import { Contract, Provider } from 'ethers';
import { ELIS_TREASURY_ABI, ELIS_FEE_CONTROLLER_ABI, getElisTreasuryAddress, getElisFeeController } from '@elis/contracts';
import { ElisTreasuryInfo } from './types';
export async function getElisTreasuryInfo(provider: Provider, chainId: number): Promise<ElisTreasuryInfo> {
    const treasuryAddress = getElisTreasuryAddress(chainId);
    const feeControllerAddress = getElisFeeController(chainId);
    if (!treasuryAddress) {
        throw new Error(`ELIS_TREASURY_NOT_CONFIGURED for chain ${chainId}`);
    }
    if (!feeControllerAddress) {
        throw new Error(`ELIS_FEE_CONTROLLER_NOT_CONFIGURED for chain ${chainId}`);
    }
    const treasuryContract = new Contract(treasuryAddress, ELIS_TREASURY_ABI, provider);
    const feeControllerContract = new Contract(feeControllerAddress, ELIS_FEE_CONTROLLER_ABI, provider);
    const [owner, protocolFeeBps] = await Promise.all([
        treasuryContract.governance(),
        feeControllerContract.protocolFeeBps()
    ]);
    return {
        chainId,
        treasuryAddress,
        feeControllerAddress,
        defaultFeeBps: Number(protocolFeeBps),
        owner
    };
}

export const getTreasuryInfo = getElisTreasuryInfo;
