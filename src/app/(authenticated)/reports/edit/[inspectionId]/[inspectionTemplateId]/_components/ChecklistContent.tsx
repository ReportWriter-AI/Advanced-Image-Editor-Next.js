"use client";

import { useMemo, useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  Loader2,
  PlusCircle,
  Edit2,
  Trash2,
  GripVertical,
} from "lucide-react";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useInspectionTemplateChecklistsQuery,
  useCreateInspectionTemplateChecklistMutation,
  useUpdateInspectionTemplateChecklistMutation,
  useDeleteInspectionTemplateChecklistMutation,
  useReorderInspectionTemplateChecklistsMutation,
  useUpdateChecklistAnswerMutation,
  InspectionTemplateChecklist,
} from "@/components/api/queries/inspectionTemplateChecklists";
import { ChecklistItemForm } from "./ChecklistItemForm";
import { ChecklistFieldInput } from "./ChecklistFieldInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CreatableConcatenatedInput } from "@/components/ui/creatable-concatenated-input";
import { useReusableDropdownsQuery } from "@/components/api/queries/reusableDropdowns";
import { cn } from "@/lib/utils";

interface ChecklistContentProps {
  inspectionId: string;
  inspectionTemplateId: string;
  sectionId: string;
  subsectionId: string | null;
  subsectionName?: string;
}

interface SortableChecklistItemProps {
  checklist: InspectionTemplateChecklist;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
  reorderDisabled: boolean;
  onAnswerChange?: (checklistId: string, answerData: Partial<InspectionTemplateChecklist>) => void;
  inspectionId: string;
  inspectionTemplateId: string;
  sectionId: string;
  subsectionId: string;
}

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

function SortableChecklistItem({
  checklist,
  onEdit,
  onDelete,
  disabled,
  reorderDisabled,
  onAnswerChange,
  inspectionId,
  inspectionTemplateId,
  sectionId,
  subsectionId,
}: SortableChecklistItemProps) {
  const { data: dropdownsData } = useReusableDropdownsQuery();

  // Convert API format (Array<{id, value}>) to options format (Array<{value, label}>)
  const locationOptions = useMemo(() => {
    if (!dropdownsData?.data?.location) return [];
    return dropdownsData.data.location.map((item: { id: string; value: string }) => ({
      value: item.value,
      label: item.value,
    }));
  }, [dropdownsData]);

  const [locationValue, setLocationValue] = useState(checklist.location || "");
  const [commentValue, setCommentValue] = useState(checklist.comment || "");

  const prevLocationRef = useRef<string | undefined>(checklist.location);
  const prevCommentRef = useRef<string | undefined>(checklist.comment);

  // Debounce location and comment changes
  const debouncedLocation = useDebounce(locationValue, 500);
  const debouncedComment = useDebounce(commentValue, 500);

  // Sync with checklist changes
  useEffect(() => {
    const newLocation = checklist.location || "";
    const newComment = checklist.comment || "";

    if (newLocation !== (prevLocationRef.current || "")) {
      setLocationValue(newLocation);
      prevLocationRef.current = checklist.location;
    }

    if (newComment !== (prevCommentRef.current || "")) {
      setCommentValue(newComment);
      prevCommentRef.current = checklist.comment;
    }
  }, [checklist.location, checklist.comment]);

  // Save debounced location changes
  useEffect(() => {
    if (debouncedLocation !== (prevLocationRef.current || "") && onAnswerChange) {
      onAnswerChange(checklist._id || "", { location: debouncedLocation });
      prevLocationRef.current = debouncedLocation;
    }
  }, [debouncedLocation, checklist._id, onAnswerChange]);

  // Save debounced comment changes
  useEffect(() => {
    if (debouncedComment !== (prevCommentRef.current || "") && onAnswerChange) {
      onAnswerChange(checklist._id || "", { comment: debouncedComment });
      prevCommentRef.current = debouncedComment;
    }
  }, [debouncedComment, checklist._id, onAnswerChange]);

  const {
    attributes: sortableAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: checklist._id || "",
    disabled: reorderDisabled,
  });

  const { role, tabIndex, ...attributes } = sortableAttributes;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isStatusWithField = checklist.type === 'status' && checklist.field;

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50")}>
      <div className="rounded-lg border p-4 hover:bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Checkbox and title for status without field */}
              {checklist.type === 'status' && !isStatusWithField && (
                <>
                  <Checkbox
                    checked={checklist.defaultChecked || false}
                    onCheckedChange={(checked) => {
                      if (onAnswerChange) {
                        onAnswerChange(checklist._id || "", { defaultChecked: Boolean(checked) });
                      }
                    }}
                    disabled={disabled}
                  />
                  <span className="text-sm font-medium">{checklist.name}</span>
                </>
              )}
              {/* Checkbox and title for status with field */}
              {checklist.type === 'status' && isStatusWithField && (
                <>
                  <Checkbox
                    checked={checklist.defaultChecked || false}
                    onCheckedChange={(checked) => {
                      if (onAnswerChange) {
                        onAnswerChange(checklist._id || "", { defaultChecked: Boolean(checked) });
                      }
                    }}
                    disabled={disabled}
                  />
                  <span className="text-sm font-medium">{checklist.name}</span>
                </>
              )}
              {/* Checkbox and title for information */}
              {checklist.type === 'information' && (
                <>
                  <Checkbox
                    checked={checklist.defaultChecked || false}
                    onCheckedChange={(checked) => {
                      if (onAnswerChange) {
                        onAnswerChange(checklist._id || "", { defaultChecked: Boolean(checked) });
                      }
                    }}
                    disabled={disabled}
                  />
                  <span className="text-sm font-medium">{checklist.name}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="icon"
              {...attributes}
              role="button"
              tabIndex={reorderDisabled ? -1 : 0}
              aria-disabled={reorderDisabled}
              className={cn(
                reorderDisabled && "cursor-not-allowed opacity-40"
              )}
              title="Drag to reorder"
              {...(!reorderDisabled ? listeners : {})}
            >
              <GripVertical className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onEdit}
              disabled={disabled}
              title="Edit checklist"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onDelete}
              disabled={disabled}
              title="Delete checklist"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {/* Location field for status checklists */}
          {checklist.type === 'status' && (
            <div className="space-y-2">
              <CreatableConcatenatedInput
                value={locationValue}
                onChange={setLocationValue}
                label="Location"
                placeholder="Search location..."
                inputPlaceholder="Enter location"
                options={locationOptions}
                disabled={disabled}
              />
            </div>
          )}

          {/* Comment field for all checklist types */}
          <div className="space-y-2">
            <Label htmlFor={`comment-${checklist._id}`}>Comment</Label>
            <Textarea
              id={`comment-${checklist._id}`}
              value={commentValue}
              onChange={(e) => setCommentValue(e.target.value)}
              rows={4}
              disabled={disabled}
              placeholder="Enter comment..."
            />
          </div>

          {/* Field input for status with field - appears below location/comment */}
          {isStatusWithField && onAnswerChange && (
            <div>
              <ChecklistFieldInput
                checklist={checklist}
                onAnswerChange={(answerData) => onAnswerChange(checklist._id || "", answerData)}
                disabled={disabled}
                hideTitleAndCheckbox={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChecklistContent({
  inspectionId,
  inspectionTemplateId,
  sectionId,
  subsectionId,
  subsectionName,
}: ChecklistContentProps) {
  const [createStatusFormOpen, setCreateStatusFormOpen] = useState(false);
  const [createInformationFormOpen, setCreateInformationFormOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<InspectionTemplateChecklist | null>(null);
  const [deletingChecklistId, setDeletingChecklistId] = useState<string | null>(null);
  const [statusChecklistsLocal, setStatusChecklistsLocal] = useState<InspectionTemplateChecklist[]>([]);
  const [informationChecklistsLocal, setInformationChecklistsLocal] = useState<InspectionTemplateChecklist[]>([]);

  const { data, isLoading, error } = useInspectionTemplateChecklistsQuery(
    inspectionId,
    inspectionTemplateId,
    sectionId,
    subsectionId || ""
  );

  const createChecklistMutation = useCreateInspectionTemplateChecklistMutation(inspectionId, inspectionTemplateId, sectionId, subsectionId || "");
  const updateChecklistMutation = useUpdateInspectionTemplateChecklistMutation(inspectionId, inspectionTemplateId, sectionId, subsectionId || "");
  const deleteChecklistMutation = useDeleteInspectionTemplateChecklistMutation(inspectionId, inspectionTemplateId, sectionId, subsectionId || "");
  const reorderChecklistsMutation = useReorderInspectionTemplateChecklistsMutation(inspectionId, inspectionTemplateId, sectionId, subsectionId || "");
  const updateAnswerMutation = useUpdateChecklistAnswerMutation(inspectionId, inspectionTemplateId, sectionId, subsectionId || "");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const checklists = useMemo(() => {
    if (!data?.data?.checklists) return [];
    return Array.isArray(data.data.checklists) ? data.data.checklists : [];
  }, [data]);

  // Sync local state with query data
  useEffect(() => {
    if (data?.data?.checklists) {
      const checklistsArray = Array.isArray(data.data.checklists) ? data.data.checklists : [];
      const status = [...checklistsArray]
        .filter(c => c.type === 'status')
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      const information = [...checklistsArray]
        .filter(c => c.type === 'information')
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setStatusChecklistsLocal(status);
      setInformationChecklistsLocal(information);
    }
  }, [data]);

  const statusChecklists = statusChecklistsLocal;
  const informationChecklists = informationChecklistsLocal;

  const handleCreateStatusChecklist = async (values: any) => {
    try {
      await createChecklistMutation.mutateAsync({
        type: 'status',
        ...values,
      });
      setCreateStatusFormOpen(false);
    } catch (error) {
      console.error("Create status checklist error:", error);
    }
  };

  const handleCreateInformationChecklist = async (values: any) => {
    try {
      await createChecklistMutation.mutateAsync({
        type: 'information',
        ...values,
      });
      setCreateInformationFormOpen(false);
    } catch (error) {
      console.error("Create information checklist error:", error);
    }
  };

  const handleUpdateChecklist = async (values: any) => {
    if (!editingChecklist?._id) return;

    try {
      await updateChecklistMutation.mutateAsync({
        checklistId: editingChecklist._id,
        checklistData: {
          ...values,
          orderIndex: editingChecklist.orderIndex,
        },
      });
      setEditingChecklist(null);
    } catch (error) {
      console.error("Update checklist error:", error);
    }
  };

  const handleDeleteChecklist = async () => {
    if (!deletingChecklistId) return;

    try {
      await deleteChecklistMutation.mutateAsync(deletingChecklistId);
      setDeletingChecklistId(null);
    } catch (error) {
      console.error("Delete checklist error:", error);
    }
  };

  const handleAnswerChange = useCallback(
    async (checklistId: string, answerData: Partial<InspectionTemplateChecklist>) => {
      try {
        await updateAnswerMutation.mutateAsync({
          checklistId,
          answerData,
        });
      } catch (error) {
        console.error("Update checklist answer error:", error);
      }
    },
    [updateAnswerMutation]
  );

  const handleToggleAllStatusDefaultChecked = useCallback(
    async (checked: boolean) => {
      try {
        const updatePromises = statusChecklists.map((checklist) =>
          updateAnswerMutation.mutateAsync({
            checklistId: checklist._id || "",
            answerData: { defaultChecked: checked },
          })
        );
        await Promise.all(updatePromises);
      } catch (error) {
        console.error("Toggle all status defaultChecked error:", error);
      }
    },
    [statusChecklists, updateAnswerMutation]
  );

  const handleToggleAllInformationDefaultChecked = useCallback(
    async (checked: boolean) => {
      try {
        const updatePromises = informationChecklists.map((checklist) =>
          updateAnswerMutation.mutateAsync({
            checklistId: checklist._id || "",
            answerData: { defaultChecked: checked },
          })
        );
        await Promise.all(updatePromises);
      } catch (error) {
        console.error("Toggle all information defaultChecked error:", error);
      }
    },
    [informationChecklists, updateAnswerMutation]
  );

  const allStatusChecked = useMemo(() => {
    return statusChecklists.length > 0 && statusChecklists.every((c) => c.defaultChecked);
  }, [statusChecklists]);

  const allInformationChecked = useMemo(() => {
    return informationChecklists.length > 0 && informationChecklists.every((c) => c.defaultChecked);
  }, [informationChecklists]);

  const isReorderDisabled = 
    createChecklistMutation.isPending ||
    updateChecklistMutation.isPending ||
    deleteChecklistMutation.isPending ||
    reorderChecklistsMutation.isPending ||
    !!editingChecklist ||
    !!deletingChecklistId;

  const commitStatusReorder = useCallback(
    async (nextStatusChecklists: InspectionTemplateChecklist[]) => {
      try {
        // Get all checklists and update only status ones
        // Status checklists come first, then information checklists
        const statusIds = new Set(nextStatusChecklists.map(c => c._id).filter(Boolean));
        
        // Create payload: status checklists first, then information checklists
        const payload: Array<{ id: string; order: number }> = [];
        
        // Add status checklists with new order
        nextStatusChecklists.forEach((checklist, index) => {
          if (checklist._id) {
            payload.push({
              id: checklist._id,
              order: index + 1,
            });
          }
        });
        
        // Add information checklists with their existing relative order, offset by status count
        const sortedInformation = [...informationChecklistsLocal].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        sortedInformation.forEach((checklist, index) => {
          if (checklist._id) {
            payload.push({
              id: checklist._id,
              order: nextStatusChecklists.length + index + 1,
            });
          }
        });

        await reorderChecklistsMutation.mutateAsync({ checklists: payload });
      } catch (error: any) {
        console.error("Error reordering status checklists:", error);
      }
    },
    [statusChecklistsLocal, informationChecklistsLocal, reorderChecklistsMutation]
  );

  const commitInformationReorder = useCallback(
    async (nextInformationChecklists: InspectionTemplateChecklist[]) => {
      try {
        // Get all checklists and update only information ones
        // Status checklists come first, then information checklists
        const sortedStatus = [...statusChecklistsLocal].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        
        // Create payload: status checklists first, then information checklists
        const payload: Array<{ id: string; order: number }> = [];
        
        // Add status checklists with their existing relative order
        sortedStatus.forEach((checklist, index) => {
          if (checklist._id) {
            payload.push({
              id: checklist._id,
              order: index + 1,
            });
          }
        });
        
        // Add information checklists with new order, offset by status count
        nextInformationChecklists.forEach((checklist, index) => {
          if (checklist._id) {
            payload.push({
              id: checklist._id,
              order: sortedStatus.length + index + 1,
            });
          }
        });

        await reorderChecklistsMutation.mutateAsync({ checklists: payload });
      } catch (error: any) {
        console.error("Error reordering information checklists:", error);
      }
    },
    [statusChecklistsLocal, informationChecklistsLocal, reorderChecklistsMutation]
  );

  const handleStatusDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (isReorderDisabled || isLoading) {
        return;
      }

      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = statusChecklists.findIndex((checklist) => checklist._id === active.id);
      const newIndex = statusChecklists.findIndex((checklist) => checklist._id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(statusChecklists, oldIndex, newIndex).map((checklist, index) => ({
        ...checklist,
        orderIndex: index + 1,
      }));

      setStatusChecklistsLocal(reordered);
      void commitStatusReorder(reordered);
    },
    [statusChecklists, commitStatusReorder, isReorderDisabled, isLoading]
  );

  const handleInformationDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (isReorderDisabled || isLoading) {
        return;
      }

      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = informationChecklists.findIndex((checklist) => checklist._id === active.id);
      const newIndex = informationChecklists.findIndex((checklist) => checklist._id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(informationChecklists, oldIndex, newIndex).map((checklist, index) => ({
        ...checklist,
        orderIndex: index + 1,
      }));

      setInformationChecklistsLocal(reordered);
      void commitInformationReorder(reordered);
    },
    [informationChecklists, commitInformationReorder, isReorderDisabled, isLoading]
  );

  if (!subsectionId) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">No subsection selected</p>
          <p className="text-sm">Select a subsection from the sidebar to view its checklists</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h2 className="text-2xl font-bold">Checklists</h2>
          {subsectionName && (
            <p className="text-muted-foreground">{subsectionName}</p>
          )}
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Failed to load checklists"}
              </p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading checklists...
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Status Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Status</CardTitle>
                <Button onClick={() => setCreateStatusFormOpen(true)} size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </CardHeader>
              <CardContent>
                {statusChecklists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No status checklists yet.</p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStatusDragEnd}>
                    <SortableContext
                      items={statusChecklists.map((checklist) => checklist._id || "")}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {statusChecklists.map((checklist) => (
                          <SortableChecklistItem
                            key={checklist._id}
                            checklist={checklist}
                            onEdit={() => setEditingChecklist(checklist)}
                            onDelete={() => setDeletingChecklistId(checklist._id || null)}
                            disabled={createChecklistMutation.isPending || updateChecklistMutation.isPending}
                            reorderDisabled={isReorderDisabled}
                            onAnswerChange={handleAnswerChange}
                            inspectionId={inspectionId}
                            inspectionTemplateId={inspectionTemplateId}
                            sectionId={sectionId}
                            subsectionId={subsectionId || ""}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>

            {/* Information Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Information</CardTitle>
                <Button onClick={() => setCreateInformationFormOpen(true)} size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </CardHeader>
              <CardContent>
                {informationChecklists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No information checklists yet.</p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInformationDragEnd}>
                    <SortableContext
                      items={informationChecklists.map((checklist) => checklist._id || "")}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {informationChecklists.map((checklist) => (
                          <SortableChecklistItem
                            key={checklist._id}
                            checklist={checklist}
                            onEdit={() => setEditingChecklist(checklist)}
                            onDelete={() => setDeletingChecklistId(checklist._id || null)}
                            disabled={createChecklistMutation.isPending || updateChecklistMutation.isPending}
                            reorderDisabled={isReorderDisabled}
                            onAnswerChange={handleAnswerChange}
                            inspectionId={inspectionId}
                            inspectionTemplateId={inspectionTemplateId}
                            sectionId={sectionId}
                            subsectionId={subsectionId || ""}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <ChecklistItemForm
        open={createStatusFormOpen}
        onOpenChange={setCreateStatusFormOpen}
        onSubmit={handleCreateStatusChecklist}
        type="status"
        isSubmitting={createChecklistMutation.isPending}
      />

      <ChecklistItemForm
        open={createInformationFormOpen}
        onOpenChange={setCreateInformationFormOpen}
        onSubmit={handleCreateInformationChecklist}
        type="information"
        isSubmitting={createChecklistMutation.isPending}
      />

      {editingChecklist && (
        <ChecklistItemForm
          open={!!editingChecklist}
          onOpenChange={(open) => !open && setEditingChecklist(null)}
          onSubmit={handleUpdateChecklist}
          type={editingChecklist.type as 'status' | 'information'}
          initialValues={editingChecklist}
          isSubmitting={updateChecklistMutation.isPending}
        />
      )}

      <AlertDialog
        open={!!deletingChecklistId}
        onOpenChange={(open) => !open && setDeletingChecklistId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Checklist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this checklist item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteChecklistMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChecklist}
              disabled={deleteChecklistMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteChecklistMutation.isPending ? (
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
    </>
  );
}
