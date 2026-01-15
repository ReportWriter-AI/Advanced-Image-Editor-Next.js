"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreatableTagInput } from "@/components/ui/creatable-tag-input";
import { CreatableConcatenatedInput } from "@/components/ui/creatable-concatenated-input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InspectionTemplateChecklist } from "@/components/api/queries/inspectionTemplateChecklists";
import { useReusableDropdownsQuery } from "@/components/api/queries/reusableDropdowns";

const statusChecklistSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  field: z.enum(['checkbox', 'multipleAnswers', 'date', 'number', 'numberRange', 'signature', 'text']),
  location: z.string().optional(),
  comment: z.string().optional(),
  defaultChecked: z.boolean(),
  answerChoices: z.array(z.string()).optional(),
});

const informationChecklistSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  comment: z.string().optional(),
  defaultChecked: z.boolean(),
});

type StatusChecklistFormValues = z.infer<typeof statusChecklistSchema>;
type InformationChecklistFormValues = z.infer<typeof informationChecklistSchema>;

interface ChecklistItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: any) => Promise<void>;
  type: 'status' | 'information';
  initialValues?: InspectionTemplateChecklist | null;
  isSubmitting?: boolean;
}

export function ChecklistItemForm({
  open,
  onOpenChange,
  onSubmit,
  type,
  initialValues,
  isSubmitting = false,
}: ChecklistItemFormProps) {
  const [answerChoices, setAnswerChoices] = useState<string[]>([]);
  const { data: dropdownsData } = useReusableDropdownsQuery();

  // Convert API format (Array<{id, value}>) to options format (Array<{value, label}>)
  const locationOptions = useMemo(() => {
    if (!dropdownsData?.data?.location) return [];
    return dropdownsData.data.location.map((item: { id: string; value: string }) => ({
      value: item.value,
      label: item.value,
    }));
  }, [dropdownsData]);

  const statusForm = useForm<StatusChecklistFormValues>({
    resolver: zodResolver(statusChecklistSchema),
    defaultValues: {
      name: "",
      field: "checkbox",
      location: "",
      comment: "",
      defaultChecked: false,
      answerChoices: [],
    },
  });

  const informationForm = useForm<InformationChecklistFormValues>({
    resolver: zodResolver(informationChecklistSchema),
    defaultValues: {
      name: "",
      comment: "",
      defaultChecked: false,
    },
  });

  const selectedField = type === 'status' ? statusForm.watch("field") : null;
  const needsAnswerChoices = selectedField === 'multipleAnswers' || selectedField === 'number' || selectedField === 'numberRange';

  // Reset answerChoices when field type changes to one that doesn't need them
  useEffect(() => {
    if (type === 'status' && selectedField && !needsAnswerChoices) {
      setAnswerChoices([]);
      statusForm.setValue("answerChoices", []);
    }
  }, [selectedField, needsAnswerChoices, type, statusForm]);

  useEffect(() => {
    if (open) {
      if (initialValues) {
        if (type === 'status') {
          statusForm.reset({
            name: initialValues.name || "",
            field: initialValues.field || "checkbox",
            location: initialValues.location || "",
            comment: initialValues.comment || "",
            defaultChecked: initialValues.defaultChecked ?? false,
            answerChoices: initialValues.answerChoices || [],
          });
          setAnswerChoices(initialValues.answerChoices || []);
        } else {
          informationForm.reset({
            name: initialValues.name || "",
            comment: initialValues.comment || "",
            defaultChecked: initialValues.defaultChecked ?? false,
          });
        }
      } else {
        if (type === 'status') {
          statusForm.reset({
            name: "",
            field: "checkbox",
            location: "",
            comment: "",
            defaultChecked: false,
            answerChoices: [],
          });
          setAnswerChoices([]);
        } else {
          informationForm.reset({
            name: "",
            comment: "",
            defaultChecked: false,
          });
        }
      }
    }
  }, [open, initialValues, type, statusForm, informationForm]);

  const handleStatusSubmit = async (values: StatusChecklistFormValues) => {
    // In edit mode, only send the name field
    if (initialValues) {
      await onSubmit({
        name: values.name,
      });
    } else {
      await onSubmit({
        ...values,
        answerChoices: needsAnswerChoices ? answerChoices : undefined,
      });
    }
  };

  const handleInformationSubmit = async (values: InformationChecklistFormValues) => {
    // In edit mode, only send the name field
    if (initialValues) {
      await onSubmit({
        name: values.name,
      });
    } else {
      await onSubmit(values);
    }
  };

  const fieldOptions = [
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'multipleAnswers', label: 'Multiple Answers' },
    { value: 'date', label: 'Date' },
    { value: 'number', label: 'Number' },
    { value: 'numberRange', label: 'Number Range' },
    // { value: 'signature', label: 'Signature' },
    { value: 'text', label: 'Text' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialValues ? `Edit ${type === 'status' ? 'Status' : 'Information'} Checklist` : `Add ${type === 'status' ? 'Status' : 'Information'} Checklist`}
          </DialogTitle>
          <DialogDescription>
            {initialValues
              ? `Update the ${type === 'status' ? 'status' : 'information'} checklist details below.`
              : `Fill in the details to create a new ${type === 'status' ? 'status' : 'information'} checklist item.`}
          </DialogDescription>
        </DialogHeader>

        {type === 'status' ? (
          <form onSubmit={statusForm.handleSubmit(handleStatusSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Enter checklist name"
                {...statusForm.register("name")}
                disabled={isSubmitting}
              />
              {statusForm.formState.errors.name && (
                <p className="text-sm text-red-600">
                  {statusForm.formState.errors.name.message}
                </p>
              )}
            </div>

            {!initialValues && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="field">Field *</Label>
                  <Controller
                    control={statusForm.control}
                    name="field"
                    render={({ field, fieldState }) => (
                      <div>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger id="field" className={fieldState.error ? "border-red-600" : ""}>
                            <SelectValue placeholder="Select field type" />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.error && (
                          <p className="mt-1 text-sm text-red-600">
                            {fieldState.error.message}
                          </p>
                        )}
                      </div>
                    )}
                  />
                </div>

                {needsAnswerChoices && (
                  <CreatableTagInput
                    value={answerChoices}
                    onChange={setAnswerChoices}
                    label={
                      selectedField === 'multipleAnswers' 
                        ? 'Answer Choices'
                        : selectedField === 'number' || selectedField === 'numberRange'
                        ? 'Unit Types'
                        : undefined
                    }
                    helperText={
                      selectedField === 'multipleAnswers'
                        ? 'Add multiple answer options for this checklist item.'
                        : selectedField === 'number' || selectedField === 'numberRange'
                        ? 'Add unit types (e.g., inches, feet, meters) for this checklist item.'
                        : undefined
                    }
                    placeholder={`Add ${selectedField === 'multipleAnswers' ? 'answer choice' : 'unit type'}...`}
                    disabled={isSubmitting}
                  />
                )}

                <div className="space-y-2">
                  <Controller
                    control={statusForm.control}
                    name="location"
                    render={({ field, fieldState }) => (
                      <div>
                        <CreatableConcatenatedInput
                          value={field.value || ""}
                          onChange={field.onChange}
                          label="Location"
                          placeholder="Search location..."
                          inputPlaceholder="Enter location"
                          options={locationOptions}
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
                  <Label htmlFor="comment">Comment</Label>
                  <Controller
                    control={statusForm.control}
                    name="comment"
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
                          id="comment"
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

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="defaultChecked" className="text-base">
                      Default Checked
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically check this item by default
                    </p>
                  </div>
                  <Controller
                    control={statusForm.control}
                    name="defaultChecked"
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    )}
                  />
                </div>
              </>
            )}

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
                  initialValues ? "Update Checklist" : "Create Checklist"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={informationForm.handleSubmit(handleInformationSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Enter checklist name"
                {...informationForm.register("name")}
                disabled={isSubmitting}
              />
              {informationForm.formState.errors.name && (
                <p className="text-sm text-red-600">
                  {informationForm.formState.errors.name.message}
                </p>
              )}
            </div>

            {!initialValues && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="comment">Comment</Label>
                  <Controller
                    control={informationForm.control}
                    name="comment"
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
                          id="comment"
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

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="defaultChecked" className="text-base">
                      Default Checked
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically check this item by default
                    </p>
                  </div>
                  <Controller
                    control={informationForm.control}
                    name="defaultChecked"
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    )}
                  />
                </div>
              </>
            )}

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
                  initialValues ? "Update Checklist" : "Create Checklist"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
