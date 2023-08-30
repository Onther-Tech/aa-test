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

// const swaprouterComilerSettings = {
//   version: '0.7.6',
//   settings: {
//     optimizer: { enabled: true, runs: 1000000 }
//   }
// }
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
    //   'contracts/interfaces/ISwapRouter02.sol': swaprouterComilerSettings,
    // }
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
    beneficiary: 3,
    wethAddress: {
      default: 4,
      hardhat: '0x4200000000000000000000000000000000000006',
      mainnet: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      goerli: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
      titan: '0x4200000000000000000000000000000000000006',
      titangoerli: '0x4200000000000000000000000000000000000006',
    },
    tonAddress: {
      default: 5,
      hardhat: '0xfa956eb0c4b3e692ad5a6b2f08170ade55999aca',
      mainnet: '0x2be5e8c109e2197D077D13A82dAead6a9b3433C5',
      goerli: '0x68c1F9620aeC7F2913430aD6daC1bb16D8444F00',
      titan: '0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2',
      titangoerli: '0xfa956eb0c4b3e692ad5a6b2f08170ade55999aca',
    },
    tosAddress: {
      default: 6,
      hardhat: '0x6AF3cb766D6cd37449bfD321D961A61B0515c1BC',
      mainnet: '0x409c4D8cd5d2924b9bc5509230d16a61289c8153',
      goerli: '0x67F3bE272b1913602B191B3A68F7C238A2D81Bb9',
      titan: '0xD08a2917653d4E460893203471f0000826fb4034',
      titangoerli: '0x6AF3cb766D6cd37449bfD321D961A61B0515c1BC',
    },
    uniswapV3FactoryAddress: {
      default: 7,
      hardhat: '0x8C2351935011CfEccA4Ea08403F127FB782754AC',
      mainnet: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      goerli: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      titan: '0x8C2351935011CfEccA4Ea08403F127FB782754AC',
      titangoerli: '0x8C2351935011CfEccA4Ea08403F127FB782754AC',
    },
    l1MessengerAddress: {
      default: 8,
      goerli: '0x2878373BA3Be0Ef2a93Ba5b3F7210D76cb222e63',
      hardhat: '0x2878373BA3Be0Ef2a93Ba5b3F7210D76cb222e63',
    },
    l2MessengerAddress: {
      default: 9,
      titan: '0x4200000000000000000000000000000000000007',
      titan_goerli: '0x4200000000000000000000000000000000000007',
      hardhat: '0x4200000000000000000000000000000000000007',
    },
    l1BridgeAddress: {
      default: 10,
      goerli: '0x7377F3D0F64d7a54Cf367193eb74a052ff8578FD',
      hardhat: '0x7377F3D0F64d7a54Cf367193eb74a052ff8578FD',
    },
    l2BridgeAddress: {
      default: 11,
      titan: '0x4200000000000000000000000000000000000010',
      titan_goerli: '0x4200000000000000000000000000000000000010',
      hardhat: '0x4200000000000000000000000000000000000010',
    },
    l1AddressManagerAddress: {
      default: 12,
      goerli: '0xEFa07e4263D511fC3a7476772e2392efFb1BDb92',
      hardhat: '0xEFa07e4263D511fC3a7476772e2392efFb1BDb92',
    },
    tonAdminAddress: {
      default: 13,
      hardhat: '0xc1eba383D94c6021160042491A5dfaF1d82694E6',
      mainnet: '0xc1eba383D94c6021160042491A5dfaF1d82694E6',
      goerli: '0xc1eba383D94c6021160042491A5dfaF1d82694E6',
      titan: '0xc1eba383D94c6021160042491A5dfaF1d82694E6',
      titangoerli: '0xc1eba383D94c6021160042491A5dfaF1d82694E6',
    },
    quoterV2Address: {
      default: 14,
      hardhat: '0x4Fe186d98bbb99C4B2f9c8c7F82E1Bb8231CF4d6',
      mainnet: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      goerli: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      titan: '0x4Fe186d98bbb99C4B2f9c8c7F82E1Bb8231CF4d6',
      titangoerli: '0x4Fe186d98bbb99C4B2f9c8c7F82E1Bb8231CF4d6',
    },
    SwapRouter02Address: {
      default: 15,
      hardhat: '0x1316822b9d2EEF86a925b753e8854F24761dA80E',
      mainnet: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      goerli: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      titan: '0x1316822b9d2EEF86a925b753e8854F24761dA80E',
      titangoerli: '0x1316822b9d2EEF86a925b753e8854F24761dA80E',
    },
    tonHolder:
      `privatekey://${process.env.PRIVATE_KEY}`,
    user2Address:
      `privatekey://${process.env.USER2_PRIVATE_KEY}`,
    user3Address:
      `privatekey://${process.env.USER3_PRIVATE_KEY}`,
  },
  networks: {
    hardhat: {
      forking: {
        url: `${process.env.ETH_NODE_URI_TITAN_GOERLI}`,
        blockNumber: 22311
      },
      allowUnlimitedContractSize: false,
      // deploy: ['deploy']
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
      gasPrice: 1000000,
      deploy: ['deploy']
    },
    titangoerli: {
      url: `${process.env.ETH_NODE_URI_TITAN_GOERLI}`,
      accounts: [`${process.env.PRIVATE_KEY}`],
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
