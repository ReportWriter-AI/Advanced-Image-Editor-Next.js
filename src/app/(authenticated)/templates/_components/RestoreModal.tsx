"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, AlertCircle } from "lucide-react";
import { useDeletedTemplatesQuery, useRestoreTemplateMutation } from "@/components/api/queries/templates";
import { Card, CardContent } from "@/components/ui/card";

interface Template {
  _id: string;
  name: string;
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface RestoreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RestoreModal({ open, onOpenChange }: RestoreModalProps) {
  const { data, isLoading, error, refetch } = useDeletedTemplatesQuery();
  const restoreMutation = useRestoreTemplateMutation();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const deletedTemplates: Template[] = data?.data?.templates || [];

  const handleRestore = async (templateId: string) => {
    try {
      setRestoringId(templateId);
      await restoreMutation.mutateAsync(templateId);
      await refetch();
    } catch (error) {
      // Error is already handled by the mutation's onError callback
      console.error("Restore template error:", error);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Restore Deleted Templates</DialogTitle>
          <DialogDescription>
            Select a template to restore. Restored templates will appear in your templates list.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Failed to load deleted templates"}
                </p>
              </CardContent>
            </Card>
          ) : deletedTemplates.length === 0 ? (
            <div className="rounded-lg border border-muted bg-muted/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No deleted templates found.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {deletedTemplates.map((template) => (
                <Card key={template._id} className="hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{template.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Deleted on {new Date(template.deletedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(template._id)}
                      disabled={restoringId === template._id || restoreMutation.isPending}
                    >
                      {restoringId === template._id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Restoring...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
