"use client";

import { Loader2 } from "lucide-react";
import { ChecklistSearchResult } from "@/components/api/queries/inspectionTemplates";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChecklistSearchDropdownProps {
  results: ChecklistSearchResult[];
  isLoading: boolean;
  onSelect: (sectionId: string, subsectionId: string) => void;
  searchQuery: string;
  selectedIndex: number;
}

export function ChecklistSearchDropdown({
  results,
  isLoading,
  onSelect,
  searchQuery,
  selectedIndex,
}: ChecklistSearchDropdownProps) {
  // Helper function to highlight matched text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 font-semibold">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground">No checklists found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
      <ScrollArea className="max-h-[400px]">
        <div className="p-1">
          {results.map((result, index) => (
            <button
              key={`${result.sectionId}-${result.subsectionId}-${result.checklistId}`}
              onClick={() => onSelect(result.sectionId, result.subsectionId)}
              className={cn(
                "w-full rounded-sm px-3 py-2.5 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none",
                selectedIndex === index && "bg-accent"
              )}
              onMouseEnter={(e) => {
                // Prevent mouse hover from interfering with keyboard navigation
                (e.currentTarget as HTMLButtonElement).focus();
              }}
            >
              <div className="flex flex-col gap-0.5">
                <div className="text-xs text-muted-foreground">
                  {result.sectionName} - {result.subsectionName}
                </div>
                <div className="text-sm font-medium">
                  {highlightMatch(result.checklistName, searchQuery)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
