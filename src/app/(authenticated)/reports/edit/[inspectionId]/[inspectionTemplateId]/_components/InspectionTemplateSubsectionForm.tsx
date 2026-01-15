"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
// import TinyMCERichTextEditor from "@/components/TinyMCERichTextEditor";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InspectionTemplateSubsection } from "@/components/api/queries/inspectionTemplateSubsections";

const subsectionSchema = z.object({
  name: z.string().trim().min(1, "Subsection name is required"),
  informationalOnly: z.boolean(),
  includeInEveryReport: z.boolean(),
  inspectorNotes: z.string().optional(),
});

type SubsectionFormValues = z.infer<typeof subsectionSchema>;

interface InspectionTemplateSubsectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SubsectionFormValues) => Promise<void>;
  initialValues?: InspectionTemplateSubsection | null;
  isSubmitting?: boolean;
}

export function InspectionTemplateSubsectionForm({
  open,
  onOpenChange,
  onSubmit,
  initialValues,
  isSubmitting = false,
}: InspectionTemplateSubsectionFormProps) {
  const form = useForm<SubsectionFormValues>({
    resolver: zodResolver(subsectionSchema),
    defaultValues: {
      name: "",
      informationalOnly: false,
      includeInEveryReport: true,
      inspectorNotes: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.reset({
          name: initialValues.name || "",
          informationalOnly: initialValues.informationalOnly || false,
          includeInEveryReport: initialValues.includeInEveryReport ?? true,
          inspectorNotes: initialValues.inspectorNotes || "",
        });
      } else {
        form.reset({
          name: "",
          informationalOnly: false,
          includeInEveryReport: true,
          inspectorNotes: "",
        });
      }
    }
  }, [open, initialValues, form]);

  const handleSubmit = async (values: SubsectionFormValues) => {
    await onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialValues ? "Edit Subsection" : "Add New Subsection"}
          </DialogTitle>
          <DialogDescription>
            {initialValues
              ? "Update the subsection details below."
              : "Fill in the details to create a new subsection for this section."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Subsection Name *</Label>
            <Input
              id="name"
              placeholder="Enter subsection name"
              {...form.register("name")}
              disabled={isSubmitting}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="informationalOnly" className="text-base">
                  Informational Only (Hide ratings/defects/grid row)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Hide ratings, defects, and grid row for this subsection
                </p>
              </div>
              <Controller
                control={form.control}
                name="informationalOnly"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="includeInEveryReport" className="text-base">
                  Include this in Every Report
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically include this subsection in all reports
                </p>
              </div>
              <Controller
                control={form.control}
                name="includeInEveryReport"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inspectorNotes">Notes (for inspector)</Label>
            <Controller
              control={form.control}
              name="inspectorNotes"
              render={({ field, fieldState }) => (
                <div>
                  {/* <TinyMCERichTextEditor
                    value={field.value || ""}
                    onChange={field.onChange}
                    height={300}
                    plugins={['textcolor', 'link', 'image', 'media']}
                    toolbar="bold italic underline | forecolor backcolor | link image media"
                  /> */}
                  <Textarea
                    id="inspectorNotes"
                    value={field.value || ""}
                    onChange={field.onChange}
                    rows={8}
                    disabled={isSubmitting}
                  />
                  {fieldState.error && (
                    <p className="mt-1 text-sm text-red-600">
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {initialValues ? "Updating..." : "Creating..."}
                </>
              ) : (
                initialValues ? "Update Subsection" : "Create Subsection"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
