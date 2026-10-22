import { Contract, Provider } from 'ethers';
import { ELIS_V3_POSITION_MANAGER_ABI, getElisV3PositionManager, CANONICAL_NATIVE_ADDRESS } from '@elis/contracts';
import { ElisV3PositionInfo } from './types';
export async function getElisV3Position(provider: Provider, chainId: number, tokenId: bigint | string): Promise<ElisV3PositionInfo> {
    const managerAddr = getElisV3PositionManager(chainId);
    if (!managerAddr) {
        throw new Error(`Elis V3 Position Manager is not configured for chain ${chainId}`);
    }
    const manager = new Contract(managerAddr, ELIS_V3_POSITION_MANAGER_ABI, provider);
    const pos = await manager.positions(tokenId);
    return {
        tokenId: BigInt(tokenId),
        nonce: 0n,
        operator: CANONICAL_NATIVE_ADDRESS,
        token0: pos.token0,
        token1: pos.token1,
        fee: Number(pos.fee),
        tickLower: Number(pos.tickLower),
        tickUpper: Number(pos.tickUpper),
        liquidity: BigInt(pos.liquidity),
        feeGrowthInside0LastX128: 0n,
        feeGrowthInside1LastX128: 0n,
        tokensOwed0: BigInt(pos.tokensOwed0),
        tokensOwed1: BigInt(pos.tokensOwed1)
    };
}
