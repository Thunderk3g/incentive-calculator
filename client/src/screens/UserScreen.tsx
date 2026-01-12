import React, { useState } from "react";
import { useConfig } from "../context/ConfigContext";
import { calculateDynamicIncentives } from "../utils/dynamicCalculator";
import type {
  DynamicPolicyRow,
  BulkSessionInput,
  CriterionColumn,
} from "../types/index.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Calculator,
  Plus,
  RotateCcw,
  X,
  CheckSquare,
  Square,
  Copy,
} from "lucide-react";

// Abbreviation map for checkbox column headers (3-color policy: primary, muted, accent)
const COLUMN_ABBREVIATIONS: Record<string, string> = {
  ciAbove25L: "CI",
  adb: "ADB",
  autopay: "AP",
  bfl: "BFL",
  superwoman: "SW",
  spouse: "SP",
  ekyc: "EK",
  accountAggregator: "AA",
  isEtouch: "ET",
};

const UserScreen: React.FC = () => {
  const { config } = useConfig();

  const [step, setStep] = useState<"initial" | "spreadsheet">("initial");
  const [sessionInput, setSessionInput] = useState<BulkSessionInput>({
    month: config.month,
    organization: config.organizations[0] || "Inhouse",
    vintage: config.vintages[2] || "Tier 1",
    productType: config.productTypes[0]?.id || "term",
    employeeName: "",
    employeeId: "",
    numPolicies: 1,
    policies: [],
  });

  const [policies, setPolicies] = useState<DynamicPolicyRow[]>([]);
  const [calculationResult, setCalculationResult] = useState<any>(null);

  const createEmptyPolicy = (): DynamicPolicyRow => {
    const policy: DynamicPolicyRow = {
      id: Date.now().toString() + Math.random(),
    };

    config.criterionColumns.forEach((col) => {
      if (col.type === "checkbox") {
        policy[col.id] = false;
      } else if (col.type === "number") {
        policy[col.id] = 0;
      } else if (
        col.type === "dropdown" &&
        col.dropdownOptions &&
        col.dropdownOptions.length > 0
      ) {
        policy[col.id] = col.dropdownOptions[0];
      } else {
        policy[col.id] = "";
      }
    });

    return policy;
  };

  const handleStartSpreadsheet = () => {
    const newPolicies = Array(sessionInput.numPolicies)
      .fill(null)
      .map(() => createEmptyPolicy());
    setPolicies(newPolicies);
    setSessionInput((prev) => ({ ...prev, policies: newPolicies }));
    setStep("spreadsheet");
  };

  const updatePolicy = (id: string, field: string, value: any) => {
    setPolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleCalculate = () => {
    const result = calculateDynamicIncentives(config, {
      ...sessionInput,
      policies,
    });
    setCalculationResult(result);
    setPolicies(result.policies);
  };

  const addRow = () => {
    setPolicies([...policies, createEmptyPolicy()]);
  };

  const removeRow = (id: string) => {
    if (policies.length > 1) {
      setPolicies(policies.filter((p) => p.id !== id));
    }
  };

  const resetForm = () => {
    setStep("initial");
    setPolicies([]);
    setCalculationResult(null);
  };

  // Excel-like Fill All functionality
  const toggleColumnCheckboxes = (columnId: string, checked: boolean) => {
    setPolicies((prev) => prev.map((p) => ({ ...p, [columnId]: checked })));
  };

  const isColumnAllChecked = (columnId: string) =>
    policies.length > 0 && policies.every((p) => p[columnId] === true);

  const isColumnPartiallyChecked = (columnId: string) =>
    policies.some((p) => p[columnId]) && !isColumnAllChecked(columnId);

  // Get all checkbox columns
  const checkboxColumns = config.criterionColumns.filter(
    (col) => col.type === "checkbox"
  );
  const nonCheckboxColumns = config.criterionColumns.filter(
    (col) => col.type !== "checkbox"
  );

  // Bulk actions
  const selectAllRiders = () => {
    setPolicies((prev) =>
      prev.map((p) => {
        const updated = { ...p };
        checkboxColumns.forEach((col) => {
          updated[col.id] = true;
        });
        return updated;
      })
    );
  };

  const clearAllRiders = () => {
    setPolicies((prev) =>
      prev.map((p) => {
        const updated = { ...p };
        checkboxColumns.forEach((col) => {
          updated[col.id] = false;
        });
        return updated;
      })
    );
  };

  const copyRowDown = (fromIndex: number) => {
    if (fromIndex < policies.length - 1) {
      const sourcePolicy = policies[fromIndex];
      setPolicies((prev) =>
        prev.map((p, idx) => {
          if (idx === fromIndex + 1) {
            const copied = { ...p };
            // Copy all values except id
            Object.keys(sourcePolicy).forEach((key) => {
              if (
                key !== "id" &&
                key !== "ape" &&
                key !== "additionalPayout" &&
                key !== "totalPenalty"
              ) {
                copied[key] = sourcePolicy[key];
              }
            });
            return copied;
          }
          return p;
        })
      );
    }
  };

  const renderCell = (policy: DynamicPolicyRow, column: CriterionColumn) => {
    const value = policy[column.id];

    if (column.type === "dropdown") {
      return (
        <Select
          value={value || ""}
          onValueChange={(val) => updatePolicy(policy.id, column.id, val)}
        >
          <SelectTrigger className="h-9 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {column.dropdownOptions?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (column.type === "checkbox") {
      return (
        <div className="flex justify-center">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(checked) =>
              updatePolicy(policy.id, column.id, checked)
            }
          />
        </div>
      );
    }

    if (column.type === "number") {
      return (
        <Input
          type="number"
          value={value || ""}
          onChange={(e) =>
            updatePolicy(policy.id, column.id, parseFloat(e.target.value) || 0)
          }
          className="h-9 bg-white"
        />
      );
    }

    if (column.type === "calculated") {
      return (
        <span className="text-muted-foreground font-medium whitespace-nowrap">
          ₹{(value || 0).toLocaleString()}
        </span>
      );
    }

    return (
      <Input
        type="text"
        value={value || ""}
        onChange={(e) => updatePolicy(policy.id, column.id, e.target.value)}
        className="h-9 bg-white"
      />
    );
  };

  // STEP 1: Initial Form
  if (step === "initial") {
    return (
      <div className="grid md:grid-cols-5 gap-8 animate-in fade-in duration-500 max-w-5xl mx-auto py-8">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">
              Term Incentive Calculator
            </CardTitle>
            <CardDescription>
              Enter your details to start policy calculations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee Name</Label>
                <Input
                  value={sessionInput.employeeName}
                  onChange={(e) =>
                    setSessionInput({
                      ...sessionInput,
                      employeeName: e.target.value,
                    })
                  }
                  placeholder="Enter your name"
                />
              </div>
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input
                  value={sessionInput.employeeId}
                  onChange={(e) =>
                    setSessionInput({
                      ...sessionInput,
                      employeeId: e.target.value,
                    })
                  }
                  placeholder="Enter your ID"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select
                  value={sessionInput.organization}
                  onValueChange={(val) =>
                    setSessionInput({
                      ...sessionInput,
                      organization: val,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.organizations.map((org) => (
                      <SelectItem key={org} value={org}>
                        {org}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tier / Vintage</Label>
                <Select
                  value={sessionInput.vintage}
                  onValueChange={(val) =>
                    setSessionInput({ ...sessionInput, vintage: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.vintages.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Initial Number of Policies</Label>
              <Input
                type="number"
                value={sessionInput.numPolicies || ""}
                onChange={(e) =>
                  setSessionInput({
                    ...sessionInput,
                    numPolicies: parseInt(e.target.value) || 1,
                  })
                }
                min="1"
              />
            </div>

            <Button
              onClick={handleStartSpreadsheet}
              disabled={
                !sessionInput.employeeName || sessionInput.numPolicies < 1
              }
              className="w-full h-12 text-lg font-bold shadow-md hover:shadow-lg transition-all"
            >
              Start Entering Policies
              <ArrowLeft className="ml-2 h-5 w-5 rotate-180" />
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 bg-primary/5 border-primary/10">
          <CardHeader>
            <CardTitle className="text-xl text-primary">
              Term Insurance Grid Jan'26
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-4 list-disc pl-5 font-medium">
              <li>Minimum 3 policies required for eligibility</li>
              <li>Base slabs for HRO, Tier 1, and Tier 2</li>
              <li>Additional payouts for EKYC, Spouse, BFL etc.</li>
              <li>Proportional release for iSecure Monthly policies</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STEP 2: Spreadsheet Logic
  const totalIncentive = calculationResult?.totalIncentive || 0;
  const deferredIncentive = calculationResult?.deferredIncentive || 0;
  const isEligible = policies.length >= 3;

  return (
    <div className="animate-in fade-in duration-500 space-y-6 max-w-[1400px] mx-auto py-4">
      {/* Summary Header */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card className="md:col-span-1 border-primary/20 bg-primary/5">
          <CardHeader className="py-4">
            <CardTitle className="text-lg text-primary truncate">
              {sessionInput.employeeName}
            </CardTitle>
            <CardDescription className="flex flex-col gap-0.5">
              <span>ID: {sessionInput.employeeId}</span>
              <span className="font-medium text-primary/70">
                {sessionInput.organization} • {sessionInput.vintage}
              </span>
            </CardDescription>
            <Button
              variant="link"
              onClick={resetForm}
              className="px-0 h-auto self-start text-muted-foreground hover:text-primary gap-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Form
            </Button>
          </CardHeader>
        </Card>

        <Card className="md:col-span-3">
          <CardContent className="py-6 flex justify-around items-center h-full">
            <div className="text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Released Today
              </div>
              <div
                className={cn(
                  "text-3xl font-black",
                  isEligible ? "text-green-600" : "text-destructive"
                )}
              >
                ₹{totalIncentive.toLocaleString()}
              </div>
            </div>
            <div className="w-px h-12 bg-border hidden md:block" />
            <div className="text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Deferred (iSecure)
              </div>
              <div className="text-xl font-bold text-orange-500">
                ₹{deferredIncentive.toLocaleString()}
              </div>
            </div>
            <div className="w-px h-12 bg-border hidden md:block" />
            <div className="text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Avg Ticket Size
              </div>
              <div className="text-xl font-bold text-slate-800">
                ₹{(calculationResult?.averageTicketSize || 0).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!isEligible && (
        <Card className="bg-destructive/10 border-destructive/20 text-destructive border shadow-sm">
          <CardContent className="py-3 text-center text-sm font-bold flex items-center justify-center gap-2">
            <X className="h-4 w-4" />
            Minimum 3 policies are required. Currently: {policies.length}
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Toolbar */}
      <Card className="bg-muted/20 border-dashed">
        <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Bulk Actions:
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={selectAllRiders}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Select All Riders
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllRiders}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <Square className="h-3.5 w-3.5" />
            Clear All
          </Button>
        </CardContent>
      </Card>

      {/* Spreadsheet with Excel-like features */}
      <Card className="shadow-xl border-t-4 border-t-primary">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                {/* Sticky row number column */}
                <TableHead className="w-[50px] text-center font-bold sticky left-0 z-20 bg-muted/40">
                  #
                </TableHead>
                {/* Sticky product name column */}
                <TableHead className="text-center font-bold min-w-[130px] sticky left-[50px] z-20 bg-muted/40 border-r">
                  Product
                </TableHead>
                {/* Non-checkbox columns */}
                {nonCheckboxColumns
                  .filter((col) => col.id !== "policyName")
                  .sort((a, b) => a.order - b.order)
                  .map((col) => (
                    <TableHead
                      key={col.id}
                      className="text-center font-bold min-w-[120px]"
                    >
                      {col.name}
                    </TableHead>
                  ))}
                {/* Checkbox columns with fill-all headers */}
                {checkboxColumns
                  .sort((a, b) => a.order - b.order)
                  .map((col) => {
                    const abbr =
                      COLUMN_ABBREVIATIONS[col.id] ||
                      col.name.substring(0, 3).toUpperCase();
                    const allChecked = isColumnAllChecked(col.id);
                    const partiallyChecked = isColumnPartiallyChecked(col.id);
                    return (
                      <TableHead
                        key={col.id}
                        className="text-center font-bold w-[60px] min-w-[60px] p-1"
                      >
                        <div
                          className="flex flex-col items-center gap-1 cursor-pointer"
                          title={`${col.name} - Click to fill all`}
                        >
                          <span className="text-xs text-muted-foreground">
                            {abbr}
                          </span>
                          <Checkbox
                            checked={allChecked}
                            className={cn(
                              "transition-all",
                              partiallyChecked && "opacity-50"
                            )}
                            onCheckedChange={(checked) =>
                              toggleColumnCheckboxes(col.id, Boolean(checked))
                            }
                          />
                        </div>
                      </TableHead>
                    );
                  })}
                {/* Result columns - sticky on right */}
                <TableHead className="text-right font-bold min-w-[80px] sticky right-[160px] z-20 bg-muted/40">
                  APE
                </TableHead>
                <TableHead className="text-right font-bold min-w-[80px] sticky right-[80px] z-20 bg-muted/40 text-green-600">
                  Payout
                </TableHead>
                <TableHead className="text-right font-bold min-w-[80px] sticky right-0 z-20 bg-muted/40 text-destructive">
                  Penalty
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy, idx) => (
                <TableRow
                  key={policy.id}
                  className={cn(
                    "transition-colors group",
                    idx % 2 === 0 ? "bg-white" : "bg-muted/20",
                    "hover:bg-primary/5",
                    policy.isDeferred && "bg-orange-50/70"
                  )}
                >
                  {/* Sticky row number */}
                  <TableCell
                    className={cn(
                      "text-center font-bold text-muted-foreground sticky left-0 z-10",
                      idx % 2 === 0 ? "bg-white" : "bg-muted/20",
                      "group-hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{idx + 1}</span>
                      {idx < policies.length - 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyRowDown(idx)}
                          title="Copy to next row"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  {/* Sticky product name */}
                  <TableCell
                    className={cn(
                      "p-2 sticky left-[50px] z-10 border-r",
                      idx % 2 === 0 ? "bg-white" : "bg-muted/20",
                      "group-hover:bg-primary/5"
                    )}
                  >
                    {renderCell(
                      policy,
                      config.criterionColumns.find(
                        (c) => c.id === "policyName"
                      )!
                    )}
                  </TableCell>
                  {/* Non-checkbox columns */}
                  {nonCheckboxColumns
                    .filter((col) => col.id !== "policyName")
                    .sort((a, b) => a.order - b.order)
                    .map((col) => (
                      <TableCell key={col.id} className="p-2">
                        {renderCell(policy, col)}
                      </TableCell>
                    ))}
                  {/* Checkbox columns */}
                  {checkboxColumns
                    .sort((a, b) => a.order - b.order)
                    .map((col) => (
                      <TableCell key={col.id} className="p-1">
                        {renderCell(policy, col)}
                      </TableCell>
                    ))}
                  {/* Sticky result columns */}
                  <TableCell
                    className={cn(
                      "text-right font-bold text-slate-700 sticky right-[160px] z-10",
                      idx % 2 === 0 ? "bg-white" : "bg-muted/20",
                      "group-hover:bg-primary/5"
                    )}
                  >
                    ₹{(policy.ape || 0).toLocaleString()}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-bold text-green-600 sticky right-[80px] z-10",
                      idx % 2 === 0 ? "bg-white" : "bg-muted/20",
                      "group-hover:bg-primary/5"
                    )}
                  >
                    +{(policy.additionalPayout || 0).toLocaleString()}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-bold text-destructive sticky right-0 z-10 pr-2",
                      idx % 2 === 0 ? "bg-white" : "bg-muted/20",
                      "group-hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>
                        -{(policy.totalPenalty || 0).toLocaleString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(policy.id)}
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-2">
        <div className="flex gap-4 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={addRow}
            className="flex-1 md:flex-none h-11 border-dashed font-bold border-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Policy
          </Button>
          <Button
            onClick={handleCalculate}
            className="flex-1 md:flex-none h-11 font-bold shadow-lg"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Calculate Results
          </Button>
        </div>

        {calculationResult && (
          <Card className="bg-muted/20 border-dashed border-2">
            <CardContent className="py-3 px-6 text-xs text-muted-foreground font-semibold flex gap-6">
              <span>
                Base: ₹{calculationResult.breakdown.totalBase.toLocaleString()}
              </span>
              <span>
                ATS: ₹{calculationResult.atsIncentive.toLocaleString()}
              </span>
              <span className="text-primary font-bold">
                Rate: ₹
                {calculationResult.breakdown.totalRate?.toLocaleString(
                  undefined,
                  {
                    maximumFractionDigits: 1,
                  }
                )}
              </span>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default UserScreen;
