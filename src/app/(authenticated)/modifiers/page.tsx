"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Loader2, PlusCircle, Trash2 } from "lucide-react";

const modifierFormSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  key: z
    .string()
    .trim()
    .min(1, "Identifier is required")
    .regex(/^[a-z0-9_]+$/, "Use letters, numbers, and underscores only"),
  supportsType: z.boolean().default(false),
  hasEqualsField: z.boolean().default(false),
  requiresRange: z.boolean().default(false),
  group: z.enum(["standard", "custom"]).default("standard"),
  description: z.string().optional(),
});

type ModifierFormValues = z.infer<typeof modifierFormSchema>;

interface ModifierDefinition {
  _id: string;
  key: string;
  label: string;
  supportsType: boolean;
  hasEqualsField: boolean;
  requiresRange: boolean;
  group?: "custom";
  description?: string;
  orderIndex?: number;
  createdAt: string;
  updatedAt: string;
}

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

const DEFAULT_FORM_VALUES: ModifierFormValues = {
  label: "",
  key: "",
  supportsType: false,
  hasEqualsField: false,
  requiresRange: false,
  group: "custom",
  description: "",
};

const toIdentifier = (input?: string) =>
  (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 64);

const BEHAVIOR_OPTIONS = [
  {
    value: "type" as const,
    title: "Type Dropdown",
    description: "Allows selecting between Range, Per Unit, and Per Unit Over.",
  },
  {
    value: "range" as const,
    title: "Always Show Range Inputs",
    description: "Keeps Greater Than / Less Than inputs visible.",
  },
  {
    value: "equals" as const,
    title: "Equals Field",
    description: "Adds an Equals input for matching specific values.",
  },
];

export default function ModifiersPage() {
  const [modifiers, setModifiers] = useState<ModifierDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<MessageState>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modifierToDelete, setModifierToDelete] = useState<ModifierDefinition | null>(null);
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);

  const form = useForm<ModifierFormValues>({
    resolver: zodResolver(modifierFormSchema) as Resolver<ModifierFormValues>,
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const orderedModifiers = useMemo(() => {
    return [...modifiers].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [modifiers]);

  const fetchModifiers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/modifiers", { credentials: "include" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to load modifiers");
      }
      setModifiers(Array.isArray(result.modifiers) ? result.modifiers : []);
    } catch (error: any) {
      console.error("Fetch modifiers error:", error);
      setMessage({ type: "error", text: error.message || "Failed to load modifiers" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModifiers();
  }, [fetchModifiers]);

  const openCreateDialog = () => {
    setKeyManuallyEdited(false);
    form.reset(DEFAULT_FORM_VALUES);
    setDialogOpen(true);
  };

  const openDeleteDialog = (modifier: ModifierDefinition) => {
    setModifierToDelete(modifier);
    setDeleteDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setKeyManuallyEdited(false);
    form.reset(DEFAULT_FORM_VALUES);
  };

  const labelValue = form.watch("label");
  const supportsTypeValue = form.watch("supportsType");
  const requiresRangeValue = form.watch("requiresRange");
  const hasEqualsValue = form.watch("hasEqualsField");

  useEffect(() => {
    if (!dialogOpen || keyManuallyEdited) {
      return;
    }
    const generated = toIdentifier(labelValue);
    form.setValue("key", generated, {
      shouldDirty: generated.length > 0,
      shouldValidate: generated.length > 0,
    });
  }, [labelValue, keyManuallyEdited, dialogOpen, form]);

  const behaviorSelection = useMemo<"type" | "range" | "equals" | "none">(() => {
    if (supportsTypeValue) return "type";
    if (requiresRangeValue) return "range";
    if (hasEqualsValue) return "equals";
    return "none";
  }, [supportsTypeValue, requiresRangeValue, hasEqualsValue]);

  const setBehavior = (value: "type" | "range" | "equals") => {
    form.setValue("supportsType", value === "type");
    form.setValue("requiresRange", value === "range");
    form.setValue("hasEqualsField", value === "equals");
  };

  const handleSubmitForm: SubmitHandler<ModifierFormValues> = async (values) => {
    try {
      setSubmitting(true);
      setMessage(null);

      const payload = {
        label: values.label.trim(),
        key: values.key.trim(),
        supportsType: values.supportsType,
        hasEqualsField: values.hasEqualsField,
        requiresRange: values.requiresRange,
        group: values.group === "custom" ? "custom" : undefined,
        description: values.description?.trim() || undefined,
      };

      const response = await fetch("/api/modifiers", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to save modifier");
      }

      setMessage({ type: "success", text: result.message || "Modifier saved successfully" });
      closeDialog();
      fetchModifiers();
    } catch (error: any) {
      console.error("Save modifier error:", error);
      setMessage({ type: "error", text: error.message || "Failed to save modifier" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteModifier = async () => {
    if (!modifierToDelete) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/modifiers/${modifierToDelete._id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete modifier");
      }

      setMessage({ type: "success", text: result.message || "Modifier deleted" });
      setDeleteDialogOpen(false);
      setModifierToDelete(null);
      fetchModifiers();
    } catch (error: any) {
      console.error("Delete modifier error:", error);
      setMessage({ type: "error", text: error.message || "Failed to delete modifier" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Modifiers</h1>
          <p className="text-muted-foreground">
            Define the data fields that drive modifier logic across your services. Add Fee and Add Hours are always available.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Modifier
        </Button>
      </div>

      {message && (
        <Card
          className={message.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}
        >
          <CardContent className="flex items-start gap-3 p-4">
            {message.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <p className="text-sm text-muted-foreground">{message.text}</p>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setMessage(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Available Modifiers</CardTitle>
          <CardDescription>
            Control which inputs appear in the service form when this modifier is selected. These definitions power every modifiers dropdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading modifiers...
            </div>
          ) : orderedModifiers.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              <p>No modifiers found.</p>
              <Button variant="outline" onClick={openCreateDialog}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create your first modifier
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full divide-y divide-muted text-sm">
                <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Label</th>
                    <th className="px-4 py-3">Behavior</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted">
                  {orderedModifiers.map((modifier) => (
                    <tr key={modifier._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-foreground">{modifier.label}</div>
                        {modifier.description && (
                          <p className="text-xs text-muted-foreground">{modifier.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          {modifier.supportsType && <Badge variant="secondary">Shows Type Dropdown</Badge>}
                          {modifier.requiresRange && <Badge variant="secondary">Always Range Inputs</Badge>}
                          {modifier.hasEqualsField && <Badge variant="secondary">Shows Equals Field</Badge>}
                          {!modifier.supportsType && !modifier.requiresRange && !modifier.hasEqualsField && (
                            <span className="text-xs text-muted-foreground">Standard inputs only</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="destructive"
                            size="icon"
                            title="Delete modifier"
                            onClick={() => openDeleteDialog(modifier)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Modifier</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmitForm)}>
            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Input id="label" placeholder="Sq.Ft." {...form.register("label")} disabled={submitting} />
              {form.formState.errors.label && (
                <p className="text-sm text-red-600">{form.formState.errors.label.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="key">Identifier *</Label>
              <Controller
                name="key"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="key"
                    placeholder="sq_ft"
                    value={field.value}
                    onChange={(event) => {
                      setKeyManuallyEdited(true);
                      field.onChange(event.target.value);
                    }}
                    disabled={submitting}
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">
                Generated from the label. You can override it with lowercase letters, numbers, and underscores.
              </p>
              {form.formState.errors.key && (
                <p className="text-sm text-red-600">{form.formState.errors.key.message}</p>
              )}
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <Label>Field Behavior *</Label>
              <div className="space-y-4">
                {BEHAVIOR_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-start gap-3 text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      name="modifier-behavior"
                      value={option.value}
                      checked={behaviorSelection === option.value}
                      onChange={() => setBehavior(option.value)}
                      disabled={submitting}
                    />
                    <div>
                      <span className="font-medium">{option.title}</span>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    value="standard"
                    checked={form.watch("group") === "standard"}
                    onChange={() => form.setValue("group", "standard")}
                    disabled={submitting}
                  />
                  Standard
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    value="custom"
                    checked={form.watch("group") === "custom"}
                    onChange={() => form.setValue("group", "custom")}
                    disabled={submitting}
                  />
                  Custom
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Optional context for your team."
                {...form.register("description")}
                disabled={submitting}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Modifier
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Modifier</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{modifierToDelete?.label}</span>? Existing services referencing this identifier will need to be updated manually.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setModifierToDelete(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteModifier} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


