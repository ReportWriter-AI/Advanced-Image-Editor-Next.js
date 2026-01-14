"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TemplateSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateSettingsModal({ open, onOpenChange }: TemplateSettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Template Settings</DialogTitle>
          <DialogDescription>
            Template Settings
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
