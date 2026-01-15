"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as LucideIcons from "lucide-react";
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
import { InspectionTemplateSection } from "@/components/api/queries/inspectionTemplateSections";

const sectionSchema = z.object({
  name: z.string().trim().min(1, "Section name is required"),
  excludeFromSummaryView: z.boolean(),
  includeInEveryReport: z.boolean(),
  startSectionOnNewPage: z.boolean(),
  sectionIcon: z.string().optional(),
  inspectionGuidelines: z.string().optional(),
  inspectorNotes: z.string().optional(),
});

type SectionFormValues = z.infer<typeof sectionSchema>;

// Popular Lucide icons for section
const sectionIcons = [
  'CheckCircle', 'XCircle', 'AlertCircle', 'Info', 'Star', 'Heart', 'Flag',
  'Home', 'Building', 'Car', 'Calendar', 'Clock', 'MapPin', 'Phone', 'Mail',
  'User', 'Users', 'Shield', 'Lock', 'Unlock', 'Key', 'Bell', 'BellRing',
  'Zap', 'Flame', 'Droplet', 'Sun', 'Moon', 'Cloud', 'CloudRain', 'Snowflake',
  'FileText', 'Folder', 'Settings', 'Wrench', 'Tool', 'Hammer', 'Ruler',
];

interface InspectionTemplateSectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SectionFormValues) => Promise<void>;
  initialValues?: InspectionTemplateSection | null;
  isSubmitting?: boolean;
}

export function InspectionTemplateSectionForm({
  open,
  onOpenChange,
  onSubmit,
  initialValues,
  isSubmitting = false,
}: InspectionTemplateSectionFormProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);

  const form = useForm<SectionFormValues>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      name: "",
      excludeFromSummaryView: false,
      includeInEveryReport: false,
      startSectionOnNewPage: false,
      sectionIcon: "Home",
      inspectionGuidelines: "",
      inspectorNotes: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.reset({
          name: initialValues.name || "",
          excludeFromSummaryView: initialValues.excludeFromSummaryView || false,
          includeInEveryReport: initialValues.includeInEveryReport || false,
          startSectionOnNewPage: initialValues.startSectionOnNewPage || false,
          sectionIcon: initialValues.sectionIcon || "Home",
          inspectionGuidelines: initialValues.inspectionGuidelines || "",
          inspectorNotes: initialValues.inspectorNotes || "",
        });
      } else {
        form.reset({
          name: "",
          excludeFromSummaryView: false,
          includeInEveryReport: false,
          startSectionOnNewPage: false,
          sectionIcon: "Home",
          inspectionGuidelines: "",
          inspectorNotes: "",
        });
      }
      setShowIconPicker(false);
    }
  }, [open, initialValues, form]);

  const selectedIcon = form.watch("sectionIcon") || "Home";

  const handleSelectIcon = (iconName: string) => {
    if (selectedIcon === iconName) {
      form.setValue("sectionIcon", "Home");
    } else {
      form.setValue("sectionIcon", iconName);
    }
    setShowIconPicker(false);
  };

  const handleSubmit = async (values: SectionFormValues) => {
    await onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialValues ? "Edit Section" : "Add New Section"}
          </DialogTitle>
          <DialogDescription>
            {initialValues
              ? "Update the section details below."
              : "Fill in the details to create a new section for this inspection template."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Section Name *</Label>
            <Input
              id="name"
              placeholder="Enter section name"
              {...form.register("name")}
              disabled={isSubmitting}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Section Icon</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  disabled={isSubmitting}
                >
                  Select Icon
                  {(() => {
                    const IconComponent = (LucideIcons as any)[selectedIcon];
                    return IconComponent ? (
                      <IconComponent className="ml-2 h-4 w-4" />
                    ) : null;
                  })()}
                </Button>
                <span className="text-sm text-muted-foreground">
                  Selected: {selectedIcon}
                </span>
                {selectedIcon !== "Home" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => form.setValue("sectionIcon", "Home")}
                    disabled={isSubmitting}
                  >
                    Reset to Home
                  </Button>
                )}
              </div>
              {showIconPicker && (
                <div className="grid grid-cols-8 gap-2 p-4 border rounded-lg bg-background max-h-[300px] overflow-y-auto">
                  {sectionIcons.map((iconName) => {
                    const IconComponent = (LucideIcons as any)[iconName];
                    if (!IconComponent) return null;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => handleSelectIcon(iconName)}
                        className={`p-2 border rounded hover:bg-muted ${
                          selectedIcon === iconName
                            ? "bg-primary text-primary-foreground"
                            : ""
                        }`}
                      >
                        <IconComponent className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="excludeFromSummaryView" className="text-base">
                  Exclude from Summary View
                </Label>
                <p className="text-sm text-muted-foreground">
                  Hide this section from the summary view
                </p>
              </div>
              <Controller
                control={form.control}
                name="excludeFromSummaryView"
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
                  Automatically include this section in all reports
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

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="startSectionOnNewPage" className="text-base">
                  Start Section on New Page (PDF)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Start this section on a new page when generating PDF reports
                </p>
              </div>
              <Controller
                control={form.control}
                name="startSectionOnNewPage"
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
            <Label htmlFor="inspectionGuidelines">Inspection Guidelines (based on applicable standards)</Label>
            <Controller
              control={form.control}
              name="inspectionGuidelines"
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
                    id="inspectionGuidelines"
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

          <div className="space-y-2">
            <Label htmlFor="inspectorNotes">Inspector Notes</Label>
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
                initialValues ? "Update Section" : "Create Section"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
