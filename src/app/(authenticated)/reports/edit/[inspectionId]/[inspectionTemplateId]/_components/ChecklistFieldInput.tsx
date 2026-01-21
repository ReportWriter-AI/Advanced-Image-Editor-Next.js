"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { InspectionTemplateChecklist } from "@/components/api/queries/inspectionTemplateChecklists";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface ChecklistFieldInputProps {
  checklist: InspectionTemplateChecklist;
  onAnswerChange: (answerData: Partial<InspectionTemplateChecklist>) => void;
  disabled?: boolean;
  hideTitleAndCheckbox?: boolean;
}

export function ChecklistFieldInput({
  checklist,
  onAnswerChange,
  disabled = false,
  hideTitleAndCheckbox = false,
}: ChecklistFieldInputProps) {
  const [textValue, setTextValue] = useState(checklist.textAnswer || "");
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(checklist.selectedAnswers || []);
  const [dateValue, setDateValue] = useState<Date | undefined>(
    checklist.dateAnswer ? new Date(checklist.dateAnswer) : undefined
  );
  const [numberValue, setNumberValue] = useState<string>(
    checklist.numberAnswer?.toString() || ""
  );
  const [numberUnit, setNumberUnit] = useState(checklist.numberUnit || "");
  const [rangeFrom, setRangeFrom] = useState<string>(
    checklist.rangeFrom?.toString() || ""
  );
  const [rangeTo, setRangeTo] = useState<string>(
    checklist.rangeTo?.toString() || ""
  );
  const [rangeUnit, setRangeUnit] = useState(checklist.rangeUnit || "");

  // Refs to track previous values to prevent infinite loops
  const prevTextAnswerRef = useRef<string | undefined>(checklist.textAnswer);
  const prevNumberAnswerRef = useRef<number | undefined>(checklist.numberAnswer);
  const prevNumberUnitRef = useRef<string | undefined>(checklist.numberUnit);
  const prevRangeFromRef = useRef<number | undefined>(checklist.rangeFrom);
  const prevRangeToRef = useRef<number | undefined>(checklist.rangeTo);
  const prevRangeUnitRef = useRef<string | undefined>(checklist.rangeUnit);
  const prevSelectedAnswersRef = useRef<string[] | undefined>(checklist.selectedAnswers);
  const prevDateAnswerRef = useRef<Date | string | undefined>(checklist.dateAnswer);

  // Sync with checklist changes - only update if values actually changed from props
  useEffect(() => {
    const newTextAnswer = checklist.textAnswer || "";
    const newSelectedAnswers = checklist.selectedAnswers || [];
    const newDateAnswer = checklist.dateAnswer ? new Date(checklist.dateAnswer) : undefined;
    const newNumberAnswer = checklist.numberAnswer?.toString() || "";
    const newNumberUnit = checklist.numberUnit || "";
    const newRangeFrom = checklist.rangeFrom?.toString() || "";
    const newRangeTo = checklist.rangeTo?.toString() || "";
    const newRangeUnit = checklist.rangeUnit || "";

    // Only update state if the prop value differs from what we last synced (stored in ref)
    if (newTextAnswer !== (prevTextAnswerRef.current || "")) {
      setTextValue(newTextAnswer);
      prevTextAnswerRef.current = checklist.textAnswer;
    }
    
    const newSelectedAnswersStr = JSON.stringify(newSelectedAnswers);
    const prevSelectedAnswersStr = JSON.stringify(prevSelectedAnswersRef.current || []);
    if (newSelectedAnswersStr !== prevSelectedAnswersStr) {
      setSelectedAnswers(newSelectedAnswers);
      prevSelectedAnswersRef.current = checklist.selectedAnswers;
    }
    
    const newDateStr = newDateAnswer?.toISOString();
    const prevDateStr = prevDateAnswerRef.current instanceof Date 
      ? prevDateAnswerRef.current.toISOString() 
      : typeof prevDateAnswerRef.current === 'string' 
        ? prevDateAnswerRef.current 
        : undefined;
    if (newDateStr !== prevDateStr) {
      setDateValue(newDateAnswer);
      prevDateAnswerRef.current = checklist.dateAnswer;
    }
    
    if (newNumberAnswer !== (prevNumberAnswerRef.current?.toString() || "")) {
      setNumberValue(newNumberAnswer);
      prevNumberAnswerRef.current = checklist.numberAnswer;
    }
    
    if (newNumberUnit !== (prevNumberUnitRef.current || "")) {
      setNumberUnit(newNumberUnit);
      prevNumberUnitRef.current = checklist.numberUnit;
    }
    
    if (newRangeFrom !== (prevRangeFromRef.current?.toString() || "")) {
      setRangeFrom(newRangeFrom);
      prevRangeFromRef.current = checklist.rangeFrom;
    }
    
    if (newRangeTo !== (prevRangeToRef.current?.toString() || "")) {
      setRangeTo(newRangeTo);
      prevRangeToRef.current = checklist.rangeTo;
    }
    
    if (newRangeUnit !== (prevRangeUnitRef.current || "")) {
      setRangeUnit(newRangeUnit);
      prevRangeUnitRef.current = checklist.rangeUnit;
    }
  }, [checklist.textAnswer, checklist.selectedAnswers, checklist.dateAnswer, checklist.numberAnswer, checklist.numberUnit, checklist.rangeFrom, checklist.rangeTo, checklist.rangeUnit]);

  const debouncedTextValue = useDebounce(textValue, 500);

  useEffect(() => {
    // Only call onAnswerChange if the debounced value differs from the previous value we sent
    if (debouncedTextValue !== prevTextAnswerRef.current) {
      // Validate max length (optional, can be adjusted)
      if (debouncedTextValue.length <= 1000) {
        prevTextAnswerRef.current = debouncedTextValue;
        onAnswerChange({ textAnswer: debouncedTextValue });
      }
    }
  }, [debouncedTextValue]);

  const handleTextChange = (value: string) => {
    // Client-side validation: max length
    if (value.length <= 1000) {
      setTextValue(value);
    }
  };

  const handleMultipleAnswerToggle = (choice: string) => {
    const newSelected = selectedAnswers.includes(choice)
      ? selectedAnswers.filter((a) => a !== choice)
      : [...selectedAnswers, choice];
    setSelectedAnswers(newSelected);
    onAnswerChange({ selectedAnswers: newSelected });
  };

  const handleDateChange = (date: Date | undefined) => {
    setDateValue(date);
    onAnswerChange({ dateAnswer: date });
  };

  const debouncedNumberValue = useDebounce(numberValue, 500);

  useEffect(() => {
    const numValue = debouncedNumberValue === "" ? undefined : parseFloat(debouncedNumberValue);
    const currentUnit = numberUnit || undefined;
    
    // Only call onAnswerChange if values actually changed
    if (numValue !== prevNumberAnswerRef.current || currentUnit !== prevNumberUnitRef.current) {
      if (numValue !== undefined && !isNaN(numValue)) {
        prevNumberAnswerRef.current = numValue;
        prevNumberUnitRef.current = currentUnit;
        onAnswerChange({ numberAnswer: numValue, numberUnit: currentUnit });
      } else if (debouncedNumberValue === "") {
        prevNumberAnswerRef.current = undefined;
        prevNumberUnitRef.current = undefined;
        onAnswerChange({ numberAnswer: undefined, numberUnit: undefined });
      }
    }
  }, [debouncedNumberValue, numberUnit]);

  const handleNumberChange = (value: string) => {
    // Allow empty string or valid number
    if (value === "" || (!isNaN(parseFloat(value)) && isFinite(parseFloat(value)))) {
      setNumberValue(value);
    }
  };

  const handleNumberUnitChange = (unit: string) => {
    setNumberUnit(unit);
    const numValue = numberValue === "" ? undefined : parseFloat(numberValue);
    if (numValue !== undefined && !isNaN(numValue)) {
      onAnswerChange({ numberAnswer: numValue, numberUnit: unit || undefined });
    }
  };

  const debouncedRangeFrom = useDebounce(rangeFrom, 500);
  const debouncedRangeTo = useDebounce(rangeTo, 500);

  useEffect(() => {
    const fromValue = debouncedRangeFrom === "" ? undefined : parseFloat(debouncedRangeFrom);
    const toValue = debouncedRangeTo === "" ? undefined : parseFloat(debouncedRangeTo);
    const currentUnit = rangeUnit || undefined;
    
    // Only call onAnswerChange if values actually changed
    const fromChanged = fromValue !== prevRangeFromRef.current;
    const toChanged = toValue !== prevRangeToRef.current;
    const unitChanged = currentUnit !== prevRangeUnitRef.current;
    
    if (fromChanged || toChanged || unitChanged) {
      // Validate range: from <= to
      if (fromValue !== undefined && toValue !== undefined && !isNaN(fromValue) && !isNaN(toValue)) {
        if (fromValue <= toValue) {
          prevRangeFromRef.current = fromValue;
          prevRangeToRef.current = toValue;
          prevRangeUnitRef.current = currentUnit;
          onAnswerChange({
            rangeFrom: fromValue,
            rangeTo: toValue,
            rangeUnit: currentUnit,
          });
        }
      } else {
        prevRangeFromRef.current = fromValue !== undefined && !isNaN(fromValue) ? fromValue : undefined;
        prevRangeToRef.current = toValue !== undefined && !isNaN(toValue) ? toValue : undefined;
        prevRangeUnitRef.current = currentUnit;
        onAnswerChange({
          rangeFrom: prevRangeFromRef.current,
          rangeTo: prevRangeToRef.current,
          rangeUnit: currentUnit,
        });
      }
    }
  }, [debouncedRangeFrom, debouncedRangeTo, rangeUnit]);

  const handleRangeFromChange = (value: string) => {
    if (value === "" || (!isNaN(parseFloat(value)) && isFinite(parseFloat(value)))) {
      setRangeFrom(value);
    }
  };

  const handleRangeToChange = (value: string) => {
    if (value === "" || (!isNaN(parseFloat(value)) && isFinite(parseFloat(value)))) {
      setRangeTo(value);
    }
  };

  const handleRangeUnitChange = (unit: string) => {
    setRangeUnit(unit);
    const fromValue = rangeFrom === "" ? undefined : parseFloat(rangeFrom);
    const toValue = rangeTo === "" ? undefined : parseFloat(rangeTo);
    onAnswerChange({
      rangeFrom: fromValue,
      rangeTo: toValue,
      rangeUnit: unit || undefined,
    });
  };

  if (!checklist.field) {
    return null;
  }

  switch (checklist.field) {
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          {!hideTitleAndCheckbox && (
            <>
              <Checkbox
                checked={checklist.defaultChecked || false}
                onCheckedChange={(checked) => {
                  onAnswerChange({ defaultChecked: Boolean(checked) });
                }}
                disabled={disabled}
              />
              <Label className="font-normal">{checklist.name}</Label>
            </>
          )}
        </div>
      );

    case "text":
      return (
        <div className="space-y-2">
          {!hideTitleAndCheckbox && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={checklist.defaultChecked || false}
                onCheckedChange={(checked) => {
                  onAnswerChange({ defaultChecked: Boolean(checked) });
                }}
                disabled={disabled}
              />
              <Label>{checklist.name}</Label>
            </div>
          )}
          <Input
            value={textValue}
            onChange={(e) => handleTextChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter text..."
            maxLength={1000}
          />
          {textValue.length > 900 && (
            <p className="text-xs text-muted-foreground">
              {1000 - textValue.length} characters remaining
            </p>
          )}
        </div>
      );

    case "multipleAnswers":
      return (
        <div className="space-y-3">
          {!hideTitleAndCheckbox && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={checklist.defaultChecked || false}
                onCheckedChange={(checked) => {
                  onAnswerChange({ defaultChecked: Boolean(checked) });
                }}
                disabled={disabled}
              />
              <Label>{checklist.name}</Label>
            </div>
          )}
          {checklist.comment && (
            <p className="text-sm text-muted-foreground">{checklist.comment}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 py-2">
            {checklist.answerChoices && checklist.answerChoices.length > 0 ? (
              checklist.answerChoices.map((choice, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedAnswers.includes(choice)}
                    onCheckedChange={() => handleMultipleAnswerToggle(choice)}
                    disabled={disabled}
                  />
                  <Label className="font-normal cursor-pointer" onClick={() => !disabled && handleMultipleAnswerToggle(choice)}>
                    {choice}
                  </Label>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No answer choices available</p>
            )}
          </div>
        </div>
      );

    case "date":
      return (
        <div className="space-y-2">
          {!hideTitleAndCheckbox && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={checklist.defaultChecked || false}
                onCheckedChange={(checked) => {
                  onAnswerChange({ defaultChecked: Boolean(checked) });
                }}
                disabled={disabled}
              />
              <Label>{checklist.name}</Label>
            </div>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateValue && "text-muted-foreground"
                )}
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateValue ? format(dateValue, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateValue}
                onSelect={handleDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      );

    case "number":
      return (
        <div className="space-y-3">
          {!hideTitleAndCheckbox && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={checklist.defaultChecked || false}
                onCheckedChange={(checked) => {
                  onAnswerChange({ defaultChecked: Boolean(checked) });
                }}
                disabled={disabled}
              />
              <Label>{checklist.name}</Label>
            </div>
          )}
          <div className="space-y-2">
            <Input
              type="number"
              value={numberValue}
              onChange={(e) => handleNumberChange(e.target.value)}
              disabled={disabled}
              placeholder="Enter number..."
            />
          </div>
          {checklist.answerChoices && checklist.answerChoices.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Unit</Label>
              <div className="flex flex-wrap gap-3">
                {checklist.answerChoices.map((unit, index) => (
                  <label
                    key={index}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={`number-unit-${checklist._id}`}
                      value={unit}
                      checked={numberUnit === unit}
                      onChange={() => handleNumberUnitChange(unit)}
                      disabled={disabled}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{unit}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    case "numberRange":
      const fromNum = rangeFrom === "" ? undefined : parseFloat(rangeFrom);
      const toNum = rangeTo === "" ? undefined : parseFloat(rangeTo);
      const rangeError = fromNum !== undefined && toNum !== undefined && !isNaN(fromNum) && !isNaN(toNum) && fromNum > toNum;
      
      return (
        <div className="space-y-3">
          {!hideTitleAndCheckbox && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={checklist.defaultChecked || false}
                onCheckedChange={(checked) => {
                  onAnswerChange({ defaultChecked: Boolean(checked) });
                }}
                disabled={disabled}
              />
              <Label>{checklist.name}</Label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">From</Label>
              <Input
                type="number"
                value={rangeFrom}
                onChange={(e) => handleRangeFromChange(e.target.value)}
                disabled={disabled}
                placeholder="From..."
                className={rangeError ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">To</Label>
              <Input
                type="number"
                value={rangeTo}
                onChange={(e) => handleRangeToChange(e.target.value)}
                disabled={disabled}
                placeholder="To..."
                className={rangeError ? "border-red-500" : ""}
              />
            </div>
          </div>
          {rangeError && (
            <p className="text-xs text-red-600">From value must be less than or equal to To value</p>
          )}
          {checklist.answerChoices && checklist.answerChoices.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Unit</Label>
              <div className="flex flex-wrap gap-3">
                {checklist.answerChoices.map((unit, index) => (
                  <label
                    key={index}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={`range-unit-${checklist._id}`}
                      value={unit}
                      checked={rangeUnit === unit}
                      onChange={() => handleRangeUnitChange(unit)}
                      disabled={disabled}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{unit}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
}
