import type {
  FlexibleIncentiveConfig,
  BulkSessionInput,
  DynamicCalculationResult,
  TierTable,
  CalculationRule,
  DynamicPolicyRow,
} from "../types/index.ts";

// Find matching tier table based on organization and vintage
function findTierTable(
  config: FlexibleIncentiveConfig,
  organization: string,
  vintage: string
): TierTable | undefined {
  return config.tierTables.find(
    (t) => t.organization === organization && t.vintage === vintage
  );
}

// Calculate base incentive from tier table
function calculateBaseIncentive(
  tierTable: TierTable | undefined,
  nop: number
): number {
  if (!tierTable || nop < 3) return 0;

  // Find matching tier or highest tier <= nop
  const sortedTiers = [...tierTable.tiers].sort((a, b) => b.nop - a.nop);
  const matchingTier = sortedTiers.find((t) => nop >= t.nop);

  // If nop is less than the smallest nop in the table, but >= 3, handles that if 3 is logic
  const minTierNOP = Math.min(...tierTable.tiers.map((t) => t.nop));
  if (nop < minTierNOP) return 0;

  let baseIncentive = matchingTier ? matchingTier.incentive : 0;

  // Excel logic: If NOP > max tier, add 2000 per additional NOP
  const maxTierNOP = Math.max(...tierTable.tiers.map((t) => t.nop));
  if (nop > maxTierNOP && matchingTier) {
    const additionalNOP = nop - maxTierNOP;
    baseIncentive = matchingTier.incentive + additionalNOP * 2000;
  }

  return baseIncentive;
}

// Evaluate a condition string against policy data
function evaluateCondition(
  condition: string,
  policy: DynamicPolicyRow
): boolean {
  try {
    // Simple eval replacement
    let evalString = condition;
    Object.keys(policy).forEach((key) => {
      const value = (policy as any)[key];
      // For boolean fields like ekyc, AA, etc.
      const valueStr = typeof value === "string" ? `"${value}"` : String(value);
      evalString = evalString.replace(
        new RegExp(`\\b${key}\\b`, "g"),
        valueStr
      );
    });

    const result = new Function(`return ${evalString}`)();
    return Boolean(result);
  } catch (e) {
    console.warn("Failed to evaluate condition:", condition, e);
    return false;
  }
}

// Calculate APE (Annual Premium Equivalent)
export function calculateAPE(policy: DynamicPolicyRow): number {
  const amount = Number(policy.paymentAmount) || 0;
  const frequency = policy.paymentFrequency;

  switch (frequency) {
    case "Monthly":
      return amount * 12;
    case "Quarterly":
      return amount * 4;
    case "Half-Yearly":
      return amount * 2;
    case "Annual":
      return amount;
    default:
      return amount;
  }
}

// Apply calculation rules to a policy
function applyCalculationRules(
  policy: DynamicPolicyRow,
  rules: CalculationRule[]
): { payouts: number; penalties: number } {
  let totalPayouts = 0;
  let totalPenalties = 0;

  rules.forEach((rule) => {
    if (evaluateCondition(rule.condition, policy)) {
      if (rule.type === "payout") {
        totalPayouts += rule.adjustment;
      } else {
        totalPenalties += Math.abs(rule.adjustment); // penalties usually negative in rule, but for summary we want abs
      }
    }
  });

  return { payouts: totalPayouts, penalties: totalPenalties };
}

/**
 * Calculate incentives for all policies using flexible configuration
 */
export function calculateDynamicIncentives(
  config: FlexibleIncentiveConfig,
  input: BulkSessionInput
): DynamicCalculationResult {
  const totalNOP = input.policies.length;

  // 1. Min 3 policy gate (universal minimum)
  if (totalNOP < 3) {
    return {
      policies: input.policies.map((p) => ({
        ...p,
        baseIncentive: 0,
        additionalPayout: 0,
        totalPenalty: 0,
        totalIncentive: 0,
      })),
      totalIncentive: 0,
      deferredIncentive: 0,
      averageTicketSize: 0,
      atsIncentive: 0,
      breakdown: { totalBase: 0, totalPayouts: 0, totalPenalties: 0 },
    };
  }

  const tierTable = findTierTable(config, input.organization, input.vintage);

  // 2. Base Incentive from slab lookup
  let baseFromSlab = calculateBaseIncentive(tierTable, totalNOP);

  // 3. Incremental incentive beyond slab cap
  // Slab caps: HRO = 15, Tier 1 = 16, Tier 2 = 17
  let slabCap = 15; // Default for HRO (Outsource 0-3 Months)
  if (input.vintage === "Tier 1") {
    slabCap = 16;
  } else if (input.vintage === "Tier 2") {
    slabCap = 17;
  }

  let incrementalIncentive = 0;
  if (totalNOP > slabCap) {
    incrementalIncentive = (totalNOP - slabCap) * 2000;
  }

  const totalBase = baseFromSlab + incrementalIncentive;

  // 4. Process each policy for add-ons, penalties, APE, and deferred status
  let totalPayouts = 0;
  let totalPenalties = 0;
  let totalAPE = 0;
  let deferredCount = 0;

  const calculatedPolicies = input.policies.map((policy) => {
    const ape = calculateAPE(policy);
    totalAPE += ape;

    const { payouts, penalties } = applyCalculationRules(
      policy,
      config.calculationRules
    );
    totalPayouts += payouts;
    totalPenalties += penalties;

    // Deferral check: I-Secure Monthly
    const isDeferred =
      policy.policyName === "I-Secure" && policy.paymentFrequency === "Monthly";
    if (isDeferred) deferredCount++;

    return {
      ...policy,
      ape,
      additionalPayout: payouts,
      totalPenalty: penalties,
      isDeferred,
    };
  });

  // 5. ATS Calculation (Average Ticket Size is Sum(APE) / NOP)
  const averageTicketSize = totalAPE / totalNOP;

  // Pre-ATS total = Base + Add-ons - Penalties
  const preAtsTotal = totalBase + totalPayouts - totalPenalties;

  // 6. ATS Booster (multiplier applied to preAtsTotal)
  let atsMultiplier = 0;
  if (config.atsTable) {
    // Sort descending by minAts to find the highest matching tier
    const sortedAts = [...config.atsTable].sort((a, b) => b.minAts - a.minAts);
    const matchingAts = sortedAts.find((s) => averageTicketSize >= s.minAts);
    if (matchingAts) {
      atsMultiplier = matchingAts.incentive;
    }
  }
  const atsBoosterAmount = preAtsTotal * atsMultiplier;

  // 7. Final Pool (before deferral split)
  const earningPool = preAtsTotal + atsBoosterAmount;

  // 8. Deferred Payout Logic (I-Secure Monthly)
  // We split the pool proportionally based on deferred vs non-deferred policies
  // Logic: Rate = Pool / TotalNOP
  // Immediate = (TotalNOP - DeferredNOP) * Rate
  // Deferred = DeferredNOP * Rate
  const ratePerPolicy = earningPool / totalNOP;
  const totalToRelease = (totalNOP - deferredCount) * ratePerPolicy;
  const totalDeferred = deferredCount * ratePerPolicy;

  return {
    policies: calculatedPolicies,
    totalIncentive: totalToRelease, // Released immediately
    deferredIncentive: totalDeferred,
    averageTicketSize,
    atsIncentive: atsBoosterAmount,
    breakdown: {
      totalBase,
      totalPayouts,
      totalPenalties,
      totalRate: ratePerPolicy,
    },
  };
}
