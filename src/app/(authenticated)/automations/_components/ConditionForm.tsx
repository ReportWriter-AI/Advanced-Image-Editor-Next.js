"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReactSelect from "react-select";
import { Trash2 } from "lucide-react";
import {
  CONDITION_TYPES,
  getOperatorsForConditionType,
  getServiceCategoryOptions,
} from "@/src/lib/automation-conditions";
import { ConditionType } from "@/src/models/AutomationAction";
import { splitCommaSeparated } from "@/lib/utils";

interface Service {
  _id: string;
  id?: string;
  name: string;
  addOns?: Array<{ name: string }>;
}

interface Category {
  _id: string;
  id?: string;
  name: string;
}

export interface ConditionFormData {
  type: ConditionType;
  operator: string;
  value?: string;
  serviceId?: string;
  addonName?: string;
  serviceCategory?: string;
  categoryId?: string;
  yearBuild?: number;
  foundation?: string;
  squareFeet?: number;
  zipCode?: string;
  city?: string;
  state?: string;
}

interface ConditionFormProps {
  condition: ConditionFormData;
  index: number;
  onChange: (index: number, condition: ConditionFormData) => void;
  onRemove: (index: number) => void;
}

export function ConditionForm({ condition, index, onChange, onRemove }: ConditionFormProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [foundationOptions, setFoundationOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingFoundation, setLoadingFoundation] = useState(false);

  const conditionType = condition.type;
  const serviceId = condition.serviceId;

  useEffect(() => {
    if (conditionType === "SERVICE" || conditionType === "ADDONS") {
      fetchServices();
    }
    if (
      conditionType === "CLIENT_CATEGORY" ||
      conditionType === "CLIENT_AGENT_CATEGORY" ||
      conditionType === "LISTING_AGENT_CATEGORY"
    ) {
      fetchCategories();
    }
    if (conditionType === "FOUNDATION") {
      fetchFoundationOptions();
    }
  }, [conditionType]);

  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      const response = await fetch("/api/services", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setServices(Array.isArray(data.services) ? data.services : []);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await fetch("/api/categories", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(Array.isArray(data.categories) ? data.categories : []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchFoundationOptions = async () => {
    try {
      setLoadingFoundation(true);
      const response = await fetch("/api/reusable-dropdowns", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const foundationString = data.foundation || "";
        const foundationValues = splitCommaSeparated(foundationString);
        const options = foundationValues.map((value) => ({
          value: value.trim(),
          label: value.trim(),
        })).filter((opt) => opt.value.length > 0);
        setFoundationOptions(options);
      }
    } catch (error) {
      console.error("Error fetching foundation options:", error);
    } finally {
      setLoadingFoundation(false);
    }
  };

  const handleChange = (field: keyof ConditionFormData, value: any) => {
    const updated = { ...condition, [field]: value };
    
    // Reset dependent fields when type or service changes
    if (field === "type") {
      updated.operator = "";
      updated.value = undefined;
      updated.serviceId = undefined;
      updated.addonName = undefined;
      updated.serviceCategory = undefined;
      updated.categoryId = undefined;
      updated.yearBuild = undefined;
      updated.foundation = undefined;
      updated.squareFeet = undefined;
      updated.zipCode = undefined;
      updated.city = undefined;
      updated.state = undefined;
    } else if (field === "serviceId") {
      updated.addonName = undefined;
    }

    Object.keys(updated).forEach((key) => {
      if (updated[key as keyof ConditionFormData] === undefined) {
        delete updated[key as keyof ConditionFormData];
      }
    });
    onChange(index, updated);
  };

  const selectedService = services.find(
    (s) => (s._id || s.id)?.toString() === serviceId
  );

  const availableAddons = selectedService?.addOns || [];

  const serviceOptions = services.map((s) => ({
    value: (s._id || s.id)?.toString() || "",
    label: s.name,
  }));

  const addonOptions = availableAddons.map((addon) => ({
    value: addon.name,
    label: addon.name,
  }));

  const categoryOptions = categories.map((cat) => ({
    value: (cat._id || cat.id)?.toString() || "",
    label: cat.name,
  }));

  const operatorOptions = getOperatorsForConditionType(conditionType);
  const selectedOperator = operatorOptions.find(
    (op) => op.value === condition.operator
  );

  const serviceCategoryOptions = getServiceCategoryOptions();
  const selectedServiceCategory = serviceCategoryOptions.find(
    (opt) => opt.value === condition.serviceCategory
  );

  const selectedCategory = categoryOptions.find(
    (opt) => opt.value === condition.categoryId
  );

  const selectedFoundation = foundationOptions.find(
    (opt) => opt.value === condition.foundation
  );

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Condition {index + 1}</h4>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Condition Type</Label>
          <ReactSelect
            value={CONDITION_TYPES.find((t) => t.value === condition.type) || null}
            onChange={(option) => handleChange("type", option?.value || "")}
            options={CONDITION_TYPES}
            placeholder="Select condition type"
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>

        <div className="space-y-2">
          <Label>Operator</Label>
          <ReactSelect
            value={selectedOperator || null}
            onChange={(option) => handleChange("operator", option?.value || "")}
            options={operatorOptions}
            placeholder="Select operator"
            isDisabled={!conditionType}
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>

        {/* Event Name - value field */}
        {conditionType === "EVENT_NAME" && (
          <div className="space-y-2 md:col-span-2">
            <Label>Event Name</Label>
            <Input
              value={condition.value || ""}
              onChange={(e) => handleChange("value", e.target.value)}
              placeholder="Enter event name"
            />
          </div>
        )}

        {/* Service - serviceId field */}
        {conditionType === "SERVICE" && (
          <div className="space-y-2 md:col-span-2">
            <Label>Service</Label>
            <ReactSelect
              value={serviceOptions.find((opt) => opt.value === serviceId) || null}
              onChange={(option) => handleChange("serviceId", option?.value || "")}
              options={serviceOptions}
              isLoading={loadingServices}
              placeholder="Select a service"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
        )}

        {/* Addons - serviceId and addonName fields */}
        {conditionType === "ADDONS" && (
          <>
            <div className="space-y-2">
              <Label>Service</Label>
              <ReactSelect
                value={serviceOptions.find((opt) => opt.value === serviceId) || null}
                onChange={(option) => handleChange("serviceId", option?.value || "")}
                options={serviceOptions}
                isLoading={loadingServices}
                placeholder="Select a service"
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
            <div className="space-y-2">
              <Label>Addon</Label>
              <ReactSelect
                value={addonOptions.find((opt) => opt.value === condition.addonName) || null}
                onChange={(option) => handleChange("addonName", option?.value || "")}
                options={addonOptions}
                isDisabled={!serviceId || addonOptions.length === 0}
                placeholder={serviceId ? "Select an addon" : "Select service first"}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
          </>
        )}

        {/* Service Category - serviceCategory field */}
        {conditionType === "SERVICE_CATEGORY" && (
          <div className="space-y-2 md:col-span-2">
            <Label>Service Category</Label>
            <ReactSelect
              value={selectedServiceCategory || null}
              onChange={(option) => handleChange("serviceCategory", option?.value || "")}
              options={serviceCategoryOptions}
              placeholder="Select a service category"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
        )}

        {/* Client/Agent Categories - categoryId field */}
        {(conditionType === "CLIENT_CATEGORY" ||
          conditionType === "CLIENT_AGENT_CATEGORY" ||
          conditionType === "LISTING_AGENT_CATEGORY") && (
          <div className="space-y-2 md:col-span-2">
            <Label>Category</Label>
            <ReactSelect
              value={selectedCategory || null}
              onChange={(option) => handleChange("categoryId", option?.value || "")}
              options={categoryOptions}
              isLoading={loadingCategories}
              placeholder="Select a category"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
        )}

        {/* All Reports - no additional field */}
        {conditionType === "ALL_REPORTS" && null}

        {/* Any Reports - no additional field */}
        {conditionType === "ANY_REPORTS" && null}

        {/* Year Build - yearBuild field */}
        {conditionType === "YEAR_BUILD" && (
          <div className="space-y-2 md:col-span-2">
            <Label>Year</Label>
            <Input
              type="number"
              value={condition.yearBuild || ""}
              onChange={(e) => {
                const value = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                handleChange("yearBuild", isNaN(value as number) ? undefined : value);
              }}
              placeholder="Enter year (e.g., 2024)"
              min="1900"
              max="2100"
            />
          </div>
        )}

        {/* Foundation - foundation field */}
        {conditionType === "FOUNDATION" && (
          <div className="space-y-2 md:col-span-2">
            <Label>Foundation</Label>
            <ReactSelect
              value={selectedFoundation || null}
              onChange={(option) => handleChange("foundation", option?.value || "")}
              options={foundationOptions}
              isLoading={loadingFoundation}
              placeholder="Select a foundation"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
        )}

        {/* Square Feet - squareFeet field */}
        {conditionType === "SQUARE_FEET" && (
          <div className="space-y-2 md:col-span-2">
            <Label>Square Feet</Label>
            <Input
              type="number"
              value={condition.squareFeet || ""}
              onChange={(e) => {
                const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
                handleChange("squareFeet", isNaN(value as number) ? undefined : value);
              }}
              placeholder="Enter square feet"
              min="0"
              step="1"
            />
          </div>
        )}

        {/* Zip Code - zipCode field */}
        {conditionType === "ZIP_CODE" && (
          <div className="space-y-2 md:col-span-2">
            <Label>Zip Code</Label>
            <Input
              value={condition.zipCode || ""}
              onChange={(e) => handleChange("zipCode", e.target.value)}
              placeholder="Enter zip code"
            />
          </div>
        )}

        {/* City - city field */}
        {conditionType === "CITY" && (
          <div className="space-y-2 md:col-span-2">
            <Label>City</Label>
            <Input
              value={condition.city || ""}
              onChange={(e) => handleChange("city", e.target.value)}
              placeholder="Enter city"
            />
          </div>
        )}

        {/* State - state field */}
        {conditionType === "STATE" && (
          <div className="space-y-2 md:col-span-2">
            <Label>State</Label>
            <Input
              value={condition.state || ""}
              onChange={(e) => handleChange("state", e.target.value)}
              placeholder="Enter state"
            />
          </div>
        )}
      </div>
    </div>
  );
}
