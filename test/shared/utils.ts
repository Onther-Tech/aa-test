import { ethers } from 'hardhat'
import bn from 'bignumber.js'

export const computedCreate2Address = (factoryAddress:string, saltHex: string, byteCode: string) => {
    return `0x${ethers.utils.keccak256(
        `0x${['ff', factoryAddress, saltHex, ethers.utils.keccak256(byteCode)]
          .map((x) => x.replace(/0x/, ''))
          .join('')}`,
      )
      .slice(-40)}`.toLowerCase()
  }

export const numberToUint256 = (value: number) => {
  const hex = value.toString(16)
  return `0x${'0'.repeat(64 - hex.length)}${hex}`
}

export const saltToHex = (salt: string | number) =>
  ethers.utils.id(salt.toString())

const FEE_SIZE = 3;

export const encodePath = (path: Array<string>, fees: Array<number>) => {
  if (path.length != fees.length + 1) {
    throw new Error("path/fee lengths do not match");
  }
  let encoded = "0x";
  for (let i = 0; i < fees.length; i++) {
    encoded += path[i].slice(2);
    encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, "0");
  }
  encoded += path[path.length - 1].slice(2);
  return encoded.toLowerCase();
};

export const FeeAmount = {
    LOWEST: 100,
    LOW: 500,
    MEDIUM: 3000,
    HIGH: 10000,
  };

export const TICK_SPACINGS = {
    [FeeAmount.LOWEST]: 1,
    [FeeAmount.LOW]: 10,
    [FeeAmount.MEDIUM]: 60,
    [FeeAmount.HIGH]: 200,
  };

export const getMinTick = (tickSpacing: number) => Math.ceil(-887272 / tickSpacing) * tickSpacing;
export const getMaxTick = (tickSpacing: number) => Math.floor(887272 / tickSpacing) * tickSpacing;

export const encodePriceSqrt = (reserve1: string, reserve0: string) => {
    return new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toFixed();
};
