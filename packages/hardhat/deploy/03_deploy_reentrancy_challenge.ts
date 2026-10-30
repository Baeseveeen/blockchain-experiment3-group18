import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployReentrancyChallenge: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const vulnerableVault = await deploy("VulnerableVault", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  await deploy("VulnerableVaultAttacker", {
    contract: "ReentrancyAttacker",
    from: deployer,
    args: [vulnerableVault.address],
    log: true,
    autoMine: true,
  });

  const fixedVault = await deploy("FixedVault", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  await deploy("FixedVaultAttacker", {
    contract: "ReentrancyAttacker",
    from: deployer,
    args: [fixedVault.address],
    log: true,
    autoMine: true,
  });
};

export default deployReentrancyChallenge;

deployReentrancyChallenge.tags = ["ReentrancyChallenge"];
