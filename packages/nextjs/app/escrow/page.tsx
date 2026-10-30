"use client";

import type { NextPage } from "next";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { BuyerOrderActions, CreateOrderForm } from "~~/components/escrow";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const STATUS_LABELS = [
  "Created（待付款）",
  "Paid（已付款）",
  "Completed（已完成）",
  "Refunded（已退款）",
  "Disputed（争议中）",
] as const;

function OrderRow({ id, onUpdated }: { id: bigint; onUpdated?: () => void }) {
  const {
    data: order,
    isLoading,
    error,
    refetch: refetchOrder,
  } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "getOrder",
    args: [id],
  });

  if (isLoading) {
    return (
      <tr>
        <td>{id.toString()}</td>
        <td colSpan={7}>正在读取订单...</td>
      </tr>
    );
  }

  if (error || !order) {
    return (
      <tr>
        <td>{id.toString()}</td>
        <td colSpan={7} className="text-error">
          读取失败：{error?.message ?? "暂无订单数据"}
        </td>
      </tr>
    );
  }

  const statusIndex = Number(order.status);
  const status = STATUS_LABELS[statusIndex] ?? `未知状态（${statusIndex}）`;

  const handleUpdated = () => {
    void refetchOrder();
    onUpdated?.();
  };

  return (
    <tr>
      <td>{id.toString()}</td>
      <td className="max-w-36 break-all">{order.buyer}</td>
      <td className="max-w-36 break-all">{order.seller}</td>
      <td>{formatUnits(order.amount, 18)} ZHToken</td>
      <td>{new Date(Number(order.deadline) * 1000).toLocaleString()}</td>
      <td>{status}</td>
      <td>{order.description || "—"}</td>
      <td>
        <BuyerOrderActions
          orderId={id}
          buyer={order.buyer}
          seller={order.seller}
          amount={order.amount}
          status={statusIndex}
          onUpdated={handleUpdated}
        />
      </td>
    </tr>
  );
}

const EscrowPage: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  const {
    data: arbiterAddress,
    isLoading: arbiterLoading,
    error: arbiterError,
  } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "arbiter",
  });

  const {
    data: initialOrderCreatedEvents,
    isLoading: initialEventsLoading,
    error: initialEventsError,
    refetch: refetchInitialOrderEvents,
  } = useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderCreated",
    toBlock: 2672600n,
    blocksBatchSize: 10,
  });

  const {
    data: normalOrderCreatedEvents,
    isLoading: normalEventsLoading,
    error: normalEventsError,
    refetch: refetchNormalOrderEvents,
  } = useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderCreated",
    fromBlock: 2715949n,
    toBlock: 2715949n,
    blocksBatchSize: 10,
  });

  const {
    data: activeOrderCreatedEvents,
    isLoading: activeEventsLoading,
    error: activeEventsError,
    refetch: refetchActiveOrderEvents,
  } = useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderCreated",
    fromBlock: 2740251n,
    watch: true,
    blocksBatchSize: 10,
  });

  const orderIds = Array.from(
    new Set(
      [...(initialOrderCreatedEvents ?? []), ...(normalOrderCreatedEvents ?? []), ...(activeOrderCreatedEvents ?? [])]
        .map(event => event.args.id)
        .filter((id): id is bigint => id !== undefined),
    ),
  ).sort((a, b) => (a === b ? 0 : a > b ? -1 : 1));

  const refreshOrders = () => {
    void refetchInitialOrderEvents();
    void refetchNormalOrderEvents();
    void refetchActiveOrderEvents();
  };

  const ordersLoading = initialEventsLoading || normalEventsLoading || activeEventsLoading;
  const ordersError = initialEventsError ?? normalEventsError ?? activeEventsError;

  return (
    <main className="mx-auto w-full max-w-7xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Escrow 订单管理</h1>

      <section className="mb-6 rounded-xl bg-base-200 p-5">
        <h2 className="mb-3 text-xl font-semibold">账户与合约信息</h2>

        <p className="mb-2">
          <strong>当前钱包：</strong>
          <span className="break-all">{connectedAddress ?? "请先连接钱包"}</span>
        </p>

        <p>
          <strong>仲裁人：</strong>
          {arbiterLoading ? "正在读取..." : arbiterError ? "读取失败，请检查网络和合约配置" : arbiterAddress}
        </p>
      </section>

      <section className="mb-8">
        <CreateOrderForm onOrderCreated={refreshOrders} />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">订单列表（共 {orderIds.length} 笔）</h2>

          <button className="btn btn-primary btn-sm" onClick={refreshOrders} disabled={ordersLoading}>
            {ordersLoading ? "读取中..." : "刷新订单"}
          </button>
        </div>

        {ordersError && <p className="mb-4 text-error">读取订单事件失败：{ordersError.message}</p>}

        {ordersLoading && <p className="mb-4">正在读取 OrderCreated 历史事件，请稍候...</p>}

        {!ordersLoading && !ordersError && orderIds.length === 0 && (
          <p className="rounded-xl bg-base-200 p-5">当前合约尚无订单，请确认网络为 POTOS Testnet。</p>
        )}

        {orderIds.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>订单 ID</th>
                  <th>买家</th>
                  <th>卖家</th>
                  <th>金额</th>
                  <th>截止时间</th>
                  <th>状态</th>
                  <th>订单描述</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orderIds.map(id => (
                  <OrderRow key={id.toString()} id={id} onUpdated={refreshOrders} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
};

export default EscrowPage;
