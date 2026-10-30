import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const VICTIM_DEPOSIT = ethers.parseEther("0.002");
const ATTACK_DEPOSIT = ethers.parseEther("0.001");

async function deployChallengeFixture() {
  const [, victim, attackerOwner] = await ethers.getSigners();

  const vulnerableVault = await ethers.deployContract("VulnerableVault");
  const vulnerableAttacker = await ethers.deployContract("ReentrancyAttacker", [await vulnerableVault.getAddress()]);

  const fixedVault = await ethers.deployContract("FixedVault");
  const fixedAttacker = await ethers.deployContract("ReentrancyAttacker", [await fixedVault.getAddress()]);

  return { victim, attackerOwner, vulnerableVault, vulnerableAttacker, fixedVault, fixedAttacker };
}

describe("Reentrancy challenge", function () {
  it("drains VulnerableVault through repeated withdraw calls", async function () {
    const { victim, attackerOwner, vulnerableVault, vulnerableAttacker } = await loadFixture(deployChallengeFixture);

    await vulnerableVault.connect(victim).deposit({ value: VICTIM_DEPOSIT });
    await vulnerableAttacker.connect(attackerOwner).attack({ value: ATTACK_DEPOSIT });

    expect(await vulnerableVault.vaultBalance()).to.equal(0n);
    expect(await vulnerableAttacker.attackerBalance()).to.equal(VICTIM_DEPOSIT + ATTACK_DEPOSIT);
    expect(await vulnerableAttacker.reentryCount()).to.equal(2n);
  });

  it("reverts the same attack against FixedVault and preserves victim funds", async function () {
    const { victim, attackerOwner, fixedVault, fixedAttacker } = await loadFixture(deployChallengeFixture);

    await fixedVault.connect(victim).deposit({ value: VICTIM_DEPOSIT });

    await expect(fixedAttacker.connect(attackerOwner).attack({ value: ATTACK_DEPOSIT })).to.be.revertedWith(
      "Vault: send failed",
    );

    expect(await fixedVault.vaultBalance()).to.equal(VICTIM_DEPOSIT);
    expect(await fixedAttacker.attackerBalance()).to.equal(0n);
    expect(await fixedAttacker.reentryCount()).to.equal(0n);
  });
});
