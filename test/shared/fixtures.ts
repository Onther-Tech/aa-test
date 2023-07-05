import hre from 'hardhat'
import { ethers } from 'hardhat'
import {  Wallet, Signer } from 'ethers'

import { TokamakFixture } from './fixtureInterfaces'


import { TokamakAccountFactory } from '../../typechain-types/contracts/factory/TokamakAccountFactory'
import { TokamakEntryPoint } from '../../typechain-types/contracts/TokamakEntryPoint'
import { TokamakPaymaster } from '../../typechain-types/contracts/TokamakPaymaster'
// import { VerifyingPaymaster } from '../../typechain-types/contracts/VerifyingPaymaster'
import { TokamakAccount } from '../../typechain-types/contracts/TokamakAccount'
import { TestToken  } from '../../typechain-types/contracts/test/TestToken'
import { IL2StandardERC20  } from '../../typechain-types/contracts/interfaces/IL2StandardERC20'
import { TokamakOracle  } from '../../typechain-types/contracts/oracle/TokamakOracle.sol'

export const tokamakFixtures = async function (): Promise<TokamakFixture> {
    const [deployer, addr1, addr2 ] = await ethers.getSigners();
    const { tonAddress } = await hre.getNamedAccounts();

    //
    // await ethers.provider.send("hardhat_setBalance", [
    //   deployer.address,
    //   "0x8ac7230489e80000",
    // ]);

    const TokamakEntryPoint_ = await ethers.getContractFactory("TokamakEntryPoint");
    const tokamakEntryPoint = (await TokamakEntryPoint_.connect(deployer).deploy()) as TokamakEntryPoint;

    const TokamakAccount_ = await ethers.getContractFactory("TokamakAccount");
    const tokamakAccount = (await TokamakAccount_.connect(deployer).deploy(
      tokamakEntryPoint.address
    )) as TokamakAccount;


    const TokamakAccountFactory_ = await ethers.getContractFactory("TokamakAccountFactory");
    const tokamakAccountFactory = (await TokamakAccountFactory_.connect(deployer).deploy(
      tokamakEntryPoint.address,
      tokamakAccount.address
    )) as TokamakAccountFactory;

    const TokamakPaymaster_ = await ethers.getContractFactory("TokamakPaymaster");
    const tokamakPaymaster = (await TokamakPaymaster_.connect(deployer).deploy(
      tokamakEntryPoint.address
    )) as TokamakPaymaster;

    const TestToken_ = await ethers.getContractFactory("TestToken");
    const token = (await TestToken_.connect(deployer).deploy()) as TestToken;

    await (await token.connect(deployer).mint(
      deployer.address,
      ethers.utils.parseEther("10000"))).wait()

    const L2StandardERC20Abi = require("../abi/L2StandardERC20.json")
    const ton = await ethers.getContractAt(L2StandardERC20Abi.abi, tonAddress, deployer) as IL2StandardERC20;

    const TokamakOracle_ = await ethers.getContractFactory("TokamakOracle");
    const oracle = (await TokamakOracle_.connect(deployer).deploy()) as TokamakOracle;



    return {
      tokamakEntryPoint: tokamakEntryPoint,
      tokamakPaymaster: tokamakPaymaster,
      tokamakAccountFactory: tokamakAccountFactory,
      tokamakAccountImpl: tokamakAccount,
      deployer: deployer,
      addr1: addr1,
      addr2: addr2,
      token: token,
      ton: ton,
      oracle : oracle
  }
}

