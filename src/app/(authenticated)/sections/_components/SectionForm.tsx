"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Trash2, GripVertical, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TinyMCERichTextEditor from "@/components/TinyMCERichTextEditor";
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const checklistItemSchema = z.object({
  text: z.string().trim().min(1, "Text is required"),
  comment: z.string().trim().optional(),
  type: z.enum(["status", "information"]),
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

interface AnswerChoicesFieldProps {
  checklistIndex: number;
  form: ReturnType<typeof useForm<SectionFormValues>>;
  disabled?: boolean;
}

function AnswerChoicesField({ checklistIndex, form, disabled }: AnswerChoicesFieldProps) {
  const [newChoiceInput, setNewChoiceInput] = useState("");

  const currentChoices = form.watch(`checklists.${checklistIndex}.answer_choices`) || [];
  const choiceFields = currentChoices.map((choice, idx) => ({ id: `choice-${idx}`, value: choice }));

  const choiceSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleChoiceDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);

    if (oldIndex === -1 || newIndex === -1 || oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reordered = arrayMove(currentChoices, oldIndex, newIndex);
    form.setValue(`checklists.${checklistIndex}.answer_choices`, reordered, {
      shouldValidate: true,
    });
  };

  const addChoice = () => {
    const trimmed = newChoiceInput.trim();
    if (trimmed) {
      const updated = [...currentChoices, trimmed];
      form.setValue(`checklists.${checklistIndex}.answer_choices`, updated, {
        shouldValidate: true,
      });
      setNewChoiceInput("");
    }
  };

  const removeChoice = (index: number) => {
    const updated = currentChoices.filter((_, idx) => idx !== index);
    form.setValue(`checklists.${checklistIndex}.answer_choices`, updated, {
      shouldValidate: true,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addChoice();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`checklists.${checklistIndex}.answer_choices`}>Answer Choices</Label>
      
      {choiceFields.length > 0 && (
        <DndContext
          sensors={choiceSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleChoiceDragEnd}
        >
          <SortableContext
            items={choiceFields.map((_, idx) => idx)}
            strategy={rectSortingStrategy}
          >
            <div className="flex flex-wrap gap-2">
              {choiceFields.map((field, idx) => (
                <SortableChoiceItem
                  key={field.id}
                  index={idx}
                  choice={field.value}
                  onRemove={() => removeChoice(idx)}
                  disabled={disabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="mt-3 border-t border-gray-200 pt-3">
        <div className="text-xs font-semibold text-gray-600 mb-2">Add Answer Choice:</div>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Type answer choice..."
            value={newChoiceInput}
            onChange={(e) => setNewChoiceInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-xs"
            disabled={disabled}
          />
          <Button
            type="button"
            onClick={addChoice}
            disabled={disabled || !newChoiceInput.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 text-white whitespace-nowrap text-xs font-semibold px-3"
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SortableChoiceItemProps {
  index: number;
  choice: string;
  onRemove: () => void;
  disabled?: boolean;
}

function SortableChoiceItem({ index, choice, onRemove, disabled }: SortableChoiceItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: index,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded border bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer group",
        isDragging && "opacity-60"
      )}
    >
      <div
        className="cursor-grab active:cursor-grabbing touch-none text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" />
      </div>
      <span className="text-xs text-gray-700 select-none flex-1">{choice}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        disabled={disabled}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded text-red-600"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
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
              <Label htmlFor={`checklists.${index}.comment`}>Comment</Label>
              <Controller
                control={form.control}
                name={`checklists.${index}.comment`}
                render={({ field, fieldState }) => (
                  <div>
                    <TinyMCERichTextEditor
                      value={field.value || ""}
                      onChange={field.onChange}
                      height={300}
                      plugins={['textcolor']}
                      toolbar="bold italic underline | forecolor backcolor"
                    />
                    {fieldState.error && (
                      <p className="mt-1 text-sm text-red-600">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
            </div>

            <AnswerChoicesField checklistIndex={index} form={form} disabled={disabled} />

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

