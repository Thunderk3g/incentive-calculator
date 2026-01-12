import React, { createContext, useContext, useState } from "react";
import type {
  FlexibleIncentiveConfig,
  CriterionColumn,
  ProductType,
  TierTable,
  CalculationRule,
} from "../types/index.ts";

interface ConfigContextType {
  config: FlexibleIncentiveConfig;
  updateConfig: (newConfig: FlexibleIncentiveConfig) => void;
}

const defaultColumns: CriterionColumn[] = [
  {
    id: "policyName",
    name: "Product Name",
    type: "dropdown",
    dropdownOptions: ["Etouch", "I-Secure", "I-Secure sachet", "Other term"],
    order: 1,
  },
  {
    id: "paymentType",
    name: "Payment Type",
    type: "dropdown",
    dropdownOptions: [
      "Single Pay",
      "Limited Pay - 5 years",
      "Limited Pay - 6 years",
      "Limited Pay - 10 years",
      "Limited Pay - 12 years",
      "Limited Pay - 15 years",
      "Regular",
    ],
    order: 2,
  },
  { id: "paymentAmount", name: "Payment Amount", type: "number", order: 3 },
  {
    id: "paymentFrequency",
    name: "Payment Frequency",
    type: "dropdown",
    dropdownOptions: ["Monthly", "Half-Yearly", "Annual"],
    order: 4,
  },
  {
    id: "ape",
    name: "APE",
    type: "calculated",
    formula: "calculateAPE",
    order: 5,
  },
  { id: "ciAbove25L", name: "CI >25 lakhs", type: "checkbox", order: 6 },
  { id: "adb", name: "ADB (Y/N)", type: "checkbox", order: 7 },
  { id: "autopay", name: "Autopay (Y/N)", type: "checkbox", order: 8 },
  { id: "bfl", name: "BFL (Y/N)", type: "checkbox", order: 9 },
  {
    id: "superwoman",
    name: "Super Woman Term (Y/N)",
    type: "checkbox",
    order: 10,
  },
  { id: "spouse", name: "Spouse (Y/N)", type: "checkbox", order: 11 },
  { id: "ekyc", name: "EKYC (Y/N)", type: "checkbox", order: 12 },
  {
    id: "accountAggregator",
    name: "Acc Aggregator",
    type: "checkbox",
    order: 13,
  },
];

const defaultProductTypes: ProductType[] = [
  { id: "term", name: "Term", enabled: true },
];

// Tier tables based on Image 1
const defaultTierTables: TierTable[] = [
  {
    id: "hro-table",
    organization: "Outsource",
    vintage: "0-3 Months",
    tiers: [
      { nop: 3, incentive: 3000 },
      { nop: 4, incentive: 4000 },
      { nop: 5, incentive: 5200 },
      { nop: 6, incentive: 6400 },
      { nop: 7, incentive: 7600 },
      { nop: 8, incentive: 9000 },
      { nop: 9, incentive: 10500 },
      { nop: 10, incentive: 12200 },
      { nop: 11, incentive: 14000 },
      { nop: 12, incentive: 16000 },
      { nop: 13, incentive: 18200 },
      { nop: 14, incentive: 20600 },
      { nop: 15, incentive: 23000 },
    ],
  },
  {
    id: "tier1-table",
    organization: "Inhouse",
    vintage: "Tier 1",
    tiers: [
      { nop: 4, incentive: 4000 },
      { nop: 5, incentive: 5000 },
      { nop: 6, incentive: 6200 },
      { nop: 7, incentive: 7400 },
      { nop: 8, incentive: 8600 },
      { nop: 9, incentive: 10000 },
      { nop: 10, incentive: 11500 },
      { nop: 11, incentive: 13200 },
      { nop: 12, incentive: 15000 },
      { nop: 13, incentive: 17000 },
      { nop: 14, incentive: 19200 },
      { nop: 15, incentive: 21600 },
      { nop: 16, incentive: 24000 },
    ],
  },
  {
    id: "tier2-table",
    organization: "Inhouse",
    vintage: "Tier 2",
    tiers: [
      { nop: 5, incentive: 5000 },
      { nop: 6, incentive: 6000 },
      { nop: 7, incentive: 7200 },
      { nop: 8, incentive: 8400 },
      { nop: 9, incentive: 9600 },
      { nop: 10, incentive: 11000 },
      { nop: 11, incentive: 12500 },
      { nop: 12, incentive: 14200 },
      { nop: 13, incentive: 16000 },
      { nop: 14, incentive: 18000 },
      { nop: 15, incentive: 20200 },
      { nop: 16, incentive: 22600 },
      { nop: 17, incentive: 25000 },
    ],
  },
];

// Calculation rules based on Image 2 (Term Grid)
const defaultRules: CalculationRule[] = [
  // Term Grid: E-touch & I-Secure Annual Payouts
  {
    id: "rule-etouch-annual",
    name: "Annual Payments on Etouch",
    condition: 'policyName === "Etouch" && paymentFrequency === "Annual"',
    adjustment: 1000,
    type: "payout",
  },
  {
    id: "rule-isecure-annual",
    name: "Annual Payments on I-Secure",
    condition: 'policyName === "I-Secure" && paymentFrequency === "Annual"',
    adjustment: 1500,
    type: "payout",
  },
  {
    id: "rule-ekyc",
    name: "EKYC 100% Cases",
    condition: "ekyc === true",
    adjustment: 2000,
    type: "payout",
  },

  // Term Grid Penalties
  {
    id: "rule-penalty-etouch-no-autopay",
    name: "Monthly E-touch No Autopay",
    condition:
      'policyName === "Etouch" && paymentFrequency === "Monthly" && autopay === false',
    adjustment: -1400,
    type: "penalty",
  },
  {
    id: "rule-penalty-isecure-no-autopay",
    name: "Monthly I-Secure No Autopay",
    condition:
      'policyName === "I-Secure" && paymentFrequency === "Monthly" && autopay === false',
    adjustment: -2000,
    type: "penalty",
  },

  // Lead Source Conversions
  {
    id: "rule-spouse",
    name: "Spouse Case",
    condition: "spouse === true",
    adjustment: 500,
    type: "payout",
  },
  {
    id: "rule-bfl",
    name: "BFL Source",
    condition: "bfl === true",
    adjustment: 500,
    type: "payout",
  },
  {
    id: "rule-superwoman",
    name: "Super Woman Term",
    condition: "superwoman === true",
    adjustment: 1000,
    type: "payout",
  },
  {
    id: "rule-sachet-assisted",
    name: "Sachet Term on Assisted Journey",
    condition: 'policyName === "I-Secure sachet"',
    adjustment: 1000,
    type: "payout",
  },
  {
    id: "rule-aa",
    name: "Isecure & Etouch via Account Aggregator",
    condition:
      'accountAggregator === true && (policyName === "Etouch" || policyName === "I-Secure")',
    adjustment: 500,
    type: "payout",
  },

  // Term Grid: Limited Pay Payouts (E-touch & I-Secure)
  {
    id: "rule-limited-pay-5-6",
    name: "Limited Pay 5 & 6 years",
    condition:
      'paymentType === "Limited Pay - 5 years" || paymentType === "Limited Pay - 6 years"',
    adjustment: 3000,
    type: "payout",
  },
  {
    id: "rule-limited-pay-10",
    name: "Limited Pay 10 years",
    condition: 'paymentType === "Limited Pay - 10 years"',
    adjustment: 2000,
    type: "payout",
  },
  {
    id: "rule-limited-pay-12",
    name: "Limited Pay 12 years",
    condition: 'paymentType === "Limited Pay - 12 years"',
    adjustment: 1250,
    type: "payout",
  },
  {
    id: "rule-limited-pay-15",
    name: "Limited Pay 15 years",
    condition: 'paymentType === "Limited Pay - 15 years"',
    adjustment: 1000,
    type: "payout",
  },

  // Term Grid: Rider Payouts
  {
    id: "rule-ci-rider",
    name: "CI Rider Sum Assured > 25 Lacs",
    condition: "ciAbove25L === true",
    adjustment: 1000,
    type: "payout",
  },
  {
    id: "rule-adb-rider",
    name: "ADB Rider Sum Assured > 1 Cr",
    condition: "adb === true",
    adjustment: 500,
    type: "payout",
  },
];

const defaultConfig: FlexibleIncentiveConfig = {
  month: "Jan'26",
  productTypes: defaultProductTypes,
  criterionColumns: defaultColumns,
  tierTables: defaultTierTables,
  calculationRules: defaultRules,
  organizations: ["Inhouse", "Outsource"],
  vintages: ["0-3 Months", "More than 3 Months", "Tier 1", "Tier 2"],
  // ATS Table: These are multipliers (e.g., 1.10 for 110%)
  atsTable: [
    { minAts: 20001, incentive: 0.1 }, // 110% -> 10% boost
    { minAts: 25000, incentive: 0.25 }, // 125% -> 25% boost
    { minAts: 40000, incentive: 0.4 }, // 140% -> 40% boost
  ],
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [config, setConfig] = useState<FlexibleIncentiveConfig>(() => {
    const saved = localStorage.getItem("flexibleIncentiveConfig");
    return saved ? JSON.parse(saved) : defaultConfig;
  });

  const updateConfig = (newConfig: FlexibleIncentiveConfig) => {
    setConfig(newConfig);
    localStorage.setItem("flexibleIncentiveConfig", JSON.stringify(newConfig));
  };

  return (
    <ConfigContext.Provider value={{ config, updateConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context)
    throw new Error("useConfig must be used within a ConfigProvider");
  return context;
};
