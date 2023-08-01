import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const tonPriceETH = ethers.utils.parseEther("1000");

const deployTokamakAccountAbstraction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const deployer = await provider.getSigner()
  const from = await provider.getSigner().getAddress()
  const network = await provider.getNetwork()

  const { tonAddress, uniswapV3FactoryAddress } = await hre.getNamedAccounts();
  console.log('tonAddress', tonAddress)
  console.log('uniswapV3FactoryAddress', uniswapV3FactoryAddress)
  console.log('deployer', from)

  //====== TokamakEntryPoint ==================

  const tokamakEntryPoint_ = await hre.deployments.deploy(
    'TokamakEntryPoint', {
      from,
      args: [],
      // gasLimit: 6e6,
      log: true,
      deterministicDeployment: true
    })

  const tokamakEntryPoint = await hre.deployments.get('TokamakEntryPoint')

  const tokamakEntryPointAddress = tokamakEntryPoint.address


  //====== TokamakAccount ==================

  const TokamakAccount_ = await hre.deployments.deploy('TokamakAccount', {
    from,
    args: [tokamakEntryPointAddress],
    // gasLimit: 2e6,
    log: true,
    deterministicDeployment: true
  })
  const tokamakAccount = await hre.deployments.get('TokamakAccount')

  //====== TokamakAccountFactory ==================

  const TokamakAccountFactory_ = await hre.deployments.deploy('TokamakAccountFactory', {
      from,
      args: [tokamakEntryPointAddress, tokamakAccount.address],
      // gasLimit: 2e6,
      log: true,
      deterministicDeployment: true
    })

  //====== OracleLibrary ==================

  const OracleLibrary_ = await hre.deployments.deploy('OracleLibrary', {
    from,
    args: [],
    log: true,
    deterministicDeployment: true
  })
  const oracleLibrary = await hre.deployments.get('OracleLibrary')

  //====== TokamakOracle ==================

  const TokamakOracle_ = await hre.deployments.deploy('TokamakOracle', {
    from,
    args: [from],
    log: true,
    deterministicDeployment: true
  })
  const tokamakOracle = await hre.deployments.get('TokamakOracle')
  /*
  const tokamakOracleContract = await hre.ethers.getContractAt(
    TokamakOracle_.abi,
    tokamakOracle.address,
    deployer
    );

  let tonAddr = await tokamakOracleContract.ton()

  if (tonAddr != tonAddress) {
    await (await tokamakOracleContract.connect(deployer).initialize(
      tonAddress,
      oracleLibrary.address,
      uniswapV3FactoryAddress
      )).wait()
  }
  let fixedPriceTONPerETH = await tokamakOracleContract.fixedPriceTONPerETH()

  if (fixedPriceTONPerETH != tonPriceETH) {
    await (await tokamakOracleContract.connect(deployer).setFixedTONPrice(
      tonPriceETH
      )).wait()
  }
  */

}

export default deployTokamakAccountAbstraction
