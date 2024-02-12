// Plugins
import "@nomicfoundation/hardhat-toolbox";
import "fhenix-hardhat-plugin";
import "fhenix-hardhat-docker";
import "hardhat-deploy";
import { HardhatUserConfig } from "hardhat/config";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

const dotenvConfigPath: string = process.env.DOTENV_CONFIG_PATH || "./.env";
dotenvConfig({ path: resolve(__dirname, dotenvConfigPath) });

// Tasks
import "./tasks";

// Ensure that we have all the environment variables we need.
const mnemonic: string | undefined = process.env.MNEMONIC;

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  // Optional: defaultNetwork is already being set to "localfhenix" by fhenix-hardhat-plugin
  defaultNetwork: "localfhenix",
  networks: {
    fhenixTestnet: {
      accounts: { mnemonic },
      chainId: 42069,
      url: "http://api.testnet.fhenix.zone:7747",
    },
  }
};

export default config;
