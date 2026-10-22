# 1. Verify ElisTreasury Governance
cast call 0x1111111111111111111111111111111111111111 "governance()(address)" --rpc-url $RPC_URL
# 2. Verify ElisFeeController Governance & Treasury Binding
cast call 0x2222222222222222222222222222222222222222 "governance()(address)" --rpc-url $RPC_URL
cast call 0x2222222222222222222222222222222222222222 "treasury()(address)" --rpc-url $RPC_URL
# 3. Verify ElisV1Factory FeeToSetter
cast call 0x3333333333333333333333333333333333333333 "feeToSetter()(address)" --rpc-url $RPC_URL
# 4. Verify ElisV2Factory FeeToSetter
cast call 0x4444444444444444444444444444444444444444 "feeToSetter()(address)" --rpc-url $RPC_URL
# 5. Verify ElisV3Factory Owner
cast call 0x5555555555555555555555555555555555555555 "owner()(address)" --rpc-url $RPC_URL
# 6. Verify ElisCircuitBreaker Guardian
cast call 0x7777777777777777777777777777777777777777 "emergencyGuardian()(address)" --rpc-url $RPC_URL
cast call 0x7777777777777777777777777777777777777777 "governance()(address)" --rpc-url $RPC_URL
