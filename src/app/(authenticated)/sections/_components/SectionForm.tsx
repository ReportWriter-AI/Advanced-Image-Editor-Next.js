"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Trash2, GripVertical, X, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  // Watch all checklist values to filter by type
  const checklistValues = form.watch("checklists");

  // Helper function to get items by type with their original indices
  const getItemsByType = (type: "status" | "information") => {
    return checklistFields
      .map((field, index) => ({ field, index, type: checklistValues[index]?.type }))
      .filter((item) => item.type === type)
      .map((item) => ({ field: item.field, originalIndex: item.index }));
  };

  // Separate items by type
  const statusItems = getItemsByType("status");
  const informationItems = getItemsByType("information");

  // Helper function to recalculate global order indices
  const recalculateOrderIndices = () => {
    const allItems = form.getValues("checklists");
    
    // Create a map to track original items by their current position
    const itemsWithOriginalIndex = allItems.map((item, idx) => ({ item, originalIdx: idx }));
    
    // Group by type while preserving order
    const statusItemsWithIdx = itemsWithOriginalIndex.filter(({ item }) => item.type === "status");
    const informationItemsWithIdx = itemsWithOriginalIndex.filter(({ item }) => item.type === "information");

    // Create updated items array - status items first, then information items
    const updatedItems: typeof allItems = [];
    
    statusItemsWithIdx.forEach(({ item, originalIdx }, index) => {
      updatedItems[originalIdx] = { ...item, order_index: index };
    });
    
    informationItemsWithIdx.forEach(({ item, originalIdx }, index) => {
      updatedItems[originalIdx] = { ...item, order_index: statusItemsWithIdx.length + index };
    });

    form.setValue("checklists", updatedItems, { shouldValidate: false });
  };

  const handleStatusDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = Number(String(active.id).replace("status-", ""));
    const newIndex = Number(String(over.id).replace("status-", ""));

    if (isNaN(oldIndex) || isNaN(newIndex) || oldIndex < 0 || newIndex < 0) {
      return;
    }

    const currentChecklists = form.getValues("checklists");
    
    // Recompute status and information items with current state
    const currentStatusItems = getItemsByType("status");
    const currentInformationItems = getItemsByType("information");
    
    if (oldIndex >= currentStatusItems.length || newIndex >= currentStatusItems.length) {
      return;
    }

    // Reorder status items only
    const statusIndices = currentStatusItems.map((item) => item.originalIndex);
    const statusItemsArray = statusIndices.map((idx) => currentChecklists[idx]);
    const reorderedStatus = arrayMove(statusItemsArray, oldIndex, newIndex);

    // Rebuild the full array: reordered status items + information items
    const informationIndices = currentInformationItems.map((item) => item.originalIndex);
    const informationItemsArray = informationIndices.map((idx) => currentChecklists[idx]);
    const reordered = [...reorderedStatus, ...informationItemsArray];

    form.setValue("checklists", reordered);
    setTimeout(() => recalculateOrderIndices(), 0);
  };

  const handleInformationDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = Number(String(active.id).replace("info-", ""));
    const newIndex = Number(String(over.id).replace("info-", ""));

    if (isNaN(oldIndex) || isNaN(newIndex) || oldIndex < 0 || newIndex < 0) {
      return;
    }

    const currentChecklists = form.getValues("checklists");
    
    // Recompute status and information items with current state
    const currentStatusItems = getItemsByType("status");
    const currentInformationItems = getItemsByType("information");
    
    if (oldIndex >= currentInformationItems.length || newIndex >= currentInformationItems.length) {
      return;
    }

    // Reorder information items only
    const informationIndices = currentInformationItems.map((item) => item.originalIndex);
    const informationItemsArray = informationIndices.map((idx) => currentChecklists[idx]);
    const reorderedInformation = arrayMove(informationItemsArray, oldIndex, newIndex);

    // Rebuild the full array: status items + reordered information items
    const statusIndices = currentStatusItems.map((item) => item.originalIndex);
    const statusItemsArray = statusIndices.map((idx) => currentChecklists[idx]);
    const reordered = [...statusItemsArray, ...reorderedInformation];

    form.setValue("checklists", reordered);
    setTimeout(() => recalculateOrderIndices(), 0);
  };

  const addStatusItem = () => {
    const currentChecklists = form.getValues("checklists");
    const statusCount = currentChecklists.filter((item) => item.type === "status").length;
    
    appendChecklist({
      text: "",
      comment: "",
      type: "status",
      answer_choices: [],
      default_checked: false,
      default_selected_answers: [],
      order_index: statusCount,
    });
    setTimeout(() => recalculateOrderIndices(), 0);
  };

  const addInformationItem = () => {
    const currentChecklists = form.getValues("checklists");
    const statusCount = currentChecklists.filter((item) => item.type === "status").length;
    const informationCount = currentChecklists.filter((item) => item.type === "information").length;
    
    appendChecklist({
      text: "",
      comment: "",
      type: "information",
      answer_choices: [],
      default_checked: false,
      default_selected_answers: [],
      order_index: statusCount + informationCount,
    });
    setTimeout(() => recalculateOrderIndices(), 0);
  };

  const removeChecklistItem = (index: number) => {
    removeChecklist(index);
    setTimeout(() => recalculateOrderIndices(), 0);
  };

  const handleSubmit = async (values: SectionFormValues) => {
    // Ensure order_index is recalculated before submit
    recalculateOrderIndices();
    
    // Get the latest values - use values parameter which should be up to date
    // But we need to recalculate order_index for the current state
    const allItems = values.checklists;
    const statusItems = allItems.filter((item) => item.type === "status");
    const informationItems = allItems.filter((item) => item.type === "information");
    
    // Create properly ordered array with correct order_index
    const sortedChecklists = [
      ...statusItems.map((item, index) => ({ ...item, order_index: index })),
      ...informationItems.map((item, index) => ({ ...item, order_index: statusItems.length + index })),
    ];
    
    const normalized: SectionFormNormalizedValues = {
      name: values.name.trim(),
      checklists: sortedChecklists.map((item) => ({
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
        order_index: item.order_index,
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

      <div className="space-y-6">
        <Label className="text-base font-semibold">Checklist Items</Label>
        
        <Accordion type="multiple" defaultValue={["status", "information"]} className="space-y-4">
          {/* Status Items Section */}
          <AccordionItem value="status" className="rounded-lg border border-blue-200 bg-blue-50/30 px-4">
            <div className="flex items-center justify-between py-2">
              <AccordionTrigger className="hover:no-underline flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">Status Items</span>
                  <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                    {statusItems.length}
                  </span>
                </div>
              </AccordionTrigger>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  addStatusItem();
                }}
                disabled={isSubmitting}
                className="ml-2 border-blue-300 bg-white hover:bg-blue-50"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Status Item
              </Button>
            </div>
            <AccordionContent className="pb-4 pt-2">
              {statusItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-blue-300 bg-white p-6 text-center text-sm text-blue-700">
                  <p>No status items yet. Click "Add Status Item" to get started.</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStatusDragEnd}>
                  <SortableContext
                    items={statusItems.map((_, index) => `status-${index}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <Accordion type="multiple" className="space-y-2">
                      {statusItems.map((item, sectionIndex) => (
                        <ChecklistItemField
                          key={item.field.id}
                          index={item.originalIndex}
                          sortableId={`status-${sectionIndex}`}
                          form={form}
                          onRemove={() => removeChecklistItem(item.originalIndex)}
                          disabled={isSubmitting}
                        />
                      ))}
                    </Accordion>
                  </SortableContext>
                </DndContext>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Information Items Section */}
          <AccordionItem value="information" className="rounded-lg border border-emerald-200 bg-emerald-50/30 px-4">
            <div className="flex items-center justify-between py-2">
              <AccordionTrigger className="hover:no-underline flex-1">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold text-emerald-900">Information Items</span>
                  <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
                    {informationItems.length}
                  </span>
                </div>
              </AccordionTrigger>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  addInformationItem();
                }}
                disabled={isSubmitting}
                className="ml-2 border-emerald-300 bg-white hover:bg-emerald-50"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Information Item
              </Button>
            </div>
            <AccordionContent className="pb-4 pt-2">
              {informationItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-emerald-300 bg-white p-6 text-center text-sm text-emerald-700">
                  <p>No information items yet. Click "Add Information Item" to get started.</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInformationDragEnd}>
                  <SortableContext
                    items={informationItems.map((_, index) => `info-${index}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <Accordion type="multiple" className="space-y-2">
                      {informationItems.map((item, sectionIndex) => (
                        <ChecklistItemField
                          key={item.field.id}
                          index={item.originalIndex}
                          sortableId={`info-${sectionIndex}`}
                          form={form}
                          onRemove={() => removeChecklistItem(item.originalIndex)}
                          disabled={isSubmitting}
                        />
                      ))}
                    </Accordion>
                  </SortableContext>
                </DndContext>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
  sortableId: string;
  form: ReturnType<typeof useForm<SectionFormValues>>;
  onRemove: () => void;
  disabled?: boolean;
}

function ChecklistItemField({ index, sortableId, form, onRemove, disabled }: ChecklistItemFieldProps) {
  const itemType = form.watch(`checklists.${index}.type`);
  
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
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
                      plugins={['textcolor', 'link', 'image', 'media']}
                      toolbar="bold italic underline | forecolor backcolor | link image media"
                    />
                    {fieldState.error && (
                      <p className="mt-1 text-sm text-red-600">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
            </div>

            {itemType === "status" && (
              <AnswerChoicesField checklistIndex={index} form={form} disabled={disabled} />
            )}

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

