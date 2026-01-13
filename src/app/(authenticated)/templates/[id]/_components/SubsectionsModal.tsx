"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
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
  CheckSquare,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useTemplateSubsectionsQuery,
  useCreateTemplateSubsectionMutation,
  useUpdateTemplateSubsectionMutation,
  useDeleteTemplateSubsectionMutation,
  useReorderTemplateSubsectionsMutation,
  TemplateSubsection,
} from "@/components/api/queries/templateSubsections";
import { TemplateSubsectionForm } from "./TemplateSubsectionForm";
import { ChecklistModal } from "./ChecklistModal";

interface SubsectionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  sectionId: string;
  sectionName: string;
}

export function SubsectionsModal({
  open,
  onOpenChange,
  templateId,
  sectionId,
  sectionName,
}: SubsectionsModalProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingSubsection, setEditingSubsection] = useState<TemplateSubsection | null>(null);
  const [deletingSubsectionId, setDeletingSubsectionId] = useState<string | null>(null);
  const [subsections, setSubsections] = useState<TemplateSubsection[]>([]);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [selectedSubsectionForChecklist, setSelectedSubsectionForChecklist] = useState<TemplateSubsection | null>(null);

  const { data, isLoading, error } = useTemplateSubsectionsQuery(templateId, sectionId);
  const createSubsectionMutation = useCreateTemplateSubsectionMutation(templateId, sectionId);
  const updateSubsectionMutation = useUpdateTemplateSubsectionMutation(templateId, sectionId);
  const deleteSubsectionMutation = useDeleteTemplateSubsectionMutation(templateId, sectionId);
  const reorderSubsectionsMutation = useReorderTemplateSubsectionsMutation(templateId, sectionId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    if (data?.data?.subsections) {
      const subsectionsArray = Array.isArray(data.data.subsections) ? data.data.subsections : [];
      setSubsections(subsectionsArray);
    }
  }, [data]);

  const sortedSubsections = useMemo(() => {
    return [...subsections].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [subsections]);

  const commitReorder = useCallback(
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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (reorderSubsectionsMutation.isPending || isLoading || editingSubsection || deletingSubsectionId) {
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

      setSubsections(reordered);
      void commitReorder(reordered);
    },
    [sortedSubsections, commitReorder, reorderSubsectionsMutation.isPending, isLoading, editingSubsection, deletingSubsectionId]
  );

  const reorderDisabled =
    reorderSubsectionsMutation.isPending || isLoading || !!editingSubsection || !!deletingSubsectionId || sortedSubsections.length <= 1;

  const handleCreateSubsection = async (values: any) => {
    try {
      await createSubsectionMutation.mutateAsync(values);
      setCreateDialogOpen(false);
    } catch (error) {
      console.error("Create subsection error:", error);
    }
  };

  const handleUpdateSubsection = async (values: any) => {
    if (!editingSubsection?._id) return;

    try {
      await updateSubsectionMutation.mutateAsync({
        subsectionId: editingSubsection._id,
        subsectionData: {
          ...values,
          orderIndex: editingSubsection.orderIndex,
        },
      });
      setEditingSubsection(null);
    } catch (error) {
      console.error("Update subsection error:", error);
    }
  };

  const handleDeleteSubsection = async () => {
    if (!deletingSubsectionId) return;

    try {
      await deleteSubsectionMutation.mutateAsync(deletingSubsectionId);
      setDeletingSubsectionId(null);
    } catch (error) {
      console.error("Delete subsection error:", error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subsections - {sectionName}</DialogTitle>
            <DialogDescription>
              Manage subsections for this section.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setCreateDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Subsection
              </Button>
            </div>

            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="flex items-start gap-3 p-4">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm text-muted-foreground">
                    {error instanceof Error ? error.message : "Failed to load subsections"}
                  </p>
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading subsections...
                </CardContent>
              </Card>
            ) : sortedSubsections.length === 0 ? (
              <Card>
                <CardContent className="space-y-4 p-10 text-center text-muted-foreground">
                  <p>No subsections found yet.</p>
                  <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
                    Create your first subsection
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
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Flags</th>
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <SortableContext
                      items={sortedSubsections.map((subsection) => subsection._id || "")}
                      strategy={verticalListSortingStrategy}
                    >
                      <tbody className="divide-y divide-muted">
                        {sortedSubsections.map((subsection) => (
                          <SortableSubsectionRow
                            key={subsection._id}
                            subsection={subsection}
                            reorderDisabled={reorderDisabled}
                            reorderBusy={reorderSubsectionsMutation.isPending}
                            onEdit={() => setEditingSubsection(subsection)}
                            onDelete={() => setDeletingSubsectionId(subsection._id || null)}
                            onViewChecklist={() => {
                              setSelectedSubsectionForChecklist(subsection);
                              setChecklistModalOpen(true);
                            }}
                          />
                        ))}
                      </tbody>
                    </SortableContext>
                  </table>
                </div>
              </DndContext>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <TemplateSubsectionForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateSubsection}
        isSubmitting={createSubsectionMutation.isPending}
      />

      <TemplateSubsectionForm
        open={!!editingSubsection}
        onOpenChange={(open) => !open && setEditingSubsection(null)}
        onSubmit={handleUpdateSubsection}
        initialValues={editingSubsection}
        isSubmitting={updateSubsectionMutation.isPending}
      />

      <AlertDialog
        open={!!deletingSubsectionId}
        onOpenChange={(open) => !open && setDeletingSubsectionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subsection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this subsection? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubsectionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubsection}
              disabled={deleteSubsectionMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubsectionMutation.isPending ? (
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

      {selectedSubsectionForChecklist && (
        <ChecklistModal
          open={checklistModalOpen}
          onOpenChange={setChecklistModalOpen}
          templateId={templateId}
          sectionId={sectionId}
          subsectionId={selectedSubsectionForChecklist._id || ""}
          subsectionName={selectedSubsectionForChecklist.name}
        />
      )}
    </>
  );
}

interface SortableSubsectionRowProps {
  subsection: TemplateSubsection;
  reorderDisabled: boolean;
  reorderBusy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onViewChecklist: () => void;
}

function SortableSubsectionRow({
  subsection,
  reorderDisabled,
  reorderBusy,
  onEdit,
  onDelete,
  onViewChecklist,
}: SortableSubsectionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subsection._id || "",
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
      data-subsection-id={subsection._id}
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
        <span className="font-medium text-foreground">{subsection.name}</span>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-2">
          {subsection.informationalOnly && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              Informational Only
            </span>
          )}
          {subsection.includeInEveryReport && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              In Every Report
            </span>
          )}
          {!subsection.informationalOnly && !subsection.includeInEveryReport && (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">
        {subsection.orderIndex ?? 0}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onViewChecklist}
            disabled={reorderBusy}
            title="Add Checklist"
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onEdit}
            disabled={reorderBusy}
            title="Edit subsection"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onDelete}
            disabled={reorderBusy}
            title="Delete subsection"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
