import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployTokamakAccountAbstraction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider

  const from = await provider.getSigner().getAddress()
  const network = await provider.getNetwork()

  const tokamakEntryPoint_ = await hre.deployments.deploy(
    'TokamakEntryPoint', {
      from,
      args: [],
      gasLimit: 6e6,
      log: true,
      deterministicDeployment: true
    })

  const tokamakEntryPoint = await hre.deployments.get('TokamakEntryPoint')

  const tokamakEntryPointAddress = tokamakEntryPoint.address

  const TokamakAccount_ = await hre.deployments.deploy('TokamakAccount', {
    from,
    args: [tokamakEntryPointAddress],
    gasLimit: 2e6,
    log: true,
    deterministicDeployment: true
  })

  const TokamakAccountFactory_ = await hre.deployments.deploy('TokamakAccountFactory', {
      from,
      args: [tokamakEntryPointAddress, TokamakAccount_.address],
      gasLimit: 2e6,
      log: true,
      deterministicDeployment: true
    })

  const TokamakPaymaster_ = await hre.deployments.deploy('TokamakPaymaster', {
    from,
    args: [tokamakEntryPointAddress],
    log: true,
    deterministicDeployment: true
  })
}

export default deployTokamakAccountAbstraction
