"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactSelect from "react-select";
import CreatableSelect from "react-select/creatable";
import { Loader2, Plus, X } from "lucide-react";
import { getGroupedTriggerOptions } from "@/src/lib/automation-triggers";
import { ConditionForm, ConditionFormData } from "./ConditionForm";
import dynamic from "next/dynamic";
import { PLACEHOLDER_SECTIONS, PlaceholderItem } from "@/src/app/(authenticated)/agreements/_components/AgreementForm";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });
import "react-quill-new/dist/quill.snow.css";

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
    "ALL_REPORTS",
    "ANY_REPORTS",
    "YEAR_BUILD",
    "FOUNDATION",
    "SQUARE_FEET",
    "ZIP_CODE",
    "CITY",
    "STATE",
  ]),
  operator: z.string().min(1, "Operator is required"),
  value: z.string().optional(),
  serviceId: z.string().optional(),
  addonName: z.string().optional(),
  serviceCategory: z.string().optional(),
  categoryId: z.string().optional(),
  yearBuild: z.number().int().positive().optional(),
  foundation: z.string().optional(),
  squareFeet: z.number().positive().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

const actionFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  automationTrigger: z.string().min(1, "Automation trigger is required"),
  isActive: z.boolean(),
  conditions: z.array(conditionSchema).optional(),
  conditionLogic: z.enum(["AND", "OR"]).optional(),
  communicationType: z.enum(["EMAIL", "TEXT"]).optional(),
  sendTiming: z.enum(["AFTER", "BEFORE"]).optional(),
  sendDelay: z.number().min(0).optional(),
  sendDelayUnit: z.enum(["MINUTES", "HOURS", "DAYS", "WEEKS", "MONTHS"]).optional(),
  onlyTriggerOnce: z.boolean().optional(),
  alsoSendOnRecurringInspections: z.boolean().optional(),
  sendEvenWhenNotificationsDisabled: z.boolean().optional(),
  sendDuringCertainHoursOnly: z.boolean().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  doNotSendOnWeekends: z.boolean().optional(),
  emailTo: z.array(z.string()).optional(),
  emailCc: z.array(z.string()).optional(),
  emailBcc: z.array(z.string()).optional(),
  emailFrom: z.enum(["COMPANY", "INSPECTOR"]).optional(),
  emailSubject: z.string().optional(),
  emailBody: z.string().optional(),
})
  .refine(
    (data) => {
      if (data.communicationType === "EMAIL") {
        if (!data.emailSubject || data.emailSubject.trim().length === 0) {
          return false;
        }
        if (!data.emailBody || data.emailBody.trim().length === 0) {
          return false;
        }
        if (!data.emailTo || data.emailTo.length === 0) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Email subject, body, and at least one recipient are required when communication type is EMAIL",
      path: ["emailSubject"],
    }
  )
  .refine(
    (data) => {
      if (data.communicationType === "TEXT") {
        if (!data.emailBody || data.emailBody.trim().length === 0) {
          return false;
        }
        if (!data.emailTo || data.emailTo.length === 0) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Text body and at least one recipient are required when communication type is TEXT",
      path: ["emailBody"],
    }
  )
  .refine(
    (data) => {
      if (data.sendDuringCertainHoursOnly) {
        if (!data.startTime || !data.endTime) {
          return false;
        }
        // Validate time format (HH:mm)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(data.startTime) || !timeRegex.test(data.endTime)) {
          return false;
        }
        // Validate startTime < endTime
        const [startHour, startMin] = data.startTime.split(':').map(Number);
        const [endHour, endMin] = data.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        if (startMinutes >= endMinutes) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Start time must be before end time when 'Send during certain hours only' is enabled",
      path: ["startTime"],
    }
  );

export type ActionFormValues = z.infer<typeof actionFormSchema>;

export type ActionFormNormalizedValues = {
  name: string;
  category: string;
  automationTrigger: string;
  isActive: boolean;
  conditions?: ConditionFormData[]; // Can be empty array to clear conditions
  conditionLogic?: "AND" | "OR";
  communicationType?: "EMAIL" | "TEXT";
  sendTiming?: "AFTER" | "BEFORE";
  sendDelay?: number;
  sendDelayUnit?: "MINUTES" | "HOURS" | "DAYS" | "WEEKS" | "MONTHS";
  onlyTriggerOnce?: boolean;
  alsoSendOnRecurringInspections?: boolean;
  sendEvenWhenNotificationsDisabled?: boolean;
  sendDuringCertainHoursOnly?: boolean;
  startTime?: string;
  endTime?: string;
  doNotSendOnWeekends?: boolean;
  emailTo?: string[];
  emailCc?: string[];
  emailBcc?: string[];
  emailFrom?: "COMPANY" | "INSPECTOR";
  emailSubject?: string;
  emailBody?: string;
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
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [companyOwnerEmail, setCompanyOwnerEmail] = useState<string | null>(null);
  const [placeholderTargetField, setPlaceholderTargetField] = useState<"subject" | "body" | null>(null);
  const quillRef = useRef<any>(null);
  const previousInitialValuesRef = useRef<any>(null);

  // Triggers that support both BEFORE and AFTER options
  const TRIGGERS_WITH_BEFORE_AFTER = [
    // 'INSPECTION_START_TIME',
    // 'INSPECTION_END_TIME',
    'INSPECTION_CLOSING_DATE',
    'INSPECTION_END_OF_PERIOD_DATE',
  ];

  // Helper function to check if trigger supports BEFORE/AFTER
  const supportsBeforeAfter = (triggerKey: string): boolean => {
    return TRIGGERS_WITH_BEFORE_AFTER.includes(triggerKey);
  };

  // Shared recipient options for To, CC, and BCC fields
  const recipientOptions = [
    { value: "CLIENTS", label: "Clients" },
    { value: "CLIENTS_AGENTS", label: "Client's Agents" },
    { value: "LISTING_AGENTS", label: "Listing Agents" },
    { value: "INSPECTORS", label: "Inspectors" },
  ];

  // Helper function to generate time options (30-minute intervals)
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        const minuteStr = minute === 0 ? '00' : minute.toString();
        const time12 = `${hour12}:${minuteStr} ${ampm}`;
        options.push({ value: time24, label: time12 });
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

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
      yearBuild: c.yearBuild,
      foundation: c.foundation,
      squareFeet: c.squareFeet,
      zipCode: c.zipCode,
      city: c.city,
      state: c.state,
    }));
  });

  const [conditionLogic, setConditionLogic] = useState<"AND" | "OR">(() => {
    if (initialValues?.conditionLogic === "AND" || initialValues?.conditionLogic === "OR") {
      return initialValues.conditionLogic;
    }
    return "AND";
  });

  // Helper function to filter non-input placeholders
  const getNonInputPlaceholders = (): PlaceholderItem[] => {
    return PLACEHOLDER_SECTIONS.flatMap(section => 
      section.placeholders.filter(p => !p.input)
    );
  };

  // Insert placeholder into subject field
  const insertPlaceholderIntoSubject = (token: string) => {
    const currentValue = form.getValues("emailSubject") || "";
    const input = document.getElementById("emailSubject") as HTMLInputElement;
    if (input) {
      const start = input.selectionStart || currentValue.length;
      const end = input.selectionEnd || currentValue.length;
      const newValue = currentValue.slice(0, start) + ` ${token} ` + currentValue.slice(end);
      form.setValue("emailSubject", newValue);
      // Set cursor position after inserted placeholder
      setTimeout(() => {
        input.focus();
        const newCursorPos = start + token.length + 2;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      // Fallback: append to end
      form.setValue("emailSubject", currentValue + ` ${token} `);
    }
  };

  // Insert placeholder into body field (ReactQuill)
  const insertPlaceholderIntoBody = (token: string) => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) {
      return;
    }
    const selection = editor.getSelection(true);
    const index = selection ? selection.index : editor.getLength();
    editor.insertText(index, ` ${token} `);
    editor.setSelection(index + token.length + 2, 0);
  };

  // Insert placeholder into text body field (textarea)
  const insertPlaceholderIntoTextBody = (token: string) => {
    const currentValue = form.getValues("emailBody") || "";
    const textarea = document.getElementById("textBody") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart || currentValue.length;
      const end = textarea.selectionEnd || currentValue.length;
      const newValue = currentValue.slice(0, start) + ` ${token} ` + currentValue.slice(end);
      form.setValue("emailBody", newValue);
      // Set cursor position after inserted placeholder
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + token.length + 2;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      // Fallback: append to end
      form.setValue("emailBody", currentValue + ` ${token} `);
    }
  };

  // Handle placeholder selection
  const handlePlaceholderSelect = (token: string) => {
    if (placeholderTargetField === "subject") {
      insertPlaceholderIntoSubject(token);
    } else if (placeholderTargetField === "body") {
      // Check if we're in EMAIL or TEXT mode
      const communicationType = form.watch("communicationType");
      if (communicationType === "EMAIL") {
        insertPlaceholderIntoBody(token);
      } else if (communicationType === "TEXT") {
        insertPlaceholderIntoTextBody(token);
      }
    }
    setPlaceholderTargetField(null);
  };

  const form = useForm<ActionFormValues>({
    resolver: zodResolver(actionFormSchema),
    defaultValues: {
      name: initialValues?.name || "",
      category: initialValues?.category || "",
      automationTrigger: initialValues?.automationTrigger || "",
      isActive: initialValues?.isActive !== undefined ? initialValues.isActive : true,
      conditions: conditions,
      conditionLogic: conditionLogic,
      communicationType: initialValues?.communicationType,
      sendTiming: initialValues?.sendTiming || "AFTER",
      sendDelay: initialValues?.sendDelay,
      sendDelayUnit: initialValues?.sendDelayUnit || "HOURS",
      onlyTriggerOnce: initialValues?.onlyTriggerOnce !== undefined ? initialValues.onlyTriggerOnce : true,
      alsoSendOnRecurringInspections: initialValues?.alsoSendOnRecurringInspections || false,
      sendEvenWhenNotificationsDisabled: initialValues?.sendEvenWhenNotificationsDisabled || false,
      sendDuringCertainHoursOnly: initialValues?.sendDuringCertainHoursOnly || false,
      startTime: initialValues?.startTime || "00:00",
      endTime: initialValues?.endTime || "00:30",
      doNotSendOnWeekends: initialValues?.doNotSendOnWeekends || false,
      emailTo: initialValues?.emailTo || [],
      emailCc: initialValues?.emailCc || [],
      emailBcc: initialValues?.emailBcc || [],
      emailFrom: initialValues?.emailFrom,
      emailSubject: initialValues?.emailSubject || "",
      emailBody: initialValues?.emailBody || "",
    },
  });

  // Initialize CC/BCC visibility based on initial values
  useEffect(() => {
    if (initialValues?.emailCc && initialValues.emailCc.length > 0) {
      setShowCc(true);
    }
    if (initialValues?.emailBcc && initialValues.emailBcc.length > 0) {
      setShowBcc(true);
    }
  }, [initialValues]);

  useEffect(() => {
    fetchCategories();
    fetchCompanyOwnerEmail();
  }, []);

  // Sync conditions/conditionLogic state and reset form when initialValues changes (for when switching between actions)
  // Use a ref to track previous initialValues to detect when we're actually switching to a different action
  // Note: This should NOT depend on conditions/conditionLogic state to avoid resetting when user modifies conditions
  useEffect(() => {
    // Check if initialValues actually changed (switching to a different action)
    const initialValuesChanged = 
      previousInitialValuesRef.current === null ||
      previousInitialValuesRef.current !== initialValues;

    if (initialValuesChanged && initialValues) {
      // Derive conditions from initialValues
      const derivedConditions = initialValues.conditions
        ? initialValues.conditions.map((c: any) => ({
            type: c.type,
            operator: c.operator || "",
            value: c.value,
            serviceId: typeof c.serviceId === 'object' ? c.serviceId?.toString() : c.serviceId,
            addonName: c.addonName,
            serviceCategory: c.serviceCategory,
            categoryId: typeof c.categoryId === 'object' ? c.categoryId?.toString() : c.categoryId,
            yearBuild: c.yearBuild,
            foundation: c.foundation,
            squareFeet: c.squareFeet,
            zipCode: c.zipCode,
            city: c.city,
            state: c.state,
          }))
        : [];

      const derivedConditionLogic = 
        initialValues.conditionLogic === "AND" || initialValues.conditionLogic === "OR"
          ? initialValues.conditionLogic
          : "AND";

      // Update conditions state from initialValues
      setConditions(derivedConditions);
      
      // Update conditionLogic state from initialValues
      setConditionLogic(derivedConditionLogic);

      // Reset form with new values
      form.reset({
        name: initialValues.name || "",
        category: initialValues.category || "",
        automationTrigger: initialValues.automationTrigger || "",
        isActive: initialValues.isActive !== undefined ? initialValues.isActive : true,
        conditions: derivedConditions,
        conditionLogic: derivedConditionLogic,
        communicationType: initialValues.communicationType,
        sendTiming: initialValues.sendTiming || "AFTER",
        sendDelay: initialValues.sendDelay,
        sendDelayUnit: initialValues.sendDelayUnit || "HOURS",
        onlyTriggerOnce: initialValues.onlyTriggerOnce !== undefined ? initialValues.onlyTriggerOnce : true,
        alsoSendOnRecurringInspections: initialValues.alsoSendOnRecurringInspections || false,
        sendEvenWhenNotificationsDisabled: initialValues.sendEvenWhenNotificationsDisabled || false,
        sendDuringCertainHoursOnly: initialValues.sendDuringCertainHoursOnly || false,
        startTime: initialValues.startTime || "00:00",
        endTime: initialValues.endTime || "00:30",
        doNotSendOnWeekends: initialValues.doNotSendOnWeekends || false,
        emailTo: initialValues.emailTo || [],
        emailCc: initialValues.emailCc || [],
        emailBcc: initialValues.emailBcc || [],
        emailFrom: initialValues.emailFrom,
        emailSubject: initialValues.emailSubject || "",
        emailBody: initialValues.emailBody || "",
      });

      // Update the ref to track this initialValues
      previousInitialValuesRef.current = initialValues;
    }
  }, [initialValues, form]);

  const fetchCompanyOwnerEmail = async () => {
    try {
      const response = await fetch("/api/automations/company-owner-email", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setCompanyOwnerEmail(data.email || null);
      }
    } catch (error) {
      console.error("Error fetching company owner email:", error);
    }
  };

  // Sync conditionLogic with form when it changes
  useEffect(() => {
    form.setValue("conditionLogic", conditionLogic);
  }, [conditionLogic, form]);

  // Enforce sendTiming to "AFTER" for triggers that don't support BEFORE/AFTER
  const automationTrigger = form.watch("automationTrigger");
  useEffect(() => {
    if (automationTrigger && !supportsBeforeAfter(automationTrigger)) {
      form.setValue("sendTiming", "AFTER");
    }
  }, [automationTrigger, form]);

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
      // Always send conditions array (even if empty) so backend can clear them when deleted
      conditions: conditions,
      conditionLogic: conditions.length > 1 ? conditionLogic : undefined,
      communicationType: values.communicationType,
      sendTiming: values.communicationType ? (values.sendTiming || "AFTER") : undefined,
      sendDelay: values.communicationType && values.sendDelay ? values.sendDelay : undefined,
      sendDelayUnit: values.communicationType && values.sendDelayUnit ? values.sendDelayUnit : undefined,
      onlyTriggerOnce: values.communicationType ? (values.onlyTriggerOnce || false) : undefined,
      alsoSendOnRecurringInspections: values.communicationType ? (values.alsoSendOnRecurringInspections || false) : undefined,
      sendEvenWhenNotificationsDisabled: values.communicationType ? (values.sendEvenWhenNotificationsDisabled || false) : undefined,
      sendDuringCertainHoursOnly: values.communicationType ? (values.sendDuringCertainHoursOnly || false) : undefined,
      startTime: values.communicationType && values.sendDuringCertainHoursOnly ? values.startTime : undefined,
      endTime: values.communicationType && values.sendDuringCertainHoursOnly ? values.endTime : undefined,
      doNotSendOnWeekends: values.communicationType ? (values.doNotSendOnWeekends || false) : undefined,
      emailTo: (values.communicationType === "EMAIL" || values.communicationType === "TEXT") && values.emailTo && values.emailTo.length > 0 ? values.emailTo : undefined,
      emailCc: values.communicationType === "EMAIL" && values.emailCc && values.emailCc.length > 0 ? values.emailCc : undefined,
      emailBcc: values.communicationType === "EMAIL" && values.emailBcc && values.emailBcc.length > 0 ? values.emailBcc : undefined,
      emailFrom: values.communicationType === "EMAIL" ? values.emailFrom : undefined,
      emailSubject: values.communicationType === "EMAIL" && values.emailSubject ? values.emailSubject.trim() : undefined,
      emailBody: (values.communicationType === "EMAIL" || values.communicationType === "TEXT") && values.emailBody ? values.emailBody : undefined,
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

  // PlaceholderSelector component - reusable for both subject and body
  const PlaceholderSelector = ({ targetField }: { targetField: "subject" | "body" }) => {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    // Filter placeholders based on search query
    const filteredSections = PLACEHOLDER_SECTIONS.map((section) => ({
      ...section,
      placeholders: section.placeholders.filter(
        (p) => !p.input && p.token.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    })).filter((section) => section.placeholders.length > 0);

    // Close dropdown when clicking outside
    useEffect(() => {
      if (!open) {
        // Clean up any existing listener when closing
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
        return;
      }

      // Add a small delay to prevent immediate closure when opening
      const timeoutId = setTimeout(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (
            dropdownRef.current &&
            !dropdownRef.current.contains(event.target as Node) &&
            buttonRef.current &&
            !buttonRef.current.contains(event.target as Node)
          ) {
            setOpen(false);
            setSearchQuery("");
          }
        };

        document.addEventListener("mousedown", handleClickOutside);
        
        // Store cleanup function
        cleanupRef.current = () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
      };
    }, [open]);

    return (
      <div className="relative">
        <Button
          ref={buttonRef}
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setPlaceholderTargetField(targetField);
            setOpen((prev) => !prev);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Placeholder
        </Button>

        {open && (
          <div
            ref={dropdownRef}
            className="absolute right-0 top-full mt-1 w-[400px] bg-white border border-gray-200 rounded-md shadow-lg z-50"
            style={{ maxHeight: "300px", display: "flex", flexDirection: "column" }}
          >
            {/* Search Input */}
            <div className="p-2 border-b border-gray-200">
              <Input
                type="text"
                placeholder="Search placeholders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                autoFocus
              />
            </div>

            {/* Scrollable List */}
            <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: "250px" }}>
              {filteredSections.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  No placeholders found.
                </div>
              ) : (
                filteredSections.map((section) => (
                  <div key={section.title} className="py-1">
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                      {section.title}
                    </div>
                    {section.placeholders.map((placeholder) => (
                      <button
                        key={placeholder.token}
                        type="button"
                        onClick={() => {
                          handlePlaceholderSelect(placeholder.token);
                          setOpen(false);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-gray-100 cursor-pointer focus:bg-gray-100 focus:outline-none"
                      >
                        {placeholder.token}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="communicationType">Communication Type</Label>
          <Controller
            name="communicationType"
            control={form.control}
            render={({ field }) => (
              <ReactSelect
                value={
                  field.value
                    ? { value: field.value, label: field.value === "EMAIL" ? "Email" : "Text" }
                    : null
                }
                onChange={(option) => field.onChange(option?.value || undefined)}
                options={[
                  { value: "EMAIL", label: "Email" },
                  { value: "TEXT", label: "Text" },
                ]}
                placeholder="Select communication type"
                isClearable
                className="react-select-container"
                classNamePrefix="react-select"
              />
            )}
          />
        </div>

        {form.watch("communicationType") === "EMAIL" && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            {/* Email To Field */}
            <div className="space-y-2">
              <Label htmlFor="emailTo">
                To <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="emailTo"
                control={form.control}
                render={({ field }) => {
                  const selectedValues = field.value?.map((val) => ({
                    value: val,
                    label: recipientOptions.find((opt) => opt.value === val)?.label || val,
                  })) || [];

                  return (
                    <CreatableSelect
                      isMulti
                      value={selectedValues}
                      onChange={(options) => {
                        const values = options ? options.map((opt) => opt.value) : [];
                        field.onChange(values);
                      }}
                      options={recipientOptions}
                      placeholder="Select recipients or type to add"
                      className="react-select-container"
                      classNamePrefix="react-select"
                      formatCreateLabel={(inputValue) => `Add "${inputValue}"`}
                      createOptionPosition="first"
                    />
                  );
                }}
              />
            </div>

            {/* CC Field */}
            <div className="space-y-2">
              {!showCc ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCc(true);
                    if (companyOwnerEmail && form.watch("emailBcc")?.length === 0) {
                      // Don't pre-populate CC with owner email
                    }
                  }}
                >
                  + CC
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emailCc">CC</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowCc(false);
                        form.setValue("emailCc", []);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Controller
                    name="emailCc"
                    control={form.control}
                    render={({ field }) => {
                      const selectedValues = field.value?.map((val) => ({
                        value: val,
                        label: recipientOptions.find((opt) => opt.value === val)?.label || val,
                      })) || [];

                      return (
                        <CreatableSelect
                          isMulti
                          value={selectedValues}
                          onChange={(options) => {
                            const values = options ? options.map((opt) => opt.value) : [];
                            field.onChange(values);
                          }}
                          options={recipientOptions}
                          placeholder="Select recipients or type to add"
                          className="react-select-container"
                          classNamePrefix="react-select"
                          formatCreateLabel={(inputValue) => `Add "${inputValue}"`}
                          createOptionPosition="first"
                        />
                      );
                    }}
                  />
                </div>
              )}
            </div>

            {/* BCC Field */}
            <div className="space-y-2">
              {!showBcc ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowBcc(true);
                    if (companyOwnerEmail && form.watch("emailBcc")?.length === 0) {
                      form.setValue("emailBcc", [companyOwnerEmail]);
                    }
                  }}
                >
                  + BCC
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emailBcc">BCC</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowBcc(false);
                        form.setValue("emailBcc", []);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Controller
                    name="emailBcc"
                    control={form.control}
                    render={({ field }) => {
                      const selectedValues = field.value?.map((val) => ({
                        value: val,
                        label: recipientOptions.find((opt) => opt.value === val)?.label || val,
                      })) || [];

                      return (
                        <CreatableSelect
                          isMulti
                          value={selectedValues}
                          onChange={(options) => {
                            const values = options ? options.map((opt) => opt.value) : [];
                            field.onChange(values);
                          }}
                          options={recipientOptions}
                          placeholder="Select recipients or type to add"
                          className="react-select-container"
                          classNamePrefix="react-select"
                          formatCreateLabel={(inputValue) => `Add "${inputValue}"`}
                          createOptionPosition="first"
                        />
                      );
                    }}
                  />
                </div>
              )}
            </div>

            {/* From Field */}
            <div className="space-y-2">
              <Label htmlFor="emailFrom">From</Label>
              <Controller
                name="emailFrom"
                control={form.control}
                render={({ field }) => (
                  <ReactSelect
                    value={
                      field.value
                        ? { value: field.value, label: field.value === "COMPANY" ? "Company" : "Inspector" }
                        : null
                    }
                    onChange={(option) => field.onChange(option?.value || undefined)}
                    options={[
                      { value: "COMPANY", label: "Company" },
                      { value: "INSPECTOR", label: "Inspector" },
                    ]}
                    placeholder="Select sender"
                    className="react-select-container"
                    classNamePrefix="react-select"
                  />
                )}
              />
            </div>

            {/* Subject Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="emailSubject">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <PlaceholderSelector targetField="subject" />
              </div>
              <Controller
                name="emailSubject"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div>
                    <Input
                      id="emailSubject"
                      {...field}
                      placeholder="Enter email subject"
                      className={fieldState.error ? "border-destructive" : ""}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                        }
                      }}
                    />
                    {fieldState.error && (
                      <p className="mt-1 text-sm text-destructive">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
            </div>

            {/* Body Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="emailBody">
                  Body <span className="text-destructive">*</span>
                </Label>
                <PlaceholderSelector targetField="body" />
              </div>
              <Controller
                name="emailBody"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div>
                    <div className="border rounded-md">
                      <ReactQuill
                        //@ts-ignore
                        ref={quillRef}
                        theme="snow"
                        value={field.value || ""}
                        onChange={field.onChange}
                        modules={{
                          toolbar: [
                            [{ header: [1, 2, 3, false] }],
                            ["bold", "italic", "underline", "strike"],
                            [{ list: "ordered" }, { list: "bullet" }],
                            ["link"],
                            ["clean"],
                          ],
                        }}
                        formats={["header", "bold", "italic", "underline", "strike", "list", "link"]}
                        placeholder="Enter email body"
                      />
                    </div>
                    {fieldState.error && (
                      <p className="mt-1 text-sm text-destructive">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {form.watch("communicationType") === "TEXT" && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            {/* Text To Field */}
            <div className="space-y-2">
              <Label htmlFor="emailTo">
                To <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="emailTo"
                control={form.control}
                render={({ field }) => {
                  const selectedValues = field.value?.map((val) => ({
                    value: val,
                    label: recipientOptions.find((opt) => opt.value === val)?.label || val,
                  })) || [];

                  return (
                    <CreatableSelect
                      isMulti
                      value={selectedValues}
                      onChange={(options) => {
                        const values = options ? options.map((opt) => opt.value) : [];
                        field.onChange(values);
                      }}
                      options={recipientOptions}
                      placeholder="Select recipients or type to add"
                      className="react-select-container"
                      classNamePrefix="react-select"
                      formatCreateLabel={(inputValue) => `Add "${inputValue}"`}
                      createOptionPosition="first"
                    />
                  );
                }}
              />
            </div>

            {/* Text Body Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="textBody">
                  Body <span className="text-destructive">*</span>
                </Label>
                <PlaceholderSelector targetField="body" />
              </div>
              <Controller
                name="emailBody"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div>
                    <textarea
                      id="textBody"
                      {...field}
                      placeholder="Enter text message body"
                      rows={6}
                      className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                        fieldState.error ? "border-destructive" : ""
                      }`}
                    />
                    {fieldState.error && (
                      <p className="mt-1 text-sm text-destructive">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {form.watch("communicationType") && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
            {supportsBeforeAfter(form.watch("automationTrigger") || "") && (
              <div className="space-y-2">
                <Label>When should this be sent?</Label>
                <Controller
                  name="sendTiming"
                  control={form.control}
                  render={({ field }) => (
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-sm font-medium ${
                          field.value === "AFTER" ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        After
                      </span>
                      <Switch
                        checked={field.value === "BEFORE"}
                        onCheckedChange={(checked) => field.onChange(checked ? "BEFORE" : "AFTER")}
                      />
                      <span
                        className={`text-sm font-medium ${
                          field.value === "BEFORE" ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        Before
                      </span>
                    </div>
                  )}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>
                Send communication {form.watch("sendTiming") === "BEFORE" ? "before" : "after"}
              </Label>
              <div className="flex items-center gap-2">
                <Controller
                  name="sendDelay"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={field.value || ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                      }
                      placeholder="0"
                      className="w-24"
                    />
                  )}
                />
                <Controller
                  name="sendDelayUnit"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value || "HOURS"}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MINUTES">Minutes</SelectItem>
                        <SelectItem value="HOURS">Hours</SelectItem>
                        <SelectItem value="DAYS">Days</SelectItem>
                        <SelectItem value="WEEKS">Weeks</SelectItem>
                        <SelectItem value="MONTHS">Months</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Additional settings</Label>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Controller
                    name="onlyTriggerOnce"
                    control={form.control}
                    render={({ field }) => (
                      <Checkbox
                        id="onlyTriggerOnce"
                        checked={field.value || false}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        className="mt-1"
                      />
                    )}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="onlyTriggerOnce"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Only trigger once
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enable to run the automation only once per unique trigger, avoiding duplicates.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Controller
                    name="alsoSendOnRecurringInspections"
                    control={form.control}
                    render={({ field }) => (
                      <Checkbox
                        id="alsoSendOnRecurringInspections"
                        checked={field.value || false}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        className="mt-1"
                      />
                    )}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="alsoSendOnRecurringInspections"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Also send on recurring inspections
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enable to trigger this automation for recurring scheduled inspections.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Controller
                    name="sendEvenWhenNotificationsDisabled"
                    control={form.control}
                    render={({ field }) => (
                      <Checkbox
                        id="sendEvenWhenNotificationsDisabled"
                        checked={field.value || false}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        className="mt-1"
                      />
                    )}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="sendEvenWhenNotificationsDisabled"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Send even when notifications disabled
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Triggers automation and sends actions even with notifications off.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Controller
                    name="sendDuringCertainHoursOnly"
                    control={form.control}
                    render={({ field }) => (
                      <Checkbox
                        id="sendDuringCertainHoursOnly"
                        checked={field.value || false}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        className="mt-1"
                      />
                    )}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="sendDuringCertainHoursOnly"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Send during certain hours only
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Limits automation to trigger only within the specified time frame.
                    </p>
                  </div>
                </div>

                {form.watch("sendDuringCertainHoursOnly") && (
                  <div className="space-y-4 pl-6 border-l-2 border-muted">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startTime">
                          Start Time <span className="text-destructive">*</span>
                        </Label>
                        <Controller
                          name="startTime"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <div>
                              <Select
                                value={field.value || "00:00"}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select start time" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                  {timeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {fieldState.error && (
                                <p className="mt-1 text-sm text-destructive">
                                  {fieldState.error.message}
                                </p>
                              )}
                            </div>
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="endTime">
                          End Time <span className="text-destructive">*</span>
                        </Label>
                        <Controller
                          name="endTime"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <div>
                              <Select
                                value={field.value || "00:30"}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select end time" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                  {timeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {fieldState.error && (
                                <p className="mt-1 text-sm text-destructive">
                                  {fieldState.error.message}
                                </p>
                              )}
                            </div>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-2">
                  <Controller
                    name="doNotSendOnWeekends"
                    control={form.control}
                    render={({ field }) => (
                      <Checkbox
                        id="doNotSendOnWeekends"
                        checked={field.value || false}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        className="mt-1"
                      />
                    )}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="doNotSendOnWeekends"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Do not send on weekends
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Stops automation from triggering on weekends, ensuring weekday actions only.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Label htmlFor="isActive" className="text-sm font-normal">
              Active
            </Label>
            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <Switch
                  id="isActive"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
          </div>
        </div>
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
