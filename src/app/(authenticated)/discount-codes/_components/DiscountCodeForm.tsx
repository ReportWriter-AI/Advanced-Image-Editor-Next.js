"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";

const discountCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required"),
  type: z.enum(["percent", "amount"], {
    required_error: "Type is required",
  }),
  value: z
    .string()
    .trim()
    .min(1, "Value is required")
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) >= 0, {
      message: "Value must be a non-negative number",
    }),
  description: z.string().optional(),
  notes: z.string().optional(),
  appliesToServices: z.array(z.string()).default([]),
  appliesToAddOns: z.array(z.string()).default([]),
  maxUses: z
    .string()
    .optional()
    .refine(
      (val) =>
        val === undefined ||
        val === "" ||
        (!Number.isNaN(Number(val)) && Number(val) >= 0 && Number.isInteger(Number(val))),
      {
        message: "Max uses must be a whole number greater than or equal to 0",
      }
    ),
  expirationDate: z.date().optional().nullable(),
  active: z.boolean().default(true),
});

export type DiscountCodeFormValues = z.infer<typeof discountCodeSchema>;

export interface DiscountCodeFormNormalizedValues {
  code: string;
  type: "percent" | "amount";
  value: number;
  description?: string;
  notes?: string;
  appliesToServices: string[];
  appliesToAddOns: {
    serviceId: string;
    addOnName: string;
    addOnOrderIndex?: number;
  }[];
  maxUses?: number;
  expirationDate?: string;
  active: boolean;
}

const DEFAULT_VALUES: DiscountCodeFormValues = {
  code: "",
  type: "percent",
  value: "",
  description: "",
  notes: "",
  appliesToServices: [],
  appliesToAddOns: [],
  maxUses: "",
  expirationDate: null,
  active: true,
};

interface ServiceOption {
  id: string;
  name: string;
  addOns: {
    name: string;
    orderIndex?: number;
  }[];
}

interface DiscountCodeFormProps {
  initialValues?: Partial<DiscountCodeFormValues>;
  submitLabel: string;
  onSubmit: (values: DiscountCodeFormNormalizedValues) => Promise<void> | void;
  onCancel: () => void;
  isSubmittingExternal?: boolean;
}

export function DiscountCodeForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmittingExternal = false,
}: DiscountCodeFormProps) {
  const form = useForm<DiscountCodeFormValues>({
    resolver: zodResolver(discountCodeSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const [services, setServices] = useState<ServiceOption[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  useEffect(() => {
    if (initialValues) {
      form.reset({
        ...DEFAULT_VALUES,
        ...initialValues,
      });
    }
  }, [initialValues, form]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setServicesLoading(true);
        setServicesError(null);
        const response = await fetch("/api/services", { credentials: "include" });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to load services");
        }
        const mapped: ServiceOption[] = Array.isArray(result.services)
          ? result.services.map((service: any) => ({
              id: service._id,
              name: service.name,
              addOns: Array.isArray(service.addOns)
                ? service.addOns.map((addOn: any) => ({
                    name: addOn.name,
                    orderIndex: typeof addOn.orderIndex === "number" ? addOn.orderIndex : undefined,
                  }))
                : [],
            }))
          : [];
        setServices(mapped);
      } catch (error: any) {
        console.error("Service options error:", error);
        setServicesError(error.message || "Failed to load services");
        setServices([]);
      } finally {
        setServicesLoading(false);
      }
    };

    fetchServices();
  }, []);

  const serviceOptions: MultiSelectOption[] = useMemo(
    () =>
      services.map((service) => ({
        value: service.id,
        label: service.name,
      })),
    [services]
  );

  const addOnOptions: MultiSelectOption[] = useMemo(() => {
    const options: MultiSelectOption[] = [];
    services.forEach((service) => {
      service.addOns.forEach((addOn, index) => {
        const orderIndex = addOn.orderIndex ?? index;
        options.push({
          value: `${service.id}::${orderIndex}`,
          label: addOn.name,
          description: service.name,
        });
      });
    });
    return options;
  }, [services]);

  const addOnMetaMap = useMemo(() => {
    const map: Record<
      string,
      {
        serviceId: string;
        addOnName: string;
        addOnOrderIndex?: number;
      }
    > = {};
    services.forEach((service) => {
      service.addOns.forEach((addOn, index) => {
        const orderIndex = addOn.orderIndex ?? index;
        const key = `${service.id}::${orderIndex}`;
        map[key] = {
          serviceId: service.id,
          addOnName: addOn.name,
          addOnOrderIndex: orderIndex,
        };
      });
    });
    return map;
  }, [services]);

  const handleSubmit = async (values: DiscountCodeFormValues) => {
    const normalized: DiscountCodeFormNormalizedValues = {
      code: values.code.trim(),
      type: values.type,
      value: Number(values.value),
      description: values.description?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
      appliesToServices: values.appliesToServices,
      appliesToAddOns: values.appliesToAddOns.map((selection) => {
        const meta = addOnMetaMap[selection];
        if (meta) {
          return {
            serviceId: meta.serviceId,
            addOnName: meta.addOnName,
            ...(meta.addOnOrderIndex !== undefined ? { addOnOrderIndex: meta.addOnOrderIndex } : {}),
          };
        }
        const [serviceId, orderIndex] = selection.split("::");
        return {
          serviceId,
          addOnName: selection,
          addOnOrderIndex: orderIndex ? Number(orderIndex) : undefined,
        };
      }),
      ...(values.maxUses && values.maxUses.trim() !== ""
        ? { maxUses: Number(values.maxUses) }
        : {}),
      ...(values.expirationDate ? { expirationDate: values.expirationDate.toISOString() } : {}),
      active: values.active,
    };

    await onSubmit(normalized);
  };

  const isSubmitting = form.formState.isSubmitting || isSubmittingExternal;
  const selectedType = form.watch("type");

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="code">Code *</Label>
          <Input
            id="code"
            placeholder="Case Sensitive"
            {...form.register("code")}
            autoComplete="off"
          />
          {form.formState.errors.code && (
            <p className="text-sm text-red-600">{form.formState.errors.code.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type *</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent</SelectItem>
                  <SelectItem value="amount">Amount</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.type && (
            <p className="text-sm text-red-600">{form.formState.errors.type.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="value">
          {selectedType === "percent" ? "Percentage Value *" : "Amount Value *"}
        </Label>
        <Input
          id="value"
          type="number"
          step="0.01"
          min="0"
          placeholder={selectedType === "percent" ? "0.0" : "0.00"}
          {...form.register("value")}
        />
        {form.formState.errors.value && (
          <p className="text-sm text-red-600">{form.formState.errors.value.message}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={3}
            placeholder="Client will see this"
            {...form.register("description")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={3}
            placeholder="Internal"
            {...form.register("notes")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Applies to Services</Label>
        <Controller
          control={form.control}
          name="appliesToServices"
          render={({ field }) => (
            <MultiSelect
              value={field.value}
              onChange={field.onChange}
              options={serviceOptions}
              placeholder={
                servicesLoading ? "Loading services..." : "Select one or more services"
              }
              disabled={servicesLoading || serviceOptions.length === 0 || isSubmitting}
            />
          )}
        />
        {servicesError && (
          <p className="text-sm text-red-600">{servicesError}</p>
        )}
        {!servicesLoading && serviceOptions.length === 0 && !servicesError && (
          <p className="text-sm text-muted-foreground">No services available.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Applies to Add-ons</Label>
        <Controller
          control={form.control}
          name="appliesToAddOns"
          render={({ field }) => (
            <MultiSelect
              value={field.value}
              onChange={field.onChange}
              options={addOnOptions}
              placeholder={
                servicesLoading
                  ? "Loading add-ons..."
                  : addOnOptions.length
                    ? "Select add-ons"
                    : "No add-ons found"
              }
              disabled={servicesLoading || addOnOptions.length === 0 || isSubmitting}
            />
          )}
        />
        {!servicesLoading && addOnOptions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add-ons from your services will appear here.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="maxUses">Max Uses</Label>
          <Input
            id="maxUses"
            type="number"
            step="1"
            min="0"
            placeholder="Blank for unlimited uses"
            {...form.register("maxUses")}
          />
          {form.formState.errors.maxUses && (
            <p className="text-sm text-red-600">{form.formState.errors.maxUses.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Expiration Date</Label>
          <Controller
            control={form.control}
            name="expirationDate"
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : "Blank for no expiration"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ?? undefined}
                    onSelect={(date) => field.onChange(date ?? null)}
                    initialFocus
                  />
                  {field.value && (
                    <div className="border-t p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => field.onChange(null)}
                      >
                        Clear date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label className="text-base">Active</Label>
          <p className="text-sm text-muted-foreground">Disable to prevent clients from using this code.</p>
        </div>
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
          )}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {submitLabel === "Save Changes" ? "Saving..." : "Submitting..."}
            </span>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}


