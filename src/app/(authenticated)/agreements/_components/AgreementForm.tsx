"use client";

import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

type PlaceholderItem = {
  token: string;
  description: string;
};

type PlaceholderSection = {
  title: string;
  placeholders: PlaceholderItem[];
};

const PLACEHOLDER_SECTIONS: PlaceholderSection[] = [
  {
    title: "Inspection Property Details",
    placeholders: [
      { token: "[ADDRESS]", description: "Full inspection address including city, state, and zip." },
      { token: "[COUNTY]", description: "County of the inspection (blank if not recorded)." },
    ],
  },
  {
    title: "Fees and Services",
    placeholders: [
      { token: "[PRICE]", description: "Total cost of the inspection." },
      { token: "[FEES]", description: "Services and their costs separated by commas." },
      { token: "[SERVICES]", description: "Comma-separated list of services." },
      { token: "[CURRENT_DATE]", description: "Current date (ex: schedule date)." },
      { token: "[CURRENT_YEAR]", description: "Current calendar year." },
    ],
  },
  {
    title: "Client Information",
    placeholders: [
      { token: "[CLIENT_NAME]", description: "Client’s full name." },
      { token: "[CUSTOMER_INITIALS]", description: "Blank space to capture initials." },
      { token: "[REQUIRED_CUSTOMER_INITIALS]", description: "Required customer initials." },
    ],
  },
  {
    title: "Inspection Details",
    placeholders: [
      { token: "[INSPECTION_DATE]", description: "Scheduled inspection date." },
      { token: "[INSPECTION_TIME]", description: "Inspection start time." },
    ],
  },
  {
    title: "Company Information",
    placeholders: [
      { token: "[COMPANY_WEBSITE]", description: "Company website URL." },
    ],
  },
];

const agreementFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required"),
  content: z
    .string()
    .refine((value) => stripHtml(value || "").length > 0, {
      message: "Agreement content cannot be empty",
    }),
});

export type AgreementFormValues = z.infer<typeof agreementFormSchema>;

export interface AgreementFormNormalizedValues {
  name: string;
  content: string;
}

const DEFAULT_VALUES: AgreementFormValues = {
  name: "",
  content: "",
};

interface AgreementFormProps {
  initialValues?: Partial<AgreementFormValues>;
  submitLabel: string;
  onSubmit: (values: AgreementFormNormalizedValues) => Promise<void> | void;
  onCancel: () => void;
  isSubmittingExternal?: boolean;
}

export function AgreementForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmittingExternal = false,
}: AgreementFormProps) {
  const form = useForm<AgreementFormValues>({
    resolver: zodResolver(agreementFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const quillRef = useRef<any>(null);

  const editorModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
      ],
    }),
    []
  );

  const editorFormats = useMemo(
    () => ["header", "bold", "italic", "underline", "strike", "list", "link"],
    []
  );

  useEffect(() => {
    if (initialValues) {
      form.reset({
        ...DEFAULT_VALUES,
        ...initialValues,
      });
    }
  }, [initialValues, form]);

  const handleSubmit = async (values: AgreementFormValues) => {
    await onSubmit({
      name: values.name.trim(),
      content: values.content,
    });
  };

  const isSubmitting = form.formState.isSubmitting || isSubmittingExternal;

  const insertPlaceholder = (token: string) => {
    const editor = quillRef.current?.getEditor?.();
    if (!editor) {
      return;
    }
    const selection = editor.getSelection(true);
    const index = selection ? selection.index : editor.getLength();
    editor.insertText(index, ` ${token} `);
    editor.setSelection(index + token.length + 2, 0);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" placeholder="Agreement name" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Agreement Content *</Label>
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quick placeholders
          </p>
          <div className="space-y-2">
            {PLACEHOLDER_SECTIONS.map((section) => (
              <div key={section.title} className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{section.title}:</span>
                {section.placeholders.slice(0, 2).map((item) => (
                  <Button
                    key={item.token}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="font-mono text-xs"
                    onClick={() => insertPlaceholder(item.token)}
                  >
                    {item.token}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div>
          <Controller
            control={form.control}
            name="content"
            render={({ field }) => (
              <ReactQuill
                //@ts-ignore
                ref={quillRef}
                theme="snow"
                value={field.value}
                onChange={field.onChange}
                modules={editorModules}
                formats={editorFormats}
                placeholder="Write the agreement details clients need to sign..."
                className={cn("h-[320px] [&_.ql-container]:!h-[256px] [&_.ql-container]:overflow-y-auto")}
              />
            )}
          />
        </div>
        {form.formState.errors.content && (
          <p className="text-sm text-red-600">{form.formState.errors.content.message}</p>
        )}
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

      <div className="space-y-3 rounded-lg border p-4">
        <div>
          <p className="text-sm font-semibold">All placeholders</p>
          <p className="text-xs text-muted-foreground">
            Browse every token below and click Insert to add it at the cursor.
          </p>
        </div>
        <Accordion type="multiple" className="w-full space-y-2">
          {PLACEHOLDER_SECTIONS.map((section) => (
            <AccordionItem key={section.title} value={section.title}>
              <AccordionTrigger className="text-sm font-medium">
                {section.title}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {section.placeholders.map((placeholder) => (
                    <div key={placeholder.token} className="rounded-md border p-3 text-sm shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <code className="font-mono text-xs">{placeholder.token}</code>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="font-mono text-xs"
                          onClick={() => insertPlaceholder(placeholder.token)}
                        >
                          Insert
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{placeholder.description}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </form>
  );
}


