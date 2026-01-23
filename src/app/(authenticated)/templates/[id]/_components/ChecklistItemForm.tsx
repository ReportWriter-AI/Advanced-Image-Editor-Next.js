"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreatableTagInput } from "@/components/ui/creatable-tag-input";
import { CreatableConcatenatedInput } from "@/components/ui/creatable-concatenated-input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { TemplateChecklist } from "@/components/api/queries/templateChecklists";
import { useReusableDropdownsQuery } from "@/components/api/queries/reusableDropdowns";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  field: z.enum(['checkbox', 'multipleAnswers', 'date', 'number', 'numberRange', 'signature', 'text']),
  location: z.string().optional(),
  comment: z.string().optional(),
  defaultChecked: z.boolean(),
  answerChoices: z.array(z.string()).optional(),
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
  const [textAnswer, setTextAnswer] = useState<string>("");
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [dateAnswer, setDateAnswer] = useState<Date | undefined>(undefined);
  const [numberAnswer, setNumberAnswer] = useState<string>("");
  const [numberUnit, setNumberUnit] = useState<string>("");
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");
  const [rangeUnit, setRangeUnit] = useState<string>("");
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
      field: "checkbox",
      location: "",
      comment: "",
      defaultChecked: false,
      answerChoices: [],
    },
  });

  const selectedField = type === 'status' ? statusForm.watch("field") : informationForm.watch("field");
  const needsAnswerChoices = selectedField === 'multipleAnswers' || selectedField === 'number' || selectedField === 'numberRange';

  // Reset answerChoices when field type changes to one that doesn't need them
  useEffect(() => {
    if (selectedField && !needsAnswerChoices) {
      setAnswerChoices([]);
      if (type === 'status') {
        statusForm.setValue("answerChoices", []);
      } else {
        informationForm.setValue("answerChoices", []);
      }
    }
  }, [selectedField, needsAnswerChoices, type, statusForm, informationForm]);

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
            field: initialValues.field || "checkbox",
            location: initialValues.location || "",
            comment: initialValues.comment || "",
            defaultChecked: initialValues.defaultChecked ?? false,
            answerChoices: initialValues.answerChoices || [],
          });
          setAnswerChoices(initialValues.answerChoices || []);
        }
        // Set answer field values
        setTextAnswer(initialValues.textAnswer || "");
        setSelectedAnswers(initialValues.selectedAnswers || []);
        setDateAnswer(initialValues.dateAnswer ? new Date(initialValues.dateAnswer) : undefined);
        setNumberAnswer(initialValues.numberAnswer?.toString() || "");
        setNumberUnit(initialValues.numberUnit || "");
        setRangeFrom(initialValues.rangeFrom?.toString() || "");
        setRangeTo(initialValues.rangeTo?.toString() || "");
        setRangeUnit(initialValues.rangeUnit || "");
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
            field: "checkbox",
            location: "",
            comment: "",
            defaultChecked: false,
            answerChoices: [],
          });
          setAnswerChoices([]);
        }
        // Reset answer field values
        setTextAnswer("");
        setSelectedAnswers([]);
        setDateAnswer(undefined);
        setNumberAnswer("");
        setNumberUnit("");
        setRangeFrom("");
        setRangeTo("");
        setRangeUnit("");
      }
    }
  }, [open, initialValues, type, statusForm, informationForm]);

  const handleStatusSubmit = async (values: StatusChecklistFormValues) => {
    const answerData: any = {};
    
    // Add answer fields based on field type
    if (initialValues?.field === 'text' && textAnswer) {
      answerData.textAnswer = textAnswer.trim() || undefined;
    } else if (initialValues?.field === 'multipleAnswers' && selectedAnswers.length > 0) {
      answerData.selectedAnswers = selectedAnswers;
    } else if (initialValues?.field === 'date' && dateAnswer) {
      answerData.dateAnswer = dateAnswer.toISOString();
    } else if (initialValues?.field === 'number') {
      if (numberAnswer) {
        answerData.numberAnswer = parseFloat(numberAnswer) || undefined;
      }
      if (numberUnit) {
        answerData.numberUnit = numberUnit;
      }
    } else if (initialValues?.field === 'numberRange') {
      if (rangeFrom) {
        answerData.rangeFrom = parseFloat(rangeFrom) || undefined;
      }
      if (rangeTo) {
        answerData.rangeTo = parseFloat(rangeTo) || undefined;
      }
      if (rangeUnit) {
        answerData.rangeUnit = rangeUnit;
      }
    }

    await onSubmit({
      ...values,
      answerChoices: needsAnswerChoices ? answerChoices : undefined,
      ...answerData,
    });
  };

  const handleInformationSubmit = async (values: InformationChecklistFormValues) => {
    const answerData: any = {};
    
    // Add answer fields based on field type
    if (initialValues?.field === 'text' && textAnswer) {
      answerData.textAnswer = textAnswer.trim() || undefined;
    } else if (initialValues?.field === 'multipleAnswers' && selectedAnswers.length > 0) {
      answerData.selectedAnswers = selectedAnswers;
    } else if (initialValues?.field === 'date' && dateAnswer) {
      answerData.dateAnswer = dateAnswer.toISOString();
    } else if (initialValues?.field === 'number') {
      if (numberAnswer) {
        answerData.numberAnswer = parseFloat(numberAnswer) || undefined;
      }
      if (numberUnit) {
        answerData.numberUnit = numberUnit;
      }
    } else if (initialValues?.field === 'numberRange') {
      if (rangeFrom) {
        answerData.rangeFrom = parseFloat(rangeFrom) || undefined;
      }
      if (rangeTo) {
        answerData.rangeTo = parseFloat(rangeTo) || undefined;
      }
      if (rangeUnit) {
        answerData.rangeUnit = rangeUnit;
      }
    }

    await onSubmit({
      ...values,
      answerChoices: needsAnswerChoices ? answerChoices : undefined,
      ...answerData,
    });
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

            {/* Default Answer Fields - Only show when editing existing checklist */}
            {initialValues && (
              <div className="space-y-4 rounded-lg border p-4">
                <Label className="text-base">Default Answer</Label>
                <p className="text-sm text-muted-foreground">
                  Set default values for this checklist item
                </p>

                {/* Text Field */}
                {initialValues.field === 'text' && (
                  <div className="space-y-2">
                    <Label htmlFor="textAnswer">Default Text Answer</Label>
                    <Input
                      id="textAnswer"
                      placeholder="Enter default text answer"
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                {/* Multiple Answers Field */}
                {initialValues.field === 'multipleAnswers' && answerChoices.length > 0 && (
                  <div className="space-y-2">
                    <Label>Default Selected Answers</Label>
                    <CreatableTagInput
                      value={answerChoices}
                      onChange={() => {}} // Read-only for answer choices
                      showCheckboxes={true}
                      selectedValues={selectedAnswers}
                      onSelectionChange={setSelectedAnswers}
                      disabled={isSubmitting}
                      placeholder=""
                    />
                    <p className="text-sm text-muted-foreground">
                      Select default answers by checking the boxes above
                    </p>
                  </div>
                )}

                {/* Date Field */}
                {initialValues.field === 'date' && (
                  <div className="space-y-2">
                    <Label>Default Date Answer</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateAnswer && "text-muted-foreground"
                          )}
                          disabled={isSubmitting}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateAnswer ? format(dateAnswer, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateAnswer}
                          onSelect={setDateAnswer}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Number Field */}
                {initialValues.field === 'number' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="numberAnswer">Default Number Answer</Label>
                      <Input
                        id="numberAnswer"
                        type="number"
                        placeholder="Enter default number"
                        value={numberAnswer}
                        onChange={(e) => setNumberAnswer(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    {answerChoices.length > 0 && (
                      <div className="space-y-2">
                        <Label>Default Unit</Label>
                        <div className="flex flex-wrap gap-3">
                          {answerChoices.map((unit) => (
                            <label
                              key={unit}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <input
                                type="radio"
                                name={`number-unit-${initialValues._id}`}
                                value={unit}
                                checked={numberUnit === unit}
                                onChange={() => setNumberUnit(unit)}
                                disabled={isSubmitting}
                                className="h-4 w-4"
                              />
                              <span className="text-sm">{unit}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Number Range Field */}
                {initialValues.field === 'numberRange' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="rangeFrom">From</Label>
                        <Input
                          id="rangeFrom"
                          type="number"
                          placeholder="From"
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rangeTo">To</Label>
                        <Input
                          id="rangeTo"
                          type="number"
                          placeholder="To"
                          value={rangeTo}
                          onChange={(e) => setRangeTo(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                    {answerChoices.length > 0 && (
                      <div className="space-y-2">
                        <Label>Default Unit</Label>
                        <div className="flex flex-wrap gap-3">
                          {answerChoices.map((unit) => (
                            <label
                              key={unit}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <input
                                type="radio"
                                name={`range-unit-${initialValues._id}`}
                                value={unit}
                                checked={rangeUnit === unit}
                                onChange={() => setRangeUnit(unit)}
                                disabled={isSubmitting}
                                className="h-4 w-4"
                              />
                              <span className="text-sm">{unit}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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

            <div className="space-y-2">
              <Label htmlFor="field">Field *</Label>
              <Controller
                control={informationForm.control}
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
                control={informationForm.control}
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

            {/* Default Answer Fields - Only show when editing existing checklist */}
            {initialValues && (
              <div className="space-y-4 rounded-lg border p-4">
                <Label className="text-base">Default Answer</Label>
                <p className="text-sm text-muted-foreground">
                  Set default values for this checklist item
                </p>

                {/* Text Field */}
                {initialValues.field === 'text' && (
                  <div className="space-y-2">
                    <Label htmlFor="textAnswer">Default Text Answer</Label>
                    <Input
                      id="textAnswer"
                      placeholder="Enter default text answer"
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                {/* Multiple Answers Field */}
                {initialValues.field === 'multipleAnswers' && answerChoices.length > 0 && (
                  <div className="space-y-2">
                    <Label>Default Selected Answers</Label>
                    <CreatableTagInput
                      value={answerChoices}
                      onChange={() => {}} // Read-only for answer choices
                      showCheckboxes={true}
                      selectedValues={selectedAnswers}
                      onSelectionChange={setSelectedAnswers}
                      disabled={isSubmitting}
                      placeholder=""
                    />
                    <p className="text-sm text-muted-foreground">
                      Select default answers by checking the boxes above
                    </p>
                  </div>
                )}

                {/* Date Field */}
                {initialValues.field === 'date' && (
                  <div className="space-y-2">
                    <Label>Default Date Answer</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateAnswer && "text-muted-foreground"
                          )}
                          disabled={isSubmitting}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateAnswer ? format(dateAnswer, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateAnswer}
                          onSelect={setDateAnswer}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Number Field */}
                {initialValues.field === 'number' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="numberAnswer">Default Number Answer</Label>
                      <Input
                        id="numberAnswer"
                        type="number"
                        placeholder="Enter default number"
                        value={numberAnswer}
                        onChange={(e) => setNumberAnswer(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    {answerChoices.length > 0 && (
                      <div className="space-y-2">
                        <Label>Default Unit</Label>
                        <RadioGroup
                          value={numberUnit}
                          onValueChange={setNumberUnit}
                          disabled={isSubmitting}
                        >
                          {answerChoices.map((unit) => (
                            <div key={unit} className="flex items-center space-x-2">
                              <RadioGroupItem value={unit} id={`number-unit-${unit}`} />
                              <Label htmlFor={`number-unit-${unit}`} className="font-normal cursor-pointer">
                                {unit}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    )}
                  </div>
                )}

                {/* Number Range Field */}
                {initialValues.field === 'numberRange' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="rangeFrom">From</Label>
                        <Input
                          id="rangeFrom"
                          type="number"
                          placeholder="From"
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rangeTo">To</Label>
                        <Input
                          id="rangeTo"
                          type="number"
                          placeholder="To"
                          value={rangeTo}
                          onChange={(e) => setRangeTo(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                    {answerChoices.length > 0 && (
                      <div className="space-y-2">
                        <Label>Default Unit</Label>
                        <RadioGroup
                          value={rangeUnit}
                          onValueChange={setRangeUnit}
                          disabled={isSubmitting}
                        >
                          {answerChoices.map((unit) => (
                            <div key={unit} className="flex items-center space-x-2">
                              <RadioGroupItem value={unit} id={`range-unit-${unit}`} />
                              <Label htmlFor={`range-unit-${unit}`} className="font-normal cursor-pointer">
                                {unit}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
