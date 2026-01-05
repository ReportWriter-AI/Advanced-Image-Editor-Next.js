"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const checklistItemSchema = z.object({
  text: z.string().trim().min(1, "Text is required"),
  comment: z.string().trim().optional(),
  type: z.enum(["status", "information"]),
  tab: z.enum(["information", "limitations"]),
  answer_choices: z.array(z.string().trim()).optional(),
  default_checked: z.boolean(),
  default_selected_answers: z.array(z.string().trim()).optional(),
  order_index: z.number(),
});

const sectionSchema = z.object({
  name: z.string().trim().min(1, "Section name is required"),
  checklists: z.array(checklistItemSchema),
});

export type SectionFormValues = z.infer<typeof sectionSchema>;

export interface SectionFormNormalizedValues {
  name: string;
  checklists: Array<{
    text: string;
    comment?: string;
    type: "status" | "information";
    tab: "information" | "limitations";
    answer_choices?: string[];
    default_checked: boolean;
    default_selected_answers?: string[];
    order_index: number;
  }>;
}

const DEFAULT_VALUES: SectionFormValues = {
  name: "",
  checklists: [],
};

interface SectionFormProps {
  initialValues?: Partial<SectionFormValues>;
  submitLabel: string;
  onSubmit: (values: SectionFormNormalizedValues) => Promise<void> | void;
  onCancel: () => void;
  isSubmittingExternal?: boolean;
}

export function SectionForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmittingExternal = false,
}: SectionFormProps) {
  const form = useForm<SectionFormValues>({
    resolver: zodResolver(sectionSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const {
    fields: checklistFields,
    append: appendChecklist,
    remove: removeChecklist,
  } = useFieldArray({
    control: form.control,
    name: "checklists",
  });

  useEffect(() => {
    if (initialValues) {
      form.reset({
        ...DEFAULT_VALUES,
        ...initialValues,
      });
    }
  }, [initialValues, form]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleChecklistDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);

    if (oldIndex === -1 || newIndex === -1 || oldIndex < 0 || newIndex < 0) {
      return;
    }

    const currentChecklists = form.getValues("checklists");
    const reordered = arrayMove(currentChecklists, oldIndex, newIndex).map((item, index) => ({
      ...item,
      order_index: index,
    }));
    form.setValue("checklists", reordered);
  };

  const addChecklistItem = () => {
    const newIndex = checklistFields.length;
    appendChecklist({
      text: "",
      comment: "",
      type: "information",
      tab: "information",
      answer_choices: [],
      default_checked: false,
      default_selected_answers: [],
      order_index: newIndex,
    });
  };

  const removeChecklistItem = (index: number) => {
    removeChecklist(index);
  };

  const handleSubmit = async (values: SectionFormValues) => {
    const normalized: SectionFormNormalizedValues = {
      name: values.name.trim(),
      checklists: values.checklists.map((item, index) => ({
        text: item.text.trim(),
        comment: item.comment?.trim() || undefined,
        type: item.type,
        tab: item.tab,
        answer_choices:
          Array.isArray(item.answer_choices) && item.answer_choices.length > 0
            ? item.answer_choices
            : undefined,
        default_checked: item.default_checked,
        default_selected_answers:
          Array.isArray(item.default_selected_answers) && item.default_selected_answers.length > 0
            ? item.default_selected_answers
            : undefined,
        order_index: index,
      })),
    };

    await onSubmit(normalized);
  };

  const isSubmitting = form.formState.isSubmitting || isSubmittingExternal;

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Section Name *</Label>
        <Input
          id="name"
          placeholder="e.g., 1 - Inspection Overview & Client Responsibilities"
          {...form.register("name")}
          autoComplete="off"
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Checklist Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Checklist Item
          </Button>
        </div>

        {checklistFields.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <p>No checklist items yet. Click "Add Checklist Item" to get started.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChecklistDragEnd}>
            <SortableContext
              items={checklistFields.map((_, index) => index)}
              strategy={verticalListSortingStrategy}
            >
              <Accordion type="multiple" className="space-y-2">
                {checklistFields.map((field, index) => (
                  <ChecklistItemField
                    key={field.id}
                    index={index}
                    form={form}
                    onRemove={() => removeChecklistItem(index)}
                    disabled={isSubmitting}
                  />
                ))}
              </Accordion>
            </SortableContext>
          </DndContext>
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
    </form>
  );
}

interface ChecklistItemFieldProps {
  index: number;
  form: ReturnType<typeof useForm<SectionFormValues>>;
  onRemove: () => void;
  disabled?: boolean;
}

function ChecklistItemField({ index, form, onRemove, disabled }: ChecklistItemFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: index,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("rounded-lg border", isDragging && "opacity-60")}>
      <AccordionItem value={`item-${index}`} className="border-0">
        <div className="flex items-center gap-2 px-4 py-3">
          <div
            className="cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <AccordionTrigger className="flex-1 hover:no-underline">
            <div className="flex-1 text-left">
              <span className="font-medium">
                {form.watch(`checklists.${index}.text`) || `Checklist Item ${index + 1}`}
              </span>
            </div>
          </AccordionTrigger>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            disabled={disabled}
            className="h-8 w-8"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor={`checklists.${index}.text`}>Text *</Label>
              <Input
                id={`checklists.${index}.text`}
                {...form.register(`checklists.${index}.text`)}
                placeholder="e.g., General: Style of Home"
              />
              {form.formState.errors.checklists?.[index]?.text && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.checklists[index]?.text?.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`checklists.${index}.type`}>Type *</Label>
                <Controller
                  control={form.control}
                  name={`checklists.${index}.type`}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id={`checklists.${index}.type`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="information">Information</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`checklists.${index}.tab`}>Tab *</Label>
                <Controller
                  control={form.control}
                  name={`checklists.${index}.tab`}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id={`checklists.${index}.tab`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="information">Information</SelectItem>
                        <SelectItem value="limitations">Limitations</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`checklists.${index}.comment`}>Comment</Label>
              <Textarea
                id={`checklists.${index}.comment`}
                rows={4}
                {...form.register(`checklists.${index}.comment`)}
                placeholder="Template text or description..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`checklists.${index}.answer_choices`}>Answer Choices</Label>
              <Input
                id={`checklists.${index}.answer_choices`}
                placeholder="Comma-separated values (e.g., Option 1, Option 2, Option 3)"
                onChange={(e) => {
                  const value = e.target.value;
                  const choices = value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  form.setValue(`checklists.${index}.answer_choices`, choices, {
                    shouldValidate: true,
                  });
                }}
                defaultValue={form.watch(`checklists.${index}.answer_choices`)?.join(", ") || ""}
              />
              <p className="text-xs text-muted-foreground">
                Enter multiple options separated by commas
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor={`checklists.${index}.default_checked`} className="text-base">
                  Default Checked
                </Label>
                <p className="text-sm text-muted-foreground">
                  Auto-select this item for new inspections
                </p>
              </div>
              <Controller
                control={form.control}
                name={`checklists.${index}.default_checked`}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                )}
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </div>
  );
}

