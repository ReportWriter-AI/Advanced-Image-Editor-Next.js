"use client";

import { useMemo, useState } from "react";
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
  Loader2,
  PlusCircle,
} from "lucide-react";
import { useTemplatesQuery, useCreateTemplateMutation } from "@/components/api/queries/templates";

interface Template {
  _id: string;
  name: string;
  company: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const { data, isLoading, error } = useTemplatesQuery();
  const createTemplateMutation = useCreateTemplateMutation();

  const templates: Template[] = useMemo(() => {
    return Array.isArray(data?.data?.templates) ? data.data.templates : [];
  }, [data]);

  const noTemplates = useMemo(
    () => !isLoading && templates.length === 0,
    [isLoading, templates.length]
  );

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
        <Button onClick={() => setCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Template
        </Button>
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
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-muted border-collapse text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Template Name</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3">Updated At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted">
              {templates.map((template) => (
                <tr
                  key={template._id}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => router.push(`/templates/${template._id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{template.name}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(template.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}
