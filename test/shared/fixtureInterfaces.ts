
import { Signer } from 'ethers'

import { TokamakAccountFactory } from '../../typechain-types/contracts/factory/TokamakAccountFactory'
import { TokamakEntryPoint } from '../../typechain-types/contracts/TokamakEntryPoint'
import { TokamakPaymaster } from '../../typechain-types/contracts/TokamakPaymaster'
import { TokamakAccount  } from '../../typechain-types/contracts/TokamakAccount'
import { TestToken  } from '../../typechain-types/contracts/test/TestToken'
import { IL2StandardERC20  } from '../../typechain-types/contracts/interfaces/IL2StandardERC20'
import { TokamakOracle  } from '../../typechain-types/contracts/oracle/TokamakOracle.sol'
import { OracleLibrary  } from '../../typechain-types/contracts/libraries/OracleLibrary.sol'
import { IQuoterV2  } from '../../typechain-types/contracts/interfaces/IQuoterV2'

interface TokamakFixture  {
    tokamakEntryPoint: TokamakEntryPoint,
    tokamakPaymaster: TokamakPaymaster,
    // verifyingPaymaster: VerifyingPaymaster,
    tokamakAccountFactory: TokamakAccountFactory,
    tokamakAccountImpl: TokamakAccount,
    deployer: Signer,
    addr1: Signer,
    addr2: Signer,
    beneficiary: Signer,
    token: TestToken,
    ton: IL2StandardERC20,
    tokamakOracle : TokamakOracle,
    oracleLibrary: OracleLibrary,
    uniswapV3FactoryAddress: string,
    wethAddress: string,
    quoterV2Address: string,
    SwapRouter02Address: string,
    quoterV2: IQuoterV2
}

export { TokamakFixture }
