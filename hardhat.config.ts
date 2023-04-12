import { HardhatUserConfig } from "hardhat/config";
import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'

const config: HardhatUserConfig = {
  networks: {
    local: {
      url: 'http://127.0.0.1:8545'
    }
  },
  solidity: "0.8.17",
};

export default config;
