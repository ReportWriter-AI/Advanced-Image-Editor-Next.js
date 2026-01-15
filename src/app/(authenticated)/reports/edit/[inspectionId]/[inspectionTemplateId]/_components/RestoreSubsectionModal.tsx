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
import { useDeletedInspectionTemplateSubsectionsQuery, useRestoreInspectionTemplateSubsectionMutation } from "@/components/api/queries/inspectionTemplateSubsections";
import { Card, CardContent } from "@/components/ui/card";

interface Subsection {
  _id: string;
  name: string;
  deletedAt: string;
  orderIndex: number;
}

interface RestoreSubsectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string;
  inspectionTemplateId: string;
  sectionId: string;
}

export function RestoreSubsectionModal({ open, onOpenChange, inspectionId, inspectionTemplateId, sectionId }: RestoreSubsectionModalProps) {
  const { data, isLoading, error, refetch } = useDeletedInspectionTemplateSubsectionsQuery(inspectionId, inspectionTemplateId, sectionId);
  const restoreMutation = useRestoreInspectionTemplateSubsectionMutation(inspectionId, inspectionTemplateId, sectionId);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const deletedSubsections: Subsection[] = data?.data?.subsections || [];

  const handleRestore = async (subsectionId: string) => {
    try {
      setRestoringId(subsectionId);
      await restoreMutation.mutateAsync(subsectionId);
      await refetch();
    } catch (error) {
      // Error is already handled by the mutation's onError callback
      console.error("Restore subsection error:", error);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Restore Deleted Subsections</DialogTitle>
          <DialogDescription>
            Select a subsection to restore. Restored subsections will appear in your subsections list.
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
                  {error instanceof Error ? error.message : "Failed to load deleted subsections"}
                </p>
              </CardContent>
            </Card>
          ) : deletedSubsections.length === 0 ? (
            <div className="rounded-lg border border-muted bg-muted/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No deleted subsections found.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {deletedSubsections.map((subsection) => (
                <Card key={subsection._id} className="hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{subsection.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Deleted on {new Date(subsection.deletedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(subsection._id)}
                      disabled={restoringId === subsection._id || restoreMutation.isPending}
                    >
                      {restoringId === subsection._id ? (
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
