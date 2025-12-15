"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import ReactSelect from "react-select";
import { Loader2, Plus } from "lucide-react";
import { getGroupedTriggerOptions } from "@/src/lib/automation-triggers";
import { ConditionForm, ConditionFormData } from "./ConditionForm";

interface Category {
  _id: string;
  id?: string;
  name: string;
}

const conditionSchema = z.object({
  type: z.enum([
    "INSPECTION",
    "AGREEMENT",
    "EVENT_NAME",
    "SERVICE",
    "ADDONS",
    "SERVICE_CATEGORY",
    "CLIENT_CATEGORY",
    "CLIENT_AGENT_CATEGORY",
    "LISTING_AGENT_CATEGORY",
  ]),
  operator: z.string().min(1, "Operator is required"),
  value: z.string().optional(),
  serviceId: z.string().optional(),
  addonName: z.string().optional(),
  serviceCategory: z.string().optional(),
  categoryId: z.string().optional(),
});

const actionFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  automationTrigger: z.string().min(1, "Automation trigger is required"),
  isActive: z.boolean(),
  conditions: z.array(conditionSchema).optional(),
  conditionLogic: z.enum(["AND", "OR"]).optional(),
});

export type ActionFormValues = z.infer<typeof actionFormSchema>;

export type ActionFormNormalizedValues = {
  name: string;
  category: string;
  automationTrigger: string;
  isActive: boolean;
  conditions?: ConditionFormData[];
  conditionLogic?: "AND" | "OR";
};

interface ActionFormProps {
  initialValues?: Partial<ActionFormValues>;
  submitLabel: string;
  onSubmit: (values: ActionFormNormalizedValues) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ActionForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ActionFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [conditions, setConditions] = useState<ConditionFormData[]>(() => {
    if (!initialValues?.conditions) return [];
    return initialValues.conditions.map((c: any) => ({
      type: c.type,
      operator: c.operator || "",
      value: c.value,
      serviceId: typeof c.serviceId === 'object' ? c.serviceId?.toString() : c.serviceId,
      addonName: c.addonName,
      serviceCategory: c.serviceCategory,
      categoryId: typeof c.categoryId === 'object' ? c.categoryId?.toString() : c.categoryId,
    }));
  });

  const [conditionLogic, setConditionLogic] = useState<"AND" | "OR">(() => {
    if (initialValues?.conditionLogic === "AND" || initialValues?.conditionLogic === "OR") {
      return initialValues.conditionLogic;
    }
    return "AND";
  });

  const form = useForm<ActionFormValues>({
    resolver: zodResolver(actionFormSchema),
    defaultValues: {
      name: initialValues?.name || "",
      category: initialValues?.category || "",
      automationTrigger: initialValues?.automationTrigger || "",
      isActive: initialValues?.isActive !== undefined ? initialValues.isActive : true,
      conditions: conditions,
      conditionLogic: conditionLogic,
    },
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  // Sync conditionLogic with form when it changes
  useEffect(() => {
    form.setValue("conditionLogic", conditionLogic);
  }, [conditionLogic, form]);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await fetch("/api/automations/categories", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSubmit = async (values: ActionFormValues) => {
    const normalized: ActionFormNormalizedValues = {
      name: values.name.trim(),
      category: values.category,
      automationTrigger: values.automationTrigger,
      isActive: values.isActive,
      conditions: conditions.length > 0 ? conditions : undefined,
      conditionLogic: conditions.length > 1 ? conditionLogic : undefined,
    };
    await onSubmit(normalized);
  };

  const handleAddCondition = () => {
    const newCondition: ConditionFormData = {
      type: "INSPECTION",
      operator: "",
    };
    const updated = [...conditions, newCondition];
    setConditions(updated);
    form.setValue("conditions", updated);
  };

  const handleConditionChange = (index: number, condition: ConditionFormData) => {
    const updated = [...conditions];
    updated[index] = condition;
    setConditions(updated);
    form.setValue("conditions", updated);
  };

  const handleConditionRemove = (index: number) => {
    const updated = conditions.filter((_, i) => i !== index);
    setConditions(updated);
    form.setValue("conditions", updated);
  };

  const categoryOptions = categories.map((cat) => ({
    value: (cat._id || cat.id)?.toString() || "",
    label: cat.name,
  }));

  const selectedCategory = categoryOptions.find(
    (option) => option.value === form.watch("category")
  );

  const triggerOptions = getGroupedTriggerOptions();
  const selectedTrigger = triggerOptions
    .flatMap((group) => group.options)
    .find((option) => option.value === form.watch("automationTrigger"));

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder="Enter action name"
          className={form.formState.errors.name ? "border-destructive" : ""}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">
          Category <span className="text-destructive">*</span>
        </Label>
        <Controller
          name="category"
          control={form.control}
          render={({ field, fieldState }) => (
            <div>
              <ReactSelect
                value={selectedCategory || null}
                onChange={(option) => field.onChange(option?.value || "")}
                options={categoryOptions}
                isLoading={loadingCategories}
                isDisabled={loadingCategories}
                placeholder="Select a category"
                className="react-select-container"
                classNamePrefix="react-select"
              />
              {fieldState.error && (
                <p className="mt-1 text-sm text-destructive">{fieldState.error.message}</p>
              )}
            </div>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="automationTrigger">
          Automation Trigger <span className="text-destructive">*</span>
        </Label>
        <Controller
          name="automationTrigger"
          control={form.control}
          render={({ field, fieldState }) => (
            <div>
              <ReactSelect
                value={selectedTrigger || null}
                onChange={(option) => field.onChange(option?.value || "")}
                options={triggerOptions}
                placeholder="Select an automation trigger"
                className="react-select-container"
                classNamePrefix="react-select"
                formatGroupLabel={(group) => (
                  <div className="font-semibold text-sm py-1">{group.label}</div>
                )}
                formatOptionLabel={({ label, description }) => (
                  <div className="py-1">
                    <div className="font-medium">{label}</div>
                    {description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                    )}
                  </div>
                )}
              />
              {fieldState.error && (
                <p className="mt-1 text-sm text-destructive">{fieldState.error.message}</p>
              )}
            </div>
          )}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Controller
            name="isActive"
            control={form.control}
            render={({ field }) => (
              <Checkbox
                id="isActive"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
            Active
          </Label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Conditions (Optional)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddCondition}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Condition
          </Button>
        </div>

        {conditions.length > 1 && (
          <div className="space-y-2">
            <Label>Connect conditions with</Label>
            <Controller
              name="conditionLogic"
              control={form.control}
              render={({ field }) => (
                <ReactSelect
                  value={{ value: conditionLogic, label: conditionLogic }}
                  onChange={(option) => {
                    const value = option?.value as "AND" | "OR";
                    setConditionLogic(value);
                    field.onChange(value);
                  }}
                  options={[
                    // @ts-ignore
                    { value: "AND", label: "AND (All conditions must be true)" },
                    // @ts-ignore
                    { value: "OR", label: "OR (At least one condition must be true)" },
                  ]}
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              )}
            />
          </div>
        )}

        {conditions.length > 0 && (
          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <div key={index} className="relative">
                {index > 0 && conditions.length > 1 && (
                  <div className="flex items-center justify-center my-2">
                    <span className="px-3 py-1 bg-muted rounded-md text-sm font-medium">
                      {conditionLogic}
                    </span>
                  </div>
                )}
                <ConditionForm
                  condition={condition}
                  index={index}
                  onChange={handleConditionChange}
                  onRemove={handleConditionRemove}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
