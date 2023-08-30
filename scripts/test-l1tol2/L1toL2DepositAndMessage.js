
const hre = require("hardhat");
const { ethers } = require("hardhat");
require('dotenv').config()

let accounts, account, provider;

// goerli
let l1_TON_Address = "0x68c1F9620aeC7F2913430aD6daC1bb16D8444F00";
let l1_addressManager = "0xEFa07e4263D511fC3a7476772e2392efFb1BDb92";
let l1toL2DepositAndMessage_Address = "0x7f9676Bb813f377A5e59Bb5774F58199D9772BAA";
let libMessengerAddress = "0x7Ce2d12686dE696B9b4e67CB04E31D1F51d3b589";

// titangoerli
let l2_TON_Address = "0xFa956eB0c4b3E692aD5a6B2f08170aDE55999ACa";
let paymaster = "0xF33C5E2ABE4c052783AAed527390A77FAD5841FA";
let l2PaymasterDeposit_Address = "0x8a664F47338419AA45859aE763dc4EEe61886b21";

const L1toL2DepositAndMessageJson = require("../../artifacts/contracts/L1/L1toL2DepositAndMessage.sol/L1toL2DepositAndMessage.json")
const L2PaymasterDepositJson = require("../../artifacts/contracts/L2/L2PaymasterDeposit.sol/L2PaymasterDeposit.json")
const TonJson = require("../abis/TON.json")

async function main() {
    [account] = await ethers.getSigners();

    let accountAddress = await account.getAddress();
    console.log('accounts', accountAddress)


  //==== L1toL2Message =================================
    // const L1toL2DepositAndMessage_ = await ethers.getContractFactory("L1toL2DepositAndMessage", {
    //     libraries: { LibMessenger: libMessengerAddress }
    // });
    // const l1toL2DepositAndMessage = await L1toL2DepositAndMessage_.deploy(l1_TON_Address);
    // await l1toL2DepositAndMessage.deployed();
    // console.log('L1toL2DepositAndMessage' , l1toL2DepositAndMessage.address)

    // let l1toL2MessageContract = await ethers.getContractAt(
    //     L1toL2DepositAndMessageJson.abi,
    //     l1toL2DepositAndMessage_Address,
    //     account
    // );

    let L2PaymasterDepositContract = await ethers.getContractAt(
        L2PaymasterDepositJson.abi,
        l2PaymasterDeposit_Address,
        account
    );

    let tonContract = await ethers.getContractAt(
        TonJson.abi,
        l1_TON_Address,
        account
    );

    let amount = ethers.utils.parseEther("1")

    let callData = await L2PaymasterDepositContract.interface.encodeFunctionData(
        "addDepositFor",
        [   l2_TON_Address,
            account.address,
            amount
        ]
    )

    const data1 = ethers.utils.solidityPack(
        ["address","address","address","address","uint32","uint32","bytes"],
        [
            l1_addressManager,
            l1_TON_Address,
            l2_TON_Address,
            l2PaymasterDeposit_Address,
            2000000,
            2000000,
            callData
        ]
        );


    let tx = await tonContract.connect(account).approveAndCall(
        l1toL2DepositAndMessage_Address,
        amount,
        data1);

    console.log(tx)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
