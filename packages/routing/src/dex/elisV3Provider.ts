import { DEXProtocol, Token } from '@elis/types';
import { Interface, Provider } from 'ethers';
import { ELIS_V3_ROUTER_ABI, CANONICAL_NATIVE_ADDRESS, getElisV3Router, ElisRouterNotDeployedError } from '@elis/contracts';
import { DEXProvider, DEXQuote, DEXExecution, DEXQuoteParams } from './types';
import { calculateV3ConcentratedOutput, isNativeToken, resolvePoolTokenAddress } from './dexMath';
import { PoolStateReader } from './poolStateReader';
export class ElisV3Provider implements DEXProvider {
    public readonly id: DEXProtocol = 'ELIS_V3';
    public readonly protocol: DEXProtocol = 'ELIS_V3';
    public readonly name = 'ELIS V3 Concentrated AMM';
    public readonly supportedChainIds: number[] = [1, 10, 56, 137, 8453, 42161, 43114, 31337];
    public isAvailable(chainId: number | string, _tokenIn: Token, _tokenOut: Token): boolean {
        const id = typeof chainId === 'number' ? chainId : (chainId === 'polygon' ? 137 : Number(chainId));
        const routerAddress = getElisV3Router(id);
        return Boolean(routerAddress && this.supportedChainIds.includes(id));
    }
    public async getQuote(params: DEXQuoteParams): Promise<DEXQuote | null> {
        if (!this.supportedChainIds.includes(params.chainId)) {
            return null;
        }
        const routerAddress = getElisV3Router(params.chainId);
        if (!routerAddress) {
            return null;
        }
        const effectiveFeeBps = (params as any).feeTierBps !== undefined ? (params as any).feeTierBps : 30;
        let poolAddress: string | undefined = undefined;
        let quoteBlockNumber: number | undefined = undefined;
        let calculated: ReturnType<typeof calculateV3ConcentratedOutput> = null;
        if ((params as any).provider) {
            try {
                const inAddr = resolvePoolTokenAddress(params.tokenIn, params.chainId);
                const outAddr = resolvePoolTokenAddress(params.tokenOut, params.chainId);
                const feePips = effectiveFeeBps * 100;
                const liveState = await PoolStateReader.getLivePoolStateForPair(params.chainId, inAddr, outAddr, feePips, (params as any).provider as Provider);
                if (liveState) {
                    poolAddress = liveState.poolAddress;
                    quoteBlockNumber = liveState.blockNumber;
                    calculated = calculateV3ConcentratedOutput({
                        chainId: params.chainId,
                        tokenIn: params.tokenIn,
                        tokenOut: params.tokenOut,
                        amountIn: params.amountIn,
                        feeTierBps: effectiveFeeBps,
                        slippageToleranceBps: params.slippageToleranceBps || 50,
                        customLiquidity: liveState.liquidity,
                        customSqrtPriceX96: liveState.sqrtPriceX96,
                        customCurrentTick: liveState.tick,
                        customTickSpacing: liveState.tickSpacing,
                        initializedTicks: liveState.initializedTicks
                    });
                }
            }
            catch {
            }
        }
        if (!calculated) {
            calculated = calculateV3ConcentratedOutput({
                chainId: params.chainId,
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                amountIn: params.amountIn,
                feeTierBps: effectiveFeeBps,
                slippageToleranceBps: params.slippageToleranceBps || 50,
                customReserveIn: (params as any).customReserveIn,
                customReserveOut: (params as any).customReserveOut,
                customLiquidity: (params as any).customLiquidity,
                customSqrtPriceX96: (params as any).customSqrtPriceX96,
                customCurrentTick: (params as any).customCurrentTick,
                customTickSpacing: (params as any).customTickSpacing,
                initializedTicks: (params as any).initializedTicks
            });
        }
        if (!calculated || calculated.amountOut <= 0n) {
            return null;
        }
        const quoteTimestamp = Date.now();
        return {
            provider: 'ELIS_V3',
            providerName: this.name,
            chainId: params.chainId,
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: params.amountIn,
            amountOut: calculated.amountOut,
            minimumAmountOut: calculated.minimumAmountOut,
            feeAmount: calculated.feeAmount,
            feeTierBps: calculated.feeTierBps,
            priceImpactPercent: calculated.priceImpactPercent,
            executionTarget: routerAddress,
            approvalTarget: routerAddress,
            poolAddress,
            quoteBlockNumber,
            gasEstimate: 160000n,
            gasCostUSD: 0.04,
            quoteTimestamp,
            expiration: quoteTimestamp + 15000,
            routePath: [params.tokenIn.address, params.tokenOut.address]
        };
    }
    public async buildExecution(quote: DEXQuote, userAddress: string, recipientAddress?: string, deadline?: number): Promise<DEXExecution> {
        const chainIdNum = typeof quote.chainId === 'number' ? quote.chainId : Number(quote.chainId);
        const routerAddress = getElisV3Router(chainIdNum);
        if (!routerAddress) {
            throw new ElisRouterNotDeployedError('ELIS_V3', chainIdNum);
        }
        const iface = new Interface(ELIS_V3_ROUTER_ABI);
        const recipient = recipientAddress || userAddress;
        const swapDeadline = deadline || Math.floor(Date.now() / 1000) + 1200;
        const tokenInAddr = resolvePoolTokenAddress(quote.tokenIn, chainIdNum);
        const tokenOutAddr = resolvePoolTokenAddress(quote.tokenOut, chainIdNum);
        const isNativeIn = isNativeToken(quote.tokenIn.address) || Boolean(quote.tokenIn.isNative);
        const calldata = iface.encodeFunctionData('exactInputSingle', [
            [
                tokenInAddr,
                tokenOutAddr,
                (quote.feeTierBps || 30) * 100,
                recipient,
                swapDeadline,
                quote.amountIn,
                quote.minimumAmountOut,
                0
            ]
        ]);
        return {
            to: routerAddress,
            data: calldata,
            value: isNativeIn ? quote.amountIn.toString() : '0',
            chainId: chainIdNum,
            gasLimit: quote.gasEstimate.toString(),
            gasEstimateUnits: quote.gasEstimate,
            approvalTarget: isNativeIn ? CANONICAL_NATIVE_ADDRESS : routerAddress,
            approvalAmount: isNativeIn ? '0' : quote.amountIn.toString(),
            requiredAllowanceRaw: isNativeIn ? '0' : quote.amountIn.toString()
        };
    }
}
export const elisV3Provider = new ElisV3Provider();
