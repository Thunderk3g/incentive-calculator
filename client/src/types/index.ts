// Base types
export type Tier = {
  nop: number;
  incentive: number;
};

export type Criteria = {
  id: string;
  name: string;
  value: number;
  type: "payout" | "penalty";
};

export type IncentiveConstruct = {
  month: string;
  tiers: {
    tier1: Tier[];
    tier2: Tier[];
    hro: Tier[];
  };
  criterias: Criteria[];
};

export type UserInput = {
  organization: "tier1" | "tier2" | "hro";
  nopIssued: number;
  selectedCriterias: string[];
};

export type CalculationResult = {
  baseIncentive: number;
  additionalPayout: number;
  totalPenalty: number;
  totalIncentive: number;
};

// ============================================================================
// DYNAMIC COLUMN SYSTEM
// ============================================================================

// Column field types
export type ColumnType = 'dropdown' | 'checkbox' | 'number' | 'text' | 'calculated';

// Admin-configurable criterion column
export type CriterionColumn = {
  id: string;
  name: string;
  type: ColumnType;
  dropdownOptions?: string[];  // For dropdown type
  formula?: string;  // For calculated type
  defaultValue?: any;
  order: number;  // Display order
};

// Product type configuration
export type ProductType = {
  id: string;
  name: string;
  enabled: boolean;
};

// Tier lookup table for different org/vintage combinations
export type TierTable = {
  id: string;
  organization: string;  // "Inhouse", "Outsource"
  vintage: string;  // "0-3 months", "3-6 months", etc.
  tiers: Tier[];
};

// Calculation rule
export type CalculationRule = {
  id: string;
  name: string;
  condition: string;  // JSON expression or simple condition
  adjustment: number;  // Amount to add/subtract
  type: "payout" | "penalty";
};

// Main flexible configuration
export type FlexibleIncentiveConfig = {
  month: string;
  productTypes: ProductType[];
  criterionColumns: CriterionColumn[];
  tierTables: TierTable[];
  calculationRules: CalculationRule[];
  organizations: string[];  // ["Inhouse", "Outsource"]
  vintages: string[];  // ["0-3 months", "3-6 months", etc.]
  atsTable?: { minAts: number; incentive: number }[];
};

// Policy entry with dynamic fields
export type DynamicPolicyRow = {
  id: string;
  [key: string]: any;  // Dynamic fields based on configured columns
};

// User session input for bulk calculation
export type BulkSessionInput = {
  month: string;
  organization: string;
  vintage: string;
  productType: string;
  employeeName: string;
  employeeId: string;
  numPolicies: number;
  policies: DynamicPolicyRow[];
};

// Calculation result for dynamic system
export type DynamicCalculationResult = {
  policies: DynamicPolicyRow[];  // Includes calculated fields
  totalIncentive: number;
  deferredIncentive: number;
  averageTicketSize: number;
  atsIncentive: number;
  breakdown: {
    totalBase: number;
    totalPayouts: number;
    totalPenalties: number;
    totalRate?: number;
  };
};
