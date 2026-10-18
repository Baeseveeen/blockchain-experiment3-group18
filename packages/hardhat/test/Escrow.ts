import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const AMOUNT = ethers.parseUnits("30", 18);
const INITIAL_BALANCE = ethers.parseUnits("100", 18);

async function deployFixture() {
  const [deployer, buyer, seller, arbiter, stranger] = await ethers.getSigners();

  const token = await ethers.deployContract("ZHToken");

  // 只有 deployer 是代币 owner，所以由 deployer 给 buyer mint
  await token.mint(buyer.address, INITIAL_BALANCE);

  const escrow = await ethers.deployContract("Escrow", [arbiter.address]);

  const deadline = (await time.latest()) + 3600;

  return {
    token,
    escrow,
    deployer,
    buyer,
    seller,
    arbiter,
    stranger,
    deadline,
  };
}

describe("Escrow", function () {
  it("createOrder 记录订单并发出事件", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);

    await expect(
      escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书"),
    )
      .to.emit(escrow, "OrderCreated")
      .withArgs(0, buyer.address, seller.address, await token.getAddress(), AMOUNT, deadline);

    const order = await escrow.getOrder(0);

    expect(order.buyer).to.equal(buyer.address);
    expect(order.seller).to.equal(seller.address);
    expect(order.amount).to.equal(AMOUNT);
    expect(order.status).to.equal(0n);
    expect(await escrow.orderCount()).to.equal(1n);
  });

  it("未 approve 时 deposit 失败", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);

    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");

    await expect(escrow.connect(buyer).deposit(0)).to.be.revertedWith("ZHToken: allowance exceeded");
  });

  it("approve 后 deposit 成功，代币进入 Escrow，状态变为 Paid", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);

    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");

    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);

    await expect(escrow.connect(buyer).deposit(0)).to.emit(escrow, "OrderPaid").withArgs(0);

    const order = await escrow.getOrder(0);

    expect(order.status).to.equal(1n);

    expect(await token.balanceOf(await escrow.getAddress())).to.equal(AMOUNT);

    expect(await token.allowance(buyer.address, await escrow.getAddress())).to.equal(0n);
  });

  it("非买家调用 confirm 失败", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);

    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");

    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);

    await escrow.connect(buyer).deposit(0);

    await expect(escrow.connect(seller).confirm(0)).to.be.revertedWith("Escrow: caller is not the buyer");
  });

  it("confirm 后卖家收到代币，状态变为 Completed", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);

    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");

    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);

    await escrow.connect(buyer).deposit(0);

    await expect(escrow.connect(buyer).confirm(0)).to.emit(escrow, "OrderCompleted").withArgs(0);

    const order = await escrow.getOrder(0);

    expect(order.status).to.equal(2n);

    expect(await token.balanceOf(seller.address)).to.equal(AMOUNT);

    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
  });

  it("deadline 之前 refund 失败，deadline 之后 refund 成功", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);

    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");

    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);

    await escrow.connect(buyer).deposit(0);

    await expect(escrow.connect(buyer).refund(0)).to.be.revertedWith("Escrow: deadline not reached");

    await time.increase(3601);

    await expect(escrow.connect(buyer).refund(0)).to.emit(escrow, "OrderRefunded").withArgs(0);

    const order = await escrow.getOrder(0);

    expect(order.status).to.equal(3n);

    expect(await token.balanceOf(buyer.address)).to.equal(INITIAL_BALANCE);
  });

  it("非仲裁人调用 resolve 失败", async function () {
    const { token, escrow, buyer, seller, arbiter, deadline } = await loadFixture(deployFixture);

    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "争议订单");

    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);

    await escrow.connect(buyer).deposit(0);
    await escrow.connect(seller).dispute(0);

    await expect(escrow.connect(buyer).resolve(0, false)).to.be.revertedWith("Escrow: caller is not the arbiter");

    expect(arbiter.address).to.not.equal(buyer.address);
  });

  it("dispute 后仲裁人 resolve(false) 退款给买家", async function () {
    const { token, escrow, buyer, seller, arbiter, deadline } = await loadFixture(deployFixture);

    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "争议订单");

    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);

    await escrow.connect(buyer).deposit(0);
    await escrow.connect(seller).dispute(0);

    await expect(escrow.connect(arbiter).resolve(0, false)).to.emit(escrow, "OrderResolved").withArgs(0, false);

    const order = await escrow.getOrder(0);

    expect(order.status).to.equal(3n);

    expect(await token.balanceOf(buyer.address)).to.equal(INITIAL_BALANCE);

    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
  });
});
