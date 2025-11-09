"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ClipboardCopy, FileEdit, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

type SampleReport = {
  _id: string;
  title: string;
  url: string;
  order: number;
  description?: string;
  inspectionId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function SampleReportPage() {
  const [reports, setReports] = useState<SampleReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reorderBusy, setReorderBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<SampleReport | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SampleReport | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const editForm = useForm<{ title: string; description: string }>({
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const orderedReports = useMemo(
    () =>
      [...reports].sort((a, b) => {
        if (a.order === b.order) {
          return (a.createdAt || "").localeCompare(b.createdAt || "");
        }
        return a.order - b.order;
      }),
    [reports]
  );

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/sample-reports", { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to load sample reports");
      }

      const json = await res.json();
      setReports(Array.isArray(json.sampleReports) ? json.sampleReports : []);
    } catch (err: any) {
      console.error("Error fetching sample reports:", err);
      setError(err.message || "Failed to load sample reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const commitReorder = useCallback(
    async (nextReports: SampleReport[]) => {
      setReorderBusy(true);
      setError(null);

      try {
        const payload = nextReports.map((report, index) => ({
          id: report._id,
          order: index + 1,
        }));

        const res = await fetch("/api/sample-reports/reorder", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reports: payload }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "Failed to reorder sample reports");
        }
      } catch (err: any) {
        console.error("Error reordering sample reports:", err);
        setError(err.message || "Failed to reorder sample reports");
        await fetchReports(); // fallback refresh
      } finally {
        setReorderBusy(false);
      }
    },
    [fetchReports]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (reorderBusy) {
        return;
      }
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = orderedReports.findIndex((report) => report._id === active.id);
      const newIndex = orderedReports.findIndex((report) => report._id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(orderedReports, oldIndex, newIndex).map((report, index) => ({
        ...report,
        order: index + 1,
      }));

      setReports(reordered);
      commitReorder(reordered);
    },
    [orderedReports, commitReorder, reorderBusy]
  );

  const handleDeleteRequest = (report: SampleReport) => {
    setPendingDelete(report);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      setDeleteSaving(true);
      setDeleteError(null);
      setDeletingId(pendingDelete._id);

      const res = await fetch(`/api/sample-reports/${pendingDelete._id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to delete sample report");
      }

      await fetchReports();
      setPendingDelete(null);
    } catch (err: any) {
      console.error("Error deleting sample report:", err);
      setDeleteError(err.message || "Failed to delete sample report");
    } finally {
      setDeleteSaving(false);
      setDeletingId(null);
    }
  };

  const handleCloseDeleteDialog = () => {
    if (deleteSaving) return;
    setPendingDelete(null);
    setDeleteError(null);
  };

  const handleOpenEdit = (report: SampleReport) => {
    setEditingReport(report);
    editForm.reset({
      title: report.title ?? "",
      description: report.description ?? "",
    });
    setEditError(null);
  };

  const handleCloseEdit = () => {
    if (editSaving) return;
    setEditingReport(null);
    editForm.reset({
      title: "",
      description: "",
    });
    setEditError(null);
  };

  const handleSaveEdit = editForm.handleSubmit(async (values) => {
    if (!editingReport?._id) return;
    const title = values.title.trim();
    const description = values.description.trim();

    if (!title) {
      editForm.setError("title", { type: "required", message: "Title is required." });
      return;
    }

    try {
      setEditSaving(true);
      setEditError(null);

      const res = await fetch(`/api/sample-reports/${editingReport._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to update sample report");
      }

      const json = await res.json();
      const updated = json.sampleReport as SampleReport | undefined;
      if (updated) {
        setReports((prev) =>
          prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r))
        );
      } else {
        await fetchReports();
      }
      handleCloseEdit();
    } catch (err: any) {
      console.error("Error updating sample report:", err);
      setEditError(err.message || "Failed to update sample report");
    } finally {
      setEditSaving(false);
    }
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Sample Reports</h1>
        <p className="text-muted-foreground">
          Review and manage the sample report links already curated for your company. Reorder, update
          details, or remove entries as needed.
        </p>
      </header>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">Something went wrong</CardTitle>
          </CardHeader>
          <CardFooter>
            <p className="text-sm text-destructive">{error}</p>
          </CardFooter>
        </Card>
      )}

      <Separator />

      <section aria-label="Sample report list" className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">Your Sample Reports</h2>
        </div>

        {loading ? (
          <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
            Loading sample reports…
          </div>
        ) : orderedReports.length === 0 ? (
          <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
            No sample reports found. Ask an administrator to provide sample links for your company.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedReports.map((report) => report._id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {orderedReports.map((report) => (
                  <SortableReportCard
                    key={report._id}
                    report={report}
                    onEdit={handleOpenEdit}
                    onDelete={handleDeleteRequest}
                    deletingId={deletingId}
                    reorderBusy={reorderBusy}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <Dialog open={Boolean(editingReport)} onOpenChange={(open) => !open && handleCloseEdit()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Sample Report</DialogTitle>
            <DialogDescription>
              Update the name or description. The link stays the same.
            </DialogDescription>
          </DialogHeader>
          <form id="edit-sample-report-form" className="space-y-4" onSubmit={handleSaveEdit}>
            <div className="space-y-2">
              <Label htmlFor="edit-sample-title">Title</Label>
              <Input
                id="edit-sample-title"
                {...editForm.register("title", { required: "Title is required." })}
                required
                autoFocus
              />
              {editForm.formState.errors.title && (
                <p className="text-sm text-destructive">{editForm.formState.errors.title.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sample-description">Description</Label>
              <Textarea
                id="edit-sample-description"
                {...editForm.register("description")}
                rows={4}
              />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseEdit}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-sample-report-form"
              disabled={editSaving}
            >
              {editSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={handleCloseDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sample report?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The sample report will be permanently removed from your
              company.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSaving ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type SortableReportCardProps = {
  report: SampleReport;
  onEdit: (report: SampleReport) => void;
  onDelete: (report: SampleReport) => void;
  deletingId: string | null;
  reorderBusy: boolean;
};

function SortableReportCard({
  report,
  onEdit,
  onDelete,
  deletingId,
  reorderBusy,
}: SortableReportCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: report._id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDeleting = deletingId === report._id;

  const handleCopyUrl = () => {
    if (!report.url) return;
    navigator.clipboard
      .writeText(report.url)
      .catch((err) => console.error("Failed to copy sample report URL:", err));
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col ${isDragging ? "z-50" : ""}`}
    >
      <Card
        className={`flex h-full flex-col justify-between ${
          isDragging ? "shadow-xl ring-2 ring-primary" : ""
        }`}
      >
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl">{report.title}</CardTitle>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
              aria-label="Drag to reorder"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
          {report.description && (
            <p className="text-sm text-muted-foreground">{report.description}</p>
          )}
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary"
                title="View report"
                disabled={reorderBusy}
              >
                <Link href={report.url} target="_blank" rel="noopener noreferrer">
                  <span className="sr-only">View report</span>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary"
                onClick={handleCopyUrl}
                title="Copy URL"
                disabled={reorderBusy}
              >
                <span className="sr-only">Copy URL</span>
                <ClipboardCopy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary"
                onClick={() => onEdit(report)}
                title="Edit"
                disabled={reorderBusy}
              >
                <span className="sr-only">Edit</span>
                <FileEdit className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive"
              disabled={isDeleting || reorderBusy}
              onClick={() => onDelete(report)}
              title="Delete"
            >
              <span className="sr-only">Delete</span>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}


