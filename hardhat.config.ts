// import '@nomiclabs/hardhat-waffle'
import "@nomicfoundation/hardhat-toolbox";
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import "@nomicfoundation/hardhat-chai-matchers";

import "hardhat-gas-reporter";
import dotenv from "dotenv" ;
import { HardhatUserConfig } from "hardhat/types";
import "hardhat-deploy";
import '@nomiclabs/hardhat-etherscan'

import 'solidity-coverage'

import * as fs from 'fs'

dotenv.config();

const mnemonicFileName = process.env.MNEMONIC_FILE ?? `${process.env.HOME}/.secret/testnet-mnemonic.txt`
let mnemonic = 'test '.repeat(11) + 'junk'
if (fs.existsSync(mnemonicFileName)) { mnemonic = fs.readFileSync(mnemonicFileName, 'ascii') }

function getNetwork1 (url: string): { url: string, accounts: { mnemonic: string } } {
  return {
    url,
    accounts: { mnemonic }
  }
}

function getNetwork (name: string): { url: string, accounts: { mnemonic: string } } {
  return getNetwork1(`https://${name}.infura.io/v3/${process.env.INFURA_ID}`)
  // return getNetwork1(`wss://${name}.infura.io/ws/v3/${process.env.INFURA_ID}`)
}

const optimizedComilerSettings = {
  version: '0.8.17',
  settings: {
    optimizer: { enabled: true, runs: 1000000 },
    viaIR: true
  }
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [{
      version: '0.8.15',
      // settings: {
      //   optimizer: { enabled: true, runs: 1000000 }
      // },
      settings: {
        optimizer: { enabled: true, runs: 200 }
      }
    }],
    // overrides: {
    //   'contracts/TokamakEntryPoint.sol': optimizedComilerSettings,
    //   'contracts/factory/TokamakAccountFactory.sol': optimizedComilerSettings,
    //   'contracts/TokamakPaymaster.sol': optimizedComilerSettings
    // }
  },
  namedAccounts: {
    deployer: 0,
    addr1: 1,
    addr2: 2,
    tonAddress: {
      default: 3,
      hardhat: '0xfa956eb0c4b3e692ad5a6b2f08170ade55999aca',
      mainnet: '0x2be5e8c109e2197D077D13A82dAead6a9b3433C5',
      goerli: '0x68c1F9620aeC7F2913430aD6daC1bb16D8444F00',
      titan: '0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2',
      titangoerli: '0xfa956eb0c4b3e692ad5a6b2f08170ade55999aca',
    },
    tosAddress: {
      default: 4,
      hardhat: '0x6AF3cb766D6cd37449bfD321D961A61B0515c1BC',
      mainnet: '0x409c4D8cd5d2924b9bc5509230d16a61289c8153',
      goerli: '0x67F3bE272b1913602B191B3A68F7C238A2D81Bb9',
      titan: '0xD08a2917653d4E460893203471f0000826fb4034',
      titangoerli: '0x6AF3cb766D6cd37449bfD321D961A61B0515c1BC',
    },
    l1MessengerAddress: {
      default: 5,
      goerli: '0x2878373BA3Be0Ef2a93Ba5b3F7210D76cb222e63',
      hardhat: '0x2878373BA3Be0Ef2a93Ba5b3F7210D76cb222e63',
    },
    l2MessengerAddress: {
      default: 6,
      titan: '0x4200000000000000000000000000000000000007',
      titan_goerli: '0x4200000000000000000000000000000000000007',
      hardhat: '0x4200000000000000000000000000000000000007',
    },
    l1BridgeAddress: {
      default: 7,
      goerli: '0x7377F3D0F64d7a54Cf367193eb74a052ff8578FD',
      hardhat: '0x7377F3D0F64d7a54Cf367193eb74a052ff8578FD',
    },
    l2BridgeAddress: {
      default: 8,
      titan: '0x4200000000000000000000000000000000000010',
      titan_goerli: '0x4200000000000000000000000000000000000010',
      hardhat: '0x4200000000000000000000000000000000000010',
    },
    l1AddressManagerAddress: {
      default: 9,
      goerli: '0xEFa07e4263D511fC3a7476772e2392efFb1BDb92',
      hardhat: '0xEFa07e4263D511fC3a7476772e2392efFb1BDb92',
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: `${process.env.ETH_NODE_URI_TITAN_GOERLI}`,
        // blockNumber: 3815
        blockNumber: 3810
      },
      allowUnlimitedContractSize: false,
      deploy: ['deploy']
    },
    dev: { url: 'http://localhost:8545' },
    // github action starts localgeth service, for gas calculations
    localgeth: { url: 'http://localgeth:8545' },
    goerli: getNetwork('goerli'),
    sepolia: getNetwork('sepolia'),
    proxy: getNetwork1('http://localhost:8545'),
    titan: {
      url: `${process.env.ETH_NODE_URI_TITAN_MAINNET}`,
      accounts: [`${process.env.DEPLOYER}`],
      chainId: 55004,
      gasPrice: 250000,
      deploy: ['deploy']
    },
    titan_goerli: {
      url: `${process.env.ETH_NODE_URI_TITAN_GOERLI}`,
      accounts: [`${process.env.DEPLOYER}`],
      chainId: 5050,
      gasPrice: 250000,
      deploy: ['deploy']
    },
  },
  deterministicDeployment: (network: string) => {
    // Skip on hardhat's local network.
    if (network === "31337") {
        return undefined;
    } else {
      return {
        factory: "0x4e59b44847b379578588920ca78fbf26c0b4956c",
        deployer: "0x3fab184622dc19b6109349b94811493bf2a45362",
        funding: "10000000000000000",
        signedTx: "0x00",
      }
    }
  },
  mocha: {
    timeout: 10000
  },
  etherscan: {
    apiKey: {
      goerli: `${process.env.ETHERSCAN_API_KEY}`,
      "titangoerli":"verify",
      "titan":"verify"
    } ,
    customChains: [
      {
        network: "titangoerli",
        chainId: 5050,
        urls: {
          apiURL: "https://goerli.explorer.tokamak.network/api",
          browserURL: "https://goerli.explorer.tokamak.network"
        }
      },
      {
        network: "titan",
        chainId: 55004,
        urls: {
          apiURL: "https://explorer.titan.tokamak.network/api",
          browserURL: "https://explorer.titan.tokamak.network"
        }
      }
    ]
  },
};

// coverage chokes on the "compilers" settings
if (process.env.COVERAGE != null) {
  // @ts-ignore
  config.solidity = config.solidity.compilers[0]
}


export default config;
