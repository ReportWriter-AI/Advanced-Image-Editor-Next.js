"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, GripVertical, Loader2, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface InspectionSection {
  _id: string;
  name: string;
  order_index: number;
  checklists: Array<{
    text: string;
    order_index: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

export default function SectionsPage() {
  const router = useRouter();
  const [sections, setSections] = useState<InspectionSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<MessageState>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<InspectionSection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);

  const fetchSections = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/inspection-sections", { credentials: "include" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch sections");
      }
      setSections(Array.isArray(result.sections) ? result.sections : []);
    } catch (error: any) {
      console.error("Error fetching sections:", error);
      setMessage({ type: "error", text: error.message || "Failed to load sections" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const orderedSections = useMemo(
    () => [...sections].sort((a, b) => a.order_index - b.order_index),
    [sections]
  );

  const noSections = useMemo(() => !loading && sections.length === 0, [loading, sections.length]);

  const openDeleteDialog = (section: InspectionSection) => {
    setSectionToDelete(section);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSection = async () => {
    if (!sectionToDelete?._id) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/inspection-sections/${sectionToDelete._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete section");
      }
      toast.success("Section deleted");
      setDeleteDialogOpen(false);
      setSectionToDelete(null);
      fetchSections();
    } catch (error: any) {
      console.error("Delete section error:", error);
      toast.error(error.message || "Failed to delete section");
    } finally {
      setIsDeleting(false);
    }
  };

  const commitReorder = useCallback(
    async (nextSections: InspectionSection[]) => {
      setReorderBusy(true);
      try {
        const payload = nextSections.map((section, index) => ({
          id: section._id,
          order_index: index + 1,
        }));

        const response = await fetch("/api/inspection-sections/reorder", {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sections: payload }),
        });

        if (!response.ok) {
          const json = await response.json().catch(() => ({}));
          throw new Error((json as { error?: string }).error || "Failed to reorder sections");
        }

        toast.success("Section order updated");
      } catch (error: any) {
        console.error("Error reordering sections:", error);
        setMessage({ type: "error", text: error.message || "Failed to reorder sections" });
        await fetchSections();
        toast.error(error.message || "Failed to reorder sections");
      } finally {
        setReorderBusy(false);
      }
    },
    [fetchSections]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (reorderBusy || loading) {
        return;
      }

      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = orderedSections.findIndex((section) => section._id === active.id);
      const newIndex = orderedSections.findIndex((section) => section._id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(orderedSections, oldIndex, newIndex).map((section, index) => ({
        ...section,
        order_index: index + 1,
      }));

      setSections(reordered);
      void commitReorder(reordered);
    },
    [orderedSections, commitReorder, reorderBusy, loading]
  );

  const reorderDisabled = reorderBusy || loading || isDeleting || orderedSections.length <= 1;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inspection Sections</h1>
          <p className="text-muted-foreground">
            Manage your inspection sections and their checklists.
          </p>
        </div>
        <Button onClick={() => router.push("/sections/create")}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Section
        </Button>
      </div>

      {message && (
        <Card
          className={
            message.type === "success"
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }
        >
          <CardContent className="flex items-start gap-3 p-4">
            {message.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <p className="text-sm text-muted-foreground">{message.text}</p>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setMessage(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading sections...
          </CardContent>
        </Card>
      ) : noSections ? (
        <Card>
          <CardContent className="space-y-4 p-10 text-center text-muted-foreground">
            <p>No sections found yet.</p>
            <Button variant="link" onClick={() => router.push("/sections/create")}>
              Create your first section
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Card>
            <CardHeader>
              <CardTitle>Existing Sections</CardTitle>
              <CardDescription>
                Drag sections to reorder them. Changes are saved automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="min-w-full divide-y divide-muted border-collapse text-sm">
                <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center">Order</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Checklists</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <SortableContext
                  items={orderedSections.map((section) => section._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="divide-y divide-muted">
                    {orderedSections.map((section) => (
                      <SortableSectionRow
                        key={section._id}
                        section={section}
                        reorderDisabled={reorderDisabled}
                        reorderBusy={reorderBusy}
                        onEdit={() => router.push(`/sections/${section._id}`)}
                        onDelete={() => openDeleteDialog(section)}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </CardContent>
          </Card>
        </DndContext>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Section</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{sectionToDelete?.name}</span>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSectionToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSection} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SortableSectionRowProps {
  section: InspectionSection;
  reorderDisabled: boolean;
  reorderBusy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableSectionRow({
  section,
  reorderDisabled,
  reorderBusy,
  onEdit,
  onDelete,
}: SortableSectionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section._id,
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
        <span className="font-medium text-foreground">{section.name}</span>
      </td>
      <td className="px-4 py-3 align-top">
        <span className="text-muted-foreground">{section.checklists?.length || 0} items</span>
      </td>
      <td className="px-4 py-3 align-top">
        <span className="text-muted-foreground">
          {format(new Date(section.createdAt), "PP")}
        </span>
      </td>
      <td className="px-4 py-3 text-right align-top">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onEdit}
            title="Edit section"
            disabled={reorderBusy}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={onDelete}
            title="Delete section"
            disabled={reorderBusy}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

