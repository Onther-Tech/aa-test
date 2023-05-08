// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@eth-optimism/contracts/standards/IL2StandardERC20.sol";
import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "./iFeeTokenPriceOracle.sol";
import "./FeeTokenPriceOracle.sol";

contract FeePaymaster is BasePaymaster, IL2StandardERC20, ERC20, FeeTokenPriceOracle {

    //calculated cost of the postOp
    uint256 constant public COST_OF_POST = 15000;

    address public immutable theFactory;

    address public l1Token;
    address public l2Bridge;

    constructor(
        address accountFactory,
        string memory _symbol,
        IEntryPoint _entryPoint,
        address _l2Bridge,
        address _l1Token,
        string memory _name
    ) BasePaymaster(_entryPoint) ERC20(_name, _symbol) {
        theFactory = accountFactory;

        l1Token = _l1Token;
        l2Bridge = _l2Bridge;

        super.initialize(address(this), 0x0000000000000000000000000000000000000000);
    }

    /**
     * L2StandardERC20 implementation
     */

    modifier onlyL2Bridge() {
          //require(msg.sender == l2Bridge, "Only L2 Bridge can mint and burn");
          _;
      }

      // slither-disable-next-line external-function
      function supportsInterface(bytes4 _interfaceId) public pure returns (bool) {
          bytes4 firstSupportedInterface = bytes4(keccak256("supportsInterface(bytes4)")); // ERC165
          bytes4 secondSupportedInterface = IL2StandardERC20.l1Token.selector ^
              IL2StandardERC20.mint.selector ^
              IL2StandardERC20.burn.selector;
          return _interfaceId == firstSupportedInterface || _interfaceId == secondSupportedInterface;
      }

      // slither-disable-next-line external-function
      function mint(address _to, uint256 _amount) public virtual onlyL2Bridge {
          _mint(_to, _amount);

          emit Mint(_to, _amount);
      }

      // slither-disable-next-line external-function
      function burn(address _from, uint256 _amount) public virtual onlyL2Bridge {
          _burn(_from, _amount);

          emit Burn(_from, _amount);
      }


    /**
     * BasePaymaster implementation
     * /

     /**
     * transfer paymaster ownership.
     * owner of this paymaster is allowed to withdraw funds (tokens transferred to this paymaster's balance)
     * when changing owner, the old owner's withdrawal rights are revoked.
     */
    function transferOwnership(address newOwner) public override virtual onlyOwner {
        // remove allowance of current owner
        _approve(address(this), owner(), 0);
        super.transferOwnership(newOwner);
        // new owner is allowed to withdraw tokens from the paymaster's balance
        _approve(address(this), newOwner, type(uint).max);
    }

    //TODO: this method assumes a fixed ratio of token-to-eth. subclass should override to supply oracle
    // or a setter.
    function getTokenValueOfEth(uint256 valueEth) internal view virtual override returns (uint256 valueToken) {
        return super.getTokenValueOfEth(valueEth);
    }

    function stake() public payable {
        entryPoint.addStake{value : msg.value}(2);
    }

    /**
      * validate the request:
      * if this is a constructor call, make sure it is a known account (that is, a contract that
      * we trust that in its constructor will set
      * verify the sender has enough tokens.
      * (since the paymaster is also the token, there is no notion of "approval")
      */
    function validatePaymasterUserOp(UserOperation calldata userOp, bytes32 /*userOpHash*/, uint256 requiredPreFund)
    external view override returns (bytes memory context, uint256 sigTimeRange) {
        uint256 tokenPrefund = getTokenValueOfEth(requiredPreFund);

        // verificationGasLimit is dual-purposed, as gas limit for postOp. make sure it is high enough
        // make sure that verificationGasLimit is high enough to handle postOp
        require(userOp.verificationGasLimit > COST_OF_POST, "TokenPaymaster: gas too low for postOp");

        if (userOp.initCode.length != 0) {
            _validateConstructor(userOp);
            require(balanceOf(userOp.sender) >= tokenPrefund, "TokenPaymaster: no balance (pre-create)");
        } else {

            require(balanceOf(userOp.sender) >= tokenPrefund, "TokenPaymaster: no balance");
        }

        return (abi.encode(userOp.sender), 0);
    }

    // when constructing an account, validate constructor code and parameters
    // we trust our factory (and that it doesn't have any other public methods)
    function _validateConstructor(UserOperation calldata userOp) internal virtual view {
        address factory = address(bytes20(userOp.initCode[0 : 20]));
        require(factory == theFactory, "TokenPaymaster: wrong account factory");
    }

    /**
     * actual charge of user.
     * this method will be called just after the user's TX with mode==OpSucceeded|OpReverted (account pays in both cases)
     * BUT: if the user changed its balance in a way that will cause  postOp to revert, then it gets called again, after reverting
     * the user's TX , back to the state it was before the transaction started (before the validatePaymasterUserOp),
     * and the transaction should succeed there.
     */
    function _postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) internal override {
        //we don't really care about the mode, we just pay the gas with the user's tokens.
        (mode);
        address sender = abi.decode(context, (address));
        uint256 charge = getTokenValueOfEth(actualGasCost + COST_OF_POST);
        //actualGasCost is known to be no larger than the above requiredPreFund, so the transfer should succeed.
        _transfer(sender, address(this), charge);
    }
}
