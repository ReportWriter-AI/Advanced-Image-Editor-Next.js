"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronRight, ChevronDown, GripVertical, Loader2, PlusCircle, Edit2, Trash2, RotateCcw } from "lucide-react";
import * as LucideIcons from "lucide-react";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  useTemplateSectionsQuery,
  useReorderTemplateSectionsMutation,
  TemplateSection,
} from "@/components/api/queries/templateSections";
import {
  useTemplateSubsectionsQuery,
  useReorderTemplateSubsectionsMutation,
  TemplateSubsection,
} from "@/components/api/queries/templateSubsections";
import { cn } from "@/lib/utils";

interface TemplateSidebarProps {
  templateId: string;
  selectedSectionId: string | null;
  selectedSubsectionId: string | null;
  onSectionSelect: (sectionId: string | null) => void;
  onSubsectionSelect: (sectionId: string, subsectionId: string) => void;
  onSectionEdit: (section: TemplateSection) => void;
  onSectionDelete: (sectionId: string) => void;
  onSubsectionEdit: (section: TemplateSection, subsection: TemplateSubsection) => void;
  onSubsectionDelete: (section: TemplateSection, subsectionId: string) => void;
  onAddSubsection: (section: TemplateSection) => void;
  onSectionRestoreClick: (sectionId: string) => void;
  reorderSectionsDisabled: boolean;
  reorderSubsectionsDisabled: (sectionId: string) => boolean;
}

export function TemplateSidebar({
  templateId,
  selectedSectionId,
  selectedSubsectionId,
  onSectionSelect,
  onSubsectionSelect,
  onSectionEdit,
  onSectionDelete,
  onSubsectionEdit,
  onSubsectionDelete,
  onAddSubsection,
  onSectionRestoreClick,
  reorderSectionsDisabled,
  reorderSubsectionsDisabled,
}: TemplateSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [subsectionsMap, setSubsectionsMap] = useState<Map<string, TemplateSubsection[]>>(new Map());

  const { data: sectionsData, isLoading: sectionsLoading } = useTemplateSectionsQuery(templateId);
  const reorderSectionsMutation = useReorderTemplateSectionsMutation(templateId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Load sections
  useEffect(() => {
    if (sectionsData?.data?.sections) {
      const sectionsArray = Array.isArray(sectionsData.data.sections) ? sectionsData.data.sections : [];
      setSections(sectionsArray);
      // Expand all sections by default
      const allSectionIds = new Set<string>(
        sectionsArray
          .map((section: TemplateSection) => section._id)
          .filter((id: string | undefined): id is string => !!id)
      );
      setExpandedSections(prev => {
        // Only update if the sections have changed (merge new IDs with existing expanded state)
        if (allSectionIds.size === 0) return prev;
        // If prev is empty, initialize with all sections, otherwise merge
        if (prev.size === 0) {
          return allSectionIds;
        }
        // Merge: keep existing expanded sections, add new ones
        const merged = new Set<string>(prev);
        allSectionIds.forEach((id: string) => merged.add(id));
        return merged;
      });
    }
  }, [sectionsData]);

  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [sections]);

  // Auto-expand section if it's selected
  useEffect(() => {
    if (selectedSectionId) {
      setExpandedSections(prev => {
        if (prev.has(selectedSectionId)) return prev;
        return new Set(prev).add(selectedSectionId);
      });
    }
  }, [selectedSectionId]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const commitSectionReorder = useCallback(
    async (nextSections: TemplateSection[]) => {
      try {
        const payload = nextSections
          .filter((section) => section._id)
          .map((section, index) => ({
            id: section._id!,
            order: index + 1,
          }));

        await reorderSectionsMutation.mutateAsync({ sections: payload });
      } catch (error: any) {
        console.error("Error reordering sections:", error);
      }
    },
    [reorderSectionsMutation]
  );

  const handleSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (reorderSectionsMutation.isPending || sectionsLoading) {
        return;
      }

      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = sortedSections.findIndex((section) => section._id === active.id);
      const newIndex = sortedSections.findIndex((section) => section._id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(sortedSections, oldIndex, newIndex).map((section, index) => ({
        ...section,
        orderIndex: index + 1,
      }));

      setSections(reordered);
      void commitSectionReorder(reordered);
    },
    [sortedSections, commitSectionReorder, reorderSectionsMutation.isPending, sectionsLoading]
  );

  const handleSubsectionsLoaded = useCallback((sectionId: string, subsections: TemplateSubsection[]) => {
    setSubsectionsMap(prev => {
      const next = new Map(prev);
      const existing = next.get(sectionId) || [];
      // Only update if subsections actually changed
      if (existing.length !== subsections.length || 
          existing.some((s, i) => s._id !== subsections[i]?._id)) {
        next.set(sectionId, subsections);
        return next;
      }
      return prev;
    });
  }, []);

  const renderIcon = (iconName?: string) => {
    const iconToUse = iconName || 'Home';
    const IconComponent = (LucideIcons as any)[iconToUse];
    if (!IconComponent) return null;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <div className="w-full border-b md:border-b-0 md:border-r bg-sidebar text-sidebar-foreground flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {sectionsLoading ? (
          <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading sections...</span>
          </div>
        ) : sortedSections.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No sections found
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <div className="p-2">
              <SortableContext
                items={sortedSections.map((section) => section._id || "")}
                strategy={verticalListSortingStrategy}
              >
                {sortedSections.map((section) => (
                  <SectionItem
                    key={section._id}
                    section={section}
                    templateId={templateId}
                    isExpanded={expandedSections.has(section._id || "")}
                    isSelected={selectedSectionId === section._id}
                    selectedSubsectionId={selectedSubsectionId}
                    subsections={subsectionsMap.get(section._id || "") || []}
                    onToggle={() => toggleSection(section._id || "")}
                    onSelect={() => onSectionSelect(section._id || null)}
                    onSubsectionSelect={(subsectionId) => onSubsectionSelect(section._id || "", subsectionId)}
                    onEdit={() => onSectionEdit(section)}
                    onDelete={() => onSectionDelete(section._id || "")}
                    onSubsectionEdit={(subsection) => onSubsectionEdit(section, subsection)}
                    onSubsectionDelete={(subsectionId) => onSubsectionDelete(section, subsectionId)}
                    onAddSubsection={() => onAddSubsection(section)}
                    onSectionRestoreClick={() => onSectionRestoreClick(section._id || "")}
                    onSubsectionsLoaded={(subsections) => handleSubsectionsLoaded(section._id || "", subsections)}
                    reorderDisabled={reorderSectionsDisabled}
                    reorderSubsectionsDisabled={reorderSubsectionsDisabled(section._id || "")}
                    renderIcon={renderIcon}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}

interface SectionItemProps {
  section: TemplateSection;
  templateId: string;
  isExpanded: boolean;
  isSelected: boolean;
  selectedSubsectionId: string | null;
  subsections: TemplateSubsection[];
  onToggle: () => void;
  onSelect: () => void;
  onSubsectionSelect: (subsectionId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSubsectionEdit: (subsection: TemplateSubsection) => void;
  onSubsectionDelete: (subsectionId: string) => void;
  onAddSubsection: () => void;
  onSectionRestoreClick: () => void;
  onSubsectionsLoaded: (subsections: TemplateSubsection[]) => void;
  reorderDisabled: boolean;
  reorderSubsectionsDisabled: boolean;
  renderIcon: (iconName?: string) => React.ReactNode;
}

function SectionItem({
  section,
  templateId,
  isExpanded,
  isSelected,
  selectedSubsectionId,
  subsections,
  onToggle,
  onSelect,
  onSubsectionSelect,
  onEdit,
  onDelete,
  onSubsectionEdit,
  onSubsectionDelete,
  onAddSubsection,
  onSectionRestoreClick,
  onSubsectionsLoaded,
  reorderDisabled,
  reorderSubsectionsDisabled,
  renderIcon,
}: SectionItemProps) {
  const { attributes: sortableAttributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section._id || "",
    disabled: reorderDisabled,
  });

  // Extract conflicting props and override with our own
  const { role, tabIndex, ...attributes } = sortableAttributes;

  const { data: subsectionsData, isLoading: subsectionsLoading } = useTemplateSubsectionsQuery(
    templateId,
    section._id || ""
  );

  const reorderSubsectionsMutation = useReorderTemplateSubsectionsMutation(templateId, section._id || "");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const prevSubsectionsRef = useRef<TemplateSubsection[]>([]);

  // Load subsections when expanded
  useEffect(() => {
    if (isExpanded && subsectionsData?.data?.subsections) {
      const subsectionsArray = Array.isArray(subsectionsData.data.subsections) 
        ? subsectionsData.data.subsections 
        : [];
      
      // Only update if subsections changed
      const prev = prevSubsectionsRef.current;
      if (prev.length !== subsectionsArray.length || 
          prev.some((s, i) => s._id !== subsectionsArray[i]?._id)) {
        prevSubsectionsRef.current = subsectionsArray;
        onSubsectionsLoaded(subsectionsArray);
      }
    }
  }, [isExpanded, subsectionsData, onSubsectionsLoaded]);

  const sortedSubsections = useMemo(() => {
    return [...subsections].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [subsections]);

  const commitSubsectionReorder = useCallback(
    async (nextSubsections: TemplateSubsection[]) => {
      try {
        const payload = nextSubsections
          .filter((subsection) => subsection._id)
          .map((subsection, index) => ({
            id: subsection._id!,
            order: index + 1,
          }));

        await reorderSubsectionsMutation.mutateAsync({ subsections: payload });
      } catch (error: any) {
        console.error("Error reordering subsections:", error);
      }
    },
    [reorderSubsectionsMutation]
  );

  const handleSubsectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (reorderSubsectionsMutation.isPending || subsectionsLoading || reorderSubsectionsDisabled) {
        return;
      }

      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = sortedSubsections.findIndex((subsection) => subsection._id === active.id);
      const newIndex = sortedSubsections.findIndex((subsection) => subsection._id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(sortedSubsections, oldIndex, newIndex).map((subsection, index) => ({
        ...subsection,
        orderIndex: index + 1,
      }));

      onSubsectionsLoaded(reordered);
      void commitSubsectionReorder(reordered);
    },
    [sortedSubsections, commitSubsectionReorder, reorderSubsectionsMutation.isPending, subsectionsLoading, reorderSubsectionsDisabled, onSubsectionsLoaded]
  );

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      return;
    }
    onSelect();
    if (!isExpanded) {
      onToggle();
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50")}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              isSelected && !selectedSubsectionId && "bg-accent text-accent-foreground"
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                {...attributes}
                role="button"
                tabIndex={reorderDisabled ? -1 : 0}
                aria-disabled={reorderDisabled}
                className={cn(
                  "drag-handle flex items-center justify-center p-1 rounded hover:bg-muted cursor-grab active:cursor-grabbing",
                  reorderDisabled && "cursor-not-allowed opacity-40"
                )}
                {...(!reorderDisabled ? listeners : {})}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-3 w-3" />
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className="p-0.5 hover:bg-muted rounded cursor-pointer"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
              {renderIcon(section.sectionIcon)}
              <span className="truncate">{section.name}</span>
            </div>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onEdit}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Section
          </ContextMenuItem>
          <ContextMenuItem onClick={onAddSubsection}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Subsection
          </ContextMenuItem>
          <ContextMenuItem onClick={onSectionRestoreClick}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restore Subsections
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Section
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {isExpanded && (
        <div className="ml-6 mt-1">
          {subsectionsLoading ? (
            <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading subsections...</span>
            </div>
          ) : sortedSubsections.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">No subsections</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubsectionDragEnd}>
              <SortableContext
                items={sortedSubsections.map((subsection) => subsection._id || "")}
                strategy={verticalListSortingStrategy}
              >
                {sortedSubsections.map((subsection) => (
                  <SubsectionItem
                    key={subsection._id}
                    subsection={subsection}
                    isSelected={selectedSubsectionId === subsection._id}
                    onSelect={() => onSubsectionSelect(subsection._id || "")}
                    onEdit={() => onSubsectionEdit(subsection)}
                    onDelete={() => onSubsectionDelete(subsection._id || "")}
                    reorderDisabled={reorderSubsectionsDisabled}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}

interface SubsectionItemProps {
  subsection: TemplateSubsection;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  reorderDisabled: boolean;
}

function SubsectionItem({
  subsection,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  reorderDisabled,
}: SubsectionItemProps) {
  const { attributes: sortableAttributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subsection._id || "",
    disabled: reorderDisabled,
  });

  // Extract conflicting props and override with our own
  const { role, tabIndex, ...attributes } = sortableAttributes;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50")}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={onSelect}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              isSelected && "bg-accent text-accent-foreground"
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                {...attributes}
                role="button"
                tabIndex={reorderDisabled ? -1 : 0}
                aria-disabled={reorderDisabled}
                className={cn(
                  "drag-handle flex items-center justify-center p-1 rounded hover:bg-muted cursor-grab active:cursor-grabbing",
                  reorderDisabled && "cursor-not-allowed opacity-40"
                )}
                {...(!reorderDisabled ? listeners : {})}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-3 w-3" />
              </div>
              <span className="truncate">{subsection.name}</span>
            </div>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onEdit}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Subsection
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Subsection
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
