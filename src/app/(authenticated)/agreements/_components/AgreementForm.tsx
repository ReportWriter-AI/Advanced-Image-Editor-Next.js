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

export type PlaceholderItem = {
  token: string;
  description: string;
  input?: boolean;
  required?: boolean;
};

export type PlaceholderSection = {
  title: string;
  placeholders: PlaceholderItem[];
};

export const PLACEHOLDER_SECTIONS: PlaceholderSection[] = [
  {
    title: "Inspection Property Details",
    placeholders: [
      { token: "[ADDRESS]", description: "Full inspection address including city, state, and zip." },
      { token: "[STREET]", description: "Street portion of the inspection address." },
      { token: "[CITY]", description: "City where the inspection takes place." },
      { token: "[STATE]", description: "State for the inspection location." },
      { token: "[ZIP]", description: "Zip code for the inspection address." },
      { token: "[COUNTY]", description: "County of the inspection (blank if not recorded)." },
      { token: "[YEAR_BUILT]", description: "Home build year from inspection details." },
      { token: "[FOUNDATION]", description: "Foundation type selected during scheduling." },
      { token: "[SQUARE_FEET]", description: "Total square footage entered for the inspection." },
    ],
  },
  {
    title: "Fees and Services",
    placeholders: [
      { token: "[DESCRIPTION]", description: "Display names of the services associated." },
      { token: "[NOTES]", description: "Internal inspection notes." },
      { token: "[PRICE]", description: "Total cost of the inspection." },
      { token: "[FEES]", description: "Services and their costs separated by commas." },
      { token: "[SERVICES]", description: "Comma-separated list of services." },
      { token: "[CURRENT_DATE]", description: "Current date (ex: schedule date)." },
      { token: "[CURRENT_YEAR]", description: "Current calendar year." },
      { token: "[EVENTS]", description: "Table of events with times and inspector names." },
      { token: "[EVENTS_LIST]", description: "Table showing event start and end times." },
      { token: "[EVENTS_TEXT]", description: "Text list of events with times and inspector names." },
      { token: "[EVENTS_LIST_TEXT]", description: "Text list of events with start/end times only." },
      { token: "[PAID]", description: "Yes/No if the inspection is paid." },
      { token: "[PUBLISHED]", description: "Yes/No if reports are published." },
      { token: "[AGREED]", description: "Yes/No if all agreements are signed." },
      { token: "[ORDER_ID]", description: "Order identifier for the inspection." },
    ],
  },
  {
    title: "Client Information",
    placeholders: [
      { token: "[CLIENT_NAME]", description: "Client's full name." },
      { token: "[CLIENT_FIRST_NAME]", description: "Client’s first name." },
      { token: "[CUSTOMER_INITIALS]", description: "Blank space to capture initials.", input: true, required: false },
      { token: "[REQUIRED_CUSTOMER_INITIALS]", description: "Required customer initials.", input: true, required: true },
      { token: "[CLIENT_CONTACT_INFO]", description: "Client email plus phone number." },
      { token: "[CLIENT_PHONE]", description: "Client phone number." },
      { token: "[CLIENT_EMAIL]", description: "Client email address." },
      { token: "[CLIENT_ADDRESS]", description: "Client mailing address (requires buyer address capture setting)." },
    ],
  },
  {
    title: "Client's Agent Information",
    placeholders: [
      { token: "[AGENT_NAME]", description: "Client agent’s full name." },
      { token: "[AGENT_FIRST_NAME]", description: "Client agent’s first name." },
      { token: "[AGENT_CONTACT_INFO]", description: "Client agent’s email plus phone." },
      { token: "[AGENT_PHONE]", description: "Client agent’s phone number." },
      { token: "[AGENT_EMAIL]", description: "Client agent’s email address." },
      { token: "[AGENT_ADDRESS]", description: "Client agent’s street address." },
      { token: "[AGENT_FULL_ADDRESS]", description: "Client agent’s full address (street, city, state, zip)." },
      { token: "[AGENT_CITY]", description: "Client agent’s city." },
      { token: "[AGENT_STATE]", description: "Client agent’s state." },
      { token: "[AGENT_ZIP]", description: "Client agent’s zip code." },
    ],
  },
  {
    title: "Listing Agent Information",
    placeholders: [
      { token: "[LISTING_AGENT_NAME]", description: "Listing agent’s full name." },
      { token: "[LISTING_AGENT_FIRST_NAME]", description: "Listing agent’s first name." },
      { token: "[LISTING_AGENT_CONTACT_INFO]", description: "Listing agent’s email plus phone." },
      { token: "[LISTING_AGENT_PHONE]", description: "Listing agent’s phone number." },
      { token: "[LISTING_AGENT_EMAIL]", description: "Listing agent’s email address." },
      { token: "[LISTING_AGENT_ADDRESS]", description: "Listing agent’s street address." },
      { token: "[LISTING_AGENT_FULL_ADDRESS]", description: "Listing agent’s full address (street, city, state, zip)." },
      { token: "[LISTING_AGENT_CITY]", description: "Listing agent’s city." },
      { token: "[LISTING_AGENT_STATE]", description: "Listing agent’s state." },
      { token: "[LISTING_AGENT_ZIP]", description: "Listing agent’s zip code." },
    ],
  },
  {
    title: "Inspection Details",
    placeholders: [
      { token: "[INSPECTION_DATE]", description: "Scheduled inspection date." },
      { token: "[INSPECTION_TIME]", description: "Inspection start time." },

      { token: "[INSPECTION_END_TIME]", description: "Scheduled inspection end time." },
      { token: "[INSPECTION_TEXT_LINK]", description: "Mobile-friendly inspection details link." },
      
      { token: "[SIGN_AND_PAY_LINK]", description: "Button leading to sign-and-pay portal." },
      { token: "[SIGN_LINK]", description: "Button linking to the client portal signature page." },
      { token: "[PAY_LINK]", description: "Button linking to the payment page." },
      { token: "[INVOICE_LINK]", description: "Button linking to the invoice." },
      { token: "[VIEW_REPORT_ON_CLIENT_PORTAL_LINK]", description: "Button linking to the client portal report view." },

      { token: "[REPORT_PUBLISHED_TEXT_LINK]", description: "Mobile-friendly link to published reports only." },
      // { token: "[REPORT_TEXT_LINK]", description: "Mobile-friendly link to all web reports." },
      // { token: "[REPORT_PUBLISHED_LINK]", description: "Link to published reports only." },
      // { token: "[REPORT_PDF]", description: "Buttons for every report PDF and attachment." },
      // { token: "[REPORT_LINK]", description: "Link to all web reports." },
      // { token: "[EDIT_LINK]", description: "Internal link to the report editor." },
      // { token: "[SUMMARY_PDF]", description: "Button for the PDF summary only." },
      // { token: "[REVIEW_LINK]", description: "Link encouraging review submissions." },
      // { token: "[REVIEW_STARS]", description: "Star graphic for reviews." },
      // { token: "[INVOICE_TEXT_LINK]", description: "Mobile-friendly invoice link." },
    ],
  },
  {
    title: "Inspector Information",
    placeholders: [
      { token: "[INSPECTOR_FIRST_NAME]", description: "Primary inspector’s first name." },
      { token: "[INSPECTOR_NAME]", description: "Primary inspector’s full name." },
      { token: "[INSPECTORS]", description: "Full names of all assigned inspectors." },
      { token: "[INSPECTORS_FIRST_NAMES]", description: "First names of all assigned inspectors." },
      { token: "[INSPECTOR_PHONE]", description: "Primary inspector’s phone number." },
      { token: "[INSPECTOR_EMAIL]", description: "Primary inspector’s email address." },
      { token: "[INSPECTOR_CREDENTIALS]", description: "Licensing credentials from inspector profile." },
      { token: "[INSPECTOR_IMAGE]", description: "Inspector profile photo." },
      { token: "[INSPECTOR_SIGNATURE]", description: "Inspector signature image asset." }, //you
      { token: "[INSPECTOR_DESCRIPTION]", description: "Inspector bio/description." },
      { token: "[INSPECTOR_NOTES]", description: "Notes stored on the inspector profile." },
      { token: "[INSPECTOR_INITIALS]", description: "Primary inspector’s initials." },
    ],
  },
  {
    title: "Company Information",
    placeholders: [
      { token: "[INSPECTION_COMPANY]", description: "Company name from profile settings." },
      { token: "[INSPECTION_COMPANY_PHONE]", description: "Company phone number from profile." },
      { token: "[COMPANY_ADDRESS]", description: "Company street address." },
      { token: "[COMPANY_CITY]", description: "Company city." },
      { token: "[COMPANY_STATE]", description: "Company state." },
      { token: "[COMPANY_ZIP]", description: "Company zip code." },
      { token: "[COMPANY_PHONE]", description: "Alternate company phone contact." },
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


