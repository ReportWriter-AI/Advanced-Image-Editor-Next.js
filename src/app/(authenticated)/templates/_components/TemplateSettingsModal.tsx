"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTemplateQuery, useUpdateTemplateMutation } from "@/components/api/queries/templates";

interface TemplateSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
}

export function TemplateSettingsModal({ open, onOpenChange, templateId }: TemplateSettingsModalProps) {
  const [reportDescription, setReportDescription] = useState("");
  
  const { data, isLoading, error } = useTemplateQuery(templateId);
  const updateMutation = useUpdateTemplateMutation(templateId);

  // Update local state when template data loads
  useEffect(() => {
    if (data?.data?.template?.reportDescription !== undefined) {
      setReportDescription(data.data.template.reportDescription || "");
    }
  }, [data]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setReportDescription("");
    }
  }, [open]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ reportDescription });
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation hook (toast)
      console.error("Failed to update template:", error);
    }
  };

  const handleCancel = () => {
    // Reset to original value
    if (data?.data?.template?.reportDescription !== undefined) {
      setReportDescription(data.data.template.reportDescription || "");
    } else {
      setReportDescription("");
    }
    onOpenChange(false);
  };

  const isSubmitting = updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Template Settings</DialogTitle>
          <DialogDescription>
            Manage settings for this template.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-4">
            <p className="text-sm text-destructive">
              Failed to load template settings. Please try again.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reportDescription">Report Description</Label>
              <Textarea
                id="reportDescription"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Enter report description..."
                rows={6}
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting || isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
