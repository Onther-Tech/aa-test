// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface AddressManagerI {
    function getAddress(string memory _name) external view returns (address);
}

/**
 * @title LibMessenger
 */
library LibMessenger {

    function getL1CommunicationMessenger(address addressManager) external view returns(address _address) {
        if (addressManager == address(0)) return address(0);
        try
            AddressManagerI(addressManager).getAddress('Proxy__OVM_L1CrossDomainMessenger') returns (address a) {
                _address = a;
        } catch (bytes memory ) {
            _address = address(0);
        }
    }

    function getL1Bridge(address addressManager) external view returns(address _address) {
        if (addressManager == address(0)) return address(0);
        try
            AddressManagerI(addressManager).getAddress('Proxy__OVM_L1StandardBridge') returns (address a) {
                _address = a;
        } catch (bytes memory ) {
            _address = address(0);
        }
    }
}
