"use client";

import { useEffect, useState, useMemo } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Loader2, Check, ChevronsUpDown, X } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { DataTable, Column } from '@/components/ui/data-table';
import { cn } from '@/lib/utils';

const ruleTypeOptions = [
  'Total Inspections Count',
  'Total Revenue',
  'First Inspection',
  'Last Inspection',
  "Buyer's Agent Inspection Count",
  "Seller's Agent Inspection Count",
  "Buyer's Agent Revenue",
  "Seller's Agent Revenue",
  "Buyer's Agent First Inspection",
  "Seller's Agent First Inspection",
  "Buyer's Agent Last Inspection",
  "Seller's Agent Last Inspection",
];

const categoryRuleSchema = z.object({
  operation: z.enum(['AND', 'OR']).optional(),
  ruleType: z.string().min(1, 'Rule type is required'),
  condition: z.enum(['Equal To', 'Greater Than', 'Less Than']),
  count: z.number().min(0, 'Count must be 0 or greater'),
  within: z.enum(['Last', 'Next']).optional(),
  days: z.number().min(1, 'Days must be at least 1').optional(),
}).refine((data) => {
  if (data.within && !data.days) {
    return false;
  }
  return true;
}, {
  message: 'Days is required when Within is selected',
  path: ['days'],
});

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format'),
  autoCategorizing: z.boolean(),
  autoCategoryPerson: z.enum(['Agent', 'Client']).optional(),
  rules: z.array(categoryRuleSchema).optional(),
  removeCategoryOnRuleFail: z.boolean(),
}).refine((data) => {
  if (data.autoCategorizing && !data.autoCategoryPerson) {
    return false;
  }
  return true;
}, {
  message: 'Auto Category Person is required when Auto Categorizing is enabled',
  path: ['autoCategoryPerson'],
}).refine((data) => {
  if (data.autoCategorizing && (!data.rules || data.rules.length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'At least one rule is required when Auto Categorizing is enabled',
  path: ['rules'],
});

type CategoryFormValues = z.infer<typeof categorySchema>;
type CategoryRule = z.infer<typeof categoryRuleSchema>;

interface Category {
  _id: string;
  name: string;
  color: string;
  autoCategorizing: boolean;
  autoCategoryPerson?: 'Agent' | 'Client';
  rules: CategoryRule[];
  removeCategoryOnRuleFail: boolean;
  createdAt: string;
  updatedAt: string;
}

// Searchable Select Component
function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !value && 'text-muted-foreground',
            disabled && 'cursor-not-allowed opacity-60'
          )}
          disabled={disabled}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No option found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onValueChange(option);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      color: '#3b82f6',
      autoCategorizing: false,
      autoCategoryPerson: undefined,
      rules: [],
      removeCategoryOnRuleFail: false,
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = form;

  const autoCategorizing = watch('autoCategorizing');
  const rules = watch('rules') || [];

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'rules',
  });

  useEffect(() => {
    loadCategories(pagination.page, pagination.limit);
  }, [pagination.page, pagination.limit]);

  const loadCategories = async (page: number = 1, limit: number = 10) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/categories?page=${page}&limit=${limit}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const data = await response.json();
      setCategories(data.categories || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const columns: Column<Category>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: 'color',
      header: 'Color',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded border"
            style={{ backgroundColor: row.color }}
          />
          <span className="text-xs text-muted-foreground">{row.color}</span>
        </div>
      ),
    },
    {
      id: 'autoCategorizing',
      header: 'Auto Categorizing',
      cell: (row) => (
        <span className="text-xs">
          {row.autoCategorizing ? (
            <span>
              {row.autoCategoryPerson} ({row.rules?.length || 0} rule{row.rules?.length !== 1 ? 's' : ''})
            </span>
          ) : (
            <span className="text-muted-foreground">No</span>
          )}
        </span>
      ),
    },
    {
      id: 'rules',
      header: 'Rules',
      cell: (row) => (
        <span className="text-xs">
          {row.rules && row.rules.length > 0 ? (
            <span>{row.rules.length} rule{row.rules.length !== 1 ? 's' : ''}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      className: 'text-right',
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(row)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteClick(row)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleCreate = () => {
    setEditingCategory(null);
    reset({
      name: '',
      color: '#3b82f6',
      autoCategorizing: false,
      autoCategoryPerson: undefined,
      rules: [],
      removeCategoryOnRuleFail: false,
    });
    setDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    reset({
      name: category.name,
      color: category.color,
      autoCategorizing: category.autoCategorizing,
      autoCategoryPerson: category.autoCategoryPerson,
      rules: category.rules || [],
      removeCategoryOnRuleFail: category.removeCategoryOnRuleFail,
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/categories/${categoryToDelete._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete category');
      }

      toast.success('Category deleted successfully');
      await loadCategories(pagination.page, pagination.limit);
      setCategoryToDelete(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to delete category');
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (values: CategoryFormValues) => {
    try {
      setSaving(true);
      const url = editingCategory ? '/api/categories' : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const payload = editingCategory
        ? { ...values, _id: editingCategory._id }
        : values;

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save category');
      }

      toast.success(`Category ${editingCategory ? 'updated' : 'created'} successfully`);
      await loadCategories(pagination.page, pagination.limit);
      setDialogOpen(false);
      setEditingCategory(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = () => {
    append({
      ruleType: '',
      condition: 'Equal To',
      count: 0,
    });
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Categories Manager</h3>
          <p className="text-sm text-muted-foreground">Create and manage categories for your contacts</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Categories</CardTitle>
          <CardDescription>Manage your categories</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={categories}
            loading={loading}
            pagination={
              pagination.totalPages > 0
                ? {
                    page: pagination.page,
                    limit: pagination.limit,
                    total: pagination.total,
                    totalPages: pagination.totalPages,
                    onPageChange: handlePageChange,
                  }
                : undefined
            }
            emptyMessage='No categories found. Click "Create" to add your first category.'
          />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Update category details' : 'Create a new category for your contacts'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input id="name" {...field} />
                )}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Controller
                  name="color"
                  control={control}
                  render={({ field }) => (
                    <>
                      <Input
                        type="color"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        placeholder="#3b82f6"
                        value={field.value}
                        onChange={(e) => {
                          let value = e.target.value.trim();
                          // Auto-add # if user types without it
                          if (value && !value.startsWith('#') && /^[A-Fa-f0-9]{3,6}$/.test(value)) {
                            value = '#' + value;
                          }
                          field.onChange(value);
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pastedText = e.clipboardData.getData('text').trim();
                          let value = pastedText;
                          // Auto-add # if pasted without it
                          if (value && !value.startsWith('#') && /^[A-Fa-f0-9]{3,6}$/.test(value)) {
                            value = '#' + value;
                          }
                          field.onChange(value);
                        }}
                        className="flex-1"
                      />
                    </>
                  )}
                />
              </div>
              {errors.color && (
                <p className="text-sm text-destructive">{errors.color.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Controller
                name="autoCategorizing"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="autoCategorizing"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                    />
                    <Label htmlFor="autoCategorizing" className="font-medium cursor-pointer">
                      Auto Categorizing
                    </Label>
                  </div>
                )}
              />
            </div>

            {autoCategorizing && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="autoCategoryPerson">Auto Category Person</Label>
                  <Controller
                    name="autoCategoryPerson"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="autoCategoryPerson">
                          <SelectValue placeholder="Select person type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Agent">Agent</SelectItem>
                          <SelectItem value="Client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.autoCategoryPerson && (
                    <p className="text-sm text-destructive">{errors.autoCategoryPerson.message}</p>
                  )}
                </div>

                <div className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <Label>Rules</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddRule}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Rule
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="space-y-4 border rounded-lg p-4 bg-muted/30">
                      {index > 0 && (
                        <div className="space-y-2">
                          <Label>Operation</Label>
                          <Controller
                            name={`rules.${index}.operation`}
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select operation" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AND">AND</SelectItem>
                                  <SelectItem value="OR">OR</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Auto Category Add Rule Type</Label>
                        <Controller
                          name={`rules.${index}.ruleType`}
                          control={control}
                          render={({ field }) => (
                            <SearchableSelect
                              value={field.value}
                              onValueChange={field.onChange}
                              options={ruleTypeOptions}
                              placeholder="Select rule type"
                            />
                          )}
                        />
                        {errors.rules?.[index]?.ruleType && (
                          <p className="text-sm text-destructive">
                            {errors.rules[index]?.ruleType?.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Condition</Label>
                        <Controller
                          name={`rules.${index}.condition`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Equal To">Equal To</SelectItem>
                                <SelectItem value="Greater Than">Greater Than</SelectItem>
                                <SelectItem value="Less Than">Less Than</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Count</Label>
                        <Controller
                          name={`rules.${index}.count`}
                          control={control}
                          render={({ field }) => (
                            <Input
                              type="number"
                              step="0.01"
                              value={field.value}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          )}
                        />
                        {errors.rules?.[index]?.count && (
                          <p className="text-sm text-destructive">
                            {errors.rules[index]?.count?.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Within (Optional)</Label>
                        <Controller
                          name={`rules.${index}.within`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select option" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Last">Last</SelectItem>
                                <SelectItem value="Next">Next</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {watch(`rules.${index}.within`) && (
                          <div className="space-y-2">
                            <Label>Days</Label>
                            <Controller
                              name={`rules.${index}.days`}
                              control={control}
                              render={({ field }) => (
                                <Input
                                  type="number"
                                  min="1"
                                  value={field.value}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                                />
                              )}
                            />
                            {errors.rules?.[index]?.days && (
                              <p className="text-sm text-destructive">
                                {errors.rules[index]?.days?.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Rule
                        </Button>
                      )}
                    </div>
                  ))}

                  {fields.length === 0 && (
                    <Button type="button" variant="outline" onClick={handleAddRule}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Rule
                    </Button>
                  )}

                  {autoCategorizing && fields.length > 0 && (
                    <p className="text-sm text-muted-foreground italic mt-4">
                      Note: The category rule(s) above are considering confirmed inspections that are paid or unpaid.
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Controller
                name="removeCategoryOnRuleFail"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="removeCategoryOnRuleFail"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                    />
                    <Label htmlFor="removeCategoryOnRuleFail" className="font-medium cursor-pointer">
                      Remove Category on Rule Fail
                    </Label>
                  </div>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingCategory(null);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingCategory ? 'Update' : 'Create'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(categoryToDelete)} onOpenChange={(open) => !open && !isDeleting && setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "{categoryToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

