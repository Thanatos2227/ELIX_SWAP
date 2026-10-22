import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AcrossProvider } from '../packages/routing/src/crosschain/providers/acrossProvider';
import { defaultTokenService } from '../packages/tokens/src';
import { defaultChainRegistry } from '../packages/chains/src';
import { ExecutionPlanBuilder, sealPlan, assertPlanIntegrity } from '../packages/execution/src';
import { CrossChainQuote, QuoteRequest } from '../packages/types/src';

const USER_ADDR = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
const RECIPIENT_ADDR = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const SPOKE_POOL_ARB = '0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A';
const MOCK_API_KEY = 'test_across_api_key_regression_12345';
const MOCK_INTEGRATOR_ID = '0x0001';

describe('ELIS — Across Output Amount Parsing & Slippage Bounds Regression Suite', () => {
  const usdcArb = defaultTokenService.getTokensForChain('arbitrum').find((t) => t.symbol === 'USDC')!;
  const usdcBase = defaultTokenService.getTokensForChain('base').find((t) => t.symbol === 'USDC')!;
  const ethArb = defaultTokenService.getTokensForChain('arbitrum').find((t) => t.symbol === 'ETH')!;
  const wethBase = defaultTokenService.getTokensForChain('base').find((t) => t.symbol === 'WETH')!;

  const createBaseRequest = (overrides?: Partial<QuoteRequest>): QuoteRequest => ({
    sourceChainId: 'arbitrum',
    destinationChainId: 'base',
    tokenIn: usdcArb,
    tokenOut: usdcBase,
    amountInRaw: '1000000000', // 1,000 USDC
    userWalletAddress: USER_ADDR,
    recipientAddress: RECIPIENT_ADDR,
    slippageTolerancePercent: 0.5,
    ...overrides
  });

  const createMockResponse = (dataOverrides: Record<string, any>) => {
    return (async () => {
      const payload = {
        swapTx: {
          to: SPOKE_POOL_ARB,
          data: '0x7b9392320000000000000000000000008ba1f109551bd432803012645ac136ddd64dba72',
          value: '0',
          chainId: 42161
        },
        expectedOutputAmount: '999500000',
        minOutputAmount: '994502500',
        quoteExpiryTimestamp: Math.floor(Date.now() / 1000) + 300,
        totalRelayFee: { total: '500000', pct: '0.0005' },
        estimatedFillTimeSec: 20,
        ...dataOverrides
      };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as any;
  };

  // =========================================================================
  // FINDING 1: ACROSS V3 OUTPUT AMOUNT PARSING REGRESSION TESTS
  // =========================================================================
  describe('Finding 1: Across V3 Output Amount Parsing', () => {
    it('1.1 Parses valid expectedOutputAmount correctly (primary Across V3 field)', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '999895647',
        minOutputAmount: '999895647'
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      assert.equal(quote.destinationAmountRaw, '999895647');
      assert.equal(quote.minDestinationAmountRaw, '999895647');
    });

    it('1.2 Falls back to outputAmount when expectedOutputAmount is omitted (legacy Across V2 compatibility)', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: undefined,
        outputAmount: '999500000',
        minOutputAmount: '994502500'
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      assert.equal(quote.destinationAmountRaw, '999500000');
    });

    it('1.3 Falls back to destinationAmount when both expectedOutputAmount and outputAmount are omitted', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: undefined,
        outputAmount: undefined,
        destinationAmount: '999200000',
        minOutputAmount: '994200000'
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      assert.equal(quote.destinationAmountRaw, '999200000');
    });

    it('1.4 Falls back to totalRelayFee deduction when all net output fields are omitted', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: undefined,
        outputAmount: undefined,
        destinationAmount: undefined,
        minOutputAmount: undefined,
        totalRelayFee: { total: '1000000', pct: '0.001' } // 1 USDC fee on 1000 USDC input
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      assert.equal(quote.destinationAmountRaw, '999000000'); // 1,000,000,000 - 1,000,000
    });

    it('1.5 Rejects missing output amount fail-closed with INVALID_AMOUNT', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: undefined,
        outputAmount: undefined,
        destinationAmount: undefined,
        totalRelayFee: undefined,
        minOutputAmount: undefined
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('1.6 Rejects empty string output amount fail-closed', async () => {
      const mockFetch = createMockResponse({ expectedOutputAmount: '' });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('1.7 Rejects whitespace-only output amount fail-closed', async () => {
      const mockFetch = createMockResponse({ expectedOutputAmount: '   ' });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('1.8 Rejects negative output amount fail-closed', async () => {
      const mockFetch = createMockResponse({ expectedOutputAmount: '-500000' });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('1.9 Rejects decimal output amount fail-closed', async () => {
      const mockFetch = createMockResponse({ expectedOutputAmount: '999500.50' });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('1.10 Rejects scientific notation output amount fail-closed', async () => {
      const mockFetch = createMockResponse({ expectedOutputAmount: '1e18' });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('1.11 Rejects leading-zero output amount format fail-closed', async () => {
      const mockFetch = createMockResponse({ expectedOutputAmount: '0999500000' });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('1.12 Rejects non-numeric output amount fail-closed', async () => {
      const mockFetch = createMockResponse({ expectedOutputAmount: 'unauthorized_or_corrupted' });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('1.13 Rejects zero net output amount fail-closed', async () => {
      const mockFetch = createMockResponse({ expectedOutputAmount: '0', minOutputAmount: '0' });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('1.14 Does not silently fall back to legacy output field when primary expectedOutputAmount is malformed', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '-999500000', // malformed primary
        outputAmount: '999500000'           // valid secondary
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false, 'Malformed primary field must not silently promote secondary field');
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('1.15 Valid primary expectedOutputAmount takes strict precedence over differing secondary outputAmount', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '999800000',
        outputAmount: '999100000'
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      assert.equal(quote.destinationAmountRaw, '999800000');
    });

    it('1.16 Rejects malformed totalRelayFee.total fail-closed', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: undefined,
        outputAmount: undefined,
        destinationAmount: undefined,
        totalRelayFee: { total: '-500', pct: '0.0005' }
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });
  });

  // =========================================================================
  // FINDING 2: SLIPPAGE TOLERANCE & CONSERVATIVE MINIMUM OUTPUT BOUNDS
  // =========================================================================
  describe('Finding 2: User Slippage Tolerance & Bridge Minimum Output', () => {
    it('2.1 Direct bridge route with default tolerance (0.5%) preserves equal provider bound when matching', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '1000000000',
        minOutputAmount: '1000000000' // Across exact-input guarantee
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: undefined }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      // User min at 0.5% would be 995,000,000. Protocol guarantee is 1,000,000,000.
      // Conservative bound must NOT loosen the protocol guarantee!
      assert.equal(quote.minDestinationAmountRaw, '1000000000');
    });

    it('2.2 User tolerance STRICTER than provider bound takes precedence (protective against bridge looseness)', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '1000000000',
        minOutputAmount: '990000000' // Provider allows 1.0% bridge slippage
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      // User requests 0.2% max slippage (min output: 998,000,000)
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: 0.2 }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      // Expected: 1,000,000,000
      // User bound: 998,000,000
      // Provider bound: 990,000,000
      // Effective minimum must be the STRICTER constraint: 998,000,000
      assert.equal(quote.minDestinationAmountRaw, '998000000');
    });

    it('2.3 Provider bound STRICTER than user tolerance takes precedence (protective against protocol degradation)', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '1000000000',
        minOutputAmount: '995000000' // Provider guarantees at least 995,000,000 (0.5% max)
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      // User specifies permissive 2.0% tolerance (user min would be 980,000,000)
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: 2.0 }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      // Provider bound (995,000,000) is stricter than user bound (980,000,000)
      // Effective minimum must adopt the stricter protocol guarantee: 995,000,000
      assert.equal(quote.minDestinationAmountRaw, '995000000');
    });

    it('2.4 Missing provider minOutputAmount computes minimum output strictly from user tolerance', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '1000000000',
        minOutputAmount: undefined,
        minimumOutputAmount: undefined,
        minDestinationAmount: undefined
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: 0.5 }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      assert.equal(quote.minDestinationAmountRaw, '995000000');
    });

    it('2.5 Zero slippage tolerance (0.0%) sets minimum destination amount equal to expected output', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '1000000000',
        minOutputAmount: '990000000'
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: 0 }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      assert.equal(quote.minDestinationAmountRaw, '1000000000');
    });

    it('2.6 Maximum permitted boundary tolerance (50.0%) is accepted and applied accurately', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '1000000000',
        minOutputAmount: undefined
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: 50.0 }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      assert.equal(quote.minDestinationAmountRaw, '500000000'); // 50% of 1,000,000,000
    });

    it('2.7 Rejects negative slippage tolerance fail-closed with INVALID_AMOUNT', async () => {
      const mockFetch = createMockResponse({});
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: -0.5 }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('2.8 Rejects out-of-range slippage tolerance (> 50.0%) fail-closed with INVALID_AMOUNT', async () => {
      const mockFetch = createMockResponse({});
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: 50.01 }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('2.9 Rejects NaN slippage tolerance fail-closed with INVALID_AMOUNT', async () => {
      const mockFetch = createMockResponse({});
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: NaN }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('2.10 Rejects Infinity slippage tolerance fail-closed with INVALID_AMOUNT', async () => {
      const mockFetch = createMockResponse({});
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: Infinity }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('2.11 Rejects non-numeric slippage tolerance fail-closed with INVALID_AMOUNT', async () => {
      const mockFetch = createMockResponse({});
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: 'permissive' as any }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('2.12 Rejects malformed provider minOutputAmount fail-closed', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '1000000000',
        minOutputAmount: '-990000000'
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('2.13 Rejects inconsistent provider values when minOutputAmount exceeds expectedOutputAmount', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '999500000',
        minOutputAmount: '1005000000' // min > expected is an inconsistent invariant violation
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest());

      assert.ok(quote);
      assert.equal(quote.isExecutable, false);
      assert.equal(quote.unexecutableReason, 'INVALID_AMOUNT');
    });

    it('2.14 Preserves integer arithmetic and token precision on 18-decimal token hops', async () => {
      // 1 ETH = 1e18 wei. Expected output: 0.9995 ETH = 999500000000000000 wei.
      const mockFetch = createMockResponse({
        swapTx: {
          to: SPOKE_POOL_ARB,
          data: '0x7b9392320000000000000000000000008ba1f109551bd432803012645ac136ddd64dba72',
          value: '1000000000000000000',
          chainId: 42161
        },
        expectedOutputAmount: '999500000000000000',
        minOutputAmount: '994502500000000000'
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote({
        sourceChainId: 'arbitrum',
        destinationChainId: 'base',
        tokenIn: ethArb,
        tokenOut: wethBase,
        amountInRaw: '1000000000000000000',
        userWalletAddress: USER_ADDR,
        recipientAddress: RECIPIENT_ADDR,
        slippageTolerancePercent: 0.5
      });

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      assert.equal(quote.destinationAmountRaw, '999500000000000000');
      assert.equal(quote.minDestinationAmountRaw, '994502500000000000');
    });
  });

  // =========================================================================
  // FINDING 3: EXECUTION PLAN INTEGRITY WITH CORRECTED SLIPPAGE BOUNDS
  // =========================================================================
  describe('Finding 3: Execution Plan Integrity with Corrected Amounts', () => {
    it('3.1 Builds, seals, and validates an ExecutionPlan locking in the conservative minimum output', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '1000000000',
        minOutputAmount: '990000000' // Provider says 990,000,000
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      // User requests stricter 0.1% slippage (min output: 999,000,000)
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: 0.1 }));

      assert.ok(quote);
      assert.equal(quote.isExecutable, true);
      assert.equal(quote.destinationAmountRaw, '1000000000');
      assert.equal(quote.minDestinationAmountRaw, '999000000');

      const plan = ExecutionPlanBuilder.buildPlan({
        route: {
          id: 'route-conservative-slippage-test',
          routeType: 'CROSS_CHAIN',
          hops: [],
          crossChainQuote: quote,
          isExecutable: true,
          gasCostUSD: 0.05,
          estimatedGasUnits: 200000n
        },
        request: createBaseRequest({ slippageTolerancePercent: 0.1 })
      });

      assert.ok(plan);
      assert.equal(plan.isExecutable, true);
      assert.equal(plan.expectedAmountOutRaw, '1000000000');
      assert.equal(plan.minimumAmountOutRaw, '999000000');

      // Verify sealing and integrity verification
      const sealedPlan = sealPlan(plan);
      assert.ok(sealedPlan.integrityHash);
      assert.doesNotThrow(() => assertPlanIntegrity(sealedPlan));
    });

    it('3.2 Tampering with minimumAmountOutRaw breaks plan integrity hash verification', async () => {
      const mockFetch = createMockResponse({
        expectedOutputAmount: '1000000000',
        minOutputAmount: '999000000'
      });
      const provider = new AcrossProvider({ apiKey: MOCK_API_KEY, integratorId: MOCK_INTEGRATOR_ID, fetchFn: mockFetch });
      const quote = await provider.getQuote(createBaseRequest({ slippageTolerancePercent: 0.1 }));

      const plan = ExecutionPlanBuilder.buildPlan({
        route: {
          id: 'route-tamper-slippage-test',
          routeType: 'CROSS_CHAIN',
          hops: [],
          crossChainQuote: quote!,
          isExecutable: true,
          gasCostUSD: 0.05,
          estimatedGasUnits: 200000n
        },
        request: createBaseRequest({ slippageTolerancePercent: 0.1 })
      });

      const sealedPlan = sealPlan(plan);
      // Attempt to tamper with minimumAmountOutRaw downstream
      (sealedPlan as any).minimumAmountOutRaw = '950000000'; // loosened bound

      assert.throws(() => assertPlanIntegrity(sealedPlan), /INTEGRITY_BREACH/);
    });
  });
});
