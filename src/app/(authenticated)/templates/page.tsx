"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  GripVertical,
  Loader2,
  PlusCircle,
  Pencil,
  Settings,
  Trash2,
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
import { useTemplatesQuery, useCreateTemplateMutation, useReorderTemplatesMutation, useDeleteTemplateMutation } from "@/components/api/queries/templates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TemplateSettingsModal } from "./_components/TemplateSettingsModal";
import { LocationModal } from "./_components/LocationModal";
import { RestoreModal } from "./_components/RestoreModal";

interface Template {
  _id: string;
  name: string;
  company: string;
  createdBy: string;
  orderIndex?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [settingsPopoverOpen, setSettingsPopoverOpen] = useState(false);
  const [templateSettingsModalOpen, setTemplateSettingsModalOpen] = useState(false);
  const [selectedTemplateIdForSettings, setSelectedTemplateIdForSettings] = useState<string | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);

  const { data, isLoading, error } = useTemplatesQuery();
  const createTemplateMutation = useCreateTemplateMutation();
  const reorderTemplatesMutation = useReorderTemplatesMutation();
  const deleteTemplateMutation = useDeleteTemplateMutation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    if (data?.data?.templates) {
      const normalized: Template[] = Array.isArray(data.data.templates)
        ? data.data.templates.map((template: Template, index: number) => ({
            ...template,
            orderIndex:
              typeof template.orderIndex === "number" && Number.isFinite(template.orderIndex)
                ? template.orderIndex
                : index + 1,
          }))
        : [];
      setTemplates(normalized);
    }
  }, [data]);

  const orderedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => {
      const aOrder = Number.isFinite(a.orderIndex) ? (a.orderIndex as number) : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(b.orderIndex) ? (b.orderIndex as number) : Number.MAX_SAFE_INTEGER;

      if (aOrder === bOrder) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      return aOrder - bOrder;
    });
  }, [templates]);

  const noTemplates = useMemo(
    () => !isLoading && orderedTemplates.length === 0,
    [isLoading, orderedTemplates.length]
  );

  const commitReorder = useCallback(
    async (nextTemplates: Template[]) => {
      try {
        const payload = nextTemplates.map((template, index) => ({
          id: template._id,
          order: index + 1,
        }));

        await reorderTemplatesMutation.mutateAsync({ templates: payload });
      } catch (error: any) {
        console.error("Error reordering templates:", error);
        // Error is already handled by the mutation's onError callback
      }
    },
    [reorderTemplatesMutation]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (reorderTemplatesMutation.isPending || isLoading) {
        return;
      }

      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = orderedTemplates.findIndex((template) => template._id === active.id);
      const newIndex = orderedTemplates.findIndex((template) => template._id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(orderedTemplates, oldIndex, newIndex).map((template, index) => ({
        ...template,
        orderIndex: index + 1,
      }));

      setTemplates(reordered);
      void commitReorder(reordered);
    },
    [orderedTemplates, commitReorder, reorderTemplatesMutation.isPending, isLoading]
  );

  const reorderDisabled = reorderTemplatesMutation.isPending || isLoading || orderedTemplates.length <= 1;

  const openDeleteDialog = (template: Template) => {
    if (reorderTemplatesMutation.isPending) {
      return;
    }
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      await deleteTemplateMutation.mutateAsync(templateToDelete._id);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch (error: any) {
      console.error("Delete template error:", error);
      // Error is already handled by the mutation's onError callback
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      return;
    }

    try {
      const response = await createTemplateMutation.mutateAsync(templateName.trim());
      setCreateDialogOpen(false);
      setTemplateName("");
      router.push(`/templates/${response.data.template._id}`);
    } catch (error) {
      // Error is already handled by the mutation's onError callback
      console.error("Create template error:", error);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-muted-foreground">
            Manage your inspection templates.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Template
          </Button>
          <Popover open={settingsPopoverOpen} onOpenChange={setSettingsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              <div className="flex flex-col">
                <button
                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setSettingsPopoverOpen(false);
                    setLocationModalOpen(true);
                  }}
                >
                  Location
                </button>
                <button
                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setSettingsPopoverOpen(false);
                    setRestoreModalOpen(true);
                  }}
                >
                  Restore
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Failed to load templates"}
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading templates...
          </CardContent>
        </Card>
      ) : noTemplates ? (
        <Card>
          <CardContent className="space-y-4 p-10 text-center text-muted-foreground">
            <p>No templates found yet.</p>
            <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
              Create your first template
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
                  <th className="px-4 py-3">Template Name</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3">Updated At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <SortableContext
                items={orderedTemplates.map((template) => template._id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody className="divide-y divide-muted">
                  {orderedTemplates.map((template) => (
                    <SortableTemplateRow
                      key={template._id}
                      template={template}
                      reorderDisabled={reorderDisabled}
                      reorderBusy={reorderTemplatesMutation.isPending}
                      onNavigate={() => router.push(`/templates/${template._id}`)}
                      onEdit={() => router.push(`/templates/${template._id}`)}
                      onDelete={() => openDeleteDialog(template)}
                      onSettings={() => {
                        setSelectedTemplateIdForSettings(template._id);
                        setTemplateSettingsModalOpen(true);
                      }}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </div>
        </DndContext>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>
              Enter a name for your new template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="Enter template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !createTemplateMutation.isPending && templateName.trim()) {
                    handleCreateTemplate();
                  }
                }}
                disabled={createTemplateMutation.isPending}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setTemplateName("");
              }}
              disabled={createTemplateMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate} disabled={createTemplateMutation.isPending || !templateName.trim()}>
              {createTemplateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{templateToDelete?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setTemplateToDelete(null);
              }}
              disabled={deleteTemplateMutation.isPending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTemplate} disabled={deleteTemplateMutation.isPending}>
              {deleteTemplateMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedTemplateIdForSettings && (
        <TemplateSettingsModal 
          open={templateSettingsModalOpen} 
          onOpenChange={(open) => {
            setTemplateSettingsModalOpen(open);
            if (!open) {
              setSelectedTemplateIdForSettings(null);
            }
          }} 
          templateId={selectedTemplateIdForSettings}
        />
      )}
      <LocationModal open={locationModalOpen} onOpenChange={setLocationModalOpen} />
      <RestoreModal open={restoreModalOpen} onOpenChange={setRestoreModalOpen} />
    </div>
  );
}

interface SortableTemplateRowProps {
  template: Template;
  reorderDisabled: boolean;
  reorderBusy: boolean;
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSettings: () => void;
}

function SortableTemplateRow({
  template,
  reorderDisabled,
  reorderBusy,
  onNavigate,
  onEdit,
  onDelete,
  onSettings,
}: SortableTemplateRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: template._id,
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
      className={`hover:bg-muted/30 ${isDragging ? "opacity-60" : ""} ${!reorderDisabled ? "cursor-pointer" : ""}`}
      onClick={!reorderDisabled ? onNavigate : undefined}
      data-template-id={template._id}
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
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="px-4 py-3 align-top">
        <span className="font-medium text-foreground">{template.name}</span>
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">
        {new Date(template.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">
        {new Date(template.updatedAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 align-top text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onSettings();
            }}
            title="Template settings"
            disabled={reorderBusy}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Edit template"
            disabled={reorderBusy}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete template"
            disabled={reorderBusy}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
