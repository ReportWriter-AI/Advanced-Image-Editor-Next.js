"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExcelRow {
  sectionName: string;
  itemName: string;
  commentName: string;
  commentText: string;
  commentType: string;
  multipleChoiceOptions: string;
  unitTypeOptions: string;
  order: string | number;
  answerType: string;
  defaultValue: string;
  defaultValue2: string;
  defaultUnitType: string;
  defaultLocation: string;
}

interface ImportExportSidebarProps {
  groupedData: Map<string, Map<string, ExcelRow[]>>;
  selectedSection: string | null;
  selectedItem: string | null;
  onSectionSelect: (section: string | null) => void;
  onItemSelect: (section: string, item: string) => void;
}

export function ImportExportSidebar({
  groupedData,
  selectedSection,
  selectedItem,
  onSectionSelect,
  onItemSelect,
}: ImportExportSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Auto-expand selected section
  useEffect(() => {
    if (selectedSection) {
      setExpandedSections((prev) => {
        if (prev.has(selectedSection)) return prev;
        return new Set(prev).add(selectedSection);
      });
    }
  }, [selectedSection]);

  // Auto-expand all sections on initial load
  useEffect(() => {
    if (groupedData.size > 0 && expandedSections.size === 0) {
      const allSections = new Set(groupedData.keys());
      setExpandedSections(allSections);
    }
  }, [groupedData, expandedSections.size]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const sortedSections = useMemo(() => {
    return Array.from(groupedData.keys()).sort();
  }, [groupedData]);

  const handleSectionClick = (section: string) => {
    onSectionSelect(section);
    if (!expandedSections.has(section)) {
      toggleSection(section);
    }
  };

  return (
    <div className="w-full border-b md:border-b-0 md:border-r bg-sidebar text-sidebar-foreground flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {sortedSections.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No sections found
          </div>
        ) : (
          <div className="p-2">
            {sortedSections.map((section) => {
              const itemsMap = groupedData.get(section);
              const items = itemsMap ? Array.from(itemsMap.keys()).sort() : [];
              const isExpanded = expandedSections.has(section);
              const isSelected = selectedSection === section;

              return (
                <div key={section}>
                  <button
                    onClick={() => handleSectionClick(section)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                      isSelected && !selectedItem && "bg-accent text-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSection(section);
                        }}
                        className="p-0.5 hover:bg-muted rounded cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                      <span className="truncate">{section || "(No Section)"}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        ({items.length})
                      </span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="ml-6 mt-1">
                      {items.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground">No items</div>
                      ) : (
                        items.map((item) => {
                          const isItemSelected = selectedSection === section && selectedItem === item;
                          return (
                            <button
                              key={item}
                              onClick={() => onItemSelect(section, item)}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                                isItemSelected && "bg-accent text-accent-foreground"
                              )}
                            >
                              <span className="truncate">{item || "(No Item)"}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
