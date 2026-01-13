"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, X } from "lucide-react";
import CreatableSelect from "react-select/creatable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import TinyMCERichTextEditor from "@/components/TinyMCERichTextEditor";
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
import { TemplateChecklist } from "@/components/api/queries/templateChecklists";

const statusChecklistSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  field: z.enum(['checkbox', 'multipleAnswers', 'date', 'number', 'numberRange', 'signature']),
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
  initialValues?: TemplateChecklist | null;
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
  const [selectKey, setSelectKey] = useState(0);

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
      setSelectKey(prev => prev + 1);
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
          setSelectKey(0);
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
          setSelectKey(0);
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
    await onSubmit({
      ...values,
      answerChoices: needsAnswerChoices ? answerChoices : undefined,
    });
  };

  const handleInformationSubmit = async (values: InformationChecklistFormValues) => {
    await onSubmit(values);
  };

  const fieldOptions = [
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'multipleAnswers', label: 'Multiple Answers' },
    { value: 'date', label: 'Date' },
    { value: 'number', label: 'Number' },
    { value: 'numberRange', label: 'Number Range' },
    { value: 'signature', label: 'Signature' },
  ];

  const answerChoicesOptions = answerChoices.map(choice => ({ value: choice, label: choice }));

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
              <div className="space-y-2">
                <Label>
                  {selectedField === 'multipleAnswers' && 'Answer Choices'}
                  {selectedField === 'number' && 'Unit Types'}
                  {selectedField === 'numberRange' && 'Unit Types'}
                </Label>
                <CreatableSelect
                  key={selectKey}
                  value={null}
                  onChange={(newValue) => {
                    if (newValue && !answerChoices.includes(newValue.value)) {
                      const trimmedValue = newValue.value.trim();
                      if (trimmedValue) {
                        const newChoices = [...answerChoices, trimmedValue];
                        setAnswerChoices(newChoices);
                        setSelectKey(prev => prev + 1); // Force select to reset
                      }
                    }
                  }}
                  onCreateOption={(inputValue) => {
                    const trimmedValue = inputValue.trim();
                    if (trimmedValue && !answerChoices.includes(trimmedValue)) {
                      const newChoices = [...answerChoices, trimmedValue];
                      setAnswerChoices(newChoices);
                      setSelectKey(prev => prev + 1); // Force select to reset
                    }
                  }}
                  options={answerChoicesOptions}
                  placeholder={`Add ${selectedField === 'multipleAnswers' ? 'answer choice' : 'unit type'}...`}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  isDisabled={isSubmitting}
                  isClearable={false}
                />
                {answerChoices.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {answerChoices.map((choice, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1.5 px-3 py-1"
                      >
                        <span>{choice}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newChoices = answerChoices.filter((_, i) => i !== index);
                            setAnswerChoices(newChoices);
                          }}
                          disabled={isSubmitting}
                          className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                          aria-label={`Remove ${choice}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {selectedField === 'multipleAnswers' && 'Add multiple answer options for this checklist item.'}
                  {selectedField === 'number' && 'Add unit types (e.g., inches, feet, meters) for this checklist item.'}
                  {selectedField === 'numberRange' && 'Add unit types (e.g., inches, feet, meters) for this checklist item.'}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="Enter location"
                {...statusForm.register("location")}
                disabled={isSubmitting}
              />
              {statusForm.formState.errors.location && (
                <p className="text-sm text-red-600">
                  {statusForm.formState.errors.location.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Controller
                control={statusForm.control}
                name="comment"
                render={({ field, fieldState }) => (
                  <div>
                    <TinyMCERichTextEditor
                      value={field.value || ""}
                      onChange={field.onChange}
                      height={300}
                      plugins={['textcolor', 'link', 'image', 'media']}
                      toolbar="bold italic underline | forecolor backcolor | link image media"
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

            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Controller
                control={informationForm.control}
                name="comment"
                render={({ field, fieldState }) => (
                  <div>
                    <TinyMCERichTextEditor
                      value={field.value || ""}
                      onChange={field.onChange}
                      height={300}
                      plugins={['textcolor', 'link', 'image', 'media']}
                      toolbar="bold italic underline | forecolor backcolor | link image media"
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
