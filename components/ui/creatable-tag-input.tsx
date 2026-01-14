"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import CreatableSelect from "react-select/creatable";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface CreatableTagInputProps {
  value: string[];
  onChange: (values: string[]) => void;
  label?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CreatableTagInput({
  value,
  onChange,
  label,
  helperText,
  placeholder = "Add item...",
  disabled = false,
  className,
}: CreatableTagInputProps) {
  const [selectKey, setSelectKey] = useState(0);
  const [shouldFocus, setShouldFocus] = useState(false);
  const selectRef = useRef<any>(null);

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

  const handleRemove = (indexToRemove: number) => {
    onChange(value.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
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
      {helperText && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((item, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1.5 px-3 py-1"
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
