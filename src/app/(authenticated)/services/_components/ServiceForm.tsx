"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MODIFIER_FIELDS, MODIFIER_TYPES } from "@/constants/modifierOptions";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronsUpDown, GripVertical, Info, Loader2, PlusCircle, Trash2 } from "lucide-react";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const baseCostSchema = z
  .string()
  .optional()
  .refine(
    (value) => value === undefined || value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0),
    {
      message: "Base cost must be a non-negative number",
    }
  );

const baseDurationSchema = z
  .string()
  .optional()
  .refine(
    (value) => value === undefined || value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0),
    {
      message: "Base duration must be a non-negative number",
    }
  );

const modifierSchema = z.object({
  field: z.string().min(1, "Field is required"),
  type: z.string().optional(),
  greaterThan: z
    .string()
    .optional()
    .refine((value) => value === undefined || value === "" || !Number.isNaN(Number(value)), {
      message: "Greater than must be numeric",
    }),
  lessThanOrEqual: z
    .string()
    .optional()
    .refine((value) => value === undefined || value === "" || !Number.isNaN(Number(value)), {
      message: "Less than or equal must be numeric",
    }),
  equals: z.string().optional(),
  addFee: z
    .string()
    .optional()
    .refine((value) => value === undefined || value === "" || !Number.isNaN(Number(value)), {
      message: "Add fee must be numeric",
    }),
  addHours: z
    .string()
    .optional()
    .refine((value) => value === undefined || value === "" || !Number.isNaN(Number(value)), {
      message: "Add hours must be numeric",
    }),
});

const baseServiceFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  serviceCategory: z.string().trim().min(1, "Service category is required"),
  description: z.string().optional(),
  hiddenFromScheduler: z.boolean().default(false),
  baseCost: baseCostSchema,
  baseDurationHours: baseDurationSchema,
  defaultInspectionEvents: z.string().optional(),
  organizationServiceId: z.string().optional(),
  agreementIds: z.array(z.string()).default([]),
  modifiers: z.array(modifierSchema).default([]),
});

const addOnSchema = baseServiceFieldsSchema.extend({
  allowUpsell: z.boolean().default(false),
  orderIndex: z.number().optional(),
});

const taxSchema = z.object({
  name: z.string().trim().min(1, "Tax name is required"),
  addPercent: z
    .string()
    .optional()
    .refine((value) => value === undefined || value === "" || !Number.isNaN(Number(value)), {
      message: "Add percent must be numeric",
    }),
  orderIndex: z.number().optional(),
});

export const serviceFormSchema = baseServiceFieldsSchema.extend({
  addOns: z.array(addOnSchema).default([]),
  taxes: z.array(taxSchema).default([]),
});

export type AddOnFormValues = z.infer<typeof addOnSchema>;
export type TaxFormValues = z.infer<typeof taxSchema>;
export type ServiceFormValues = z.infer<typeof serviceFormSchema>;
type ModifierFieldKey = string;

export interface ServiceFormNormalizedModifier {
  field: ModifierFieldKey;
  type?: string;
  greaterThan?: number;
  lessThanOrEqual?: number;
  equals?: string;
  addFee?: number;
  addHours?: number;
}

export interface ServiceFormNormalizedValues {
  name: string;
  serviceCategory: string;
  description?: string;
  hiddenFromScheduler: boolean;
  baseCost?: number;
  baseDurationHours?: number;
  defaultInspectionEvents: string[];
  organizationServiceId?: string;
  agreementIds: string[];
  modifiers: ServiceFormNormalizedModifier[];
  addOns: Array<{
    name: string;
    serviceCategory: string;
    description?: string;
    hiddenFromScheduler: boolean;
    baseCost?: number;
    baseDurationHours?: number;
    defaultInspectionEvents: string[];
    organizationServiceId?: string;
    modifiers: ServiceFormNormalizedModifier[];
    allowUpsell: boolean;
    orderIndex: number;
  }>;
  taxes: Array<{
    name: string;
    addPercent: number;
    orderIndex: number;
  }>;
}

const DEFAULT_VALUES: ServiceFormValues = {
  name: "",
  serviceCategory: "",
  description: "",
  hiddenFromScheduler: false,
  baseCost: "",
  baseDurationHours: "",
  defaultInspectionEvents: "",
  organizationServiceId: "",
  agreementIds: [],
  modifiers: [],
  addOns: [],
  taxes: [],
};

const DEFAULT_MODIFIER_VALUE = {
  field: "sq_ft",
  type: "range",
  greaterThan: "",
  lessThanOrEqual: "",
  equals: "",
  addFee: "",
  addHours: "",
} as const;

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectSection {
  label?: string;
  options: SearchableSelectOption[];
}

interface SearchableSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  sections: SearchableSelectSection[];
  disabled?: boolean;
  emptyText?: string;
}

interface ModifierOptionWithMeta {
  key: string;
  label: string;
  supportsType: boolean;
  hasEqualsField: boolean;
  requiresRange: boolean;
  group?: "custom";
}

interface ModifierFieldMeta {
  supportsType: boolean;
  requiresRange: boolean;
  hasEquals: boolean;
  label: string;
}

interface AgreementOption {
  id: string;
  name: string;
}

function SearchableSelect({
  value,
  onValueChange,
  placeholder = "Select an option",
  sections,
  disabled,
  emptyText = "No option found.",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  const allOptions = useMemo(
    () => sections.flatMap((section) => section.options),
    [sections]
  );
  const selectedOption = allOptions.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between hover:bg-muted",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            !selectedOption && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandList className="max-h-60 overflow-y-auto">
            {sections.map((section, sectionIndex) => (
              <CommandGroup
                key={section.label ?? sectionIndex}
                heading={section.label}
              >
                {section.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.value} ${option.label}`}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        option.value === value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const buildModifierTypeSections = (): SearchableSelectSection[] => [
  {
    options: MODIFIER_TYPES.map((option) => ({
      value: option.key,
      label: option.label,
    })),
  },
];

const createDefaultAddOn = (orderIndex = 0): AddOnFormValues => ({
  name: "",
  serviceCategory: "",
  description: "",
  hiddenFromScheduler: false,
  baseCost: "",
  baseDurationHours: "",
  defaultInspectionEvents: "",
  organizationServiceId: "",
  agreementIds: [],
  modifiers: [],
  allowUpsell: false,
  orderIndex,
});

interface ServiceFormProps {
  initialValues?: Partial<ServiceFormValues>;
  submitLabel: string;
  onSubmit: (values: ServiceFormNormalizedValues) => Promise<void> | void;
  onCancel: () => void;
  isSubmittingExternal?: boolean;
}

export function ServiceForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmittingExternal = false,
}: ServiceFormProps) {
  const form = useForm<ServiceFormValues>({

    //@ts-ignore
    resolver: zodResolver(serviceFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const defaultModifierOptions = useMemo<ModifierOptionWithMeta[]>(
    () =>
      MODIFIER_FIELDS.map((option) => ({
        key: option.key,
        label: option.label,
        supportsType: option.supportsType,
        hasEqualsField: option.hasEqualsField,
        requiresRange: option.requiresRange,
        group: option.group,
      })),
    []
  );

  const [modifierOptions, setModifierOptions] = useState<ModifierOptionWithMeta[]>(defaultModifierOptions);
  const [modifierOptionsLoading, setModifierOptionsLoading] = useState(true);
  const [modifierOptionsError, setModifierOptionsError] = useState<string | null>(null);
  const [agreements, setAgreements] = useState<AgreementOption[]>([]);
  const [agreementsLoading, setAgreementsLoading] = useState(true);
  const [agreementsError, setAgreementsError] = useState<string | null>(null);
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [serviceCategoriesLoading, setServiceCategoriesLoading] = useState(true);

  useEffect(() => {
    const fetchModifierOptions = async () => {
      try {
        setModifierOptionsLoading(true);
        setModifierOptionsError(null);
        const response = await fetch("/api/modifiers", { credentials: "include" });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to load modifiers");
        }

        const options: ModifierOptionWithMeta[] = Array.isArray(result.modifiers)
          ? result.modifiers.map((modifier: any) => ({
              key: modifier.key,
              label: modifier.label,
              supportsType: Boolean(modifier.supportsType),
              hasEqualsField: Boolean(modifier.hasEqualsField),
              requiresRange: Boolean(modifier.requiresRange),
              group: modifier.group === "custom" ? "custom" : undefined,
            }))
          : [];

        setModifierOptions(options.length > 0 ? options : defaultModifierOptions);
      } catch (error: any) {
        console.error("Modifier options error:", error);
        setModifierOptionsError(error.message || "Failed to load modifiers");
        setModifierOptions(defaultModifierOptions);
      } finally {
        setModifierOptionsLoading(false);
      }
    };

    fetchModifierOptions();
  }, [defaultModifierOptions]);

  useEffect(() => {
    const fetchAgreements = async () => {
      try {
        setAgreementsLoading(true);
        setAgreementsError(null);
        const response = await fetch("/api/agreements", { credentials: "include" });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to load agreements");
        }
        const options: AgreementOption[] = Array.isArray(result.agreements)
          ? result.agreements.map((agreement: any) => ({
              id: agreement._id,
              name: agreement.name,
            }))
          : [];
        setAgreements(options);
      } catch (error: any) {
        console.error("Agreement options error:", error);
        setAgreementsError(error.message || "Failed to load agreements");
        setAgreements([]);
      } finally {
        setAgreementsLoading(false);
      }
    };

    fetchAgreements();
  }, []);

  useEffect(() => {
    const fetchServiceCategories = async () => {
      try {
        setServiceCategoriesLoading(true);
        const response = await fetch("/api/reusable-dropdowns", { credentials: "include" });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to load service categories");
        }

        const categoriesString = result.serviceCategory || "";
        const categoriesArray = categoriesString
          .split(",")
          .map((c: string) => c.trim())
          .filter((c: string) => c.length > 0);
        
        setServiceCategories(categoriesArray);
      } catch (error: any) {
        console.error("Service categories error:", error);
        setServiceCategories([]);
      } finally {
        setServiceCategoriesLoading(false);
      }
    };

    fetchServiceCategories();
  }, []);

  const { fields: modifierFields, append, remove, update, replace } = useFieldArray({
    control: form.control,
    name: "modifiers",
  });

  const {
    fields: addOnFields,
    append: appendAddOn,
    remove: removeAddOn,
    move: moveAddOn,
    replace: replaceAddOns,
  } = useFieldArray({
    control: form.control,
    name: "addOns",
  });

  const {
    fields: taxFields,
    append: appendTax,
    remove: removeTax,
    move: moveTax,
    replace: replaceTaxes,
  } = useFieldArray({
    control: form.control,
    name: "taxes",
  });

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [modifiersSectionCollapsed, setModifiersSectionCollapsed] = useState(true);
  const [addOnsSectionCollapsed, setAddOnsSectionCollapsed] = useState(true);
  const [modifierCollapsedMap, setModifierCollapsedMap] = useState<Record<string, boolean>>({});
  const [addOnCollapsedMap, setAddOnCollapsedMap] = useState<Record<string, boolean>>({});
  const [taxCollapsedMap, setTaxCollapsedMap] = useState<Record<string, boolean>>({});
  const modifiersInitRef = useRef(true);
  const prevModifierIdsRef = useRef<string[]>([]);
  const addOnsInitRef = useRef(true);
  const prevAddOnIdsRef = useRef<string[]>([]);
  const taxesInitRef = useRef(true);
  const prevTaxIdsRef = useRef<string[]>([]);

  const defaultEventsPlaceholder = useMemo(() => "Event Names (comma separated)", []);
  const modifierFieldSections = useMemo<SearchableSelectSection[]>(() => {
    const standardOptions = modifierOptions
      .filter((option) => option.group !== "custom")
      .map((option) => ({
        value: option.key,
        label: option.label,
      }));
    const customOptions = modifierOptions
      .filter((option) => option.group === "custom")
      .map((option) => ({
        value: option.key,
        label: option.label,
      }));

    const sections: SearchableSelectSection[] = [];
    if (standardOptions.length > 0) {
      sections.push({ options: standardOptions });
    }
    if (customOptions.length > 0) {
      sections.push({ label: "-- Custom Field --", options: customOptions });
    }
    return sections;
  }, [modifierOptions]);
  const modifierTypeSections = useMemo<SearchableSelectSection[]>(() => buildModifierTypeSections(), []);

  const modifierOptionMap = useMemo<Record<string, ModifierOptionWithMeta>>(() => {
    const map: Record<string, ModifierOptionWithMeta> = {};
    modifierOptions.forEach((option) => {
      map[option.key] = option;
    });
    return map;
  }, [modifierOptions]);

  const getFieldMeta = useCallback(
    (fieldKey?: string): ModifierFieldMeta => {
      const meta = fieldKey ? modifierOptionMap[fieldKey] : undefined;
      return {
        supportsType: meta?.supportsType ?? false,
        requiresRange: meta?.requiresRange ?? false,
        hasEquals: meta?.hasEqualsField ?? false,
        label: meta?.label ?? fieldKey ?? "",
      };
    },
    [modifierOptionMap]
  );

  const getDefaultModifierField = useCallback(() => {
    const sqFt = modifierOptions.find((option) => option.key === DEFAULT_MODIFIER_VALUE.field);
    if (sqFt) {
      return sqFt.key;
    }
    return modifierOptions[0]?.key ?? DEFAULT_MODIFIER_VALUE.field;
  }, [modifierOptions]);

  useEffect(() => {
    const prevIds = prevModifierIdsRef.current;
    const currentIds = modifierFields.map((field) => field.id);

    setModifierCollapsedMap((prev) => {
      const next: Record<string, boolean> = {};
      currentIds.forEach((id) => {
        if (prev[id] !== undefined) {
          next[id] = prev[id];
        } else {
          next[id] = modifiersInitRef.current ? true : false;
        }
      });
      return next;
    });

    if (!modifiersInitRef.current) {
      const newlyAddedIds = currentIds.filter((id) => !prevIds.includes(id));
      if (newlyAddedIds.length > 0) {
        setModifiersSectionCollapsed(false);
      }
    }

    modifiersInitRef.current = false;
    prevModifierIdsRef.current = currentIds;
  }, [modifierFields]);

  useEffect(() => {
    const prevIds = prevAddOnIdsRef.current;
    const currentIds = addOnFields.map((field) => field.id);
    const newlyAddedIds = currentIds.filter((id) => !prevIds.includes(id));

    setAddOnCollapsedMap((prev) => {
      const next: Record<string, boolean> = {};
      currentIds.forEach((id) => {
        if (prev[id] !== undefined) {
          next[id] = prev[id];
        } else {
          next[id] = addOnsInitRef.current ? true : false;
        }
      });

      if (!addOnsInitRef.current && newlyAddedIds.length > 0) {
        newlyAddedIds.forEach((id) => {
          next[id] = false;
        });
      }

      return next;
    });

    if (!addOnsInitRef.current && newlyAddedIds.length > 0) {
      setAddOnsSectionCollapsed(false);
    }

    addOnsInitRef.current = false;
    prevAddOnIdsRef.current = currentIds;
  }, [addOnFields]);

  useEffect(() => {
    const prevIds = prevTaxIdsRef.current;
    const currentIds = taxFields.map((field) => field.id);
    const newlyAddedIds = currentIds.filter((id) => !prevIds.includes(id));

    setTaxCollapsedMap((prev) => {
      const next: Record<string, boolean> = {};
      currentIds.forEach((id) => {
        if (prev[id] !== undefined) {
          next[id] = prev[id];
        } else {
          next[id] = taxesInitRef.current ? true : false;
        }
      });

      if (!taxesInitRef.current && newlyAddedIds.length > 0) {
        newlyAddedIds.forEach((id) => {
          next[id] = false;
        });
      }

      return next;
    });

    taxesInitRef.current = false;
    prevTaxIdsRef.current = currentIds;
  }, [taxFields]);

  useEffect(() => {
    if (initialValues) {
      modifiersInitRef.current = true;
      addOnsInitRef.current = true;
      setModifierCollapsedMap({});
      setAddOnCollapsedMap({});
      setAddOnsSectionCollapsed(true);
      form.reset({
        ...DEFAULT_VALUES,
        ...initialValues,
      });
      if (Array.isArray(initialValues.modifiers)) {
        replace(initialValues.modifiers);
      }
      if (Array.isArray(initialValues.addOns)) {
        replaceAddOns(initialValues.addOns as AddOnFormValues[]);
      } else {
        replaceAddOns([]);
      }
      if (Array.isArray(initialValues.taxes)) {
        replaceTaxes(initialValues.taxes as TaxFormValues[]);
      } else {
        replaceTaxes([]);
      }
    }
  }, [initialValues, form, replace, replaceAddOns, replaceTaxes]);

  const handleSubmit = async (values: ServiceFormValues) => {
    const normalizeDefaultEvents = (input?: string) =>
      input
        ? input
            .split(",")
            .map((event) => event.trim())
            .filter((event) => event.length > 0)
        : [];

    const normalizeModifiers = (mods: typeof values.modifiers): ServiceFormNormalizedModifier[] =>
      mods?.map((modifier) => {
        const fieldKey = modifier.field as ModifierFieldKey;
        const { supportsType, hasEquals } = getFieldMeta(fieldKey);
        const payload: ServiceFormNormalizedModifier = {
          field: fieldKey,
        };

        if (supportsType) {
          const normalizedType = modifier.type && modifier.type.trim().length > 0 ? modifier.type : "range";
          payload.type = normalizedType;
        }

        if (hasEquals && modifier.equals && modifier.equals.trim() !== "") {
          payload.equals = modifier.equals.trim();
        }

        if (modifier.greaterThan && modifier.greaterThan.trim() !== "") {
          payload.greaterThan = Number(modifier.greaterThan);
        }
        if (modifier.lessThanOrEqual && modifier.lessThanOrEqual.trim() !== "") {
          payload.lessThanOrEqual = Number(modifier.lessThanOrEqual);
        }
        if (modifier.addFee && modifier.addFee.trim() !== "") {
          payload.addFee = Number(modifier.addFee);
        }
        if (modifier.addHours && modifier.addHours.trim() !== "") {
          payload.addHours = Number(modifier.addHours);
        }
        return payload;
      }) || [];

    const baseCostValue = values.baseCost && values.baseCost.trim() !== "" ? Number(values.baseCost) : undefined;
    const baseDurationValue =
      values.baseDurationHours && values.baseDurationHours.trim() !== ""
        ? Number(values.baseDurationHours)
        : undefined;

    const normalized: ServiceFormNormalizedValues = {
      name: values.name.trim(),
      serviceCategory: values.serviceCategory.trim(),
      description: values.description?.trim() || undefined,
      hiddenFromScheduler: values.hiddenFromScheduler,
      ...(baseCostValue !== undefined ? { baseCost: baseCostValue } : {}),
      ...(baseDurationValue !== undefined ? { baseDurationHours: baseDurationValue } : {}),
      defaultInspectionEvents: normalizeDefaultEvents(values.defaultInspectionEvents),
      organizationServiceId: values.organizationServiceId?.trim() || undefined,
      agreementIds: values.agreementIds ?? [],
      modifiers: normalizeModifiers(values.modifiers),
      addOns:
        values.addOns?.map((addOn, index) => {
          const addOnBaseCost = addOn.baseCost && addOn.baseCost.trim() !== "" ? Number(addOn.baseCost) : undefined;
          const addOnBaseDuration =
            addOn.baseDurationHours && addOn.baseDurationHours.trim() !== ""
              ? Number(addOn.baseDurationHours)
              : undefined;

          return {
            name: addOn.name.trim(),
            serviceCategory: addOn.serviceCategory.trim(),
            description: addOn.description?.trim() || undefined,
            hiddenFromScheduler: addOn.hiddenFromScheduler,
            ...(addOnBaseCost !== undefined ? { baseCost: addOnBaseCost } : {}),
            ...(addOnBaseDuration !== undefined ? { baseDurationHours: addOnBaseDuration } : {}),
            defaultInspectionEvents: normalizeDefaultEvents(addOn.defaultInspectionEvents),
            organizationServiceId: addOn.organizationServiceId?.trim() || undefined,
            modifiers: normalizeModifiers(addOn.modifiers),
            allowUpsell: addOn.allowUpsell ?? false,
            orderIndex: addOn.orderIndex ?? index,
          };
        }) || [],
      taxes:
        values.taxes?.map((tax, index) => ({
          name: tax.name.trim(),
          addPercent:
            tax.addPercent && tax.addPercent.trim() !== "" ? Number(tax.addPercent) : 0,
          orderIndex: tax.orderIndex ?? index,
        })) || [],
    };

    await onSubmit(normalized);
  };

  const isSubmitting = form.formState.isSubmitting || isSubmittingExternal;

  const handleAddModifier = () => {
    setModifiersSectionCollapsed(false);
    const fieldKey = getDefaultModifierField();
    const { supportsType } = getFieldMeta(fieldKey);
    append({
      ...DEFAULT_MODIFIER_VALUE,
      field: fieldKey,
      type: supportsType ? DEFAULT_MODIFIER_VALUE.type : undefined,
    });
  };

  const handleFieldChange = (index: number, newField: string) => {
    const current = form.getValues(`modifiers.${index}`);
    const { supportsType, requiresRange, hasEquals } = getFieldMeta(newField as ModifierFieldKey);

    update(index, {
      ...current,
      field: newField,
      type: supportsType ? current.type || "range" : undefined,
      greaterThan: requiresRange ? current.greaterThan || "" : supportsType && current.type === "per_unit_over" ? current.greaterThan || "" : "",
      lessThanOrEqual: requiresRange ? current.lessThanOrEqual || "" : "",
      equals: hasEquals ? current.equals || "" : "",
      addFee: current.addFee || "",
      addHours: current.addHours || "",
    });
  };

  const handleAddOnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = addOnFields.findIndex((field) => field.id === active.id);
    const newIndex = addOnFields.findIndex((field) => field.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      moveAddOn(oldIndex, newIndex);
    }
  };

  const handleAddAddOn = () => {
  setAddOnsSectionCollapsed(false);
  appendAddOn(createDefaultAddOn(addOnFields.length));
};

  const handleTaxDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = taxFields.findIndex((field) => field.id === active.id);
    const newIndex = taxFields.findIndex((field) => field.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      moveTax(oldIndex, newIndex);
    }
  };

  const handleAddTax = () => {
    appendTax({ name: "", addPercent: "", orderIndex: taxFields.length });
  };

  const getType = (index: number) => form.watch(`modifiers.${index}.type`);

  const toggleModifierCard = (id: string) => {
    setModifierCollapsedMap((prev) => {
      const current = prev[id] ?? true;
      return {
        ...prev,
        [id]: !current,
      };
    });
  };

  const toggleAddOnCard = (id: string) => {
    setAddOnCollapsedMap((prev) => {
      const current = prev[id] ?? true;
      return {
        ...prev,
        [id]: !current,
      };
    });
  };

  const toggleTaxCard = (id: string) => {
    setTaxCollapsedMap((prev) => {
      const current = prev[id] ?? true;
      return {
        ...prev,
        [id]: !current,
      };
    });
  };

  return (
    <TooltipProvider>
      {/* @ts-ignore */}
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name <span className="text-red-600">*</span></Label>
          <Input id="name" placeholder="Service name" {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="serviceCategory">Service Category <span className="text-red-600">*</span></Label>
          <Controller
            name="serviceCategory"
            control={form.control}
            render={({ field }) => {
              const selectedLabel = field.value ? serviceCategories.find((cat) => cat === field.value) : "";

              return (
                <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoryOpen}
                      className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                      disabled={isSubmitting || serviceCategoriesLoading}
                    >
                      {serviceCategoriesLoading ? "Loading categories..." : selectedLabel || "Select a category"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search category..." />
                      <CommandEmpty>No category found.</CommandEmpty>
                      <CommandList className="max-h-60 overflow-y-auto">
                        <CommandGroup>
                          {serviceCategories.map((category) => (
                            <CommandItem
                              key={category}
                              value={category}
                              onSelect={(currentValue) => {
                                field.onChange(currentValue);
                                field.onBlur();
                                setCategoryOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  field.value === category ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {category}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              );
            }}
          />
          {form.formState.errors.serviceCategory && (
            <p className="text-sm text-red-600">{form.formState.errors.serviceCategory.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe this service"
          rows={4}
          {...form.register("description")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="baseCost">Base Cost</Label>
          <Input
            id="baseCost"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...form.register("baseCost")}
          />
          {form.formState.errors.baseCost && (
            <p className="text-sm text-red-600">{form.formState.errors.baseCost.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseDurationHours">Base Duration (HRs)</Label>
          <Input
            id="baseDurationHours"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.0"
            {...form.register("baseDurationHours")}
          />
          {form.formState.errors.baseDurationHours && (
            <p className="text-sm text-red-600">{form.formState.errors.baseDurationHours.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultInspectionEvents" className="flex items-center gap-1">
          Default Inspection Events
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 cursor-pointer text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              These events will automatically be added when scheduling an inspection with this service.
            </TooltipContent>
          </Tooltip>
        </Label>
        <Input
          id="defaultInspectionEvents"
          placeholder={defaultEventsPlaceholder}
          {...form.register("defaultInspectionEvents")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="organizationServiceId" className="flex items-center gap-1">
            Organization Service ID
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 cursor-pointer text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                This field is only used in exports and will not appear on screen.
              </TooltipContent>
            </Tooltip>
          </Label>
          <Input
            id="organizationServiceId"
            placeholder="Internal ID"
            {...form.register("organizationServiceId")}
          />
        </div>

      <div className="space-y-2">
        <Label htmlFor="agreementId" className="flex items-center gap-1">
          Agreement
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 cursor-pointer text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>Select which agreement clients must sign for this service.</TooltipContent>
          </Tooltip>
        </Label>
        <Controller
          name="agreementIds"
          control={form.control}
          render={({ field }) => (
            <MultiSelect
              value={field.value ?? []}
              onChange={field.onChange}
              options={agreements.map((agreement) => ({
                value: agreement.id,
                label: agreement.name,
              }))}
              placeholder={
                agreementsLoading ? "Loading agreements..." : "Select agreements (optional)"
              }
              disabled={agreementsLoading || isSubmitting}
            />
          )}
        />
        {agreementsError && <p className="text-sm text-red-600">{agreementsError}</p>}
        <p className="text-xs text-muted-foreground">
          Clients will be asked to sign every agreement selected here when booking this service.
        </p>
      </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="hiddenFromScheduler">Hidden from scheduler</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 cursor-pointer text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                This addon will not be available in your online scheduler (only you and your staff can add it).
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Controller
              name="hiddenFromScheduler"
              control={form.control}
              render={({ field }) => (
                <Checkbox
                  id="hiddenFromScheduler"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                />
              )}
            />
            <div className="space-y-1 text-sm">
              <Label htmlFor="hiddenFromScheduler" className="cursor-pointer font-medium">
                Hidden from scheduler
              </Label>
              <p className="text-xs text-muted-foreground">
                This addon will not be available in your online scheduler (only your team can add it).
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModifiersSectionCollapsed((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-muted"
                aria-label={modifiersSectionCollapsed ? "Expand modifiers section" : "Collapse modifiers section"}
              >
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 transition-transform",
                    modifiersSectionCollapsed ? "-rotate-90" : "rotate-0"
                  )}
                />
              </button>
              <h3 className="text-base font-semibold">Modifiers</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Add additional fees &amp; hours when properties match specific criteria such as square footage or age.
            </p>
            {modifierOptionsError && (
              <p className="text-xs text-red-600">
                {modifierOptionsError}. Showing default modifier list.
              </p>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddModifier} disabled={isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Modifier
          </Button>
        </div>

        {!modifiersSectionCollapsed && (
          <>
            {modifierFields.length === 0 ? (
              <div className="text-sm text-muted-foreground">No modifiers added yet.</div>
            ) : (
              <div className="space-y-4">
                {modifierFields.map((field, index) => {
                  const fieldValue = form.watch(`modifiers.${index}.field`) as ModifierFieldKey;
                  const typeValue = getType(index);
                  const { supportsType, requiresRange, hasEquals, label } = getFieldMeta(fieldValue);
                  const showGreaterThan =
                    requiresRange ||
                    (!supportsType && !hasEquals) ||
                    (supportsType && (typeValue === "range" || typeValue === "per_unit_over"));
                  const showLessThan = requiresRange || (supportsType && typeValue === "range");
                  const isCollapsed =
                    modifierCollapsedMap[field.id] ?? (modifiersInitRef.current ? true : false);

                  return (
                    <div key={field.id} className="rounded-md border bg-muted/10">
                      <div className="flex items-start justify-between gap-3 p-4">
                        <div className="flex flex-1 items-center gap-2">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-muted"
                            onClick={() => toggleModifierCard(field.id)}
                            aria-label={
                              isCollapsed ? "Expand modifier details" : "Collapse modifier details"
                            }
                          >
                            <ChevronDown
                              className={cn(
                                "h-5 w-5 shrink-0 transition-transform",
                                isCollapsed ? "-rotate-90" : "rotate-0"
                              )}
                            />
                          </button>
                          <button
                            type="button"
                            className="flex-1 text-left"
                            onClick={() => toggleModifierCard(field.id)}
                          >
                            <p className="text-sm font-semibold">
                            {label || "Select a field"}
                            </p>
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => remove(index)}
                          disabled={isSubmitting}
                          title="Remove modifier"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {!isCollapsed && (
                        <div className="border-t p-4">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Field</Label>
                              <Controller
                                name={`modifiers.${index}.field`}
                                control={form.control}
                                render={({ field: fieldController }) => (
                                  <SearchableSelect
                                    value={fieldController.value}
                                    onValueChange={(newValue) => {
                                      fieldController.onChange(newValue);
                                      handleFieldChange(index, newValue);
                                    }}
                                    placeholder="Select field"
                                    sections={modifierFieldSections}
                                    disabled={isSubmitting || modifierOptionsLoading}
                                  />
                                )}
                              />
                            </div>

                            {supportsType && (
                              <div className="space-y-2">
                                <Label>Type</Label>
                                <Controller
                                  name={`modifiers.${index}.type`}
                                  control={form.control}
                                  render={({ field: typeController }) => (
                                    <SearchableSelect
                                      value={typeController.value || "range"}
                                      onValueChange={(newValue) => {
                                        typeController.onChange(newValue);
                                        const current = form.getValues(`modifiers.${index}`);
                                        if (newValue === "range") {
                                          form.setValue(`modifiers.${index}.greaterThan`, current.greaterThan || "");
                                          form.setValue(
                                            `modifiers.${index}.lessThanOrEqual`,
                                            current.lessThanOrEqual || ""
                                          );
                                        } else if (newValue === "per_unit_over") {
                                          form.setValue(`modifiers.${index}.greaterThan`, current.greaterThan || "");
                                          form.setValue(`modifiers.${index}.lessThanOrEqual`, "");
                                        } else {
                                          form.setValue(`modifiers.${index}.greaterThan`, "");
                                          form.setValue(`modifiers.${index}.lessThanOrEqual`, "");
                                        }
                                      }}
                                      placeholder="Select type"
                                      sections={modifierTypeSections}
                                      disabled={isSubmitting}
                                    />
                                  )}
                                />
                              </div>
                            )}

                            {showGreaterThan && (
                              <div className="space-y-2">
                                <Label>Greater than</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0"
                                  {...form.register(`modifiers.${index}.greaterThan`)}
                                />
                                {form.formState.errors.modifiers?.[index]?.greaterThan && (
                                  <p className="text-xs text-red-600">
                                    {form.formState.errors.modifiers?.[index]?.greaterThan?.message}
                                  </p>
                                )}
                              </div>
                            )}

                            {showLessThan && (
                              <div className="space-y-2">
                                <Label>Less than or equal to</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0"
                                  {...form.register(`modifiers.${index}.lessThanOrEqual`)}
                                />
                                {form.formState.errors.modifiers?.[index]?.lessThanOrEqual && (
                                  <p className="text-xs text-red-600">
                                    {form.formState.errors.modifiers?.[index]?.lessThanOrEqual?.message}
                                  </p>
                                )}
                              </div>
                            )}

                            {hasEquals && (
                              <div className="space-y-2">
                                <Label>Equals</Label>
                                <Input placeholder="Value" {...form.register(`modifiers.${index}.equals`)} />
                                {form.formState.errors.modifiers?.[index]?.equals && (
                                  <p className="text-xs text-red-600">
                                    {form.formState.errors.modifiers?.[index]?.equals?.message}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label>Add Fee</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...form.register(`modifiers.${index}.addFee`)}
                              />
                              {form.formState.errors.modifiers?.[index]?.addFee && (
                                <p className="text-xs text-red-600">
                                  {form.formState.errors.modifiers?.[index]?.addFee?.message}
                                </p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label>Add Hours</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.0"
                                {...form.register(`modifiers.${index}.addHours`)}
                              />
                              {form.formState.errors.modifiers?.[index]?.addHours && (
                                <p className="text-xs text-red-600">
                                  {form.formState.errors.modifiers?.[index]?.addHours?.message}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={handleAddModifier} disabled={isSubmitting}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Modifier
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAddOnsSectionCollapsed((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-muted"
                aria-label={addOnsSectionCollapsed ? "Expand add-ons section" : "Collapse add-ons section"}
              >
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 transition-transform",
                    addOnsSectionCollapsed ? "-rotate-90" : "rotate-0"
                  )}
                />
              </button>
              <h3 className="text-base font-semibold">Add-ons</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Give your client options to add additional services and upsells.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddAddOn} disabled={isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Add-on
          </Button>
        </div>

        {!addOnsSectionCollapsed && (
          <>
            {addOnFields.length === 0 ? (
              <div className="text-sm text-muted-foreground">No add-ons added yet.</div>
            ) : (
              <DndContext collisionDetection={closestCenter} onDragEnd={handleAddOnDragEnd}>
                <SortableContext items={addOnFields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {addOnFields.map((field, index) => {
                      const collapsed =
                        addOnCollapsedMap[field.id] ?? (addOnsInitRef.current ? true : false);
                      return (
                        <SortableAddOnItem
                          key={field.id}
                          fieldId={field.id}
                          //@ts-ignore
                          form={form}
                          index={index}
                          isSubmitting={isSubmitting}
                          onRemove={() => removeAddOn(index)}
                          defaultEventsPlaceholder={defaultEventsPlaceholder}
                          collapsed={collapsed}
                          onToggleCollapse={() => toggleAddOnCard(field.id)}
                          modifierFieldSections={modifierFieldSections}
                          modifierTypeSections={modifierTypeSections}
                          getFieldMeta={getFieldMeta}
                          getDefaultModifierField={getDefaultModifierField}
                          modifierOptionsLoading={modifierOptionsLoading}
                          serviceCategories={serviceCategories}
                          serviceCategoriesLoading={serviceCategoriesLoading}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={handleAddAddOn} disabled={isSubmitting}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Add-on
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">Taxes</h3>
            <p className="text-sm text-muted-foreground">
              Add a percentage to the total for this service. Taxes are calculated after all modifiers and add-ons are processed.
            </p>
          </div>
        </div>

        {taxFields.length === 0 ? (
          <div className="text-sm text-muted-foreground">No taxes added yet.</div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleTaxDragEnd}>
            <SortableContext items={taxFields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                    {taxFields.map((field, index) => {
                      const collapsed = taxCollapsedMap[field.id] ?? (taxesInitRef.current ? true : false);
                      return (
                        <SortableTaxItem
                          key={field.id}
                          fieldId={field.id}
                          //@ts-ignore
                          form={form}
                          index={index}
                          isSubmitting={isSubmitting}
                          onRemove={() => removeTax(index)}
                          collapsed={collapsed}
                          onToggleCollapse={() => toggleTaxCard(field.id)}
                        />
                      );
                    })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={handleAddTax} disabled={isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Tax
          </Button>
        </div>
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
    </TooltipProvider>
  );
}

interface SortableAddOnItemProps {
  fieldId: string;
  form: UseFormReturn<ServiceFormValues>;
  index: number;
  isSubmitting: boolean;
  onRemove: () => void;
  defaultEventsPlaceholder: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  modifierFieldSections: SearchableSelectSection[];
  modifierTypeSections: SearchableSelectSection[];
  getFieldMeta: (fieldKey?: string) => ModifierFieldMeta;
  getDefaultModifierField: () => string;
  modifierOptionsLoading: boolean;
  serviceCategories: string[];
  serviceCategoriesLoading: boolean;
}

function SortableAddOnItem({
  fieldId,
  form,
  index,
  isSubmitting,
  onRemove,
  defaultEventsPlaceholder,
  collapsed,
  onToggleCollapse,
  modifierFieldSections,
  modifierTypeSections,
  getFieldMeta,
  getDefaultModifierField,
  modifierOptionsLoading,
  serviceCategories,
  serviceCategoriesLoading,
}: SortableAddOnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: fieldId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <AddOnCard
        form={form}
        index={index}
        isSubmitting={isSubmitting}
        onRemove={onRemove}
        dragHandleProps={{ attributes, listeners }}
        defaultEventsPlaceholder={defaultEventsPlaceholder}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        modifierFieldSections={modifierFieldSections}
        modifierTypeSections={modifierTypeSections}
        getFieldMeta={getFieldMeta}
        getDefaultModifierField={getDefaultModifierField}
        modifierOptionsLoading={modifierOptionsLoading}
        serviceCategories={serviceCategories}
        serviceCategoriesLoading={serviceCategoriesLoading}
      />
    </div>
  );
}

interface AddOnCardProps {
  form: UseFormReturn<ServiceFormValues>;
  index: number;
  isSubmitting: boolean;
  onRemove: () => void;
  dragHandleProps: {
    attributes?: Record<string, any>;
    listeners?: Record<string, any>;
  };
  defaultEventsPlaceholder: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  modifierFieldSections: SearchableSelectSection[];
  modifierTypeSections: SearchableSelectSection[];
  getFieldMeta: (fieldKey?: string) => ModifierFieldMeta;
  getDefaultModifierField: () => string;
  modifierOptionsLoading: boolean;
  serviceCategories: string[];
  serviceCategoriesLoading: boolean;
}

function AddOnCard({
  form,
  index,
  isSubmitting,
  onRemove,
  dragHandleProps,
  defaultEventsPlaceholder,
  collapsed,
  onToggleCollapse,
  modifierFieldSections,
  modifierTypeSections,
  getFieldMeta,
  getDefaultModifierField,
  modifierOptionsLoading,
  serviceCategories,
  serviceCategoriesLoading,
}: AddOnCardProps) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [modifierCollapsedMap, setModifierCollapsedMap] = useState<Record<string, boolean>>({});
  const modifierInitRef = useRef(true);
  const prevModifierIdsRef = useRef<string[]>([]);
  const addOnPath = `addOns.${index}` as const;
  const addOnErrors = form.formState.errors.addOns?.[index];

  useEffect(() => {
    form.setValue(`${addOnPath}.orderIndex` as const, index);
  }, [form, addOnPath, index]);

  const {
    fields: modifierFields,
    append: appendModifier,
    remove: removeModifier,
    update: updateModifier,
  } = useFieldArray({
    control: form.control,
    name: `${addOnPath}.modifiers` as const,
  });

  useEffect(() => {
    const prevIds = prevModifierIdsRef.current;
    const currentIds = modifierFields.map((field) => field.id);
    const newlyAddedIds = currentIds.filter((id) => !prevIds.includes(id));

    setModifierCollapsedMap((prev) => {
      const next: Record<string, boolean> = {};
      currentIds.forEach((id) => {
        if (prev[id] !== undefined) {
          next[id] = prev[id];
        } else {
          next[id] = modifierInitRef.current ? true : false;
        }
      });

      if (!modifierInitRef.current && newlyAddedIds.length > 0) {
        newlyAddedIds.forEach((id) => {
          next[id] = false;
        });
      }

      return next;
    });

    modifierInitRef.current = false;
    prevModifierIdsRef.current = currentIds;
  }, [modifierFields]);

  const handleAddModifier = () => {
    const defaultField = getDefaultModifierField();
    const { supportsType } = getFieldMeta(defaultField);
    appendModifier({
      ...DEFAULT_MODIFIER_VALUE,
      field: defaultField,
      type: supportsType ? DEFAULT_MODIFIER_VALUE.type : undefined,
    });
  };

  const handleModifierFieldChange = (modifierIndex: number, newField: string) => {
    const current = form.getValues(`${addOnPath}.modifiers.${modifierIndex}`);
    const { supportsType, requiresRange, hasEquals } = getFieldMeta(newField as ModifierFieldKey);

    updateModifier(modifierIndex, {
      ...current,
      field: newField,
      type: supportsType ? current?.type || "range" : undefined,
      greaterThan: requiresRange
        ? current?.greaterThan || ""
        : supportsType && current?.type === "per_unit_over"
          ? current?.greaterThan || ""
          : "",
      lessThanOrEqual: requiresRange ? current?.lessThanOrEqual || "" : "",
      equals: hasEquals ? current?.equals || "" : "",
      addFee: current?.addFee || "",
      addHours: current?.addHours || "",
    });
  };

  const getModifierType = (modifierIndex: number) =>
    form.watch(`${addOnPath}.modifiers.${modifierIndex}.type` as const);

  const addOnNameValue = form.watch(`${addOnPath}.name` as const);
  const displayName = addOnNameValue?.trim() ? addOnNameValue.trim() : `Add-on ${index + 1}`;
  const dragAttributes = dragHandleProps.attributes ?? {};
  const dragListeners = dragHandleProps.listeners ?? {};
  const collapseAriaLabel = collapsed ? "Expand add-on details" : "Collapse add-on details";

  const toggleModifierCard = (id: string) => {
    setModifierCollapsedMap((prev) => {
      const current = prev[id] ?? true;
      return {
        ...prev,
        [id]: !current,
      };
    });
  };

  return (
    <div className="rounded-md border bg-muted/10 p-4">
      <input type="hidden" {...form.register(`${addOnPath}.orderIndex` as const)} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-grab"
            disabled={isSubmitting}
            {...dragAttributes}
            {...dragListeners}
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-muted"
            onClick={onToggleCollapse}
            aria-label={collapseAriaLabel}
          >
            <ChevronDown
              className={cn("h-5 w-5 shrink-0 transition-transform", collapsed ? "-rotate-90" : "rotate-0")}
            />
          </button>
          <button type="button" className="flex-1 text-left" onClick={onToggleCollapse}>
            <p className="text-sm font-semibold">{displayName}</p>
          </button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={onRemove}
          disabled={isSubmitting}
          title="Remove add-on"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {!collapsed && (
        <>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Name <span className="text-red-600">*</span></Label>
            <Input
              placeholder="Add-on name"
              {...form.register(`${addOnPath}.name` as const)}
            />
            {addOnErrors?.name && <p className="text-sm text-red-600">{addOnErrors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Service Category <span className="text-red-600">*</span></Label>
            <Controller
              name={`${addOnPath}.serviceCategory` as const}
              control={form.control}
              render={({ field }) => {
                const selectedLabel = field.value ? serviceCategories.find((cat) => cat === field.value) : "";
                return (
                  <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={categoryOpen}
                        className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                        disabled={isSubmitting || serviceCategoriesLoading}
                      >
                        {serviceCategoriesLoading ? "Loading categories..." : selectedLabel || "Select a category"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search category..." />
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandList className="max-h-60 overflow-y-auto">
                          <CommandGroup>
                            {serviceCategories.map((category) => (
                              <CommandItem
                                key={category}
                                value={category}
                                onSelect={(currentValue) => {
                                  field.onChange(currentValue);
                                  field.onBlur();
                                  setCategoryOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === category ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {category}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                );
              }}
            />
            {addOnErrors?.serviceCategory && (
              <p className="text-sm text-red-600">{addOnErrors.serviceCategory.message}</p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            placeholder="Describe this add-on"
            rows={3}
            {...form.register(`${addOnPath}.description` as const)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Add Fee</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...form.register(`${addOnPath}.baseCost` as const)}
            />
            {addOnErrors?.baseCost && <p className="text-sm text-red-600">{addOnErrors.baseCost.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Add Hours</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.0"
              {...form.register(`${addOnPath}.baseDurationHours` as const)}
            />
            {addOnErrors?.baseDurationHours && (
              <p className="text-sm text-red-600">{addOnErrors.baseDurationHours.message}</p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label className="flex items-center gap-1">
            Default Inspection Events
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 cursor-pointer text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                These events will automatically be added when scheduling an inspection with this add-on.
              </TooltipContent>
            </Tooltip>
          </Label>
          <Input
            placeholder={defaultEventsPlaceholder}
            {...form.register(`${addOnPath}.defaultInspectionEvents` as const)}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Organization Service ID
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 cursor-pointer text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  This field is only used in exports and will not appear on screen.
                </TooltipContent>
              </Tooltip>
            </Label>
            <Input
              placeholder="Internal ID"
              {...form.register(`${addOnPath}.organizationServiceId` as const)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label>Hidden from scheduler</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 cursor-pointer text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  This add-on will not be available in your online scheduler.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Controller
                name={`${addOnPath}.hiddenFromScheduler` as const}
                control={form.control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                  />
                )}
              />
              <div className="space-y-1 text-sm">
                <Label className="cursor-pointer font-medium">Hidden from scheduler</Label>
                <p className="text-xs text-muted-foreground">
                  Keep this add-on internal for your team only.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-1">
            <Label>Allow upsell</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 cursor-pointer text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                This Add-ons will be displayed on the client portal. In the future we will allow automated upsell.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Controller
              name={`${addOnPath}.allowUpsell` as const}
              control={form.control}
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                />
              )}
            />
            <div className="space-y-1 text-sm">
              <Label className="cursor-pointer font-medium">Allow upsell</Label>
              <p className="text-xs text-muted-foreground">
                Display this add-on to clients while booking.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold">Modifiers</h4>
              <p className="text-xs text-muted-foreground">
                Add additional fees &amp; hours when properties match specific criteria.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddModifier} disabled={isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Modifier
            </Button>
          </div>

          {modifierFields.length === 0 ? (
            <div className="text-sm text-muted-foreground">No modifiers added yet.</div>
          ) : (
            <div className="space-y-4">
              {modifierFields.map((field, modifierIndex) => {
                const modifierFieldValue = form.watch(
                  `${addOnPath}.modifiers.${modifierIndex}.field` as const
                ) as ModifierFieldKey;
                const modifierTypeValue = getModifierType(modifierIndex);
                const { supportsType, requiresRange, hasEquals, label: modifierLabel } =
                  getFieldMeta(modifierFieldValue);
                const showGreaterThan =
                  requiresRange ||
                  (!supportsType && !hasEquals) ||
                  (supportsType && (modifierTypeValue === "range" || modifierTypeValue === "per_unit_over"));
                const showLessThan = requiresRange || (supportsType && modifierTypeValue === "range");
                const modifierCollapsed = modifierCollapsedMap[field.id] ?? (modifierInitRef.current ? true : false);

                return (
                  <div key={field.id} className="rounded-md border bg-muted/10">
                    <div className="flex items-start justify-between gap-3 p-4">
                      <div className="flex flex-1 items-center gap-2">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-muted"
                          onClick={() => toggleModifierCard(field.id)}
                          aria-label={
                            modifierCollapsed ? "Expand modifier details" : "Collapse modifier details"
                          }
                        >
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 shrink-0 transition-transform",
                              modifierCollapsed ? "-rotate-90" : "rotate-0"
                            )}
                          />
                        </button>
                        <button
                          type="button"
                          className="flex-1 text-left"
                          onClick={() => toggleModifierCard(field.id)}
                        >
                          <p className="text-sm font-semibold">
                            {modifierLabel || "Select a field"}
                          </p>
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeModifier(modifierIndex)}
                        disabled={isSubmitting}
                        title="Remove modifier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {!modifierCollapsed && (
                      <div className="border-t p-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Field</Label>
                            <Controller
                              name={`${addOnPath}.modifiers.${modifierIndex}.field` as const}
                              control={form.control}
                              render={({ field: fieldController }) => (
                                <SearchableSelect
                                  value={fieldController.value}
                                  onValueChange={(newValue) => {
                                    fieldController.onChange(newValue);
                                    handleModifierFieldChange(modifierIndex, newValue);
                                  }}
                                  placeholder="Select field"
                                  sections={modifierFieldSections}
                                  disabled={isSubmitting || modifierOptionsLoading}
                                />
                              )}
                            />
                          </div>

                          {supportsType && (
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <Controller
                                name={`${addOnPath}.modifiers.${modifierIndex}.type` as const}
                                control={form.control}
                                render={({ field: typeController }) => (
                                  <SearchableSelect
                                    value={typeController.value || "range"}
                                    onValueChange={(newValue) => {
                                      typeController.onChange(newValue);
                                      const current = form.getValues(`${addOnPath}.modifiers.${modifierIndex}`);
                                      if (newValue === "range") {
                                        form.setValue(
                                          `${addOnPath}.modifiers.${modifierIndex}.greaterThan`,
                                          current?.greaterThan || ""
                                        );
                                        form.setValue(
                                          `${addOnPath}.modifiers.${modifierIndex}.lessThanOrEqual`,
                                          current?.lessThanOrEqual || ""
                                        );
                                      } else if (newValue === "per_unit_over") {
                                        form.setValue(
                                          `${addOnPath}.modifiers.${modifierIndex}.greaterThan`,
                                          current?.greaterThan || ""
                                        );
                                        form.setValue(`${addOnPath}.modifiers.${modifierIndex}.lessThanOrEqual`, "");
                                      } else {
                                        form.setValue(`${addOnPath}.modifiers.${modifierIndex}.greaterThan`, "");
                                        form.setValue(`${addOnPath}.modifiers.${modifierIndex}.lessThanOrEqual`, "");
                                      }
                                    }}
                                    placeholder="Select type"
                                    sections={modifierTypeSections}
                                    disabled={isSubmitting}
                                  />
                                )}
                              />
                            </div>
                          )}

                          {showGreaterThan && (
                            <div className="space-y-2">
                              <Label>Greater than</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                {...form.register(`${addOnPath}.modifiers.${modifierIndex}.greaterThan` as const)}
                              />
                              {addOnErrors?.modifiers?.[modifierIndex]?.greaterThan && (
                                <p className="text-xs text-red-600">
                                  {addOnErrors.modifiers?.[modifierIndex]?.greaterThan?.message}
                                </p>
                              )}
                            </div>
                          )}

                          {showLessThan && (
                            <div className="space-y-2">
                              <Label>Less than or equal to</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                {...form.register(`${addOnPath}.modifiers.${modifierIndex}.lessThanOrEqual` as const)}
                              />
                              {addOnErrors?.modifiers?.[modifierIndex]?.lessThanOrEqual && (
                                <p className="text-xs text-red-600">
                                  {addOnErrors.modifiers?.[modifierIndex]?.lessThanOrEqual?.message}
                                </p>
                              )}
                            </div>
                          )}

                          {hasEquals && (
                            <div className="space-y-2">
                              <Label>Equals</Label>
                              <Input
                                placeholder="Value"
                                {...form.register(`${addOnPath}.modifiers.${modifierIndex}.equals` as const)}
                              />
                              {addOnErrors?.modifiers?.[modifierIndex]?.equals && (
                                <p className="text-xs text-red-600">
                                  {addOnErrors.modifiers?.[modifierIndex]?.equals?.message}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Add Fee</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...form.register(`${addOnPath}.modifiers.${modifierIndex}.addFee` as const)}
                            />
                            {addOnErrors?.modifiers?.[modifierIndex]?.addFee && (
                              <p className="text-xs text-red-600">
                                {addOnErrors.modifiers?.[modifierIndex]?.addFee?.message}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Add Hours</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.0"
                              {...form.register(`${addOnPath}.modifiers.${modifierIndex}.addHours` as const)}
                            />
                            {addOnErrors?.modifiers?.[modifierIndex]?.addHours && (
                              <p className="text-xs text-red-600">
                                {addOnErrors.modifiers?.[modifierIndex]?.addHours?.message}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}

interface SortableTaxItemProps {
  fieldId: string;
  form: UseFormReturn<ServiceFormValues>;
  index: number;
  isSubmitting: boolean;
  onRemove: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function SortableTaxItem({
  fieldId,
  form,
  index,
  isSubmitting,
  onRemove,
  collapsed,
  onToggleCollapse,
}: SortableTaxItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: fieldId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaxCard
        form={form}
        index={index}
        isSubmitting={isSubmitting}
        onRemove={onRemove}
        dragHandleProps={{ attributes, listeners }}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />
    </div>
  );
}

interface TaxCardProps {
  form: UseFormReturn<ServiceFormValues>;
  index: number;
  isSubmitting: boolean;
  onRemove: () => void;
  dragHandleProps: {
    attributes?: Record<string, any>;
    listeners?: Record<string, any>;
  };
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function TaxCard({
  form,
  index,
  isSubmitting,
  onRemove,
  dragHandleProps,
  collapsed,
  onToggleCollapse,
}: TaxCardProps) {
  const taxPath = `taxes.${index}` as const;
  const taxErrors = form.formState.errors.taxes?.[index];

  useEffect(() => {
    form.setValue(`${taxPath}.orderIndex` as const, index);
  }, [form, taxPath, index]);

  const dragAttributes = dragHandleProps.attributes ?? {};
  const dragListeners = dragHandleProps.listeners ?? {};
  const taxNameValue = form.watch(`${taxPath}.name` as const);
  const displayName = taxNameValue?.trim() ? taxNameValue.trim() : `Tax ${index + 1}`;
  const collapseAriaLabel = collapsed ? "Expand tax details" : "Collapse tax details";

  return (
    <div className="rounded-md border bg-muted/10 p-4">
      <input type="hidden" {...form.register(`${taxPath}.orderIndex` as const)} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-grab"
            disabled={isSubmitting}
            {...dragAttributes}
            {...dragListeners}
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-muted"
            onClick={onToggleCollapse}
            aria-label={collapseAriaLabel}
          >
            <ChevronDown
              className={cn("h-5 w-5 shrink-0 transition-transform", collapsed ? "-rotate-90" : "rotate-0")}
            />
          </button>
          <button type="button" className="flex-1 text-left" onClick={onToggleCollapse}>
            <p className="text-sm font-semibold">{displayName}</p>
          </button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={onRemove}
          disabled={isSubmitting}
          title="Remove tax"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {!collapsed && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name <span className="text-red-600">*</span></Label>
            <Input
              placeholder="Tax name"
              {...form.register(`${taxPath}.name` as const)}
            />
            {taxErrors?.name && <p className="text-sm text-red-600">{taxErrors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Add Percent <span className="text-red-600">*</span></Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...form.register(`${taxPath}.addPercent` as const)}
            />
            {taxErrors?.addPercent && (
              <p className="text-sm text-red-600">{taxErrors.addPercent.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


