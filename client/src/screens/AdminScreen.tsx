import React, { useState } from "react";
import { useConfig } from "../context/ConfigContext";
import type { FlexibleIncentiveConfig } from "../types/index.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { X, Plus, Save } from "lucide-react";

const AdminScreen: React.FC = () => {
  const { config, updateConfig } = useConfig();
  const [localConfig, setLocalConfig] =
    useState<FlexibleIncentiveConfig>(config);

  const handleSave = () => {
    updateConfig(localConfig);
    alert("Configuration saved successfully!");
  };

  const updateTier = (
    tableId: string,
    tierIndex: number,
    field: "nop" | "incentive",
    value: number
  ) => {
    const newTables = localConfig.tierTables.map((table) => {
      if (table.id === tableId) {
        const newTiers = [...table.tiers];
        newTiers[tierIndex] = { ...newTiers[tierIndex], [field]: value };
        return { ...table, tiers: newTiers };
      }
      return table;
    });
    setLocalConfig({ ...localConfig, tierTables: newTables });
  };

  const addAtsRow = () => {
    const newAtsTable = [
      ...(localConfig.atsTable || []),
      { minAts: 0, incentive: 0 },
    ];
    setLocalConfig({ ...localConfig, atsTable: newAtsTable });
  };

  const updateAtsRow = (
    index: number,
    field: "minAts" | "incentive",
    value: number
  ) => {
    const newAtsTable = [...(localConfig.atsTable || [])];
    newAtsTable[index] = { ...newAtsTable[index], [field]: value };
    setLocalConfig({ ...localConfig, atsTable: newAtsTable });
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <div className="flex justify-between items-center border-b pb-6">
        <h2 className="text-2xl font-bold text-primary">
          Term Incentive Configuration
        </h2>
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Save Configuration
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label>Campaign Month</Label>
            <Input
              type="text"
              value={localConfig.month}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, month: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {localConfig.tierTables.map((table) => (
          <Card key={table.id}>
            <CardHeader className="pb-3 border-b mb-3">
              <CardTitle className="text-sm uppercase font-bold text-primary">
                {table.organization} - {table.vintage}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[1fr_1fr_40px] gap-2 font-bold text-xs text-muted-foreground uppercase">
                <div>NOP</div>
                <div>Incentive ₹</div>
                <div></div>
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {table.tiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_1fr_40px] gap-2 items-center"
                  >
                    <Input
                      type="number"
                      value={tier.nop}
                      onChange={(e) =>
                        updateTier(
                          table.id,
                          idx,
                          "nop",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="h-9"
                    />
                    <Input
                      type="number"
                      value={tier.incentive}
                      onChange={(e) =>
                        updateTier(
                          table.id,
                          idx,
                          "incentive",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="h-9"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newTierTables = localConfig.tierTables.map(
                          (t) => {
                            if (t.id === table.id) {
                              return {
                                ...t,
                                tiers: t.tiers.filter((_, i) => i !== idx),
                              };
                            }
                            return t;
                          }
                        );
                        setLocalConfig({
                          ...localConfig,
                          tierTables: newTierTables,
                        });
                      }}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => {
                  const newTierTables = localConfig.tierTables.map((t) => {
                    if (t.id === table.id) {
                      return {
                        ...t,
                        tiers: [...t.tiers, { nop: 0, incentive: 0 }],
                      };
                    }
                    return t;
                  });
                  setLocalConfig({ ...localConfig, tierTables: newTierTables });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Row
              </Button>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="pb-3 border-b mb-3">
            <CardTitle className="text-sm uppercase font-bold text-orange-600">
              Average Ticket Size Slabs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[1fr_1fr_40px] gap-2 font-bold text-xs text-muted-foreground uppercase">
              <div>Min ATS ₹</div>
              <div>Incentive ₹</div>
              <div></div>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
              {localConfig.atsTable?.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_1fr_40px] gap-2 items-center"
                >
                  <Input
                    type="number"
                    value={row.minAts}
                    onChange={(e) =>
                      updateAtsRow(idx, "minAts", parseInt(e.target.value) || 0)
                    }
                    className="h-9"
                  />
                  <Input
                    type="number"
                    value={row.incentive}
                    onChange={(e) =>
                      updateAtsRow(
                        idx,
                        "incentive",
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="h-9"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newAts = localConfig.atsTable?.filter(
                        (_, i) => i !== idx
                      );
                      setLocalConfig({ ...localConfig, atsTable: newAts });
                    }}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={addAtsRow}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add ATS Slab
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Additional Rules (Payouts & Penalties)</CardTitle>
          <CardDescription>
            Rules are matched using simple JavaScript expressions against policy
            properties.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {localConfig.calculationRules.map((rule, idx) => (
              <div
                key={rule.id}
                className="flex flex-col md:flex-row gap-4 p-4 bg-muted/30 border rounded-md items-start md:items-end"
              >
                <div className="flex-1 w-full space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    ID / Name
                  </Label>
                  <Input
                    type="text"
                    value={rule.name}
                    onChange={(e) => {
                      const newRules = [...localConfig.calculationRules];
                      newRules[idx] = {
                        ...newRules[idx],
                        name: e.target.value,
                      };
                      setLocalConfig({
                        ...localConfig,
                        calculationRules: newRules,
                      });
                    }}
                  />
                </div>
                <div className="flex-[2] w-full space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Condition
                  </Label>
                  <Input
                    type="text"
                    value={rule.condition}
                    onChange={(e) => {
                      const newRules = [...localConfig.calculationRules];
                      newRules[idx] = {
                        ...newRules[idx],
                        condition: e.target.value,
                      };
                      setLocalConfig({
                        ...localConfig,
                        calculationRules: newRules,
                      });
                    }}
                    placeholder='policyName === "Etouch" && ekyc === true'
                    className="font-mono"
                  />
                </div>
                <div className="w-full md:w-32 space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Adjustment
                  </Label>
                  <Input
                    type="number"
                    value={rule.adjustment}
                    onChange={(e) => {
                      const newRules = [...localConfig.calculationRules];
                      newRules[idx] = {
                        ...newRules[idx],
                        adjustment: parseInt(e.target.value) || 0,
                      };
                      setLocalConfig({
                        ...localConfig,
                        calculationRules: newRules,
                      });
                    }}
                  />
                </div>
                <div className="w-full md:w-32 space-y-2">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select
                    value={rule.type}
                    onValueChange={(value: "payout" | "penalty") => {
                      const newRules = [...localConfig.calculationRules];
                      newRules[idx] = {
                        ...newRules[idx],
                        type: value,
                      };
                      setLocalConfig({
                        ...localConfig,
                        calculationRules: newRules,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payout">Payout</SelectItem>
                      <SelectItem value="penalty">Penalty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newRules = localConfig.calculationRules.filter(
                      (_, i) => i !== idx
                    );
                    setLocalConfig({
                      ...localConfig,
                      calculationRules: newRules,
                    });
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="border-dashed"
              onClick={() => {
                const newRules = [
                  ...localConfig.calculationRules,
                  {
                    id: "rule-" + Date.now(),
                    name: "New Rule",
                    condition: "",
                    adjustment: 0,
                    type: "payout" as const,
                  },
                ];
                setLocalConfig({ ...localConfig, calculationRules: newRules });
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Rule
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminScreen;
