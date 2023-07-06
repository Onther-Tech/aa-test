
import { Signer } from 'ethers'

import { TokamakAccountFactory } from '../../typechain-types/contracts/factory/TokamakAccountFactory'
import { TokamakEntryPoint } from '../../typechain-types/contracts/TokamakEntryPoint'
import { TokamakPaymaster } from '../../typechain-types/contracts/TokamakPaymaster'
import { TokamakAccount  } from '../../typechain-types/contracts/TokamakAccount'
import { TestToken  } from '../../typechain-types/contracts/test/TestToken'
import { IL2StandardERC20  } from '../../typechain-types/contracts/interfaces/IL2StandardERC20'
import { TokamakOracle  } from '../../typechain-types/contracts/oracle/TokamakOracle.sol'
import { OracleLibrary  } from '../../typechain-types/contracts/libraries/OracleLibrary.sol'

interface TokamakFixture  {
    tokamakEntryPoint: TokamakEntryPoint,
    tokamakPaymaster: TokamakPaymaster,
    // verifyingPaymaster: VerifyingPaymaster,
    tokamakAccountFactory: TokamakAccountFactory,
    tokamakAccountImpl: TokamakAccount,
    deployer: Signer,
    addr1: Signer,
    addr2: Signer,
    token: TestToken,
    ton: IL2StandardERC20,
    tokamakOracle : TokamakOracle,
    oracleLibrary: OracleLibrary,
    uniswapV3FactoryAddress: string
}

export { TokamakFixture }
