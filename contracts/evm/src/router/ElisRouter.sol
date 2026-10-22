pragma solidity 0.8.24;

import "../interfaces/IERC20.sol";
import "../interfaces/IWETH9.sol";
import "../treasury/ElisTreasury.sol";
import "../treasury/ElisFeeController.sol";
import "../v1/ElisV1Router.sol";
import "../v2/ElisV2Router.sol";
import "../v3/ElisV3Router.sol";

contract ElisRouter {
    enum ProtocolTier { AUTO, ELIS_V1, ELIS_V2, ELIS_V3 }

    address public immutable governance;
    address public immutable WETH9;
    ElisTreasury public immutable treasury;
    ElisFeeController public immutable feeController;

    ElisV1Router public v1Router;
    ElisV2Router public v2Router;
    ElisV3Router public v3Router;

    uint256 private _unlocked = 1;
    modifier nonReentrant() {
        require(_unlocked == 1, "ElisRouter: REENTRANT");
        _unlocked = 0;
        _;
        _unlocked = 1;
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "ElisRouter: EXPIRED");
        _;
    }

    struct SwapParams {
        ProtocolTier protocol;
        address tokenIn;
        address tokenOut;
        uint24 feeTier;
        uint256 amountIn;
        uint256 amountOutMinimum;
        address recipient;
        uint256 deadline;
    }

    event ProtocolSwap(
        address indexed sender,
        address indexed recipient,
        address indexed tokenIn,
        address tokenOut,
        ProtocolTier protocol,
        uint256 amountIn,
        uint256 amountOut,
        uint256 protocolFee
    );

    constructor(
        address _governance,
        address _weth9,
        address _treasury,
        address _feeController,
        address _v1Router,
        address _v2Router,
        address _v3Router
    ) {
        require(_governance != address(0), "ElisRouter: Zero governance");
        require(_weth9 != address(0), "ElisRouter: Zero WETH");
        require(_treasury != address(0), "ElisRouter: Zero treasury");
        require(_feeController != address(0), "ElisRouter: Zero feeController");

        governance = _governance;
        WETH9 = _weth9;
        treasury = ElisTreasury(payable(_treasury));
        feeController = ElisFeeController(_feeController);

        v1Router = ElisV1Router(payable(_v1Router));
        v2Router = ElisV2Router(payable(_v2Router));
        v3Router = ElisV3Router(payable(_v3Router));
    }

    receive() external payable {}

    function setRouters(address _v1, address _v2, address _v3) external {
        require(msg.sender == governance, "ElisRouter: ONLY_GOVERNANCE");
        if (_v1 != address(0)) v1Router = ElisV1Router(payable(_v1));
        if (_v2 != address(0)) v2Router = ElisV2Router(payable(_v2));
        if (_v3 != address(0)) v3Router = ElisV3Router(payable(_v3));
    }

    function swap(SwapParams calldata params)
        external
        payable
        nonReentrant
        ensure(params.deadline)
        returns (uint256 amountOut)
    {
        require(params.amountIn > 0, "ElisRouter: ZERO_AMOUNT_IN");
        require(params.recipient != address(0), "ElisRouter: ZERO_RECIPIENT");

        bool isNativeIn = msg.value > 0;
        if (isNativeIn) {
            require(msg.value == params.amountIn, "ElisRouter: VALUE_MISMATCH");
            IWETH9(WETH9).deposit{value: msg.value}();
        } else {
            _safeTransferFrom(params.tokenIn, msg.sender, address(this), params.amountIn);
        }

        uint256 feeBps = feeController.protocolFeeBps();
        uint256 protocolFee = (params.amountIn * feeBps) / 10000;
        uint256 swapAmountIn = params.amountIn - protocolFee;

        address actualTokenIn = isNativeIn ? WETH9 : params.tokenIn;

        if (protocolFee > 0) {
            _safeApprove(actualTokenIn, address(treasury), protocolFee);
            treasury.depositERC20Fee(actualTokenIn, protocolFee);
        }

        if (params.protocol == ProtocolTier.ELIS_V1 || (params.protocol == ProtocolTier.AUTO && address(v1Router) != address(0))) {
            amountOut = _swapV1(actualTokenIn, params.tokenOut, swapAmountIn, params.amountOutMinimum, params.recipient, params.deadline);
        } else if (params.protocol == ProtocolTier.ELIS_V2) {
            amountOut = _swapV2(actualTokenIn, params.tokenOut, params.feeTier, swapAmountIn, params.amountOutMinimum, params.recipient, params.deadline);
        } else if (params.protocol == ProtocolTier.ELIS_V3) {
            amountOut = _swapV3(actualTokenIn, params.tokenOut, params.feeTier, swapAmountIn, params.amountOutMinimum, params.recipient, params.deadline);
        } else {
            revert("ElisRouter: UNSUPPORTED_PROTOCOL");
        }

        require(amountOut >= params.amountOutMinimum, "ElisRouter: INSUFFICIENT_OUTPUT_AMOUNT");

        emit ProtocolSwap(
            msg.sender,
            params.recipient,
            params.tokenIn,
            params.tokenOut,
            params.protocol,
            params.amountIn,
            amountOut,
            protocolFee
        );
    }

    function _swapV1(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address recipient,
        uint256 deadline
    ) private returns (uint256) {
        _safeApprove(tokenIn, address(v1Router), amountIn);
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint256[] memory amounts = v1Router.swapExactTokensForTokens(
            amountIn,
            amountOutMinimum,
            path,
            recipient,
            deadline
        );
        return amounts[1];
    }

    function _swapV2(
        address tokenIn,
        address tokenOut,
        uint24 feeTier,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address recipient,
        uint256 deadline
    ) private returns (uint256) {
        _safeApprove(tokenIn, address(v2Router), amountIn);
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint24[] memory feePath = new uint24[](1);
        feePath[0] = feeTier > 0 ? feeTier : 30;
        uint256[] memory amounts = v2Router.swapExactTokensForTokens(
            amountIn,
            amountOutMinimum,
            path,
            feePath,
            recipient,
            deadline
        );
        return amounts[1];
    }

    function _swapV3(
        address tokenIn,
        address tokenOut,
        uint24 feeTier,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address recipient,
        uint256 deadline
    ) private returns (uint256) {
        _safeApprove(tokenIn, address(v3Router), amountIn);
        return v3Router.exactInputSingle(
            ElisV3Router.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: feeTier > 0 ? feeTier : 3000,
                recipient: recipient,
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function _safeTransfer(address token, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ElisRouter: TF_FAILED");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ElisRouter: TFROM_FAILED");
    }

    function _safeApprove(address token, address spender, uint256 value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ElisRouter: APPR_FAILED");
    }
}



}
