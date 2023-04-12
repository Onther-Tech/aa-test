import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployFeePaymaster: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()

  const entrypoint = '0x56D3a032C1ddD051BB4a8A75f3A8D9D7e802CD1d'
  const accountFactory = '0xd8959dC38DF67E38A8683c18Dd79a2315ED16F81'
  const ret = await hre.deployments.deploy(
    'FeePaymaster', {
      from,
      args: [
        entrypoint,
        'TestPaymaster',
        accountFactory,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        'TEST'
      ],
      gasLimit: 1e7,
      log: true,
      deterministicDeployment: true
    })
  console.log('FeePaymaster address:', ret.address)
}

export default deployFeePaymaster
