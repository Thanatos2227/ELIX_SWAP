import { Contract, Provider } from 'ethers';
import { DEXProtocol, Token } from '@elis/types';
import { ELIS_V1_FACTORY_ABI, ELIS_V1_PAIR_ABI, ELIS_V2_FACTORY_ABI, ELIS_V2_POOL_ABI, ELIS_V3_FACTORY_ABI, ELIS_V3_POOL_ABI, getElisV1Factory, getElisV2Factory, getElisV3Factory } from '@elis/contracts';
import { ElisPoolInfo } from './types';
const ERC20_MIN_ABI = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)'
];
export async function fetchTokenDetails(provider: Provider, address: string, chainId: number): Promise<Token> {
    try {
        const contract = new Contract(address, ERC20_MIN_ABI, provider);
        const [decimals, symbol, name] = await Promise.all([
            contract.decimals().catch(() => 18),
            contract.symbol().catch(() => 'UNKNOWN'),
            contract.name().catch(() => 'Unknown Token')
        ]);
        return {
            chainId: chainId.toString(),
            address,
            symbol,
            name,
            decimals: Number(decimals),
            isNative: false,
            verificationTier: 'COMMUNITY_VERIFIED'
        };
    }
    catch {
        return {
            chainId: chainId.toString(),
            address,
            symbol: 'UNKNOWN',
            name: 'Unknown Token',
            decimals: 18,
            isNative: false,
            verificationTier: 'COMMUNITY_VERIFIED'
        };
    }
}
export async function getElisV1PoolInfo(provider: Provider, chainId: number, pairAddress: string): Promise<ElisPoolInfo> {
    const pairContract = new Contract(pairAddress, ELIS_V1_PAIR_ABI, provider);
    const [token0Addr, token1Addr, reserves, totalSupply] = await Promise.all([
        pairContract.token0(),
        pairContract.token1(),
        pairContract.getReserves(),
        pairContract.totalSupply()
    ]);
    const [token0, token1] = await Promise.all([
        fetchTokenDetails(provider, token0Addr, chainId),
        fetchTokenDetails(provider, token1Addr, chainId)
    ]);
    return {
        protocol: 'ELIS_V1',
        chainId,
        address: pairAddress,
        token0,
        token1,
        feeBps: 30,
        reserve0: BigInt(reserves[0]),
        reserve1: BigInt(reserves[1]),
        totalLpSupply: BigInt(totalSupply)
    };
}
export async function getElisV2PoolInfo(provider: Provider, chainId: number, poolAddress: string): Promise<ElisPoolInfo> {
    const poolContract = new Contract(poolAddress, ELIS_V2_POOL_ABI, provider);
    const [token0Addr, token1Addr, feeBps, reserves, totalSupply] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.feeBps(),
        poolContract.getReserves(),
        poolContract.totalSupply()
    ]);
    const [token0, token1] = await Promise.all([
        fetchTokenDetails(provider, token0Addr, chainId),
        fetchTokenDetails(provider, token1Addr, chainId)
    ]);
    return {
        protocol: 'ELIS_V2',
        chainId,
        address: poolAddress,
        token0,
        token1,
        feeBps: Number(feeBps),
        reserve0: BigInt(reserves[0]),
        reserve1: BigInt(reserves[1]),
        totalLpSupply: BigInt(totalSupply)
    };
}
export async function getElisV3PoolInfo(provider: Provider, chainId: number, poolAddress: string): Promise<ElisPoolInfo> {
    const poolContract = new Contract(poolAddress, ELIS_V3_POOL_ABI, provider);
    const [token0Addr, token1Addr, fee, slot0, liquidity] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee(),
        poolContract.slot0(),
        poolContract.liquidity()
    ]);
    const [token0, token1] = await Promise.all([
        fetchTokenDetails(provider, token0Addr, chainId),
        fetchTokenDetails(provider, token1Addr, chainId)
    ]);
    return {
        protocol: 'ELIS_V3',
        chainId,
        address: poolAddress,
        token0,
        token1,
        feeBps: Number(fee),
        sqrtPriceX96: BigInt(slot0[0]),
        tick: Number(slot0[1]),
        liquidity: BigInt(liquidity)
    };
}
export async function getPool(provider: Provider, chainId: number, poolAddress: string, protocol: DEXProtocol = 'ELIS_V3'): Promise<ElisPoolInfo> {
    switch (protocol) {
        case 'ELIS_V1':
                    return getElisV1PoolInfo(provider, chainId, poolAddress);
        case 'ELIS_V2':
                    return getElisV2PoolInfo(provider, chainId, poolAddress);
        case 'ELIS_V3':
                    return getElisV3PoolInfo(provider, chainId, poolAddress);
        default:
            throw new Error(`Unsupported pool protocol: ${protocol}`);
    }
}
export async function getPools(provider: Provider, chainId: number, protocol?: DEXProtocol): Promise<ElisPoolInfo[]> {
    const pools: ElisPoolInfo[] = [];
    if (!protocol || protocol === 'ELIS_V1') {
        const factoryAddr = getElisV1Factory(chainId);
        if (factoryAddr) {
            try {
                const factory = new Contract(factoryAddr, ELIS_V1_FACTORY_ABI, provider);
                const len = await factory.allPairsLength();
                const count = Math.min(Number(len), 50);
                for (let i = 0; i < count; i++) {
                    const pairAddr = await factory.allPairs(i);
                    const poolInfo = await getElisV1PoolInfo(provider, chainId, pairAddr);
                    pools.push(poolInfo);
                }
            }
            catch (err) {
                console.warn(`[ElisSDK] Failed to fetch V1 pools for chain ${chainId}:`, err);
            }
        }
    }
    if (!protocol || protocol === 'ELIS_V2') {
        const factoryAddr = getElisV2Factory(chainId);
        if (factoryAddr) {
            try {
                const factory = new Contract(factoryAddr, ELIS_V2_FACTORY_ABI, provider);
                const len = await factory.allPoolsLength();
                const count = Math.min(Number(len), 50);
                for (let i = 0; i < count; i++) {
                    const poolAddr = await factory.allPools(i);
                    const poolInfo = await getElisV2PoolInfo(provider, chainId, poolAddr);
                    pools.push(poolInfo);
                }
            }
            catch (err) {
                console.warn(`[ElisSDK] Failed to fetch V2 pools for chain ${chainId}:`, err);
            }
        }
    }
    if (!protocol || protocol === 'ELIS_V3') {
        const factoryAddr = getElisV3Factory(chainId);
        if (factoryAddr) {
            try {
                const factory = new Contract(factoryAddr, ELIS_V3_FACTORY_ABI, provider);
                const len = await factory.allPoolsLength();
                const count = Math.min(Number(len), 50);
                for (let i = 0; i < count; i++) {
                    const poolAddr = await factory.allPools(i);
                    const poolInfo = await getElisV3PoolInfo(provider, chainId, poolAddr);
                    pools.push(poolInfo);
                }
            }
            catch (err) {
                console.warn(`[ElisSDK] Failed to fetch V3 pools for chain ${chainId}:`, err);
            }
        }
    }
    return pools;
}
