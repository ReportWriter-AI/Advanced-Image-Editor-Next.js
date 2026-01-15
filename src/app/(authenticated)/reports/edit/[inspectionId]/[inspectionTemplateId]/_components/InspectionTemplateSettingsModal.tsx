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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useInspectionTemplateQuery, useUpdateInspectionTemplateMutation } from "@/components/api/queries/inspectionTemplates";

interface InspectionTemplateSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string;
  inspectionTemplateId: string;
}

export function InspectionTemplateSettingsModal({ 
  open, 
  onOpenChange, 
  inspectionId, 
  inspectionTemplateId 
}: InspectionTemplateSettingsModalProps) {
  const [name, setName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  
  const { data, isLoading, error } = useInspectionTemplateQuery(inspectionId, inspectionTemplateId);
  const updateMutation = useUpdateInspectionTemplateMutation();

  // Update local state when template data loads
  useEffect(() => {
    if (data?.data?.template) {
      if (data.data.template.name !== undefined) {
        setName(data.data.template.name || "");
      }
      if (data.data.template.reportDescription !== undefined) {
        setReportDescription(data.data.template.reportDescription || "");
      }
    }
  }, [data]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setName("");
      setReportDescription("");
    }
  }, [open]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ 
        inspectionId, 
        templateId: inspectionTemplateId, 
        templateData: { name, reportDescription } 
      });
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation hook (toast)
      console.error("Failed to update inspection template:", error);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    if (data?.data?.template) {
      setName(data.data.template.name || "");
      setReportDescription(data.data.template.reportDescription || "");
    } else {
      setName("");
      setReportDescription("");
    }
    onOpenChange(false);
  };

  const isSubmitting = updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Inspection Template Settings</DialogTitle>
          <DialogDescription>
            Manage settings for this inspection template.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-4">
            <p className="text-sm text-destructive">
              Failed to load inspection template settings. Please try again.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter template name..."
                disabled={isSubmitting}
              />
            </div>
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
