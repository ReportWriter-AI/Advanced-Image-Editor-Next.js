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
import { useDeletedTemplateSectionsQuery, useRestoreTemplateSectionMutation } from "@/components/api/queries/templateSections";
import { Card, CardContent } from "@/components/ui/card";

interface Section {
  _id: string;
  name: string;
  deletedAt: string;
  orderIndex: number;
}

interface RestoreSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
}

export function RestoreSectionModal({ open, onOpenChange, templateId }: RestoreSectionModalProps) {
  const { data, isLoading, error, refetch } = useDeletedTemplateSectionsQuery(templateId);
  const restoreMutation = useRestoreTemplateSectionMutation(templateId);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const deletedSections: Section[] = data?.data?.sections || [];

  const handleRestore = async (sectionId: string) => {
    try {
      setRestoringId(sectionId);
      await restoreMutation.mutateAsync(sectionId);
      await refetch();
    } catch (error) {
      // Error is already handled by the mutation's onError callback
      console.error("Restore section error:", error);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Restore Deleted Sections</DialogTitle>
          <DialogDescription>
            Select a section to restore. Restored sections will appear in your sections list.
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
                  {error instanceof Error ? error.message : "Failed to load deleted sections"}
                </p>
              </CardContent>
            </Card>
          ) : deletedSections.length === 0 ? (
            <div className="rounded-lg border border-muted bg-muted/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No deleted sections found.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {deletedSections.map((section) => (
                <Card key={section._id} className="hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{section.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Deleted on {new Date(section.deletedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(section._id)}
                      disabled={restoringId === section._id || restoreMutation.isPending}
                    >
                      {restoringId === section._id ? (
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
