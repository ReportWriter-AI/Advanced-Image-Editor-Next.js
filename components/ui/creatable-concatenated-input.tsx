"use client";

import { useState, useRef, useEffect } from "react";
import CreatableSelect from "react-select/creatable";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface CreatableConcatenatedInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
  placeholder?: string;
  inputPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  options?: Array<{ value: string; label: string }>;
}

export function CreatableConcatenatedInput({
  value,
  onChange,
  label,
  helperText,
  placeholder = "Add item...",
  inputPlaceholder,
  disabled = false,
  className,
  options = [],
}: CreatableConcatenatedInputProps) {
  const [selectKey, setSelectKey] = useState(0);
  const [shouldFocus, setShouldFocus] = useState(false);
  const selectRef = useRef<any>(null);

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
    if (newValue) {
      const trimmedValue = newValue.value.trim();
      if (trimmedValue) {
        const newString = value.trim() ? `${value.trim()} ${trimmedValue}` : trimmedValue;
        onChange(newString);
        setSelectKey((prev) => prev + 1); // Force select to reset
        setShouldFocus(true);
      }
    }
  };

  const handleCreateOption = (inputValue: string) => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      const newString = value.trim() ? `${value.trim()} ${trimmedValue}` : trimmedValue;
      onChange(newString);
      setSelectKey((prev) => prev + 1); // Force select to reset
      setShouldFocus(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
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
      <Input
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={inputPlaceholder}
        disabled={disabled}
      />
      {helperText && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
