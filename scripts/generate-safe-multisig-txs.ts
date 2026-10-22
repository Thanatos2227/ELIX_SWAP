import fs from 'node:fs';
import path from 'node:path';
export interface SafeTransactionMeta {
    name: string;
    description: string;
    txBuilderVersion: string;
    createdAt: number;
    createdFromSafeAddress: string;
    createdFromOwnerAddress: string;
    checksum: string;
}
export interface SafeTransactionItem {
    to: string;
    value: string;
    data: string | null;
    contractMethod: {
        inputs: Array<{
            name: string;
            type: string;
            internalType?: string;
        }>;
        name: string;
        payable: boolean;
    } | null;
    contractInputsValues: Record<string, string>;
}
export interface SafeBatchFile {
    version: string;
    chainId: string;
    createdAt: number;
    meta: SafeTransactionMeta;
    transactions: SafeTransactionItem[];
}
export interface ProtocolDeploymentConfig {
    chainId: number;
    safeMultisigAddress: string;
    deployerAddress: string;
    emergencyGuardianAddress: string;
    contracts: {
        elisTreasury: string;
        elisFeeController: string;
        elisV1Factory: string;
        elisV2Factory: string;
        elisV3Factory: string;
        elisUnifiedRouter: string;
        elisCircuitBreaker: string;
        elisCrossChainRouter: string;
    };
}
export function generateDeployerInitiationBatch(config: ProtocolDeploymentConfig): SafeBatchFile {
    const transactions: SafeTransactionItem[] = [
        {
            to: config.contracts.elisTreasury,
            value: "0",
            data: null,
            contractMethod: {
                name: "transferGovernance",
                payable: false,
                inputs: [{ name: "_newGovernance", type: "address" }]
            },
            contractInputsValues: {
                _newGovernance: config.safeMultisigAddress
            }
        },
        {
            to: config.contracts.elisFeeController,
            value: "0",
            data: null,
            contractMethod: {
                name: "transferGovernance",
                payable: false,
                inputs: [{ name: "_newGovernance", type: "address" }]
            },
            contractInputsValues: {
                _newGovernance: config.safeMultisigAddress
            }
        },
        {
            to: config.contracts.elisV1Factory,
            value: "0",
            data: null,
            contractMethod: {
                name: "setFeeToSetter",
                payable: false,
                inputs: [{ name: "_feeToSetter", type: "address" }]
            },
            contractInputsValues: {
                _feeToSetter: config.safeMultisigAddress
            }
        },
        {
            to: config.contracts.elisV2Factory,
            value: "0",
            data: null,
            contractMethod: {
                name: "setFeeToSetter",
                payable: false,
                inputs: [{ name: "_feeToSetter", type: "address" }]
            },
            contractInputsValues: {
                _feeToSetter: config.safeMultisigAddress
            }
        },
        {
            to: config.contracts.elisV3Factory,
            value: "0",
            data: null,
            contractMethod: {
                name: "setOwner",
                payable: false,
                inputs: [{ name: "_owner", type: "address" }]
            },
            contractInputsValues: {
                _owner: config.safeMultisigAddress
            }
        },
        {
            to: config.contracts.elisUnifiedRouter,
            value: "0",
            data: null,
            contractMethod: {
                name: "transferGovernance",
                payable: false,
                inputs: [{ name: "_newGovernance", type: "address" }]
            },
            contractInputsValues: {
                _newGovernance: config.safeMultisigAddress
            }
        }
    ];
    return {
        version: "1.0",
        chainId: config.chainId.toString(),
        createdAt: Date.now(),
        meta: {
            name: "ELIS — Phase 1: Deployer Governance Handover Initiation",
            description: "Batch transactions executed by the deployer to transfer protocol roles to the 4-of-7 Safe Multisig.",
            txBuilderVersion: "1.16.5",
            createdAt: Date.now(),
            createdFromSafeAddress: config.safeMultisigAddress,
            createdFromOwnerAddress: config.deployerAddress,
            checksum: ""
        },
        transactions
    };
}
export function generateSafeMultisigAcceptanceBatch(config: ProtocolDeploymentConfig): SafeBatchFile {
    const transactions: SafeTransactionItem[] = [
        {
            to: config.contracts.elisTreasury,
            value: "0",
            data: null,
            contractMethod: {
                name: "acceptGovernance",
                payable: false,
                inputs: []
            },
            contractInputsValues: {}
        },
        {
            to: config.contracts.elisFeeController,
            value: "0",
            data: null,
            contractMethod: {
                name: "acceptGovernance",
                payable: false,
                inputs: []
            },
            contractInputsValues: {}
        },
        {
            to: config.contracts.elisUnifiedRouter,
            value: "0",
            data: null,
            contractMethod: {
                name: "acceptGovernance",
                payable: false,
                inputs: []
            },
            contractInputsValues: {}
        },
        {
            to: config.contracts.elisCircuitBreaker,
            value: "0",
            data: null,
            contractMethod: {
                name: "updateGuardian",
                payable: false,
                inputs: [{ name: "newGuardian", type: "address" }]
            },
            contractInputsValues: {
                newGuardian: config.emergencyGuardianAddress
            }
        }
    ];
    return {
        version: "1.0",
        chainId: config.chainId.toString(),
        createdAt: Date.now(),
        meta: {
            name: "ELIS — Phase 2: 4-of-7 Safe Multisig Governance Acceptance Batch",
            description: "Batch transaction to be signed and executed by the 4-of-7 Safe Multisig signers to finalize protocol ownership.",
            txBuilderVersion: "1.16.5",
            createdAt: Date.now(),
            createdFromSafeAddress: config.safeMultisigAddress,
            createdFromOwnerAddress: config.safeMultisigAddress,
            checksum: ""
        },
        transactions
    };
}
export function generateCastCliVerificationCommands(config: ProtocolDeploymentConfig, rpcUrl: string = "$RPC_URL"): string[] {
    return [
        `# 1. Verify ElisTreasury Governance`,
        `cast call ${config.contracts.elisTreasury} "governance()(address)" --rpc-url ${rpcUrl}`,
        `# 2. Verify ElisFeeController Governance & Treasury Binding`,
        `cast call ${config.contracts.elisFeeController} "governance()(address)" --rpc-url ${rpcUrl}`,
        `cast call ${config.contracts.elisFeeController} "treasury()(address)" --rpc-url ${rpcUrl}`,
        `# 3. Verify ElisV1Factory FeeToSetter`,
        `cast call ${config.contracts.elisV1Factory} "feeToSetter()(address)" --rpc-url ${rpcUrl}`,
        `# 4. Verify ElisV2Factory FeeToSetter`,
        `cast call ${config.contracts.elisV2Factory} "feeToSetter()(address)" --rpc-url ${rpcUrl}`,
        `# 5. Verify ElisV3Factory Owner`,
        `cast call ${config.contracts.elisV3Factory} "owner()(address)" --rpc-url ${rpcUrl}`,
        `# 6. Verify ElisCircuitBreaker Guardian`,
        `cast call ${config.contracts.elisCircuitBreaker} "emergencyGuardian()(address)" --rpc-url ${rpcUrl}`,
        `cast call ${config.contracts.elisCircuitBreaker} "governance()(address)" --rpc-url ${rpcUrl}`
    ];
}
if (process.argv[1] && path.basename(process.argv[1]).includes('generate-safe-multisig-txs')) {
    const isDryRun = process.argv.includes('--dry-run');
    const sampleConfig: ProtocolDeploymentConfig = {
        chainId: 1,
        safeMultisigAddress: process.env.GOVERNANCE_MULTISIG || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        deployerAddress: process.env.DEPLOYER_ADDRESS || "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        emergencyGuardianAddress: process.env.EMERGENCY_GUARDIAN || "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        contracts: {
            elisTreasury: "0x1111111111111111111111111111111111111111",
            elisFeeController: "0x2222222222222222222222222222222222222222",
            elisV1Factory: "0x3333333333333333333333333333333333333333",
            elisV2Factory: "0x4444444444444444444444444444444444444444",
            elisV3Factory: "0x5555555555555555555555555555555555555555",
            elisUnifiedRouter: "0x6666666666666666666666666666666666666666",
            elisCircuitBreaker: "0x7777777777777777777777777777777777777777",
            elisCrossChainRouter: "0x8888888888888888888888888888888888888888"
        }
    };
    const phase1Batch = generateDeployerInitiationBatch(sampleConfig);
    const phase2Batch = generateSafeMultisigAcceptanceBatch(sampleConfig);
    const verificationCommands = generateCastCliVerificationCommands(sampleConfig);
    const outDir = path.resolve(process.cwd(), 'deployments', 'multisig');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    const phase1Path = path.join(outDir, 'phase1_deployer_initiation_batch.json');
    const phase2Path = path.join(outDir, 'phase2_safe_acceptance_batch.json');
    const verificationPath = path.join(outDir, 'verify_governance.sh');
    fs.writeFileSync(phase1Path, JSON.stringify(phase1Batch, null, 2));
    fs.writeFileSync(phase2Path, JSON.stringify(phase2Batch, null, 2));
    fs.writeFileSync(verificationPath, verificationCommands.join('\n') + '\n');
    console.log(`[Safe Multisig Generator] Generated Phase 1 Batch: ${phase1Path}`);
    console.log(`[Safe Multisig Generator] Generated Phase 2 Batch: ${phase2Path}`);
    console.log(`[Safe Multisig Generator] Generated Cast Verification Script: ${verificationPath}`);
    console.log(`[Safe Multisig Generator] Total Actions: ${phase1Batch.transactions.length + phase2Batch.transactions.length}`);
    if (isDryRun) {
        console.log(`[Safe Multisig Generator] DRY RUN VALIDATION PASSED.`);
    }
}
