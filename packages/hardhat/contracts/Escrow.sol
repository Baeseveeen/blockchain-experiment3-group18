// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// Escrow 需要调用 ERC20 代币合约，因此只声明需要使用的函数
interface IERC20 {
    function transfer(
        address to,
        uint256 value
    ) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);

    function balanceOf(
        address account
    ) external view returns (uint256);
}

contract Escrow {
    // 订单状态：
    // Created：已创建但未付款
    // Paid：已付款，代币在 Escrow 合约中
    // Completed：交易完成，代币已给卖家
    // Refunded：已退款，代币已退回买家
    // Disputed：订单存在争议，等待仲裁
    enum Status {
        Created,
        Paid,
        Completed,
        Refunded,
        Disputed
    }

    // 一笔订单包含的信息
    struct Order {
        address buyer;       // 买家
        address seller;      // 卖家
        address token;       // 用于交易的 ERC20 代币地址
        uint256 amount;      // 交易金额，使用最小单位
        uint256 deadline;    // 截止时间，Unix 时间戳
        Status status;       // 当前订单状态
        string description;  // 订单描述
    }

    // 仲裁人地址
    address public arbiter;

    // 当前订单数量，同时也是下一个订单的 id
    uint256 public orderCount;

    // 根据订单 id 保存订单
    mapping(uint256 => Order) private _orders;

    // 订单相关事件
    event OrderCreated(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        uint256 deadline
    );

    event OrderPaid(uint256 indexed id);
    event OrderCompleted(uint256 indexed id);
    event OrderRefunded(uint256 indexed id);
    event OrderDisputed(uint256 indexed id, address by);
    event OrderResolved(uint256 indexed id, bool sellerWins);

    // 只有仲裁人可以调用
    modifier onlyArbiter() {
        require(
            msg.sender == arbiter,
            "Escrow: caller is not the arbiter"
        );
        _;
    }

    // 只有订单买家可以调用
    modifier onlyBuyer(uint256 id) {
        require(
            msg.sender == _orders[id].buyer,
            "Escrow: caller is not the buyer"
        );
        _;
    }

    // 限制订单必须处于指定状态
    modifier inStatus(uint256 id, Status s) {
        require(
            _orders[id].status == s,
            "Escrow: wrong status"
        );
        _;
    }

    // 部署时指定仲裁人
    constructor(address _arbiter) {
        require(
            _arbiter != address(0),
            "Escrow: arbiter is the zero address"
        );

        arbiter = _arbiter;
    }

    // 查询订单信息
    function getOrder(
        uint256 id
    ) public view returns (Order memory) {
        require(
            id < orderCount,
            "Escrow: order does not exist"
        );

        return _orders[id];
    }

    // TODO 1：创建订单
    function createOrder(
        address seller,
        address token,
        uint256 amount,
        uint256 deadline,
        string memory description
    ) public returns (uint256) {
        // 卖家不能是零地址
        require(
            seller != address(0),
            "Escrow: seller is the zero address"
        );

        // 买家不能同时是卖家
        require(
            seller != msg.sender,
            "Escrow: buyer cannot be seller"
        );

        // 代币地址不能是零地址
        require(
            token != address(0),
            "Escrow: token is the zero address"
        );

        // 交易金额必须大于零
        require(
            amount > 0,
            "Escrow: amount is zero"
        );

        // 截止时间必须晚于当前区块时间
        require(
            deadline > block.timestamp,
            "Escrow: deadline in the past"
        );

        // 当前订单数量就是新订单的 id
        uint256 id = orderCount;

        // 写入订单信息，创建时状态为 Created
        _orders[id] = Order({
            buyer: msg.sender,
            seller: seller,
            token: token,
            amount: amount,
            deadline: deadline,
            status: Status.Created,
            description: description
        });

        // 订单数量加一
        orderCount += 1;

        // 发出订单创建事件
        emit OrderCreated(
            id,
            msg.sender,
            seller,
            token,
            amount,
            deadline
        );

        return id;
    }

    // TODO 2：买家付款
    function deposit(
        uint256 id
    )
        public
        onlyBuyer(id)
        inStatus(id, Status.Created)
    {
        Order storage o = _orders[id];

        // 先修改状态，再调用外部代币合约
        o.status = Status.Paid;

        // Escrow 调用代币合约的 transferFrom
        // 因此代币合约看到的 msg.sender 是 Escrow 合约
        bool success = IERC20(o.token).transferFrom(
            msg.sender,
            address(this),
            o.amount
        );

        require(
            success,
            "Escrow: transferFrom failed"
        );

        emit OrderPaid(id);
    }

    // TODO 3：买家确认收货
    function confirm(
        uint256 id
    )
        public
        onlyBuyer(id)
        inStatus(id, Status.Paid)
    {
        Order storage o = _orders[id];

        // 先修改状态
        o.status = Status.Completed;

        // 将代币从 Escrow 合约转给卖家
        bool success = IERC20(o.token).transfer(
            o.seller,
            o.amount
        );

        require(
            success,
            "Escrow: transfer failed"
        );

        emit OrderCompleted(id);
    }

    // TODO 4：超期退款
    function refund(
        uint256 id
    )
        public
        onlyBuyer(id)
        inStatus(id, Status.Paid)
    {
        Order storage o = _orders[id];

        // 当前时间必须已经超过截止时间
        require(
            block.timestamp > o.deadline,
            "Escrow: deadline not reached"
        );

        // 先修改状态
        o.status = Status.Refunded;

        // 将代币退回买家
        bool success = IERC20(o.token).transfer(
            o.buyer,
            o.amount
        );

        require(
            success,
            "Escrow: transfer failed"
        );

        emit OrderRefunded(id);
    }

    // TODO 5：发起争议
    function dispute(
        uint256 id
    )
        public
        inStatus(id, Status.Paid)
    {
        Order storage o = _orders[id];

        // 只有买家或卖家可以发起争议
        require(
            msg.sender == o.buyer ||
            msg.sender == o.seller,
            "Escrow: caller is not a party"
        );

        // 将订单状态改为 Disputed
        o.status = Status.Disputed;

        emit OrderDisputed(id, msg.sender);
    }

    // TODO 6：仲裁
    function resolve(
        uint256 id,
        bool sellerWins
    )
        public
        onlyArbiter
        inStatus(id, Status.Disputed)
    {
        Order storage o = _orders[id];

        if (sellerWins) {
            // 仲裁结果：卖家胜诉
            o.status = Status.Completed;

            bool successSeller = IERC20(o.token).transfer(
                o.seller,
                o.amount
            );

            require(
                successSeller,
                "Escrow: transfer failed"
            );
        } else {
            // 仲裁结果：买家胜诉，退款给买家
            o.status = Status.Refunded;

            bool successBuyer = IERC20(o.token).transfer(
                o.buyer,
                o.amount
            );

            require(
                successBuyer,
                "Escrow: transfer failed"
            );
        }

        emit OrderResolved(id, sellerWins);
    }
}