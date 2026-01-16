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
 * Internal helper to calculate total incentive for a specific set of policies.
 * This function is used twice: once for ALL policies, and once for ONLY immediate policies.
 * It DOES NOT handle deferral splits itself.
 */
function calculateIncentiveForSubset(
  config: FlexibleIncentiveConfig,
  input: BulkSessionInput,
  subsetPolicies: DynamicPolicyRow[]
): {
  policies: DynamicPolicyRow[];
  totalGenerated: number;
  baseFromSlab: number;
  totalPayouts: number;
  totalPenalties: number;
  totalBoostAmount: number;
  averageTicketSize: number;
} {
  // 1. Term NOP
  const termNOP = subsetPolicies.length;

  // 2. Gate Criteria (Hard Stop) - Based on THIS subset's NOP
  let effectiveVintage = input.vintage;
  if (effectiveVintage === "More than 3 Months") effectiveVintage = "Tier 1";

  let minGateRequired = 4; // Default to Tier 1
  if (effectiveVintage === "Tier 2") minGateRequired = 5;
  else if (effectiveVintage === "0-3 Months") minGateRequired = 3;

  const gatePassed = termNOP >= minGateRequired;

  if (!gatePassed) {
    return {
      policies: subsetPolicies.map((p) => ({
        ...p,
        ape: calculateAPE(p),
        additionalPayout: 0,
        totalPenalty: 0,
        totalIncentive: 0,
        isDeferred: false,
      })),
      totalGenerated: 0,
      baseFromSlab: 0,
      totalPayouts: 0,
      totalPenalties: 0,
      totalBoostAmount: 0,
      averageTicketSize: 0,
    };
  }

  // 3. Slab Incentive
  let baseFromSlab = 0;
  const tierTable = findTierTable(config, input.vintage);

  if (tierTable) {
    const sortedTiers = [...tierTable.tiers].sort((a, b) => b.nop - a.nop);
    const matchingTier = sortedTiers.find((t) => termNOP >= t.nop);

    if (matchingTier) {
      baseFromSlab = matchingTier.incentive;

      // Above-Slab Logic
      const maxTierNOP = Math.max(...tierTable.tiers.map((t) => t.nop));
      if (termNOP > maxTierNOP) {
        const excess = termNOP - maxTierNOP;
        baseFromSlab += excess * 2000;
      }
    }
  }

  // 4. Calculate total APE and ATS Booster multiplier
  const totalAPE = subsetPolicies.reduce((sum, p) => sum + calculateAPE(p), 0);
  const averageTicketSize = termNOP > 0 ? totalAPE / termNOP : 0;

  let atsMultiplier = 0;
  if (config.atsTable) {
    const sortedAts = [...config.atsTable].sort((a, b) => b.minAts - a.minAts);
    const matchingAts = sortedAts.find((s) => averageTicketSize >= s.minAts);
    if (matchingAts) {
      atsMultiplier = matchingAts.incentive;
    }
  }

  // 5. Process Policies
  let totalPayouts = 0;
  let totalPenalties = 0;
  let totalBoostAmount = 0;
  let totalGenerated = 0;

  const baseSharePerPolicy = termNOP > 0 ? baseFromSlab / termNOP : 0;

  const calculatedPolicies = subsetPolicies.map((policy) => {
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
    totalGenerated += totalPolicyValue;

    return {
      ...policy,
      ape,
      additionalPayout: payouts,
      totalPenalty: penalties,
      totalIncentive: totalPolicyValue,
    };
  });

  return {
    policies: calculatedPolicies,
    totalGenerated,
    baseFromSlab,
    totalPayouts,
    totalPenalties,
    totalBoostAmount,
    averageTicketSize,
  };
}

/**
 * Calculate incentives strictly according to Master Prompt
 */
export function calculateDynamicIncentives(
  config: FlexibleIncentiveConfig,
  input: BulkSessionInput
): DynamicCalculationResult {
  const allPolicies = input.policies;

  // IDENTIFY DEFERRED POLICIES
  // Rule: If (I-Secure OR I-Secure Sachet) AND Monthly -> ENTIRE product value is deferred
  const isDeferredPolicy = (p: DynamicPolicyRow) =>
    (p.policyName === "I-Secure Non Sachet" ||
      p.policyName === "I-Secure sachet") &&
    p.paymentFrequency === "Monthly";

  const immediatePolicies = allPolicies.filter((p) => !isDeferredPolicy(p));

  // --- RUN 1: ALL POLICIES (Scenario A) ---
  // This tells us the TOTAL POTENTIAL value if nothing was deferred.
  const resultAll = calculateIncentiveForSubset(config, input, allPolicies);

  // --- RUN 2: IMMEDIATE POLICIES ONLY (Scenario B) ---
  // This tells us the value generated ONLY by the non-deferred policies.
  const resultImmediate = calculateIncentiveForSubset(
    config,
    input,
    immediatePolicies
  );

  // --- DERIVE DEFERRED AMOUNT ---
  // Deferred Amount = (Total Potential with All) - (Total Generated by Immediate Only)
  // Logic: The "Lift" provided by the deferred policies (NOP boost, ATS boost, etc.) is captured here.
  const totalPotential = resultAll.totalGenerated;
  const totalImmediate = resultImmediate.totalGenerated;

  // Determine the final deferred amount.
  // We use Math.max(0, ...) security, though logically it should be positive if simple additivity holds.
  // However, removing policies *could* technically increase value if they were dragging down ATS significantly,
  // but usually volume incentives > ATS drag. We'll trust the diff.

  // Determine the final released amount.
  let totalReleasedNow = totalImmediate;

  // Gate Fallback Logic:
  // If ALL policies passed the gate, but REMOVING deferred policies causes the count to drop below the gate,
  // we normally get 0 from 'resultImmediate'.
  // In this specific case, the user wants to pay on a "pro-rated base per policy" basis derived from the Full Session.
  // We calculate this as: (Total Potential Value / Total NOP) * Immediate NOP.
  // Note: We need to check gate criteria logic here similar to calculateIncentiveForSubset.

  let effectiveVintage = input.vintage;
  if (effectiveVintage === "More than 3 Months") effectiveVintage = "Tier 1";
  let minGateRequired = 4;
  if (effectiveVintage === "Tier 2") minGateRequired = 5;
  else if (effectiveVintage === "0-3 Months") minGateRequired = 3;

  const totalPassedGate = allPolicies.length >= minGateRequired;
  const immediatePassedGate = immediatePolicies.length >= minGateRequired;

  if (totalPassedGate && !immediatePassedGate && immediatePolicies.length > 0) {
    // FALLBACK SCENARIO
    // Calculate value per policy from the "All" run.
    // We sum up the 'totalIncentive' (hypothetical full value) of only the immediate policies.
    // This effectively gives them their share of the "Slab Benefit" earned by the group.

    // We can't just take average * count because individual policies have specific addons/penalties.
    // But 'resultAll.policies' contains the fully calculated value for EACH policy in the context of the full group.
    // So we just sum the values of the immediate policies as found in 'resultAll'.

    const immediateIds = new Set(immediatePolicies.map((p) => p.id));
    totalReleasedNow = resultAll.policies
      .filter((p) => immediateIds.has(p.id))
      .reduce((sum, p) => sum + (p.totalIncentive || 0), 0);
  } else {
    // STANDARD SCENARIO
    totalReleasedNow = totalImmediate;
  }

  // Determine the final deferred amount after fallback logic
  const deferredIncentive = Math.max(0, totalPotential - totalReleasedNow);

  // MERGE RESULTS FOR UI
  // We want to show ALL policies, but mark the relevant ones given the full context.
  // We use 'resultAll.policies' as the base because visualization usually expects the full list.
  // However, for the specific numeric values of "Total Incentive" per policy,
  // 'resultAll' contains the hypothetical "Full Potential" value for each policy.
  // We can tag them.

  const finalPolicies = resultAll.policies.map((p) => {
    const deferred = isDeferredPolicy(p);
    return {
      ...p,
      isDeferred: deferred,
      // Note: 'totalIncentive' here refers to the generated value in the "All" scenario.
      // This is correct as "Value Generated", even if deferred.
    };
  });

  const grandTotal = totalReleasedNow + deferredIncentive;
  console.log("--- Calculation Summary ---");
  console.log("Total Released Now:", totalReleasedNow);
  console.log("Deferred Incentive:", deferredIncentive);
  console.log("Grand Total (Released + Deferred):", grandTotal);
  console.log("Average Ticket Size:", resultAll.averageTicketSize);
  console.log("ATS Incentive:", resultAll.totalBoostAmount);
  console.log("Base From Slab:", resultAll.baseFromSlab);
  console.log(
    "Policies:",
    finalPolicies.map((p) => ({
      id: p.id,
      ape: p.ape,
      basePayout: p.additionalPayout, // Payouts from rules
      penalty: p.totalPenalty,
      totalIncentive: p.totalIncentive,
      isDeferred: p.isDeferred,
    }))
  );

  return {
    policies: finalPolicies,
    totalIncentive: totalReleasedNow, // Released Immediately
    deferredIncentive: deferredIncentive, // Released Later
    averageTicketSize: resultAll.averageTicketSize, // Metrics based on Full Session
    atsIncentive: resultAll.totalBoostAmount, // Metrics based on Full Session
    breakdown: {
      totalBase: resultAll.baseFromSlab,
      totalPayouts: resultAll.totalPayouts,
      totalPenalties: resultAll.totalPenalties,
      totalRate:
        resultAll.policies.length > 0
          ? totalPotential / resultAll.policies.length
          : 0,
    },
  };
}
