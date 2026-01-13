import type {
  FlexibleIncentiveConfig,
  BulkSessionInput,
  DynamicCalculationResult,
  TierTable,
  CalculationRule,
  DynamicPolicyRow,
} from "../types/index.ts";

/**
 * Checks strict eligibility for Add-ons.
 * Rule: CI Sum Assured >= 25 Lakhs AND ADB Sum Assured >= 1 Crore.
 * Note: This DOES NOT affect Slab Entry or NOP Count.
 */
function isStrictlyEligible(policy: DynamicPolicyRow): boolean {
  const hasCI = policy.ciAbove25L === true;
  const hasADB = policy.adb === true;
  return hasCI && hasADB;
}

// Find matching tier table based on organization and vintage
function findTierTable(
  config: FlexibleIncentiveConfig,
  organization: string,
  vintage: string
): TierTable | undefined {
  let lookupVintage = vintage;
  if (vintage === "More than 3 Months") {
    lookupVintage = "Tier 1";
  }
  return config.tierTables.find((t) => t.vintage === lookupVintage);
}

// Evaluate a condition string against policy data
function evaluateCondition(
  condition: string,
  policy: DynamicPolicyRow
): boolean {
  try {
    let evalString = condition;
    Object.keys(policy).forEach((key) => {
      const value = (policy as any)[key];
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
  rules: CalculationRule[],
  isEligible: boolean
): { payouts: number; penalties: number } {
  let totalPayouts = 0;
  let totalPenalties = 0;

  rules.forEach((rule) => {
    if (evaluateCondition(rule.condition, policy)) {
      if (rule.type === "penalty") {
        // Penalties apply to ALL policies, regardless of eligibility
        totalPenalties += Math.abs(rule.adjustment);
      } else {
        // Add-ons (Positive Incentives) apply ONLY if Policy is Eligible
        // Rule: "If policy is NOT eligible -> NO positive add-ons"
        if (isEligible) {
          totalPayouts += rule.adjustment;
        }
      }
    }
  });

  return { payouts: totalPayouts, penalties: totalPenalties };
}

/**
 * Calculate incentives strictly according to Master Prompt
 */
export function calculateDynamicIncentives(
  config: FlexibleIncentiveConfig,
  input: BulkSessionInput
): DynamicCalculationResult {
  const policies = input.policies;

  // 1. Term NOP
  // Rule: TOTAL number of TERM policies in the session.
  // Includes I-Secure / I-Secure Sachet. Includes policies WITHOUT CI or ADB.
  const termNOP = policies.length;

  // 2. Gate Criteria (Hard Stop)
  // Gate is checked using TOTAL TERM NOP — never eligible NOP.
  // 0–3 Months (HRO): 3
  // Tier 1 (>3 months): 4
  // Tier 2: 5

  // Normalize Vintage
  let effectiveVintage = input.vintage;
  if (effectiveVintage === "More than 3 Months") effectiveVintage = "Tier 1";

  let minGateRequired = 4; // Default to Tier 1
  if (effectiveVintage === "Tier 2") minGateRequired = 5;
  else if (effectiveVintage === "0-3 Months") minGateRequired = 3;

  const gatePassed = termNOP >= minGateRequired;

  if (!gatePassed) {
    // If gate fails -> Total Incentive = 0
    return {
      policies: policies.map((p) => ({
        ...p,
        ape: calculateAPE(p),
        additionalPayout: 0,
        totalPenalty: 0,
        totalIncentive: 0,
        isDeferred: false,
      })),
      totalIncentive: 0,
      deferredIncentive: 0,
      averageTicketSize: 0,
      atsIncentive: 0,
      breakdown: {
        totalBase: 0,
        totalPayouts: 0,
        totalPenalties: 0,
        totalRate: 0,
      },
    };
  }

  // 3. Slab Incentive
  // Slab is selected using TOTAL TERM NOP
  let baseFromSlab = 0;
  const tierTable = findTierTable(config, input.organization, input.vintage);

  if (tierTable) {
    const sortedTiers = [...tierTable.tiers].sort((a, b) => b.nop - a.nop);
    const matchingTier = sortedTiers.find((t) => termNOP >= t.nop);

    if (matchingTier) {
      baseFromSlab = matchingTier.incentive;

      // 3.2 Above-Slab Logic
      // If TOTAL TERM NOP > Max Slab NOP, Extra = (Excess * 2000)
      const maxTierNOP = Math.max(...tierTable.tiers.map((t) => t.nop));
      if (termNOP > maxTierNOP) {
        const excess = termNOP - maxTierNOP;
        baseFromSlab += excess * 2000;
      }
    }
  }

  // 4. Calculate total APE and ATS Booster multiplier
  const totalAPE = policies.reduce((sum, p) => sum + calculateAPE(p), 0);
  const averageTicketSize = termNOP > 0 ? totalAPE / termNOP : 0;

  let atsMultiplier = 0;
  if (config.atsTable) {
    const sortedAts = [...config.atsTable].sort((a, b) => b.minAts - a.minAts);
    const matchingAts = sortedAts.find((s) => averageTicketSize >= s.minAts);
    if (matchingAts) {
      atsMultiplier = matchingAts.incentive;
    }
  }

  // 5. Process Policies (Add-ons, Penalties, Deferrals)
  // Slab base is split equally per policy for attribution.
  // Booster applies to (Base Share + Add-ons - Penalties) per policy.

  let totalPayouts = 0;
  let totalPenalties = 0;
  let totalBoostAmount = 0;
  let totalReleasedNow = 0;
  let totalDeferredLater = 0;

  const baseSharePerPolicy = termNOP > 0 ? baseFromSlab / termNOP : 0;

  const calculatedPolicies = policies.map((policy) => {
    const ape = calculateAPE(policy);
    const isEligible = isStrictlyEligible(policy);

    // Apply Add-ons & Penalties
    const { payouts, penalties } = applyCalculationRules(
      policy,
      config.calculationRules,
      isEligible
    );

    totalPayouts += payouts;
    totalPenalties += penalties;

    // Generated Value for this policy (pre-boost)
    const generatedPreBoost = baseSharePerPolicy + payouts - penalties;

    // Apply Booster to this specific policy's value
    const boosterForPolicy = generatedPreBoost * atsMultiplier;
    totalBoostAmount += boosterForPolicy;

    const totalPolicyValue = generatedPreBoost + boosterForPolicy;

    // 6. I-Secure Deferred Incentive
    // Rule: If (I-Secure OR I-Secure Sachet) AND Monthly -> ENTIRE product value is deferred
    const isISecureMonthly =
      (policy.policyName === "I-Secure" ||
        policy.policyName === "I-Secure sachet") &&
      policy.paymentFrequency === "Monthly";

    if (isISecureMonthly) {
      totalDeferredLater += totalPolicyValue;
    } else {
      totalReleasedNow += totalPolicyValue;
    }

    return {
      ...policy,
      ape,
      additionalPayout: payouts,
      totalPenalty: penalties,
      isDeferred: isISecureMonthly,
      totalIncentive: totalPolicyValue, // Value Generated
    };
  });

  return {
    policies: calculatedPolicies,
    totalIncentive: totalReleasedNow, // Released Immediately
    deferredIncentive: totalDeferredLater, // Released Later
    averageTicketSize,
    atsIncentive: totalBoostAmount,
    breakdown: {
      totalBase: baseFromSlab,
      totalPayouts,
      totalPenalties,
      totalRate:
        termNOP > 0 ? (totalReleasedNow + totalDeferredLater) / termNOP : 0,
    },
  };
}
