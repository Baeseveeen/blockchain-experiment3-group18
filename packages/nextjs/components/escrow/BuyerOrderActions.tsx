"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type BuyerOrderActionsProps = {
  orderId: bigint;
  buyer: string;
  seller: string;
  amount: bigint;
  status: number;
  onUpdated?: () => void;
};

type PaymentStep = "idle" | "approving" | "depositing";

export const BuyerOrderActions = ({ orderId, buyer, seller, amount, status, onUpdated }: BuyerOrderActionsProps) => {
  const { address: connectedAddress } = useAccount();
  const [paymentStep, setPaymentStep] = useState<PaymentStep>("idle");

  const { data: escrowContract, isLoading: isEscrowLoading } = useDeployedContractInfo({
    contractName: "Escrow",
  });

  const { writeContractAsync: writeTokenAsync, isMining: isTokenMining } = useScaffoldWriteContract({
    contractName: "ZHToken",
  });

  const { writeContractAsync: writeEscrowAsync, isMining: isEscrowMining } = useScaffoldWriteContract({
    contractName: "Escrow",
  });

  const { data: arbiterAddress, isLoading: isArbiterLoading } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "arbiter",
  });

  const isBuyer = connectedAddress?.toLowerCase() === buyer.toLowerCase();
  const isSeller = connectedAddress?.toLowerCase() === seller.toLowerCase();
  const isArbiter = connectedAddress?.toLowerCase() === arbiterAddress?.toLowerCase();
  const isBusy = paymentStep !== "idle" || isTokenMining || isEscrowMining;

  const handlePay = async () => {
    if (!isBuyer) {
      notification.error("只有订单买家可以付款");
      return;
    }

    if (status !== 0) {
      notification.error("只有 Created 状态的订单可以付款");
      return;
    }

    if (!escrowContract) {
      notification.error("Escrow 合约信息尚未加载");
      return;
    }

    try {
      setPaymentStep("approving");

      const approveHash = await writeTokenAsync({
        functionName: "approve",
        args: [escrowContract.address, amount],
      });

      if (!approveHash) return;

      setPaymentStep("depositing");

      const depositHash = await writeEscrowAsync({
        functionName: "deposit",
        args: [orderId],
      });

      if (!depositHash) return;

      notification.success("付款成功，订单已进入 Paid 状态");
      onUpdated?.();
    } catch (error) {
      console.error("Approve or deposit failed:", error);
      notification.error("付款失败，请检查代币余额、授权交易或钱包状态");
    } finally {
      setPaymentStep("idle");
    }
  };

  const handleConfirm = async () => {
    if (!isBuyer) {
      notification.error("只有订单买家可以确认收货");
      return;
    }

    if (status !== 1) {
      notification.error("只有 Paid 状态的订单可以确认收货");
      return;
    }

    try {
      const confirmHash = await writeEscrowAsync({
        functionName: "confirm",
        args: [orderId],
      });

      if (!confirmHash) return;

      notification.success("确认收货成功，订单已完成");
      onUpdated?.();
    } catch (error) {
      console.error("Confirm order failed:", error);
      notification.error("确认收货失败，请检查订单状态和当前钱包");
    }
  };

  const handleDispute = async () => {
    if (!isBuyer && !isSeller) {
      notification.error("只有订单买家或卖家可以发起争议");
      return;
    }

    if (status !== 1) {
      notification.error("只有 Paid 状态的订单可以发起争议");
      return;
    }

    try {
      const disputeHash = await writeEscrowAsync({
        functionName: "dispute",
        args: [orderId],
      });

      if (!disputeHash) return;

      notification.success("争议已发起，等待仲裁人处理");
      onUpdated?.();
    } catch (error) {
      console.error("Dispute order failed:", error);
      notification.error("发起争议失败，请检查订单状态和当前钱包");
    }
  };

  const handleResolve = async (sellerWins: boolean) => {
    if (!isArbiter) {
      notification.error("只有仲裁人可以处理争议");
      return;
    }

    if (status !== 4) {
      notification.error("只有 Disputed 状态的订单可以仲裁");
      return;
    }

    try {
      const resolveHash = await writeEscrowAsync({
        functionName: "resolve",
        args: [orderId, sellerWins],
      });

      if (!resolveHash) return;

      notification.success(sellerWins ? "仲裁完成：卖家胜诉" : "仲裁完成：买家胜诉并退款");
      onUpdated?.();
    } catch (error) {
      console.error("Resolve order failed:", error);
      notification.error("仲裁失败，请检查订单状态和当前钱包");
    }
  };

  if (!isBuyer && !isSeller && !isArbiter) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {status === 0 && isBuyer && (
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={handlePay}
          disabled={isBusy || isEscrowLoading}
        >
          {paymentStep === "approving" && (
            <>
              <span className="loading loading-spinner loading-xs" />第 1/2 步：授权代币
            </>
          )}
          {paymentStep === "depositing" && (
            <>
              <span className="loading loading-spinner loading-xs" />第 2/2 步：存入托管
            </>
          )}
          {paymentStep === "idle" && "一键付款"}
        </button>
      )}

      {status === 1 && isBuyer && (
        <button className="btn btn-success btn-sm" type="button" onClick={handleConfirm} disabled={isBusy}>
          确认收货
        </button>
      )}

      {status === 1 && (isBuyer || isSeller) && (
        <button className="btn btn-warning btn-sm" type="button" onClick={handleDispute} disabled={isBusy}>
          {isEscrowMining ? <span className="loading loading-spinner loading-xs" /> : null}
          发起争议
        </button>
      )}

      {status === 4 && isArbiter && (
        <>
          <button
            className="btn btn-success btn-sm"
            type="button"
            onClick={() => void handleResolve(true)}
            disabled={isBusy || isArbiterLoading}
          >
            判卖家胜诉
          </button>
          <button
            className="btn btn-error btn-sm"
            type="button"
            onClick={() => void handleResolve(false)}
            disabled={isBusy || isArbiterLoading}
          >
            判买家胜诉
          </button>
        </>
      )}
    </div>
  );
};
