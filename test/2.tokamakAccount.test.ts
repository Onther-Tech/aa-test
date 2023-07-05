import { expect } from './shared/expect'
import { ethers, network } from 'hardhat'

import { Signer } from 'ethers'
import { tokamakFixtures } from './shared/fixtures'
import { TokamakFixture } from './shared/fixtureInterfaces'
import TokamakAccount from '../artifacts/contracts/TokamakAccount.sol/TokamakAccount.json'
// import { UserOperation } from './UserOperation'


describe('2.TokamakAccount.test', () => {
    let deployer: Signer, addr1: Signer, addr2:Signer;
    let deployed: TokamakFixture
    let tokamakAccount: any;
    let accountOwnerAddress: string;

    const globalUnstakeDelaySec = 2
    const paymasterStake = ethers.utils.parseEther('2')

    before('create fixture loader', async () => {
        deployed = await tokamakFixtures()
        deployer = deployed.deployer;
        addr1 = deployed.addr1;
        addr2 = deployed.addr2;
    })

    it('tokamakAccountFactory can make TokamakAccount', async () => {
        accountOwnerAddress = await deployed.tokamakAccountFactory.getAddress(addr1.address, 0)
        expect(await ethers.provider.getCode(accountOwnerAddress)).to.be.equal('0x')

        const topic = deployed.tokamakAccountFactory.interface.getEventTopic('CreatedAccount');
        const receipt = await (await deployed.tokamakAccountFactory["createAccount(address,uint256)"](addr1.address, 0)).wait()
        const log = receipt.logs.find(x => x.topics.indexOf(topic) >= 0);
        const deployedEvent = deployed.tokamakAccountFactory.interface.parseLog(log);

        expect(deployedEvent.args.account).to.be.eq(accountOwnerAddress)
        expect(await ethers.provider.getCode(accountOwnerAddress)).to.be.not.equal('0x')
        expect(deployedEvent.args.account).to.be.eq(accountOwnerAddress)

    });

    it('owner function returns owner of TokamakAccount', async () => {
        tokamakAccount = await ethers.getContractAt(TokamakAccount.abi, accountOwnerAddress, addr1)
        expect(await tokamakAccount.owner()).to.be.eq(addr1.address)
    });

    it('entryPoint', async () => {
        expect(await tokamakAccount.entryPoint()).to.be.eq(deployed.tokamakEntryPoint.address)
    });

    it('initialize : revert ', async () => {
        await expect(tokamakAccount.initialize(addr1.address)).to.be.rejectedWith('Initializable: contract is already initialized')
    })

    it('addDeposit ', async () => {

        expect(await tokamakAccount.getDeposit()).to.be.eq(ethers.constants.Zero)
        await (await tokamakAccount.addDeposit({value: ethers.utils.parseEther("2")})).wait()
        expect(await tokamakAccount.getDeposit()).to.be.eq(ethers.utils.parseEther("2"))

    });

    it('withdrawDepositTo : revert ', async () => {
        let amount = ethers.utils.parseEther("1");
        let balance = await tokamakAccount.getDeposit();
        let addr2Balance = await addr2.getBalance();

        await expect(
            tokamakAccount.connect(addr2).withdrawDepositTo(addr2.address, amount)).
            to.be.revertedWith("only owner")
        // expect(await tokamakAccount.getDeposit()).to.be.eq(balance.sub(amount))
        // expect(await addr2.getBalance()).to.be.eq(addr2Balance.add(amount))

    });

    it('withdrawDepositTo ', async () => {
        let amount = ethers.utils.parseEther("1");
        let balance = await tokamakAccount.getDeposit();
        let addr2Balance = await addr2.getBalance();

        await (await tokamakAccount.withdrawDepositTo(addr2.address, amount)).wait()
        expect(await tokamakAccount.getDeposit()).to.be.eq(balance.sub(amount))
        expect(await addr2.getBalance()).to.be.eq(addr2Balance.add(amount))

    });

    it('execute : revert ', async () => {
        let amount = ethers.utils.parseEther("100");

        // transfer 100 ton to tokamakAccount
        await deployed.token.connect(deployer).transfer(tokamakAccount.address, amount)

        const func = deployed.token.interface.encodeFunctionData("approve", [addr2.address, amount]);

        // tokamakAccount approve addr2 to spend 100 ton
        await expect(
            tokamakAccount.connect(addr2).execute(
                deployed.token.address,
                ethers.constants.Zero,
                func
            )).to.be.revertedWith("account: not Owner or EntryPoint");

    });

    it('execute ', async () => {
        let amount = ethers.utils.parseEther("100");

        // transfer 100 ton to tokamakAccount
        await deployed.token.connect(deployer).transfer(tokamakAccount.address, amount)

        const func = deployed.token.interface.encodeFunctionData("approve", [addr2.address, amount]);

        // tokamakAccount approve addr2 to spend 100 ton
        await tokamakAccount.connect(addr1).execute(
                deployed.token.address,
                ethers.constants.Zero,
                func
            );
    });

    it('executeBatch ', async () => {
        let amount = ethers.utils.parseEther("50");
        let OneAddress = '0x0000000000000000000000000000000000000001';
        let balance1 = await deployed.token.balanceOf(addr2.address)
        let balance2 = await deployed.token.balanceOf(OneAddress)
        expect(balance1).to.be.eq(ethers.constants.Zero);
        expect(balance2).to.be.eq(ethers.constants.Zero);

        const func1 = deployed.token.interface.encodeFunctionData("transfer", [addr2.address, amount]);
        const func2 = deployed.token.interface.encodeFunctionData("transfer", [OneAddress, amount]);

        // tokamakAccount approve addr2 to spend 100 ton
        await (await tokamakAccount.connect(addr1).executeBatch(
            [deployed.token.address, deployed.token.address], [func1, func2]
            )).wait();

        expect(await deployed.token.balanceOf(addr2.address)).to.be.eq(amount);
        expect(await deployed.token.balanceOf(OneAddress)).to.be.eq(amount);
    });
     /*
    it('getNonce ', async () => {
        let nonce = await tokamakAccount.getNonce()
        console.log('nonce', nonce)
    });

    it('validateUserOp ', async () => {
        UserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds

        const userOp: UserOperation = {
            sender: tokamakAccount.address,
            nonce: await entryPoint.getNonce(tokamakAccount.address, 0),
            signature: defaultAbiCoder.encode(['uint256'], [block.baseFeePerGas]),
            initCode: '0x',
            callData: '0x',
            callGasLimit: '0x' + 1e5.toString(16),
            verificationGasLimit: '0x' + 1e5.toString(16),
            preVerificationGas: '0x' + 1e5.toString(16),
            // we need maxFeeperGas > block.basefee + maxPriorityFeePerGas so requiredPrefund onchain is basefee + maxPriorityFeePerGas
            maxFeePerGas: block.baseFeePerGas.mul(3),
            maxPriorityFeePerGas: block.baseFeePerGas,
            paymasterAndData: '0x'
        }
        console.log('nonce', nonce)

    });
    */
});

