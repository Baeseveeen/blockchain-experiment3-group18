"use client";

import { FormEvent, useState } from "react";
import { Address, isAddress, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { AddressInput } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type CreateOrderFormProps = {
  onOrderCreated?: () => void;
};

export const CreateOrderForm = ({ onOrderCreated }: CreateOrderFormProps) => {
  const { address: connectedAddress } = useAccount();

  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState("10");
  const [deadlineMinutes, setDeadlineMinutes] = useState("30");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: tokenContract, isLoading: isTokenLoading } = useDeployedContractInfo({
    contractName: "ZHToken",
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "Escrow",
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!connectedAddress) {
      notification.error("请先连接钱包");
      return;
    }

    if (!isAddress(seller)) {
      notification.error("请输入正确的卖家地址");
      return;
    }

    if (seller.toLowerCase() === connectedAddress.toLowerCase()) {
      notification.error("买家和卖家不能是同一个地址");
      return;
    }

    if (!tokenContract) {
      notification.error("ZHToken 合约信息尚未加载");
      return;
    }

    if (!description.trim()) {
      notification.error("请输入订单说明");
      return;
    }

    const minutes = Number(deadlineMinutes);

    if (!Number.isFinite(minutes) || minutes <= 0) {
      notification.error("截止时间必须大于 0 分钟");
      return;
    }

    let amountWei: bigint;

    try {
      amountWei = parseUnits(amount, 18);
    } catch {
      notification.error("请输入正确的代币数量");
      return;
    }

    if (amountWei <= 0n) {
      notification.error("代币数量必须大于 0");
      return;
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + Math.floor(minutes * 60));

    try {
      setIsSubmitting(true);

      const transactionHash = await writeContractAsync({
        functionName: "createOrder",
        args: [seller as Address, tokenContract.address, amountWei, deadline, description.trim()],
      });

      if (!transactionHash) return;

      notification.success("订单创建成功");
      setSeller("");
      setAmount("10");
      setDeadlineMinutes("30");
      setDescription("");
      onOrderCreated?.();
    } catch (error) {
      console.error("Create order failed:", error);
      notification.error("创建订单失败，请检查钱包或交易参数");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || isMining;

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-4 rounded-2xl bg-base-100 p-6 shadow-lg">
      <div>
        <h2 className="text-2xl font-bold">创建托管订单</h2>
        <p className="mt-1 text-sm opacity-70">创建后由买家授权代币并存入 Escrow 合约</p>
      </div>

      <label className="form-control w-full">
        <span className="mb-2 font-medium">卖家地址</span>
        <AddressInput name="seller" placeholder="0x..." value={seller} onChange={setSeller} disabled={isBusy} />
      </label>

      <label className="form-control w-full">
        <span className="mb-2 font-medium">代币数量</span>
        <input
          className="input input-bordered w-full"
          type="number"
          min="0"
          step="0.000000000000000001"
          value={amount}
          onChange={event => setAmount(event.target.value)}
          disabled={isBusy}
          placeholder="例如：10"
        />
      </label>

      <label className="form-control w-full">
        <span className="mb-2 font-medium">多少分钟后到期</span>
        <input
          className="input input-bordered w-full"
          type="number"
          min="1"
          step="1"
          value={deadlineMinutes}
          onChange={event => setDeadlineMinutes(event.target.value)}
          disabled={isBusy}
          placeholder="例如：30"
        />
      </label>

      <label className="form-control w-full">
        <span className="mb-2 font-medium">订单说明</span>
        <textarea
          className="textarea textarea-bordered min-h-24 w-full"
          value={description}
          onChange={event => setDescription(event.target.value)}
          disabled={isBusy}
          placeholder="例如：Group18 route B order"
        />
      </label>

      <div className="rounded-xl bg-base-200 p-3 text-sm">
        <div className="font-medium">交易代币</div>
        <div className="break-all opacity-75">
          {isTokenLoading ? "正在读取合约配置……" : (tokenContract?.address ?? "ZHToken 配置不可用")}
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={isBusy || isTokenLoading || !tokenContract}>
        {isBusy ? (
          <>
            <span className="loading loading-spinner loading-sm" />
            等待交易确认
          </>
        ) : (
          "创建订单"
        )}
      </button>
    </form>
  );
};
