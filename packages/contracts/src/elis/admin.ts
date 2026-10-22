import { ConfigurationError } from '../errors';

export const ELIS_ADMIN: Record<string | number, string | undefined> = {
    1: undefined,
    10: undefined,
    56: undefined,
    137: undefined,
    8453: undefined,
    42161: undefined,
    43114: undefined,
    solana: undefined
};

export const ELIS_GUARDIAN_PAUSER: Record<string | number, string | undefined> = {
    1: undefined,
    10: undefined,
    56: undefined,
    137: undefined,
    8453: undefined,
    42161: undefined,
    43114: undefined,
    solana: undefined
};

export function getElisAdmin(chainId: string | number): string {
    const address = ELIS_ADMIN[chainId];
    if (!address) {
        throw new ConfigurationError(`ELIS Admin address is not configured for chain ${chainId}.`, 'ELIS_ADMIN_NOT_CONFIGURED');
    }
    return address;
}

export function getElisGuardianPauser(chainId: string | number): string {
    const address = ELIS_GUARDIAN_PAUSER[chainId];
    if (!address) {
        throw new ConfigurationError(`ELIS Guardian Pauser address is not configured for chain ${chainId}.`, 'ELIS_GUARDIAN_NOT_CONFIGURED');
    }
    return address;
}
