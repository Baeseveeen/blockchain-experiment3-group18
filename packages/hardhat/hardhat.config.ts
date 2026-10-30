import * as dotenv from "dotenv";
dotenv.config();
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomicfoundation/hardhat-verify";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import { task } from "hardhat/config";
import generateTsAbis from "./scripts/generateTsAbis";

// If not set, it uses ours Alchemy's default API key.
// You can get your own at https://dashboard.alchemyapi.io
const providerApiKey = process.env.ALCHEMY_API_KEY || "oKxs-03sij-U_N0iOlrSsZFr29-IqbuF";
// Live-network private keys are injected only at runtime by deployWithPK.
// Never store a plaintext private key in this repository.
const deployerPrivateKey = process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY;
const liveNetworkAccounts = deployerPrivateKey ? [deployerPrivateKey] : [];
// If not set, it uses our block explorers default API keys.
const etherscanApiKey = process.env.ETHERSCAN_V2_API_KEY || "DNXJA8RX2Q3VZ4URQIWP7Z68CJXQZSC6AW";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            // https://docs.soliditylang.org/en/latest/using-the-compiler.html#optimizer-options
            runs: 200,
          },
        },
      },
    ],
  },
  defaultNetwork: "potos_testnet",
  namedAccounts: {
    deployer: {
      // By default, it will take the first Hardhat account as the deployer
      default: 0,
    },
  },
  networks: {
    // View the networks that are pre-configured.
    // If the network you are looking for is not here you can add new network settings
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${providerApiKey}`,
        enabled: process.env.MAINNET_FORKING_ENABLED === "true",
      },
    },
    potos_testnet: {
      allowUnlimitedContractSize: true,
      url: `https://rpc-testnet.potos.hk`,
      chainId: 60600,
      accounts: liveNetworkAccounts,
    },
    mainnet: {
      url: "https://mainnet.rpc.buidlguidl.com",
      accounts: liveNetworkAccounts,
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: liveNetworkAccounts,
    },
    arbitrum: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: liveNetworkAccounts,
    },
    arbitrumSepolia: {
      url: `https://arb-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: liveNetworkAccounts,
    },
    optimism: {
      url: `https://opt-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: liveNetworkAccounts,
    },
    optimismSepolia: {
      url: `https://opt-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: liveNetworkAccounts,
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: liveNetworkAccounts,
    },
    polygonAmoy: {
      url: `https://polygon-amoy.g.alchemy.com/v2/${providerApiKey}`,
      accounts: liveNetworkAccounts,
    },
    polygonZkEvm: {
      url: `https://polygonzkevm-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: liveNetworkAccounts,
    },
    polygonZkEvmCardona: {
      url: `https://polygonzkevm-cardona.g.alchemy.com/v2/${providerApiKey}`,
      accounts: liveNetworkAccounts,
    },
    gnosis: {
      url: "https://rpc.gnosischain.com",
      accounts: liveNetworkAccounts,
    },
    chiado: {
      url: "https://rpc.chiadochain.net",
      accounts: liveNetworkAccounts,
    },
    base: {
      url: "https://mainnet.base.org",
      accounts: liveNetworkAccounts,
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: liveNetworkAccounts,
    },
    scrollSepolia: {
      url: "https://sepolia-rpc.scroll.io",
      accounts: liveNetworkAccounts,
    },
    scroll: {
      url: "https://rpc.scroll.io",
      accounts: liveNetworkAccounts,
    },
    celo: {
      url: "https://forno.celo.org",
      accounts: liveNetworkAccounts,
    },
    celoSepolia: {
      url: "https://forno.celo-sepolia.celo-testnet.org/",
      accounts: liveNetworkAccounts,
    },
  },
  // Configuration for harhdat-verify plugin
  etherscan: {
    apiKey: etherscanApiKey,
  },
  // Configuration for etherscan-verify from hardhat-deploy plugin
  verify: {
    etherscan: {
      apiKey: etherscanApiKey,
    },
  },
  sourcify: {
    enabled: false,
  },
};

// Extend the deploy task
task("deploy").setAction(async (args, hre, runSuper) => {
  // Run the original deploy task
  await runSuper(args);
  // Force run the generateTsAbis script
  await generateTsAbis(hre);
});

export default config;
