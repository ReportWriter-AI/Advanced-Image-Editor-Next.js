"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import CreatableSelect from "react-select/creatable";
import { X, GripVertical } from "lucide-react";
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface CreatableTagInputProps {
  value: string[];
  onChange: (values: string[]) => void;
  label?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCheckboxes?: boolean;
  selectedValues?: string[];
  onSelectionChange?: (selected: string[]) => void;
  hideSearchInput?: boolean;
}

interface SortableTagItemProps {
  id: string;
  item: string;
  index: number;
  onRemove: (index: number) => void;
  disabled?: boolean;
  showCheckbox?: boolean;
  isChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
}

function SortableTagItem({
  id,
  item,
  index,
  onRemove,
  disabled = false,
  showCheckbox = false,
  isChecked = false,
  onCheckboxChange,
}: SortableTagItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (onCheckboxChange && !disabled) {
      onCheckboxChange(checked);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-3 py-2 transition-all",
        "hover:bg-accent",
        isDragging && "shadow-lg z-50 scale-105",
        isOver && !isDragging && "border-primary border-2",
        disabled && "opacity-50 cursor-not-allowed",
        showCheckbox && isChecked && "border-primary bg-primary/5"
      )}
    >
      {showCheckbox && (
        <Checkbox
          checked={isChecked}
          onCheckedChange={handleCheckboxChange}
          disabled={disabled}
          className="shrink-0"
        />
      )}
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        className={cn(
          "cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors",
          "touch-none",
          disabled && "cursor-not-allowed"
        )}
        aria-label={`Drag to reorder ${item}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm">{item}</span>
      <button
        type="button"
        onClick={() => onRemove(index)}
        disabled={disabled}
        className={cn(
          "rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors",
          "text-muted-foreground hover:text-foreground",
          disabled && "cursor-not-allowed opacity-50"
        )}
        aria-label={`Remove ${item}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function CreatableTagInput({
  value,
  onChange,
  label,
  helperText,
  placeholder = "Add item...",
  disabled = false,
  className,
  showCheckboxes = false,
  selectedValues = [],
  onSelectionChange,
  hideSearchInput = false,
}: CreatableTagInputProps) {
  const [selectKey, setSelectKey] = useState(0);
  const [shouldFocus, setShouldFocus] = useState(false);
  const selectRef = useRef<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const options = useMemo(
    () => value.map((item) => ({ value: item, label: item })),
    [value]
  );

  // Focus input after component remounts (when selectKey changes)
  useEffect(() => {
    if (shouldFocus && !disabled) {
      let retryCount = 0;
      const maxRetries = 10;
      
      // Wait for the ref to be available after remount
      const attemptFocus = () => {
        // Try component ref focus method
        if (selectRef.current && typeof selectRef.current.focus === 'function') {
          selectRef.current.focus();
          setShouldFocus(false);
          return;
        }
        
        // Fallback: try to find input element via DOM query (scoped to container)
        const containerElement = selectRef.current?.controlRef?.current?.closest('.react-select-container') ||
                                 document.querySelector('.react-select-container');
        const inputElement = containerElement?.querySelector('input');
        if (inputElement) {
          inputElement.focus();
          setShouldFocus(false);
          return;
        }
        
        // Retry if not available yet, but limit retries
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(attemptFocus, 20);
        } else {
          setShouldFocus(false);
        }
      };
      
      // Start attempting to focus after a short delay
      const timeoutId = setTimeout(attemptFocus, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [selectKey, shouldFocus, disabled]);

  const handleChange = (newValue: any) => {
    if (newValue && !value.includes(newValue.value)) {
      const trimmedValue = newValue.value.trim();
      if (trimmedValue) {
        onChange([...value, trimmedValue]);
        setSelectKey((prev) => prev + 1); // Force select to reset
        setShouldFocus(true);
      }
    }
  };

  const handleCreateOption = (inputValue: string) => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !value.includes(trimmedValue)) {
      onChange([...value, trimmedValue]);
      setSelectKey((prev) => prev + 1); // Force select to reset
      setShouldFocus(true);
    }
  };

  const handleRemove = useCallback(
    (indexToRemove: number) => {
      onChange(value.filter((_, index) => index !== indexToRemove));
    },
    [value, onChange]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (disabled) return;

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = value.findIndex((_, index) => String(index) === active.id);
      const newIndex = value.findIndex((_, index) => String(index) === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(value, oldIndex, newIndex));
      }
    },
    [value, onChange, disabled]
  );

  const handleCheckboxChange = useCallback(
    (item: string, checked: boolean) => {
      if (!onSelectionChange) return;
      
      const newSelected = checked
        ? [...selectedValues, item]
        : selectedValues.filter((v) => v !== item);
      
      onSelectionChange(newSelected);
    },
    [selectedValues, onSelectionChange]
  );

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      {!hideSearchInput && (
        <CreatableSelect
          ref={selectRef}
          key={selectKey}
          value={null}
          onChange={handleChange}
          onCreateOption={handleCreateOption}
          options={options}
          placeholder={placeholder}
          className="react-select-container"
          classNamePrefix="react-select"
          isDisabled={disabled}
          isClearable={false}
        />
      )}
      {helperText && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
      {value.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={value.map((_, index) => String(index))}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
              {value.map((item, index) => (
                <SortableTagItem
                  key={`${item}-${index}`}
                  id={String(index)}
                  item={item}
                  index={index}
                  onRemove={handleRemove}
                  disabled={disabled}
                  showCheckbox={showCheckboxes}
                  isChecked={selectedValues.includes(item)}
                  onCheckboxChange={(checked) => handleCheckboxChange(item, checked)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
