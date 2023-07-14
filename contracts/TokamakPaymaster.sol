// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "./core/BasePaymaster.sol";
import "./core/EntryPoint.sol";

import "./interfaces1/IOracle.sol";
import "hardhat/console.sol";
/**
 * A token-based paymaster that accepts token deposits
 * The deposit is only a safeguard: the user pays with his token balance.
 *  only if the user didn't approve() the paymaster, or if the token balance is not enough, the deposit will be used.
 *  thus the required deposit is to cover just one method call.
 * The deposit is locked for the current block: the user must issue unlockTokenDeposit() to be allowed to withdraw
 *  (but can't use the deposit for this or further operations)
 *
 * paymasterAndData holds the paymaster address followed by the token address to use.
 * @notice This paymaster will be rejected by the standard rules of EIP4337, as it uses an external oracle.
 * (the standard rules ban accessing data of an external contract)
 * It can only be used if it is "whitelisted" by the bundler.
 * (technically, it can be used by an "oracle" which returns a static value, without accessing any storage)
 */
contract TokamakPaymaster is BasePaymaster {

    using UserOperationLib for UserOperation;
    using SafeERC20 for IERC20;

    //calculated cost of the postOp
    uint256 constant public COST_OF_POST = 35000;

    IOracle private constant NULL_ORACLE = IOracle(address(0));
    mapping(IERC20 => IOracle) public oracles;
    mapping(IERC20 => mapping(address => uint256)) public balances;
    mapping(address => uint256) public unlockBlock;

    event AddedToken(address token, address oracle);
    event ChnagedOracle(address token, address oracle);
    event AddedDepositFor(address token, address account, uint256 amount);
    event WithdrawTokensTo(address token, address target, uint256 amount);
    event PostOp(
        PostOpMode mode,
        address account,
        address token,
        uint256 gasPricePostOp,
        uint256 maxTokenCost,
        uint256 maxCost,
        uint256 actualGasCost);

    event InsufficientDepositToken(address account, address token, uint256 amount);

    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {
        //owner account is unblocked, to allow withdraw of paid tokens;
        unlockTokenDeposit();
    }

    /**
     * owner of the paymaster should add supported tokens
     */
    function addToken(IERC20 token, IOracle tokenPriceOracle) external onlyOwner {
        // require(oracles[token] == NULL_ORACLE, "Token already set");
        require(address(tokenPriceOracle) != address(0), 'zero oracle');
        require(address(oracles[token]) != address(tokenPriceOracle), 'same oracle');

        if (oracles[token] == NULL_ORACLE) emit AddedToken(address(token), address(tokenPriceOracle));
        else emit ChnagedOracle(address(token), address(tokenPriceOracle));

        oracles[token] = tokenPriceOracle;
    }

    /**
     * deposit tokens that a specific account can use to pay for gas.
     * The sender must first approve this paymaster to withdraw these tokens (they are only withdrawn in this method).
     * Note depositing the tokens is equivalent to transferring them to the "account" - only the account can later
     *  use them - either as gas, or using withdrawTo()
     *
     * @param token the token to deposit.
     * @param account the account to deposit for.
     * @param amount the amount of token to deposit.
     */
    function addDepositFor(IERC20 token, address account, uint256 amount) external {
        require(oracles[token] != NULL_ORACLE, "unsupported token");
        //(sender must have approval for the paymaster)
        token.safeTransferFrom(msg.sender, address(this), amount);
        balances[token][account] += amount;
        if (msg.sender == account) {
            lockTokenDeposit();
        }
        emit AddedDepositFor(address(token), account, amount);
    }

    /**
     * @return amount - the amount of given token deposited to the Paymaster.
     * @return _unlockBlock - the block height at which the deposit can be withdrawn.
     */
    function depositInfo(IERC20 token, address account) public view returns (uint256 amount, uint256 _unlockBlock) {
        amount = balances[token][account];
        _unlockBlock = unlockBlock[account];
    }

    /**
     * unlock deposit, so that it can be withdrawn.
     * can't be called in the same block as withdrawTo()
     */
    function unlockTokenDeposit() public {
        unlockBlock[msg.sender] = block.number;
    }

    /**
     * lock the tokens deposited for this account so they can be used to pay for gas.
     * after calling unlockTokenDeposit(), the account can't use this paymaster until the deposit is locked.
     */
    function lockTokenDeposit() public {
        unlockBlock[msg.sender] = 0;
    }

    /**
     * withdraw tokens.
     * can only be called after unlock() is called in a previous block.
     * @param token the token deposit to withdraw
     * @param target address to send to
     * @param amount amount to withdraw
     */
    function withdrawTokensTo(IERC20 token, address target, uint256 amount) public {
        require(unlockBlock[msg.sender] != 0 && block.number > unlockBlock[msg.sender], "DepositPaymaster: must unlockTokenDeposit");
        balances[token][msg.sender] -= amount;
        token.safeTransfer(target, amount);

        emit WithdrawTokensTo(address(token), target, amount);
    }

    /**
     * translate the given eth value to token amount
     * @param token the token to use
     * @param ethBought the required eth value we want to "buy"
     * @return requiredTokens the amount of tokens required to get this amount of eth
     */
    function getTokenValueOfEth(IERC20 token, uint256 ethBought) internal view virtual returns (uint256 requiredTokens) {
        IOracle oracle = oracles[token];
        require(oracle != NULL_ORACLE, "DepositPaymaster: unsupported token");
        return oracle.getTokenValueOfEth(ethBought);
    }

    /**
     * Validate the request:
     * The sender should have enough deposit to pay the max possible cost.
     * Note that the sender's balance is not checked. If it fails to pay from its balance,
     * this deposit will be used to compensate the paymaster for the transaction.
     */
    function _validatePaymasterUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 maxCost)
    internal view override returns (bytes memory context, uint256 validationData) {
        // console.log("_validatePaymasterUserOp maxCost %s", maxCost);
        (userOpHash);
        // verificationGasLimit is dual-purposed, as gas limit for postOp. make sure it is high enough
        require(userOp.verificationGasLimit > COST_OF_POST, "DepositPaymaster: gas too low for postOp");
        // console.log("maxCost %s", maxCost);

        bytes calldata paymasterAndData = userOp.paymasterAndData;
        require(paymasterAndData.length == 20+20, "DepositPaymaster: paymasterAndData must specify token");
        IERC20 token = IERC20(address(bytes20(paymasterAndData[20:])));
        address account = userOp.getSender();
        // uint256 balance = token.balanceOf(account);
        // console.log("balance %s", balance);
        uint256 maxTokenCost = getTokenValueOfEth(token, maxCost);
        // console.log("maxTokenCost %s", maxTokenCost);

        uint256 gasPriceUserOp = userOp.gasPrice();
        // console.log("gasPriceUserOp %s", gasPriceUserOp);

        require(unlockBlock[account] == 0, "DepositPaymaster: deposit not locked");

        // 원래 코드
        // console.log("_validatePaymasterUserOp balances[token][account] %s", balances[token][account]);

        uint256 allowance = token.allowance(account, address(this));
        // console.log("_validatePaymasterUserOp allowanceTON %s", allowance);
        // uint256 balanceToken =  token.balanceOf(account);
        if (allowance < maxTokenCost) {
            require(balances[token][account] >= maxTokenCost, "DepositPaymaster: deposit too low");
        } else {
            require(
               balances[token][account] >= maxTokenCost || token.balanceOf(account) >= maxTokenCost,
               "DepositPaymaster: token's balance or deposit is insufficient");
        }

        // 톤이 없을때, 잔액이 있는지 확인만 한다. 이때 확인을 했어도, 실제 트랜잭션을 보낼때 없다면 에러처리가 된다.
        // require(token.balanceOf(account) >= maxTokenCost, "DepositPaymaster: token's balance is insufficient");

        // uint256 allowance = token.allowance(account, address(this));
        // console.log("_validatePaymasterUserOp allowanceTON %s", allowance);
        // require(token.allowance(account, address(this)) >= maxTokenCost, "FeeTokenApproveFailed");

        // require(token.allowance(account, address(this)) >= maxTokenCost,"DepositPaymaster: token's allowance is insufficient");
        return (abi.encode(account, token, gasPriceUserOp, maxTokenCost, maxCost),0);
    }

    /**
     * perform the post-operation to charge the sender for the gas.
     * in normal mode, use transferFrom to withdraw enough tokens from the sender's balance.
     * in case the transferFrom fails, the _postOp reverts and the entryPoint will call it again,
     * this time in *postOpReverted* mode.
     * In this mode, we use the deposit to pay (which we validated to be large enough)
     */
    function _postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) internal override {
        // console.log("_postOp ------------------mode %s, actualGasCost %s", uint256(mode), actualGasCost);
        (address account, IERC20 token, uint256 gasPricePostOp, uint256 maxTokenCost, uint256 maxCost) = abi.decode(context, (address, IERC20, uint256, uint256, uint256));

        // console.log("_postOp account %s", account);
        // console.log("_postOp token %s", address(token));
        // console.log("_postOp gasPricePostOp %s", gasPricePostOp);
        // console.log("_postOp maxTokenCost %s", maxTokenCost);
        // console.log("_postOp maxCost %s", maxCost);

        //use same conversion rate as used for validation.
        uint256 actualTokenCost = (actualGasCost + COST_OF_POST * gasPricePostOp) * maxTokenCost / maxCost;
        // console.log("_postOp actualTokenCost %s", actualTokenCost);
        // console.log("_postOp mode %s", uint256(mode));

        uint256 balance = token.balanceOf(account);
        // console.log("_postOp balanceTON %s", balance);
        uint256 allowance = token.allowance(account, address(this));
        // console.log("_postOp allowanceTON %s", allowance);
        // console.log("_postOp balances[token][account] %s", balances[token][account]);
        // console.log("_postOp owner() %s", owner());
        // console.log("_postOp after balances[token][owner()] %s", balances[token][owner()]);

        if (mode != PostOpMode.postOpReverted) {
            // console.log("mode != PostOpMode.postOpReverted ");
            // 실패된 경우가 아닌경우,
            // 디파짓이 있거나, approve가 되어 있다면 토큰을 전송하면 된다.

            if (allowance < actualTokenCost) {
                require(balances[token][account] >= actualTokenCost, "TokenDepositInsufficient");
            }

            if (allowance >= actualTokenCost && balance >= actualTokenCost ) {
                token.safeTransferFrom(account, address(this), actualTokenCost);

            } else {
                balances[token][account] -= actualTokenCost;
            }

        } else {
            //in case above transferFrom failed, pay with deposit:
            if (balances[token][account] < actualTokenCost) {
                emit InsufficientDepositToken(account, address(token), (actualTokenCost - balances[token][account]));
                balances[token][account] = 0;
            } else {
                balances[token][account] -= actualTokenCost;
            }
        }

        balances[token][owner()] += actualTokenCost;
        // console.log("_postOp after balances[token][account] %s", balances[token][account]);
        emit PostOp(mode, account, address(token), gasPricePostOp, maxTokenCost, maxCost, actualGasCost);
    }
}
