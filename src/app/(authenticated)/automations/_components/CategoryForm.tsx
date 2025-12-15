"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReactSelect from "react-select";
import { Loader2 } from "lucide-react";

const automationTypeOptions = [
  { value: "Scheduling", label: "Scheduling" },
  { value: "Rescheduling", label: "Rescheduling" },
  { value: "Publishing", label: "Publishing" },
  { value: "Informational - Pre-Inspection", label: "Informational - Pre-Inspection" },
  { value: "Upsell - Pre-Inspection", label: "Upsell - Pre-Inspection" },
  { value: "Informational - Post-Inspection", label: "Informational - Post-Inspection" },
  { value: "Upsell - Post-Inspection", label: "Upsell - Post-Inspection" },
  { value: "Inspector", label: "Inspector" },
  { value: "Staff", label: "Staff" },
  { value: "3rd Party", label: "3rd Party" },
  { value: "Other", label: "Other" },
];

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  automationType: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value) return true;
        return automationTypeOptions.some((option) => option.value === value);
      },
      { message: "Invalid automation type" }
    ),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export type CategoryFormNormalizedValues = {
  name: string;
  automationType?: string;
};

interface CategoryFormProps {
  initialValues?: Partial<CategoryFormValues>;
  submitLabel: string;
  onSubmit: (values: CategoryFormNormalizedValues) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CategoryForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CategoryFormProps) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: initialValues?.name || "",
      automationType: initialValues?.automationType || undefined,
    },
  });

  const handleSubmit = async (values: CategoryFormValues) => {
    const normalized: CategoryFormNormalizedValues = {
      name: values.name.trim(),
      automationType: values.automationType || undefined,
    };
    await onSubmit(normalized);
  };

  const selectedAutomationType = automationTypeOptions.find(
    (option) => option.value === form.watch("automationType")
  );

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder="Enter category name"
          className={form.formState.errors.name ? "border-destructive" : ""}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="automationType">Automation Type</Label>
        <Controller
          name="automationType"
          control={form.control}
          render={({ field, fieldState }) => (
            <div>
              <ReactSelect
                value={selectedAutomationType || null}
                onChange={(option) => field.onChange(option?.value || undefined)}
                options={automationTypeOptions}
                isClearable
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

