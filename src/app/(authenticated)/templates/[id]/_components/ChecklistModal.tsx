"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useTemplateChecklistsQuery,
  useCreateTemplateChecklistMutation,
  useUpdateTemplateChecklistMutation,
  useDeleteTemplateChecklistMutation,
  TemplateChecklist,
} from "@/components/api/queries/templateChecklists";
import { ChecklistItemForm } from "./ChecklistItemForm";

interface ChecklistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  sectionId: string;
  subsectionId: string;
  subsectionName: string;
}

export function ChecklistModal({
  open,
  onOpenChange,
  templateId,
  sectionId,
  subsectionId,
  subsectionName,
}: ChecklistModalProps) {
  const [createStatusFormOpen, setCreateStatusFormOpen] = useState(false);
  const [createInformationFormOpen, setCreateInformationFormOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<TemplateChecklist | null>(null);
  const [deletingChecklistId, setDeletingChecklistId] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<TemplateChecklist[]>([]);

  const { data, isLoading, error } = useTemplateChecklistsQuery(templateId, sectionId, subsectionId);
  const createChecklistMutation = useCreateTemplateChecklistMutation(templateId, sectionId, subsectionId);
  const updateChecklistMutation = useUpdateTemplateChecklistMutation(templateId, sectionId, subsectionId);
  const deleteChecklistMutation = useDeleteTemplateChecklistMutation(templateId, sectionId, subsectionId);

  useEffect(() => {
    if (data?.data?.checklists) {
      const checklistsArray = Array.isArray(data.data.checklists) ? data.data.checklists : [];
      setChecklists(checklistsArray);
    }
  }, [data]);

  const statusChecklists = useMemo(() => {
    return [...checklists]
      .filter(c => c.type === 'status')
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [checklists]);

  const informationChecklists = useMemo(() => {
    return [...checklists]
      .filter(c => c.type === 'information')
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [checklists]);

  const defectsChecklists = useMemo(() => {
    return [...checklists]
      .filter(c => c.type === 'defects')
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [checklists]);

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

  const getFieldLabel = (field?: string) => {
    const fieldMap: Record<string, string> = {
      checkbox: 'Checkbox',
      multipleAnswers: 'Multiple Answers',
      date: 'Date',
      number: 'Number',
      numberRange: 'Number Range',
      text: 'Text',
    };
    return field ? fieldMap[field] || field : '—';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checklists - {subsectionName}</DialogTitle>
            <DialogDescription>
              Manage checklists for this subsection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
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
                      <div className="space-y-2">
                        {statusChecklists.map((checklist) => (
                          <div
                            key={checklist._id}
                            className="flex items-start justify-between rounded-lg border p-4 hover:bg-muted/30"
                          >
                            <div className="flex-1 space-y-1">
                              <div className="font-medium">{checklist.name}</div>
                              <div className="text-sm text-muted-foreground">
                                Field: {getFieldLabel(checklist.field)}
                                {checklist.location && ` • Location: ${checklist.location}`}
                              </div>
                              {checklist.answerChoices && checklist.answerChoices.length > 0 && (
                                <div className="text-sm text-muted-foreground">
                                  Options: {checklist.answerChoices.join(', ')}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setEditingChecklist(checklist)}
                                disabled={createChecklistMutation.isPending || updateChecklistMutation.isPending}
                                title="Edit checklist"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setDeletingChecklistId(checklist._id || null)}
                                disabled={createChecklistMutation.isPending || updateChecklistMutation.isPending}
                                title="Delete checklist"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
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
                      <div className="space-y-2">
                        {informationChecklists.map((checklist) => (
                          <div
                            key={checklist._id}
                            className="flex items-start justify-between rounded-lg border p-4 hover:bg-muted/30"
                          >
                            <div className="flex-1 space-y-1">
                              <div className="font-medium">{checklist.name}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setEditingChecklist(checklist)}
                                disabled={createChecklistMutation.isPending || updateChecklistMutation.isPending}
                                title="Edit checklist"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setDeletingChecklistId(checklist._id || null)}
                                disabled={createChecklistMutation.isPending || updateChecklistMutation.isPending}
                                title="Delete checklist"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Defects Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Defects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {defectsChecklists.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No defects checklists yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {defectsChecklists.map((checklist) => (
                          <div
                            key={checklist._id}
                            className="flex items-start justify-between rounded-lg border p-4 hover:bg-muted/30"
                          >
                            <div className="flex-1 space-y-1">
                              <div className="font-medium">{checklist.name}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
