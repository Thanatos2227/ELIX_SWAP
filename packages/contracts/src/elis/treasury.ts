import { ConfigurationError } from '../errors';
import { getElisDeployment } from '../deployments';

export const ELIS_TREASURY: Record<string | number, string | undefined> = {
    1: undefined,
    10: undefined,
    56: undefined,
    137: undefined,
    8453: undefined,
    42161: undefined,
    43114: undefined,
    solana: undefined
};

export const ELIS_PROTOCOL_FEE_RECIPIENT: Record<string | number, string | undefined> = {
    1: undefined,
    10: undefined,
    56: undefined,
    137: undefined,
    8453: undefined,
    42161: undefined,
    43114: undefined,
    solana: undefined
};

export function getElisTreasury(chainId: string | number): string {
    const deployment = typeof chainId === 'number' ? getElisDeployment(chainId) : undefined;
    const address = ELIS_TREASURY[chainId] || deployment?.treasury;
    if (!address) {
        throw new ConfigurationError(`ELIS Treasury address is not configured for chain ${chainId}. Protocol fee collection cannot proceed.`, 'ELIS_TREASURY_NOT_CONFIGURED');
    }
    return address;
}
export const getElisTreasuryAddress = getElisTreasury;

export function getElisFeeControllerAddress(chainId: string | number): string {
    const deployment = typeof chainId === 'number' ? getElisDeployment(chainId) : undefined;
    const address = deployment?.feeController;
    if (!address) {
        throw new ConfigurationError(`ELIS Fee Controller is not configured for chain ${chainId}.`, 'ELIS_FEE_CONTROLLER_NOT_CONFIGURED');
    }
    return address;
}

export function getElisProtocolFeeRecipient(chainId: string | number): string {
    const address = ELIS_PROTOCOL_FEE_RECIPIENT[chainId];
    if (!address) {
        throw new ConfigurationError(`ELIS Protocol Fee Recipient is not configured for chain ${chainId}.`, 'ELIS_FEE_RECIPIENT_NOT_CONFIGURED');
    }
    return address;
}

export function isElisTreasuryConfigured(chainId: string | number): boolean {
    const deployment = typeof chainId === 'number' ? getElisDeployment(chainId) : undefined;
    return Boolean(ELIS_TREASURY[chainId] || deployment?.treasury);
}
