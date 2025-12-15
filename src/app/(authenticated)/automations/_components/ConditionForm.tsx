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
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

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
      </div>
    </div>
  );
}
