import { Interface } from 'ethers';
import { ELIS_V1_ROUTER_ABI, ELIS_V2_ROUTER_ABI, ELIS_V3_POSITION_MANAGER_ABI, getElisV1Router, getElisV2Router, getElisV3PositionManager } from '@elis/contracts';
import { AddLiquidityV1Params, RemoveLiquidityV1Params, AddLiquidityV2Params, MintPositionV3Params, IncreaseLiquidityV3Params, DecreaseLiquidityV3Params, CollectV3FeesParams, LiquidityParams, UnsignedTransaction } from './types';
const v1RouterInterface = new Interface(ELIS_V1_ROUTER_ABI);
const v2RouterInterface = new Interface(ELIS_V2_ROUTER_ABI);
const v3PositionManagerInterface = new Interface(ELIS_V3_POSITION_MANAGER_ABI);
export function buildAddLiquidityV1Tx(params: AddLiquidityV1Params): UnsignedTransaction {
    const routerAddress = getElisV1Router(params.chainId);
    if (!routerAddress) {
        throw new Error(`Elis V1 Router not configured for chain ${params.chainId}`);
    }
    const data = v1RouterInterface.encodeFunctionData('addLiquidity', [
        params.tokenA,
        params.tokenB,
        params.amountADesired,
        params.amountBDesired,
        params.amountAMin,
        params.amountBMin,
        params.to,
        params.deadline
    ]);
    return {
        to: routerAddress,
        data,
        value: 0n,
        chainId: params.chainId
    };
}
export function buildRemoveLiquidityV1Tx(params: RemoveLiquidityV1Params): UnsignedTransaction {
    const routerAddress = getElisV1Router(params.chainId);
    if (!routerAddress) {
        throw new Error(`Elis V1 Router not configured for chain ${params.chainId}`);
    }
    const data = v1RouterInterface.encodeFunctionData('removeLiquidity', [
        params.tokenA,
        params.tokenB,
        params.liquidity,
        params.amountAMin,
        params.amountBMin,
        params.to,
        params.deadline
    ]);
    return {
        to: routerAddress,
        data,
        value: 0n,
        chainId: params.chainId
    };
}
export function buildAddLiquidityV2Tx(params: AddLiquidityV2Params): UnsignedTransaction {
    const routerAddress = getElisV2Router(params.chainId);
    if (!routerAddress) {
        throw new Error(`Elis V2 Router not configured for chain ${params.chainId}`);
    }
    const data = v2RouterInterface.encodeFunctionData('addLiquidity', [
        params.tokenA,
        params.tokenB,
        params.feeBps,
        params.amountADesired,
        params.amountBDesired,
        params.amountAMin,
        params.amountBMin,
        params.to,
        params.deadline
    ]);
    return {
        to: routerAddress,
        data,
        value: 0n,
        chainId: params.chainId
    };
}
export function buildMintPositionV3Tx(params: MintPositionV3Params): UnsignedTransaction {
    const posManagerAddress = getElisV3PositionManager(params.chainId);
    if (!posManagerAddress) {
        throw new Error(`Elis V3 Position Manager not configured for chain ${params.chainId}`);
    }
    const data = v3PositionManagerInterface.encodeFunctionData('mint', [
        {
            token0: params.token0,
            token1: params.token1,
            fee: params.feeBps,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            amount0Desired: params.amount0Desired,
            amount1Desired: params.amount1Desired,
            amount0Min: params.amount0Min,
            amount1Min: params.amount1Min,
            recipient: params.recipient,
            deadline: params.deadline
        }
    ]);
    return {
        to: posManagerAddress,
        data,
        value: 0n,
        chainId: params.chainId
    };
}
export function buildIncreaseLiquidityV3Tx(params: IncreaseLiquidityV3Params): UnsignedTransaction {
    const posManagerAddress = getElisV3PositionManager(params.chainId);
    if (!posManagerAddress) {
        throw new Error(`Elis V3 Position Manager not configured for chain ${params.chainId}`);
    }
    const data = v3PositionManagerInterface.encodeFunctionData('mint', [
        {
            token0: '',
            token1: '',
            fee: 0,
            tickLower: 0,
            tickUpper: 0,
            amount0Desired: params.amount0Desired,
            amount1Desired: params.amount1Desired,
            amount0Min: params.amount0Min,
            amount1Min: params.amount1Min,
            recipient: '',
            deadline: params.deadline
        }
    ]);
    return {
        to: posManagerAddress,
        data,
        value: 0n,
        chainId: params.chainId
    };
}
export function buildDecreaseLiquidityV3Tx(params: DecreaseLiquidityV3Params): UnsignedTransaction {
    const posManagerAddress = getElisV3PositionManager(params.chainId);
    if (!posManagerAddress) {
        throw new Error(`Elis V3 Position Manager not configured for chain ${params.chainId}`);
    }
    const data = v3PositionManagerInterface.encodeFunctionData('decreaseLiquidity', [
        params.tokenId,
        params.liquidity,
        params.amount0Min,
        params.amount1Min,
        params.deadline
    ]);
    return {
        to: posManagerAddress,
        data,
        value: 0n,
        chainId: params.chainId
    };
}
export function buildCollectV3FeesTx(params: CollectV3FeesParams): UnsignedTransaction {
    const posManagerAddress = getElisV3PositionManager(params.chainId);
    if (!posManagerAddress) {
        throw new Error(`Elis V3 Position Manager not configured for chain ${params.chainId}`);
    }
    const data = v3PositionManagerInterface.encodeFunctionData('collect', [
        params.tokenId,
        params.recipient,
        params.amount0Max,
        params.amount1Max
    ]);
    return {
        to: posManagerAddress,
        data,
        value: 0n,
        chainId: params.chainId
    };
}
export function buildLiquidityTransaction(params: LiquidityParams): UnsignedTransaction {
    switch (params.protocol) {
        case 'ELIS_V1':
        case 'ELIS_V1':
            if ('liquidity' in params) {
                return buildRemoveLiquidityV1Tx(params as RemoveLiquidityV1Params);
            }
            return buildAddLiquidityV1Tx(params as AddLiquidityV1Params);
        case 'ELIS_V2':
        case 'ELIS_V2':
            return buildAddLiquidityV2Tx(params as AddLiquidityV2Params);
        case 'ELIS_V3':
        case 'ELIS_V3':
            if ('tickLower' in params) {
                return buildMintPositionV3Tx(params as MintPositionV3Params);
            }
            if ('liquidity' in params) {
                return buildDecreaseLiquidityV3Tx(params as DecreaseLiquidityV3Params);
            }
            if ('amount0Desired' in params) {
                return buildIncreaseLiquidityV3Tx(params as IncreaseLiquidityV3Params);
            }
            return buildCollectV3FeesTx(params as CollectV3FeesParams);
        default:
            throw new Error(`Unsupported liquidity protocol: ${(params as any).protocol}`);
    }
}
