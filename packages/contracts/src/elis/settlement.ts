import { ConfigurationError } from '../errors';

export const ELIS_SETTLEMENT_CONTRACT: Record<string | number, string | undefined> = {
    1: undefined,
    10: undefined,
    56: undefined,
    137: undefined,
    8453: undefined,
    42161: undefined,
    43114: undefined,
    solana: undefined
};

export const ELIS_SOLVER_CONTRACT: Record<string | number, string | undefined> = {
    1: undefined,
    10: undefined,
    56: undefined,
    137: undefined,
    8453: undefined,
    42161: undefined,
    43114: undefined,
    solana: undefined
};

export function getElisSettlementContract(chainId: string | number): string {
    const address = ELIS_SETTLEMENT_CONTRACT[chainId];
    if (!address) {
        throw new ConfigurationError(`ELIS Settlement contract is not deployed or configured for chain ${chainId}.`, 'ELIS_SETTLEMENT_NOT_CONFIGURED');
    }
    return address;
}

export function getElisSolverContract(chainId: string | number): string {
    const address = ELIS_SOLVER_CONTRACT[chainId];
    if (!address) {
        throw new ConfigurationError(`ELIS Solver contract is not deployed or configured for chain ${chainId}.`, 'ELIS_SOLVER_NOT_CONFIGURED');
    }
    return address;
}
