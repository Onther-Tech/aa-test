import { expect } from './shared/expect'
import { ethers, network } from 'hardhat'

import { Signer } from 'ethers'
import { tokamakFixtures } from './shared/fixtures'
import { TokamakFixture } from './shared/fixtureInterfaces'

describe('1.TokamakAccountFactory.test', () => {
    let deployer: Signer, addr1: Signer, addr2:Signer;
    let deployed: TokamakFixture

    before('create fixture loader', async () => {
        deployed = await tokamakFixtures()
        deployer = deployed.deployer;
        addr1 = deployed.addr1;
        addr2 = deployed.addr2;

        // console.log('tokamakAccountFactory', deployed.tokamakAccountFactory)
    })

    describe('# createAccount ', () => {

        it('anyone can make TokamakAccount', async () => {

            let accountAddress = await deployed.tokamakAccountFactory.getAddress(addr1.address, 0)
            expect(await ethers.provider.getCode(accountAddress)).to.be.equal('0x')

            const topic = deployed.tokamakAccountFactory.interface.getEventTopic('CreatedAccount');
            const receipt = await (await deployed.tokamakAccountFactory["createAccount(address,uint256)"](addr1.address, 0)).wait()
            const log = receipt.logs.find(x => x.topics.indexOf(topic) >= 0);
            const deployedEvent = deployed.tokamakAccountFactory.interface.parseLog(log);

            expect(deployedEvent.args.account).to.be.eq(accountAddress)
            expect(await ethers.provider.getCode(accountAddress)).to.be.not.equal('0x')
            expect(deployedEvent.args.account).to.be.eq(accountAddress)

        });

        it('If tokamakAccount is already created, createAccount function returns the address of tokamakAccount.', async () => {
            let accountAddress = await deployed.tokamakAccountFactory.getAddress(addr1.address, 0)
            expect(await ethers.provider.getCode(accountAddress)).to.be.not.equal('0x')

            const topic = deployed.tokamakAccountFactory.interface.getEventTopic('CreatedAccount');
            const receipt = await (await deployed.tokamakAccountFactory["createAccount(address,uint256)"](addr1.address, 0)).wait()
            const log = receipt.logs.find(x => x.topics.indexOf(topic) >= 0);
            expect(log).to.be.eq(undefined)

        });

    });

});

