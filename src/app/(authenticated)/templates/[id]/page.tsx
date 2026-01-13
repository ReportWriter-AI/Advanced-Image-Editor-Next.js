"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  AlertCircle,
  GripVertical,
  Loader2,
  PlusCircle,
  Edit2,
  Trash2,
  List,
} from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useTemplateSectionsQuery,
  useCreateTemplateSectionMutation,
  useUpdateTemplateSectionMutation,
  useDeleteTemplateSectionMutation,
  useReorderTemplateSectionsMutation,
  TemplateSection,
} from "@/components/api/queries/templateSections";
import { TemplateSectionForm } from "./_components/TemplateSectionForm";
import { SubsectionsModal } from "./_components/SubsectionsModal";

export default function TemplatePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<TemplateSection | null>(null);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [subsectionsModalOpen, setSubsectionsModalOpen] = useState(false);
  const [selectedSectionForSubsections, setSelectedSectionForSubsections] = useState<TemplateSection | null>(null);

  const { data, isLoading, error } = useTemplateSectionsQuery(templateId);
  const createSectionMutation = useCreateTemplateSectionMutation(templateId);
  const updateSectionMutation = useUpdateTemplateSectionMutation(templateId);
  const deleteSectionMutation = useDeleteTemplateSectionMutation(templateId);
  const reorderSectionsMutation = useReorderTemplateSectionsMutation(templateId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    if (data?.data?.sections) {
      const sectionsArray = Array.isArray(data.data.sections) ? data.data.sections : [];
      setSections(sectionsArray);
    }
  }, [data]);

  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [sections]);

  const commitReorder = useCallback(
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
        // Error is already handled by the mutation's onError callback
      }
    },
    [reorderSectionsMutation]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (reorderSectionsMutation.isPending || isLoading || editingSection || deletingSectionId) {
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
      void commitReorder(reordered);
    },
    [sortedSections, commitReorder, reorderSectionsMutation.isPending, isLoading, editingSection, deletingSectionId]
  );

  const reorderDisabled =
    reorderSectionsMutation.isPending || isLoading || !!editingSection || !!deletingSectionId || sortedSections.length <= 1;

  const handleCreateSection = async (values: any) => {
    try {
      await createSectionMutation.mutateAsync(values);
      setCreateDialogOpen(false);
    } catch (error) {
      console.error("Create section error:", error);
    }
  };

  const handleUpdateSection = async (values: any) => {
    if (!editingSection?._id) return;

    try {
      await updateSectionMutation.mutateAsync({
        sectionId: editingSection._id,
        sectionData: {
          ...values,
          orderIndex: editingSection.orderIndex,
        },
      });
      setEditingSection(null);
    } catch (error) {
      console.error("Update section error:", error);
    }
  };

  const handleDeleteSection = async () => {
    if (!deletingSectionId) return;

    try {
      await deleteSectionMutation.mutateAsync(deletingSectionId);
      setDeletingSectionId(null);
    } catch (error) {
      console.error("Delete section error:", error);
    }
  };

  const renderIcon = (iconName?: string) => {
    const iconToUse = iconName || 'Home';
    const IconComponent = (LucideIcons as any)[iconToUse];
    if (!IconComponent) return null;
    return <IconComponent className="h-5 w-5" />;
  };

  const handleOpenSubsections = (section: TemplateSection) => {
    setSelectedSectionForSubsections(section);
    setSubsectionsModalOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Template Sections</h1>
          <p className="text-muted-foreground">
            Manage sections for this template.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Section
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Failed to load sections"}
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading sections...
          </CardContent>
        </Card>
      ) : sortedSections.length === 0 ? (
        <Card>
          <CardContent className="space-y-4 p-10 text-center text-muted-foreground">
            <p>No sections found yet.</p>
            <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
              Create your first section
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-muted border-collapse text-sm">
              <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-12 px-4 py-3 text-center">Order</th>
                  <th className="px-4 py-3">Icon</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <SortableContext
                items={sortedSections.map((section) => section._id || "")}
                strategy={verticalListSortingStrategy}
              >
                <tbody className="divide-y divide-muted">
                  {sortedSections.map((section) => (
                    <SortableSectionRow
                      key={section._id}
                      section={section}
                      reorderDisabled={reorderDisabled}
                      reorderBusy={reorderSectionsMutation.isPending}
                      onEdit={() => setEditingSection(section)}
                      onDelete={() => setDeletingSectionId(section._id || null)}
                      onViewSubsections={() => handleOpenSubsections(section)}
                      renderIcon={renderIcon}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </div>
        </DndContext>
      )}

      <TemplateSectionForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateSection}
        isSubmitting={createSectionMutation.isPending}
      />

      <TemplateSectionForm
        open={!!editingSection}
        onOpenChange={(open) => !open && setEditingSection(null)}
        onSubmit={handleUpdateSection}
        initialValues={editingSection}
        isSubmitting={updateSectionMutation.isPending}
      />

      <AlertDialog
        open={!!deletingSectionId}
        onOpenChange={(open) => !open && setDeletingSectionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this section? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSectionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSection}
              disabled={deleteSectionMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSectionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedSectionForSubsections && (
        <SubsectionsModal
          open={subsectionsModalOpen}
          onOpenChange={setSubsectionsModalOpen}
          templateId={templateId}
          sectionId={selectedSectionForSubsections._id || ""}
          sectionName={selectedSectionForSubsections.name}
        />
      )}
    </div>
  );
}

interface SortableSectionRowProps {
  section: TemplateSection;
  reorderDisabled: boolean;
  reorderBusy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onViewSubsections: () => void;
  renderIcon: (iconName?: string) => React.ReactNode;
}

function SortableSectionRow({
  section,
  reorderDisabled,
  reorderBusy,
  onEdit,
  onDelete,
  onViewSubsections,
  renderIcon,
}: SortableSectionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section._id || "",
    disabled: reorderDisabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-muted/30 ${isDragging ? "opacity-60" : ""}`}
      data-section-id={section._id}
    >
      <td className="w-12 px-4 py-3 align-top">
        <button
          type="button"
          className={`flex h-8 w-8 items-center justify-center rounded border ${
            reorderDisabled ? "cursor-not-allowed opacity-40" : "cursor-grab hover:bg-muted"
          }`}
          aria-label="Drag to reorder"
          disabled={reorderDisabled}
          {...attributes}
          {...(!reorderDisabled ? listeners : {})}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="px-4 py-3 align-top">
        {renderIcon(section.sectionIcon) || (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <span className="font-medium text-foreground">{section.name}</span>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-2">
          {section.excludeFromSummaryView && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              Excluded from Summary
            </span>
          )}
          {section.includeInEveryReport && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              In Every Report
            </span>
          )}
          {section.startSectionOnNewPage && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              New Page (PDF)
            </span>
          )}
          {!section.excludeFromSummaryView &&
            !section.includeInEveryReport &&
            !section.startSectionOnNewPage && (
              <span className="text-muted-foreground text-xs">—</span>
            )}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">
        {section.orderIndex ?? 0}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onViewSubsections}
            disabled={reorderBusy}
            title="View subsections"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onEdit}
            disabled={reorderBusy}
            title="Edit section"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onDelete}
            disabled={reorderBusy}
            title="Delete section"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
