import { ethers } from 'hardhat'
import { expect } from 'chai'
import { formatEther, keccak256, parseEther, hexlify } from 'ethers/lib/utils'
import { BigNumber, ContractFactory, getContractFactory, getDefaultProvider, Signer, Wallet } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'

import {
  EntryPoint,
  EntryPoint__factory,
  //IERC20,
  IEntryPoint,
  SimpleAccount,
  SimpleAccountFactory__factory,
  SimpleAccount__factory,
  SimpleAccountFactory,
  UserOperationStruct
} from '@account-abstraction/contracts'

import { Runner } from './helpers/client'
import { fillAndSign } from './helpers/UserOp'
import { createAccount, createAccountOwner, deployEntryPoint } from './helpers/testutils'
import { Create2Factory } from './helpers/Create2Factory'

async function isDeployed(provider:JsonRpcProvider, addr: string): Promise<boolean> {
  return await provider.getCode(addr).then(code => code !== '0x')
}

async function getBalance(provider:JsonRpcProvider, addr: string): Promise<BigNumber> {
  return await provider.getBalance(addr)
}

async function deploySampleContract(signer: Signer): Promise<Contract> {
  const sampleContractBytecode = '0x608060405234801561001057600080fd5b50610150806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c806360fe47b11461003b5780636d4ce63c14610057575b600080fd5b610055600480360381019061005091906100c3565b610075565b005b61005f61007f565b60405161006c91906100ff565b60405180910390f35b8060008190555050565b60008054905090565b600080fd5b6000819050919050565b6100a08161008d565b81146100ab57600080fd5b50565b6000813590506100bd81610097565b92915050565b6000602082840312156100d9576100d8610088565b5b60006100e7848285016100ae565b91505092915050565b6100f98161008d565b82525050565b600060208201905061011460008301846100f0565b9291505056fea264697066735822122055173e9fba2f2d0c32e0c701afecab051c5a8060e898b8907aa2d62e4f72db6a64736f6c63430008110033'
  const sampleContractABI = `[{
    "inputs": [],
    "name": "get",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "x",
        "type": "uint256"
      }
    ],
    "name": "set",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }]`

  const factory = new ContractFactory(sampleContractABI, sampleContractBytecode, signer);
  return factory.deploy()
}

async function deployFeePaymaster(signer: Signer, client: Runner): Promise<Contract> {
  const factory = await ethers.getContractFactory('FeePaymaster', signer)
  return await factory.deploy(
    client.accountDeployer,
    'TestPaymaster',
    client.entryPointAddress,
    '0x0000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000000',
    'TEST'
  )
}

async function prepare(
  client: Runner,
  entryPoint: Contract,
  feePaymaster: Contract,
  signer: Signer,
  accountOwner: string
): Promise<void> {
  const { proxy: aAccount } = await createAccount(signer, await accountOwner, entryPoint.address)
  await feePaymaster.mint(aAccount.address, parseEther('100000000000'), {gasLimit: 500000})
  await feePaymaster.mint(client.accountApi.getAccountAddress(), parseEther('100000000000'), {gasLimit: 500000})

  await entryPoint.depositTo(feePaymaster.address, { value: parseEther('1000') })
  await feePaymaster.stake({
    value: parseEther('1000'),
    gasLimit: 100000
  })
  await feePaymaster.deposit({
    value: parseEther('1000'),
    gasLimit: 100000
  })
}

async function makeUserOp(
  feePaymaster: Contract,
  sampleContract: Contract,
  testValue: number,
  client: Runner
): Promise<UserOperationStruct> {
  const calldata = sampleContract.interface.encodeFunctionData('set', [testValue])
  const paymasterAndData = feePaymaster.address

  const {
    callData,
    callGasLimit
  } = await client.accountApi.encodeUserOpCallDataAndGasLimit({
    target: sampleContract.address,
    data: calldata
  })
  const initCode = await client.accountApi.getInitCode()
  const initGas = await client.accountApi.estimateCreationGas(initCode)
  const verificationGasLimit = BigNumber.from(await client.accountApi.getVerificationGasLimit()).add(initGas)

  const feeData = await client.accountApi.provider.getFeeData()
  const maxFeePerGas = feeData.maxFeePerGas ?? undefined
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? undefined

  let partialUserOp: any = {
    sender: client.accountApi.getAccountAddress(),
    nonce: client.accountApi.getNonce(),
    initCode,
    callData,
    callGasLimit,
    verificationGasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas
  }
  partialUserOp.paymasterAndData = feePaymaster.address
  partialUserOp.preVerificationGas = client.accountApi.getPreVerificationGas(partialUserOp)
  partialUserOp.signature = ''

  const unsignedUserOp: UserOperationStruct = {
    ...partialUserOp
  }
  const signedUserOp = await client.accountApi.signUserOp(unsignedUserOp)
  return signedUserOp
}

describe('Test', function () {
  const ENTRY_POINT = '0x1306b01bC3e4AD202612D3843387e94737673F53'
  const BUNDLER_URL = 'http://localhost:3000/rpc'

  let provider: JsonRpcProvider
  let accounts
  let signer: Signer
  let accountOwner: Wallet
  let entryPoint: Contract
  let client: Runner

  let sampleContract: Contract

  before(async function () {
    provider = getDefaultProvider('http://localhost:8545') as JsonRpcProvider
    accounts = await provider.listAccounts()
    if (accounts.length === 0) {
      console.log('fatal: no account. use --mnemonic (needed to fund account)')
      process.exit(1)
    }

    signer = provider.getSigner()

    accountOwner = new Wallet('0x'.padEnd(66, '7'))
    entryPoint = await EntryPoint__factory.connect(ENTRY_POINT, signer)

    const index = Date.now()
    client = await new Runner(provider, BUNDLER_URL, accountOwner, ENTRY_POINT, index).init(signer)
    const addr = await client.getAddress()

    const bal = await getBalance(provider, addr)

    const requiredBalance = parseEther('0.5')
    if (bal.lt(requiredBalance.div(2))) {
      await signer.sendTransaction({
        to: addr,
        value: requiredBalance.sub(bal)
      })
    }

    sampleContract = await deploySampleContract(signer)
  })

  it('SampleContract setter', async () => {
    const value1 = await sampleContract.get()
    expect(value1).to.eql(BigNumber.from(0))

    await sampleContract.set(1)

    const value2 = await sampleContract.get()
    expect(value2).to.eql(BigNumber.from(1))
  })

  it('Send a tx to bundler without paymaster', async () => {
    const testValue = 2

    const value1 = await sampleContract.get()
    expect(value1).to.not.eql(BigNumber.from(testValue))

    const data = sampleContract.interface.encodeFunctionData('set', [testValue])
    await client.runUserOp(sampleContract.address, data)

    const value2 = await sampleContract.get()
    expect(value2).to.eql(BigNumber.from(testValue))
  })

  describe('FeePaymaster', function () {
    let feePaymaster: Contract

    before(async function () {
      feePaymaster = await deployFeePaymaster(signer, client)
      await prepare(client, entryPoint, feePaymaster, signer, accountOwner.getAddress())
    })

    it('Send a tx to bundler with paymaster', async () => {
      const testValue = 3

      const value1 = await sampleContract.get()
      expect(value1).to.not.eql(BigNumber.from(testValue))

      const balanceEth1 = await getBalance(provider, await client.accountApi.getAccountAddress())
      const balanceToken1 = await feePaymaster.balanceOf(await client.accountApi.getAccountAddress())

      const signedUserOp = await makeUserOp(feePaymaster, sampleContract, testValue, client)
      const userOpHash = await client.bundlerProvider.sendUserOpToBundler(signedUserOp)

      const value2 = await sampleContract.get()
      expect(value2).to.eql(BigNumber.from(testValue))

      const balanceEth2 = await getBalance(provider, await client.accountApi.getAccountAddress())
      const balanceToken2 = await feePaymaster.balanceOf(await client.accountApi.getAccountAddress())

      expect(balanceEth2).to.eql(balanceEth1)
      expect(balanceToken2).to.not.eql(balanceToken1)
    })
  })
})
