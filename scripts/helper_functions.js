const fs = require('fs');
const ethers = require('ethers');
const hre = require('hardhat');
const chainName = hre.network.name;
const ERC20PresetFixedSupplyJson = require('./abis/ERC20PresetFixedSupply.json');
const ERC20PresetFixedSupplyDecimal6TestJson = require('./abis1/ERC20PresetFixedSupplyDecimal6Test.sol/ERC20PresetFixedSupplyDecimal6Test.json');
const WETH9Json = require('./abis/WETH9.json');

const deployContract = async () => {
  let contractAddresses = JSON.parse(
    fs
      .readFileSync(__dirname + `/../deployed.uniswap.${chainName}.json`)
      .toString()
  );
  if (chainName === 'localhost') {
    contractAddresses = JSON.parse(
      fs
        .readFileSync(
          __dirname + `/../deployed.uniswap.${chainName}.json`
        )
        .toString()
    );
    if (contractAddresses['TON'] === undefined) {
      console.log(true);
      const accounts = await hre.ethers.getSigners();
      const deployer = accounts[0];
      let contractFactory = new ethers.ContractFactory(
        ERC20PresetFixedSupplyJson.abi,
        ERC20PresetFixedSupplyJson.bytecode,
        deployer
      );
      const TONcontract = await contractFactory.deploy(
        'TON',
        'TON',
        ethers.utils.parseEther('10000000000000'),
        deployer.address
      );
      const TOScontract = await contractFactory.deploy(
        'TOS',
        'TOS',
        ethers.utils.parseEther('10000000000000'),
        deployer.address
      );

      contractFactory = new ethers.ContractFactory(
        WETH9Json.abi,
        WETH9Json.bytecode,
        deployer
      );
      const WETHcontract = await contractFactory.deploy();

      contractFactory = new ethers.ContractFactory(
        ERC20PresetFixedSupplyDecimal6TestJson.abi,
        ERC20PresetFixedSupplyDecimal6TestJson.bytecode,
        deployer
      );
      const USDTcontract = await contractFactory.deploy(
        'USDT',
        'USDT',
        ethers.utils.parseEther('10000000000000'),
        deployer.address
      );
      const USDCcontract = await contractFactory.deploy(
        'USDC',
        'USDC',
        ethers.utils.parseEther('10000000000000'),
        deployer.address
      );

      contractAddresses.TON = TONcontract.address;
      contractAddresses.TOS = TOScontract.address;
      contractAddresses.WETH = WETHcontract.address;
      contractAddresses.USDC = USDCcontract.address;
      contractAddresses.USDT = USDTcontract.address;
      fs.writeFileSync(
        __dirname + `/../deployed.uniswap.${chainName}.json`,
        JSON.stringify(contractAddresses, null, 2)
      );
    }
  }
};

const getContract = async (contractName) => {
  const chainName = hre.network.name;
  const accounts = await hre.ethers.getSigners();
  let deployer = accounts[0];
  providers = hre.ethers.provider;
  if (chainName === 'hardhat')
    deployer = await hre.ethers.getImpersonatedSigner(
      '0xB68AA9E398c054da7EBAaA446292f611CA0CD52B'
    );

  let jsonFile;
  if (
    contractName === 'TON' ||
    contractName === 'TOS' ||
    contractName === 'WETH'
  ) {
    jsonFile = JSON.parse(
      fs.readFileSync(__dirname + '/abis/IERC20.json').toString()
    );
  } else if (contractName === 'USDC') {
    jsonFile = JSON.parse(
      fs.readFileSync(__dirname + '/abis1/usdcabi.json').toString()
    );
  } else if (contractName === 'USDT') {
    jsonFile = JSON.parse(
      fs.readFileSync(__dirname + '/abis1/usdtabi.json').toString()
    );
  } else {
    jsonFile = JSON.parse(
      fs
        .readFileSync(
          __dirname + `/abis1/${contractName}.sol/${contractName}.json`
        )
        .toString()
    );
  }
  let contractAddresses = JSON.parse(
    fs
      .readFileSync(__dirname + `/../deployed.uniswap.${chainName}.json`)
      .toString()
  );
  let contractAddress = contractAddresses[contractName];
  let contractCode = await providers.getCode(contractAddress);
  if (contractCode === '0x') {
    console.log(contractName + 'Contract Code is null, exit');
    process.exit();
  }
  const contractFactory = new ethers.ContractFactory(
    jsonFile.abi,
    jsonFile.bytecode,
    deployer
  );
  const contract = contractFactory.attach(contractAddress);
  return contract;
};

const getPoolContractAddress = async (
  UniswapV3FactoryContract,
  token0Address,
  token1Address,
  Fee
) => {
  const poolAddress = await UniswapV3FactoryContract.getPool(
    token0Address,
    token1Address,
    Fee
  );
  let poolCode = await providers.getCode(poolAddress);
  if (poolCode === '0x') {
    console.log(`poolAddress is ${poolAddress}, so you should deploy`);
  }
  return poolAddress;
};

//let positionInfo = await NonfungiblePositionManagerContract.positions(7);
//if (positionInfo.liquidity > 0) {
//   await exit(NonfungiblePositionManagerContract, positionInfo.liquidity, 7, 0, 0, deployer.address)
// }
async function exit(
  nft, //NonfungiblePositionManagerContract
  liquidity,
  tokenId,
  amount0Min,
  amount1Min,
  recipient
) {
  let providers = hre.ethers.provider;
  const decreaseLiquidityData = nft.interface.encodeFunctionData(
    'decreaseLiquidity',
    [
      {
        tokenId,
        liquidity,
        amount0Min,
        amount1Min,
        deadline: Date.now() + 100000,
      },
    ]
  );
  const collectData = nft.interface.encodeFunctionData('collect', [
    {
      tokenId,
      recipient,
      amount0Max: ethers.BigNumber.from(2).pow(128).sub(1),
      amount1Max: ethers.BigNumber.from(2).pow(128).sub(1),
    },
  ]);
  const burnData = nft.interface.encodeFunctionData('burn', [tokenId]);
  try {
    const tx = await nft.multicall([
      decreaseLiquidityData,
      collectData,
      burnData,
    ]);
    await tx.wait();
    const receipt = await providers.getTransactionReceipt(tx.hash);
    console.log(receipt);
  } catch (e) {
    console.log(e.message);
  }
}
// positionInfo = await NonfungiblePositionManagerContract.positions(5);
// if (positionInfo.liquidity > 0) {
//   await exitForETH(NonfungiblePositionManagerContract, positionInfo.liquidity, 5, 0, 0, deployer.address, USDTAddress)
// }
async function exitForETH(
  nft, //NonfungiblePositionManagerContract
  liquidity,
  tokenId,
  amount0Min,
  amount1Min,
  recipient,
  sweepTokenAddress
) {
  let providers = hre.ethers.provider;
  const decreaseLiquidityData = nft.interface.encodeFunctionData(
    'decreaseLiquidity',
    [
      {
        tokenId,
        liquidity,
        amount0Min,
        amount1Min,
        deadline: Date.now() + 100000,
      },
    ]
  );
  const collectData = nft.interface.encodeFunctionData('collect', [
    {
      tokenId,
      recipient: '0x0000000000000000000000000000000000000000',
      amount0Max: ethers.BigNumber.from(2).pow(128).sub(1),
      amount1Max: ethers.BigNumber.from(2).pow(128).sub(1),
    },
  ]);
  const amountMinimum = 0;
  const unwrapWETH9 = nft.interface.encodeFunctionData('unwrapWETH9', [
    amountMinimum,
    recipient,
  ]);
  const sweepToken = nft.interface.encodeFunctionData('sweepToken', [
    sweepTokenAddress,
    amountMinimum,
    recipient,
  ]);
  const burnData = nft.interface.encodeFunctionData('burn', [tokenId]);
  try {
    const tx = await nft.multicall(
      [decreaseLiquidityData, collectData, unwrapWETH9, sweepToken, burnData],
      { gasLimit: 3000000 }
    );
    await tx.wait();
    const receipt = await providers.getTransactionReceipt(tx.hash);
    console.log(receipt);
  } catch (e) {
    console.log(e.message);
  }
}

async function swapToERC20(
  tokenInName,
  tokenOutName,
  tokenIn,
  tokenOut,
  deployer,
  amountIn,
  SwapRouterContract
) {
  let deadline = Date.now() + 100000;
  let SwapParams = {
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    fee: 3000,
    recipient: deployer.address,
    deadline: deadline,
    amountIn: amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  };
  try {
    let tx;
    if (tokenIn === '0x4200000000000000000000000000000000000006') {
      tx = await SwapRouterContract.exactInputSingle(SwapParams, {
        gasLimit: 3000000,
        value: amountIn,
      });
    } else {
      tx = await SwapRouterContract.exactInputSingle(SwapParams, {
        gasLimit: 3000000,
      });
    }
    await tx.wait();
    const receipt = await providers.getTransactionReceipt(tx.hash);
    console.log(`===${tokenInName} => ${tokenOutName} ERC20|ETH -> ERC20`);
    console.log('transactionHash:', receipt.transactionHash);
    console.log('gasUsed: ', receipt.gasUsed);
    console.log();
    return receipt.gasUsed;
  } catch (e) {
    console.log('e', e.message);
  }
}

async function swapToETH(
  tokenInName,
  tokenOutName,
  tokenIn,
  tokenOut,
  deployer,
  amountIn,
  SwapRouterContract
) {
  let deadline = Date.now() + 100000;
  const params1 = {
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    fee: 3000,
    recipient: SwapRouterAddress,
    deadline: deadline,
    amountIn: amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  };
  const encData1 = SwapRouterContract.interface.encodeFunctionData(
    'exactInputSingle',
    [params1]
  );
  const amountMinimum = 0;
  const encData2 = SwapRouterContract.interface.encodeFunctionData(
    'unwrapWETH9',
    [amountMinimum, deployer.address]
  );
  try {
    const tx = await SwapRouterContract.multicall([encData1, encData2], {
      gasLimit: 3000000,
    });
    await tx.wait();
    const receipt = await providers.getTransactionReceipt(tx.hash);
    console.log(`===${tokenInName} => ${tokenOutName} ERC20->ETH`);
    console.log('transactionHash:', receipt.transactionHash);
    console.log('gasUsed: ', receipt.gasUsed);
    console.log();
    return receipt.gasUsed;
  } catch (e) {
    console.log('e', e.message);
  }
}

module.exports = {
  getContract,
  getPoolContractAddress,
  deployContract,
  exit,
  exitForETH,
  swapToERC20,
  swapToETH,
};