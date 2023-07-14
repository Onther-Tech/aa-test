import * as typ from './solidityTypes'

export interface UserOperation {
  sender: typ.address
  nonce: typ.uint256
  initCode: typ.bytes
  callData: typ.bytes
  callGasLimit: typ.uint256
  verificationGasLimit: typ.uint256
  preVerificationGas: typ.uint256
  maxFeePerGas: typ.uint256
  maxPriorityFeePerGas: typ.uint256
  paymasterAndData: typ.bytes
  signature: typ.bytes
}

//API struct used by getStakeInfo and simulateValidation
export interface StakeInfo {
  stake: typ.uint256
  unstakeDelaySec: typ.uint256
}

/**
 * gas and return values during simulation
 * @param preOpGas the gas used for validation (including preValidationGas)
 * @param prefund the required prefund for this operation
 * @param sigFailed validateUserOp's (or paymaster's) signature check failed
 * @param validAfter - first timestamp this UserOp is valid (merging account and paymaster time-range)
 * @param validUntil - last timestamp this UserOp is valid (merging account and paymaster time-range)
 * @param paymasterContext returned by validatePaymasterUserOp (to be passed into postOp)
 */
export interface ReturnInfo {
  preOpGas: typ.uint256
  prefund: typ.uint256
  sigFailed: typ.bool
  validAfter: typ.uint48
  validUntil: typ.uint48
  paymasterContext: typ.bytes
}
