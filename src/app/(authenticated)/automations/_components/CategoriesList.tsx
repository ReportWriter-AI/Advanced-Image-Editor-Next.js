"use client";

import { useEffect, useState } from "react";
import { DataTable, Column } from "@/components/ui/data-table";
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
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Plus } from "lucide-react";
import { CategoryForm, CategoryFormNormalizedValues } from "./CategoryForm";

interface Category {
  id: string;
  name: string;
  automationType?: string;
}

const mapCategory = (item: any): Category => ({
  id: (item && (item.id || item._id))?.toString?.() || Math.random().toString(36).slice(2, 9),
  name: item?.name || "",
  automationType: item?.automationType || undefined,
});

export default function CategoriesList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<string | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/automations/categories", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const mappedCategories: Category[] = Array.isArray(data)
          ? data.map(mapCategory)
          : [];
        setCategories(mappedCategories);
      } else {
        console.error("Failed to fetch categories");
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (category) {
      setEditingCategory(category);
      setDialogOpen(true);
      setSubmitError(null);
    }
  };

  const handleDeleteClick = (categoryId: string) => {
    setDeleteError(null);
    setCategoryPendingDelete(categoryId);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryPendingDelete) return;

    try {
      setDeleteInFlight(true);
      setDeleteError(null);

      const response = await fetch(`/api/automations/categories/${categoryPendingDelete}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete category");
      }

      await fetchCategories();
      setCategoryPendingDelete(null);
    } catch (error: any) {
      console.error("Error deleting category:", error);
      setDeleteError(error.message || "Failed to delete category");
    } finally {
      setDeleteInFlight(false);
    }
  };

  const closeDeleteDialog = () => {
    if (deleteInFlight) return;
    setCategoryPendingDelete(null);
    setDeleteError(null);
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setDialogOpen(true);
    setSubmitError(null);
  };

  const closeDialog = () => {
    if (isSubmitting) return;
    setDialogOpen(false);
    setEditingCategory(null);
    setSubmitError(null);
  };

  const handleFormSubmit = async (values: CategoryFormNormalizedValues) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const url = editingCategory
        ? `/api/automations/categories/${editingCategory.id}`
        : "/api/automations/categories";
      const method = editingCategory ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${editingCategory ? "update" : "create"} category`);
      }

      await fetchCategories();
      closeDialog();
    } catch (error: any) {
      console.error(`Error ${editingCategory ? "updating" : "creating"} category:`, error);
      setSubmitError(error.message || `Failed to ${editingCategory ? "update" : "create"} category`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<Category>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => <span className="text-muted-foreground">{row.name}</span>,
    },
    {
      id: "automationType",
      header: "Automation Type",
      cell: (row) => (
        <span className="text-muted-foreground">{row.automationType || "—"}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEditClick(row.id);
            }}
            className="h-8 w-8"
            title="Edit Category"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row.id);
            }}
            className="h-8 w-8 text-destructive hover:text-destructive"
            title="Delete Category"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Categories</h2>
          <p className="text-muted-foreground mt-1">Manage your automation categories</p>
        </div>
        <Button onClick={handleAddCategory}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={categories}
        loading={loading}
        emptyMessage="No categories found. Get started by creating your first category."
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Create Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the category information below."
                : "Fill out the information below to create your category."}
            </DialogDescription>
          </DialogHeader>

          {submitError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <CategoryForm
            initialValues={
              editingCategory
                ? {
                    name: editingCategory.name,
                    automationType: editingCategory.automationType,
                  }
                : undefined
            }
            submitLabel={editingCategory ? "Update Category" : "Create Category"}
            onSubmit={handleFormSubmit}
            onCancel={closeDialog}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(categoryPendingDelete)} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInFlight}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCategory}
              disabled={deleteInFlight}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInFlight ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
