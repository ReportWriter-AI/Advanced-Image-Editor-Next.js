"use client";

import { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Loader2, Check, ChevronsUpDown, X, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import { cn } from '@/lib/utils';
import CreatableSelect from 'react-select/creatable';

const personSchema = z.object({
  isCompany: z.boolean(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  ccEmail: z.string().email('Invalid CC email format').optional().or(z.literal('')),
  phone: z.string().optional(),
  homePhone: z.string().optional(),
  mobilePhone: z.string().optional(),
  personCompany: z.string().optional(),
  role: z.string().optional(),
  categories: z.array(z.string()).optional(),
  internalNotes: z.string().optional(),
  internalAdminNotes: z.string().optional(),
}).refine((data) => {
  if (data.isCompany) {
    return data.companyName && data.companyName.trim().length > 0;
  } else {
    return data.firstName && data.firstName.trim().length > 0 && data.lastName && data.lastName.trim().length > 0;
  }
}, {
  message: 'Required fields are missing',
  path: ['firstName'],
}).refine((data) => {
  if (data.email && data.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(data.email.trim());
  }
  return true;
}, {
  message: 'Invalid email format',
  path: ['email'],
}).refine((data) => {
  if (data.ccEmail && data.ccEmail.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(data.ccEmail.trim());
  }
  return true;
}, {
  message: 'Invalid CC email format',
  path: ['ccEmail'],
});

type PersonFormValues = z.infer<typeof personSchema>;

interface Category {
  _id: string;
  name: string;
  color: string;
}

interface Person {
  _id: string;
  isCompany: boolean;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  ccEmail?: string;
  phone?: string;
  homePhone?: string;
  mobilePhone?: string;
  personCompany?: string;
  role?: string;
  categories?: Category[];
  internalNotes?: string;
  internalAdminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// Category Search Component
function CategorySearchInput({
  selectedCategories,
  onAddCategory,
  onRemoveCategory,
  allCategories,
  disabled = false,
}: {
  selectedCategories: Category[];
  onAddCategory: (category: Category) => void;
  onRemoveCategory: (categoryId: string) => void;
  allCategories: Category[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter categories client-side based on search query
  const filteredCategories = useMemo(() => {
    // Filter out already selected categories
    const availableCategories = allCategories.filter(
      (category) => !selectedCategories.some((sc) => sc._id === category._id)
    );

    if (!searchQuery.trim()) {
      return availableCategories;
    }

    // Filter categories by name (case-insensitive)
    const query = searchQuery.trim().toLowerCase();
    return availableCategories.filter((category) =>
      category.name.toLowerCase().includes(query)
    );
  }, [searchQuery, allCategories, selectedCategories]);

  const handleSelectCategory = (category: Category) => {
    onAddCategory(category);
    setSearchQuery('');
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="text-muted-foreground">Search and select categories...</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search categories..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {filteredCategories.length > 0 ? (
                <CommandGroup>
                  {filteredCategories.map((category) => (
                    <CommandItem
                      key={category._id}
                      value={category.name}
                      onSelect={() => handleSelectCategory(category)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div
                          className="w-3 h-3 rounded border shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                        <span>{category.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <CommandEmpty>
                  {searchQuery.trim() ? 'No categories found' : 'No categories available'}
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedCategories.map((category) => (
            <div
              key={category._id}
              className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
            >
              <div
                className="w-3 h-3 rounded border"
                style={{ backgroundColor: category.color }}
              />
              <span>{category.name}</span>
              <button
                type="button"
                onClick={() => onRemoveCategory(category._id)}
                className="text-destructive hover:text-destructive/80 ml-1"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PeopleManager() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedFilterCategories, setSelectedFilterCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [allCategoriesForInput, setAllCategoriesForInput] = useState<Category[]>([]);
  const [loadingAllCategories, setLoadingAllCategories] = useState(false);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      isCompany: false,
      firstName: '',
      lastName: '',
      companyName: '',
      email: '',
      ccEmail: '',
      phone: '',
      homePhone: '',
      mobilePhone: '',
      personCompany: '',
      role: undefined,
      categories: [],
      internalNotes: '',
      internalAdminNotes: '',
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = form;

  const isCompany = watch('isCompany');

  useEffect(() => {
    loadPeople(pagination.page, pagination.limit, searchQuery, selectedFilterCategories);
  }, [pagination.page, pagination.limit, searchQuery, selectedFilterCategories]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadAvailableCategories();
  }, []);

  // Fetch dropdown data from API
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const response = await fetch('/api/reusable-dropdowns', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          // Parse comma-separated strings into arrays
          setRoleOptions(data.role ? data.role.split(',').map((item: string) => item.trim()).filter((item: string) => item.length > 0) : []);
        }
      } catch (error) {
        console.error('Failed to fetch dropdown data:', error);
      }
    };
    fetchDropdownData();
  }, []);

  const loadAllCategories = async () => {
    try {
      setLoadingAllCategories(true);
      const response = await fetch('/api/categories?limit=1000', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAllCategoriesForInput(data.categories || []);
      }
    } catch (error: any) {
      console.error('Error loading all categories:', error);
    } finally {
      setLoadingAllCategories(false);
    }
  };

  const loadAvailableCategories = async () => {
    try {
      setLoadingCategories(true);
      // Fetch all categories from the categories table
      const response = await fetch('/api/categories?limit=1000', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const data = await response.json();
      setAvailableCategories(data.categories || []);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to load categories');
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadPeople = async (
    page: number = 1,
    limit: number = 10,
    search: string = '',
    categories: string[] = []
  ) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search.trim()) {
        params.append('search', search.trim());
      }

      if (categories.length > 0) {
        params.append('categories', categories.join(','));
      }

      const response = await fetch(`/api/people?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load people');
      }

      const data = await response.json();
      setPeople(data.people || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to load people');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on search
  };

  const handleCategoriesChange = (categories: string[]) => {
    setSelectedFilterCategories(categories);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on filter change
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const getPersonDisplayName = (person: Person) => {
    if (person.isCompany) {
      return person.companyName || 'Unnamed Company';
    }
    return `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unnamed Person';
  };

  const columns: Column<Person>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{getPersonDisplayName(row)}</span>,
    },
    {
      id: 'email',
      header: 'Email',
      cell: (row) => <span>{row.email || '-'}</span>,
    },
    {
      id: 'phone',
      header: 'Phone',
      cell: (row) => <span>{row.phone || row.mobilePhone || '-'}</span>,
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => <span>{row.role || '-'}</span>,
    },
    {
      id: 'categories',
      header: 'Categories',
      cell: (row) => (
        <div>
          {row.categories && row.categories.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.categories.slice(0, 3).map((category) => (
                <div
                  key={category._id}
                    className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs"
                >
                  <div
                    className="w-2 h-2 rounded border"
                    style={{ backgroundColor: category.color }}
                  />
                  <span>{category.name}</span>
                </div>
              ))}
              {row.categories.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{row.categories.length - 3}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </div>
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
    setEditingPerson(null);
    loadAllCategories(); // Load all categories when dialog opens
    reset({
      isCompany: false,
      firstName: '',
      lastName: '',
      companyName: '',
      email: '',
      ccEmail: '',
      phone: '',
      homePhone: '',
      mobilePhone: '',
      personCompany: '',
      role: undefined,
      categories: [],
      internalNotes: '',
      internalAdminNotes: '',
    });
    setDialogOpen(true);
  };

  const handleEdit = (person: Person) => {
    setEditingPerson(person);
    loadAllCategories(); // Load all categories when dialog opens
    // Convert category ObjectIds to names for display
    const categoryNames = (person.categories || []).map((c) => 
      typeof c === 'object' && c.name ? c.name : String(c)
    );
    reset({
      isCompany: person.isCompany,
      firstName: person.firstName || '',
      lastName: person.lastName || '',
      companyName: person.companyName || '',
      email: person.email || '',
      ccEmail: person.ccEmail || '',
      phone: person.phone || '',
      homePhone: person.homePhone || '',
      mobilePhone: person.mobilePhone || '',
      personCompany: person.personCompany || '',
      role: person.role as any,
      categories: categoryNames,
      internalNotes: person.internalNotes || '',
      internalAdminNotes: person.internalAdminNotes || '',
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (person: Person) => {
    setPersonToDelete(person);
  };

  const handleConfirmDelete = async () => {
    if (!personToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/people/${personToDelete._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete person');
      }

      toast.success('Person deleted successfully');
      await loadPeople(pagination.page, pagination.limit, searchQuery, selectedFilterCategories);
      await loadAvailableCategories(); // Refresh available categories
      setPersonToDelete(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to delete person');
    } finally {
      setIsDeleting(false);
    }
  };


  const onSubmit = async (values: PersonFormValues) => {
    try {
      setSaving(true);

      // Categories are now stored as strings (names) in the form
      // Filter out empty strings and send to API
      const categoryNames = (values.categories || []).filter((name) => 
        typeof name === 'string' && name.trim().length > 0
      );

      const url = editingPerson ? '/api/people' : '/api/people';
      const method = editingPerson ? 'PUT' : 'POST';

      const payload = editingPerson
        ? { ...values, _id: editingPerson._id, categories: categoryNames }
        : { ...values, categories: categoryNames };

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
        throw new Error(errorData.error || 'Failed to save person');
      }

      toast.success(`Person ${editingPerson ? 'updated' : 'created'} successfully`);
      await loadPeople(pagination.page, pagination.limit, searchQuery, selectedFilterCategories);
      await loadAvailableCategories(); // Refresh available categories
      await loadAllCategories(); // Refresh all categories for input
      setDialogOpen(false);
      setEditingPerson(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to save person');
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions: MultiSelectOption[] = availableCategories.map((category) => ({
    value: category._id,
    label: category.name,
    description: category.color,
  }));

  // Category options for CreatableSelect (using names as values)
  const categorySelectOptions = allCategoriesForInput.map((category) => ({
    value: category.name,
    label: category.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">People</h3>
          <p className="text-sm text-muted-foreground">Manage your contacts and people</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="search">Search by Name</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by first name, last name, or company..."
                  value={searchInput}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Filter by Categories</Label>
              <MultiSelect
                value={selectedFilterCategories}
                onChange={handleCategoriesChange}
                options={categoryOptions}
                placeholder="Select categories..."
                emptyText="No categories found"
                disabled={loadingCategories}
                maxBadges={3}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing People</CardTitle>
          <CardDescription>Manage your people and contacts</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={people}
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
            emptyMessage="No people found. Click 'Create' to add your first person."
          />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPerson ? 'Edit Person' : 'Create Person'}</DialogTitle>
            <DialogDescription>
              {editingPerson ? 'Update person details' : 'Create a new person or company'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Controller
                name="isCompany"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="isCompany"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                    />
                    <Label htmlFor="isCompany" className="font-medium cursor-pointer">
                      Person is a Company/Organization
                    </Label>
                  </div>
                )}
              />
            </div>

            {isCompany ? (
              <div className="space-y-2">
                <Label htmlFor="companyName">Company/Organization</Label>
                <Controller
                  name="companyName"
                  control={control}
                  render={({ field }) => (
                    <Input id="companyName" {...field} />
                  )}
                />
                {errors.companyName && (
                  <p className="text-sm text-destructive">{errors.companyName.message}</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Controller
                    name="firstName"
                    control={control}
                    render={({ field }) => (
                      <Input id="firstName" {...field} />
                    )}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Controller
                    name="lastName"
                    control={control}
                    render={({ field }) => (
                      <Input id="lastName" {...field} />
                    )}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <Input id="email" type="email" {...field} />
                  )}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ccEmail">CC Email</Label>
                <Controller
                  name="ccEmail"
                  control={control}
                  render={({ field }) => (
                    <Input id="ccEmail" type="email" {...field} />
                  )}
                />
                {errors.ccEmail && (
                  <p className="text-sm text-destructive">{errors.ccEmail.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <Input id="phone" type="tel" {...field} />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="homePhone">Home Phone</Label>
                <Controller
                  name="homePhone"
                  control={control}
                  render={({ field }) => (
                    <Input id="homePhone" type="tel" {...field} />
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mobilePhone">Mobile Phone</Label>
                <Controller
                  name="mobilePhone"
                  control={control}
                  render={({ field }) => (
                    <Input id="mobilePhone" type="tel" {...field} />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personCompany">Company</Label>
                <Controller
                  name="personCompany"
                  control={control}
                  render={({ field }) => (
                    <Input id="personCompany" {...field} />
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categories</Label>
              <Controller
                name="categories"
                control={control}
                render={({ field }) => (
                  <CreatableSelect
                    isMulti
                    value={(field.value || []).map((name: string) => ({ value: name, label: name }))}
                    onChange={(selectedOptions) => {
                      field.onChange(selectedOptions ? selectedOptions.map(opt => opt.value) : []);
                    }}
                    onCreateOption={(inputValue) => {
                      const trimmedValue = inputValue.trim();
                      if (trimmedValue && !field.value?.includes(trimmedValue)) {
                        field.onChange([...(field.value || []), trimmedValue]);
                      }
                    }}
                    options={categorySelectOptions}
                    placeholder="Type and press Enter to add categories..."
                    isClearable
                    isDisabled={saving || loadingAllCategories}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="internalNotes">Internal - Only visible to company</Label>
              <Controller
                name="internalNotes"
                control={control}
                render={({ field }) => (
                  <Textarea
                    id="internalNotes"
                    rows={4}
                    {...field}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="internalAdminNotes">Internal - Only visible to company admins</Label>
              <Controller
                name="internalAdminNotes"
                control={control}
                render={({ field }) => (
                  <Textarea
                    id="internalAdminNotes"
                    rows={4}
                    {...field}
                  />
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingPerson(null);
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
                  editingPerson ? 'Update' : 'Create'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(personToDelete)} onOpenChange={(open) => !open && !isDeleting && setPersonToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Person?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{personToDelete ? getPersonDisplayName(personToDelete) : ''}"? This action cannot be undone.
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

