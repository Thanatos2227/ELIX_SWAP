pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ElisTreasury} from "../src/treasury/ElisTreasury.sol";
import {ElisFeeController} from "../src/treasury/ElisFeeController.sol";
import {ElisV1Factory} from "../src/v1/ElisV1Factory.sol";
import {ElisV1Router} from "../src/v1/ElisV1Router.sol";
import {ElisV2Factory} from "../src/v2/ElisV2Factory.sol";
import {ElisV2Router} from "../src/v2/ElisV2Router.sol";
import {ElisV3Factory} from "../src/v3/ElisV3Factory.sol";
import {ElisV3Router} from "../src/v3/ElisV3Router.sol";
import {ElisV3PositionManager} from "../src/v3/ElisV3PositionManager.sol";
import {ElisRouter} from "../src/router/ElisRouter.sol";
import {ElisCrossChainRouter} from "../src/ElisCrossChainRouter.sol";
import {ElisCircuitBreaker} from "../src/ElisCircuitBreaker.sol";

contract DeployElis is Script {
    struct DeploymentConfig {
        uint256 deployerPrivateKey;
        address governance;
        address emergencyGuardian;
        address wethAddress;
        address permit2Address;
    }

    struct DeployedContracts {
        address treasuryAddr;
        address feeControllerAddr;
        address circuitBreakerAddr;
        address v1FactoryAddr;
        address v1RouterAddr;
        address v2FactoryAddr;
        address v2RouterAddr;
        address v3FactoryAddr;
        address v3RouterAddr;
        address v3PositionManagerAddr;
        address unifiedRouterAddr;
        address crossChainRouterAddr;
    }

    function run() external returns (
        address treasuryAddr,
        address feeControllerAddr,
        address circuitBreakerAddr,
        address v1FactoryAddr,
        address v1RouterAddr,
        address v2FactoryAddr,
        address v2RouterAddr,
        address v3FactoryAddr,
        address v3RouterAddr,
        address v3PositionManagerAddr,
        address unifiedRouterAddr,
        address crossChainRouterAddr
    ) {
        DeployedContracts memory d = _executeDeployment();
        return (
            d.treasuryAddr,
            d.feeControllerAddr,
            d.circuitBreakerAddr,
            d.v1FactoryAddr,
            d.v1RouterAddr,
            d.v2FactoryAddr,
            d.v2RouterAddr,
            d.v3FactoryAddr,
            d.v3RouterAddr,
            d.v3PositionManagerAddr,
            d.unifiedRouterAddr,
            d.crossChainRouterAddr
        );
    }

    function _executeDeployment() internal returns (DeployedContracts memory d) {
        DeploymentConfig memory cfg = _loadConfig();
        _logDeploymentStart(cfg);

        vm.startBroadcast(cfg.deployerPrivateKey);

        _deployCore(cfg, d);
        _deployV1(cfg, d);
        _deployV2(cfg, d);
        _deployV3(cfg, d);
        _deployRouters(cfg, d);
        _wireAuthorizations(d);

        vm.stopBroadcast();

        console.log("=== Canonical Deployment Complete ===");
    }

    function _loadConfig() internal view returns (DeploymentConfig memory cfg) {
        require(block.chainid != 0, "DeployElis: Invalid chainId");

        cfg.deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        require(cfg.deployerPrivateKey != 0, "DeployElis: DEPLOYER_PRIVATE_KEY required");

        cfg.governance = vm.envAddress("GOVERNANCE_MULTISIG");
        require(cfg.governance != address(0), "DeployElis: GOVERNANCE_MULTISIG cannot be zero address");

        cfg.emergencyGuardian = vm.envAddress("EMERGENCY_GUARDIAN");
        require(cfg.emergencyGuardian != address(0), "DeployElis: EMERGENCY_GUARDIAN cannot be zero address");

        cfg.wethAddress = vm.envAddress("WETH_ADDRESS");
        require(cfg.wethAddress != address(0), "DeployElis: WETH_ADDRESS cannot be zero address");

        cfg.permit2Address = vm.envOr("PERMIT2_ADDRESS", address(0x000000000022D473030F116dDEE9F6B43aC78BA3));
        require(cfg.permit2Address != address(0), "DeployElis: PERMIT2_ADDRESS cannot be zero address");
    }

    function _logDeploymentStart(DeploymentConfig memory cfg) internal view {
        console.log("=== Deploying ELIS SWAP Canonical Protocol Suite ===");
        console.log("Chain ID:           ", block.chainid);
        console.log("Governance:         ", cfg.governance);
        console.log("Emergency Guardian: ", cfg.emergencyGuardian);
        console.log("WETH Address:       ", cfg.wethAddress);
        console.log("Permit2 Address:    ", cfg.permit2Address);
    }

    function _deployCore(DeploymentConfig memory cfg, DeployedContracts memory d) internal {
        d.treasuryAddr = address(new ElisTreasury(cfg.governance));
        console.log("1. ElisTreasury:                    ", d.treasuryAddr);

        d.circuitBreakerAddr = address(new ElisCircuitBreaker(cfg.governance, cfg.emergencyGuardian));
        console.log("2. ElisCircuitBreaker:          ", d.circuitBreakerAddr);

        d.feeControllerAddr = address(new ElisFeeController(cfg.governance, d.treasuryAddr));
        console.log("3. ElisFeeController:            ", d.feeControllerAddr);
    }

    function _deployV1(DeploymentConfig memory cfg, DeployedContracts memory d) internal {
        d.v1FactoryAddr = address(new ElisV1Factory(cfg.governance, d.treasuryAddr));
        d.v1RouterAddr = address(new ElisV1Router(d.v1FactoryAddr, cfg.wethAddress));
        console.log("4. ElisV1Factory:                    ", d.v1FactoryAddr);
        console.log("5. ElisV1Router:                      ", d.v1RouterAddr);
    }

    function _deployV2(DeploymentConfig memory cfg, DeployedContracts memory d) internal {
        d.v2FactoryAddr = address(new ElisV2Factory(cfg.governance, d.feeControllerAddr, d.treasuryAddr));
        d.v2RouterAddr = address(new ElisV2Router(d.v2FactoryAddr, cfg.wethAddress));
        console.log("6. ElisV2Factory:                    ", d.v2FactoryAddr);
        console.log("7. ElisV2Router:                      ", d.v2RouterAddr);
    }

    function _deployV3(DeploymentConfig memory cfg, DeployedContracts memory d) internal {
        d.v3FactoryAddr = address(new ElisV3Factory(cfg.governance));
        d.v3RouterAddr = address(new ElisV3Router(d.v3FactoryAddr, cfg.wethAddress));
        d.v3PositionManagerAddr = address(new ElisV3PositionManager(d.v3FactoryAddr, cfg.wethAddress));
        console.log("8. ElisV3Factory:                    ", d.v3FactoryAddr);
        console.log("9. ElisV3Router:                      ", d.v3RouterAddr);
        console.log("10. ElisV3PositionManager:  ", d.v3PositionManagerAddr);
    }

    function _deployRouters(DeploymentConfig memory cfg, DeployedContracts memory d) internal {
        d.unifiedRouterAddr = address(
            new ElisRouter(
                cfg.governance,
                cfg.wethAddress,
                d.treasuryAddr,
                d.feeControllerAddr,
                d.v1RouterAddr,
                d.v2RouterAddr,
                d.v3RouterAddr
            )
        );
        console.log("11. ElisUnifiedRouter:       ", d.unifiedRouterAddr);

        d.crossChainRouterAddr = address(
            new ElisCrossChainRouter(
                cfg.governance,
                d.treasuryAddr,
                d.feeControllerAddr,
                d.circuitBreakerAddr,
                cfg.permit2Address
            )
        );
        console.log("12. ElisCrossChainRouter: ", d.crossChainRouterAddr);
    }

    function _wireAuthorizations(DeployedContracts memory d) internal {
        ElisTreasury(payable(d.treasuryAddr)).setFeeCollector(d.unifiedRouterAddr, true);
        ElisTreasury(payable(d.treasuryAddr)).setFeeCollector(d.crossChainRouterAddr, true);
        ElisFeeController(d.feeControllerAddr).setFeeCollector(d.unifiedRouterAddr, true);
        ElisFeeController(d.feeControllerAddr).setFeeCollector(d.crossChainRouterAddr, true);
        console.log("13. Post-Deployment Authorizations Wired Successfully");
    }
}
