"use client";

import { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Loader2, ChevronsUpDown, X, Search } from 'lucide-react';
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
import { ImageUpload } from '@/components/ui/image-upload';
import CreatableSelect from 'react-select/creatable';

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const days = Array.from({ length: 31 }, (_, i) => i + 1);

const agentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  ccEmail: z.string().email('Invalid CC email format').optional().or(z.literal('')),
  phone: z.string().optional(),
  secondPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  birthdayMonth: z.enum(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']).optional(),
  birthdayDay: z.number().min(1).max(31).optional().or(z.null()),
  photoUrl: z.string().optional().nullable(),
  facebookUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
  linkedinUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
  twitterUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
  instagramUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
  tiktokUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
  websiteUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
  categories: z.array(z.string()).optional(),
  agency: z.string().optional(),
  agencyPhone: z.string().optional(),
  agentTeam: z.string().optional(),
  internalNotes: z.string().optional(),
  internalAdminNotes: z.string().optional(),
  excludeFromMassEmail: z.boolean(),
  unsubscribedFromMassEmails: z.boolean(),
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

type AgentFormValues = z.infer<typeof agentSchema>;

interface Category {
  _id: string;
  name: string;
  color: string;
}

interface Agency {
  _id: string;
  name: string;
}

interface AgentTeam {
  _id: string;
  name: string;
}

interface Agent {
  _id: string;
  firstName: string;
  lastName?: string;
  email: string;
  ccEmail?: string;
  phone?: string;
  secondPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  birthdayMonth?: string;
  birthdayDay?: number;
  photoUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  categories?: Category[];
  agency?: Agency | string;
  agencyPhone?: string;
  agentTeam?: AgentTeam | string;
  internalNotes?: string;
  internalAdminNotes?: string;
  excludeFromMassEmail: boolean;
  unsubscribedFromMassEmails: boolean;
  createdAt: string;
  updatedAt: string;
}

// Agency Search Select Component
function AgencySearchSelect({
  value,
  onChange,
  disabled = false,
  selectedName,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  selectedName?: string;
}) {
  const [currentSelectedName, setCurrentSelectedName] = useState<string | undefined>(selectedName);
  const [isCleared, setIsCleared] = useState(false);

  // Update current selected name when prop changes
  useEffect(() => {
    if (selectedName !== undefined) {
      setCurrentSelectedName(selectedName);
      setIsCleared(false);
    }
  }, [selectedName]);

  // Reset current selected name when value becomes undefined
  useEffect(() => {
    if (!value) {
      setCurrentSelectedName(undefined);
      setIsCleared(false);
    }
  }, [value]);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounce search query
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }

    const timer = setTimeout(() => {
      searchAgencies(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, open]);

  // Load initial agencies when popover opens
  useEffect(() => {
    if (open && !searchQuery.trim()) {
      searchAgencies('');
    }
  }, [open]);

  const searchAgencies = async (search: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) {
        params.append('search', search.trim());
      }
      params.append('limit', '50');

      const response = await fetch(`/api/agencies/search?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to search agencies');
      }

      const data = await response.json();
      let filteredAgencies = data.agencies || [];
      
      // Include selected agency if it exists and isn't already in results
      if (value && currentSelectedName) {
        const hasSelected = filteredAgencies.some((a: Agency) => a._id === value);
        if (!hasSelected) {
          // Add the selected agency to the top of the list
          filteredAgencies = [{ _id: value, name: currentSelectedName }, ...filteredAgencies];
        }
      }
      
      setAgencies(filteredAgencies);
    } catch (error: any) {
      console.error('Error searching agencies:', error);
      toast.error('Failed to search agencies');
      setAgencies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAgency = (agency: Agency) => {
    onChange(agency._id);
    setCurrentSelectedName(agency.name);
    setSearchQuery('');
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange(undefined);
    setCurrentSelectedName(undefined);
    setIsCleared(true);
  };

  return (
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
          <span className={value && currentSelectedName ? 'text-foreground' : 'text-muted-foreground'}>
            {currentSelectedName || (isCleared || !value ? 'Search and select agency...' : 'Loading...')}
          </span>
          <div className="flex items-center gap-1">
            {value && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClear(e as any);
                  }
                }}
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100 cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded"
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search agencies by name..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                Searching...
              </div>
            ) : agencies.length > 0 ? (
              <CommandGroup>
                {agencies.map((agency) => (
                  <CommandItem
                    key={agency._id}
                    value={agency._id}
                    onSelect={() => handleSelectAgency(agency)}
                  >
                    <span>{agency.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>
                {searchQuery.trim() ? 'No agencies found' : 'Start typing to search agencies'}
              </CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Agent Team Search Select Component
function AgentTeamSearchSelect({
  value,
  onChange,
  disabled = false,
  selectedName,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  selectedName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [agentTeams, setAgentTeams] = useState<AgentTeam[]>([]);
  const [currentSelectedName, setCurrentSelectedName] = useState<string | undefined>(selectedName);
  const [isCleared, setIsCleared] = useState(false);
  const [loading, setLoading] = useState(false);

  // Update current selected name when prop changes
  useEffect(() => {
    if (selectedName !== undefined) {
      setCurrentSelectedName(selectedName);
      setIsCleared(false);
    }
  }, [selectedName]);

  // Reset current selected name when value becomes undefined
  useEffect(() => {
    if (!value) {
      setCurrentSelectedName(undefined);
      setIsCleared(false);
    }
  }, [value]);

  // Debounce search query
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }

    const timer = setTimeout(() => {
      searchAgentTeams(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, open]);

  // Load initial agent teams when popover opens
  useEffect(() => {
    if (open && !searchQuery.trim()) {
      searchAgentTeams('');
    }
  }, [open]);

  const searchAgentTeams = async (search: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) {
        params.append('search', search.trim());
      }
      params.append('limit', '50');

      const response = await fetch(`/api/agent-teams/search?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to search agent teams');
      }

      const data = await response.json();
      let filteredTeams = data.agentTeams || [];
      
      // Include selected team if it exists and isn't already in results
      if (value && currentSelectedName) {
        const hasSelected = filteredTeams.some((t: AgentTeam) => t._id === value);
        if (!hasSelected) {
          // Add the selected team to the top of the list
          filteredTeams = [{ _id: value, name: currentSelectedName }, ...filteredTeams];
        }
      }
      
      setAgentTeams(filteredTeams);
    } catch (error: any) {
      console.error('Error searching agent teams:', error);
      toast.error('Failed to search agent teams');
      setAgentTeams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAgentTeam = (team: AgentTeam) => {
    onChange(team._id);
    setCurrentSelectedName(team.name);
    setSearchQuery('');
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange(undefined);
    setCurrentSelectedName(undefined);
    setIsCleared(true);
  };

  return (
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
          <span className={value && currentSelectedName ? 'text-foreground' : 'text-muted-foreground'}>
            {currentSelectedName || (isCleared || !value ? 'Search and select agent team...' : 'Loading...')}
          </span>
          <div className="flex items-center gap-1">
            {value && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClear(e as any);
                  }
                }}
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100 cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded"
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search agent teams by name..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                Searching...
              </div>
            ) : agentTeams.length > 0 ? (
              <CommandGroup>
                {agentTeams.map((team) => (
                  <CommandItem
                    key={team._id}
                    value={team._id}
                    onSelect={() => handleSelectAgentTeam(team)}
                  >
                    <span>{team.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>
                {searchQuery.trim() ? 'No agent teams found' : 'Start typing to search agent teams'}
              </CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Category Search Component
function CategorySearchInput({
  selectedCategorys,
  onAddCategory,
  onRemoveCategory,
  allCategorys,
  disabled = false,
}: {
  selectedCategorys: Category[];
  onAddCategory: (tag: Category) => void;
  onRemoveCategory: (tagId: string) => void;
  allCategorys: Category[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter categories client-side based on search query
  const filteredCategorys = useMemo(() => {
    // Filter out already selected categories
    const availableCategorys = allCategorys.filter(
      (tag) => !selectedCategorys.some((st) => st._id === tag._id)
    );

    if (!searchQuery.trim()) {
      return availableCategorys;
    }

    // Filter categories by name (case-insensitive)
    const query = searchQuery.trim().toLowerCase();
    return availableCategorys.filter((tag) =>
      tag.name.toLowerCase().includes(query)
    );
  }, [searchQuery, allCategorys, selectedCategorys]);

  const handleSelectCategory = (tag: Category) => {
    onAddCategory(tag);
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
              {filteredCategorys.length > 0 ? (
                <CommandGroup>
                  {filteredCategorys.map((tag) => (
                    <CommandItem
                      key={tag._id}
                      value={tag.name}
                      onSelect={() => handleSelectCategory(tag)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div
                          className="w-3 h-3 rounded border shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span>{tag.name}</span>
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

      {selectedCategorys.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedCategorys.map((tag) => (
            <div
              key={tag._id}
              className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
            >
              <div
                className="w-3 h-3 rounded border"
                style={{ backgroundColor: tag.color }}
              />
              <span>{tag.name}</span>
              <button
                type="button"
                onClick={() => onRemoveCategory(tag._id)}
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

export default function AgentManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
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
  const [selectedFilterCategorys, setSelectedFilterCategorys] = useState<string[]>([]);
  const [availableCategorys, setAvailableCategorys] = useState<Category[]>([]);
  const [loadingCategorys, setLoadingCategorys] = useState(false);
  const [allCategorysForInput, setAllCategorysForInput] = useState<Category[]>([]);
  const [loadingAllCategorys, setLoadingAllCategorys] = useState(false);

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      ccEmail: '',
      phone: '',
      secondPhone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      birthdayMonth: undefined,
      birthdayDay: undefined,
      photoUrl: null,
      facebookUrl: '',
      linkedinUrl: '',
      twitterUrl: '',
      instagramUrl: '',
      tiktokUrl: '',
      websiteUrl: '',
      categories: [],
      agency: undefined,
      agencyPhone: '',
      agentTeam: undefined,
      internalNotes: '',
      internalAdminNotes: '',
      excludeFromMassEmail: false,
      unsubscribedFromMassEmails: false,
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = form;

  useEffect(() => {
    loadAgents(pagination.page, pagination.limit, searchQuery, selectedFilterCategorys);
  }, [pagination.page, pagination.limit, searchQuery, selectedFilterCategorys]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadAvailableCategorys();
  }, []);

  const loadAllCategorys = async () => {
    try {
      setLoadingAllCategorys(true);
      const response = await fetch('/api/categories?limit=1000', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAllCategorysForInput(data.categories || []);
      }
    } catch (error: any) {
      console.error('Error loading all categories:', error);
    } finally {
      setLoadingAllCategorys(false);
    }
  };

  const loadAvailableCategorys = async () => {
    try {
      setLoadingCategorys(true);
      const response = await fetch('/api/categories?limit=1000', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const data = await response.json();
      setAvailableCategorys(data.categories || []);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to load categories');
    } finally {
      setLoadingCategorys(false);
    }
  };

  const loadAgents = async (
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

      const response = await fetch(`/api/agents?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load agents');
      }

      const data = await response.json();
      setAgents(data.agents || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on search
  };

  const handleCategorysChange = (categories: string[]) => {
    setSelectedFilterCategorys(categories);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on filter change
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const getAgentDisplayName = (agent: Agent) => {
    return `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'Unnamed Agent';
  };

  const columns: Column<Agent>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{getAgentDisplayName(row)}</span>,
    },
    {
      id: 'email',
      header: 'Email',
      cell: (row) => <span>{row.email || '-'}</span>,
    },
    {
      id: 'phone',
      header: 'Phone',
      cell: (row) => <span>{row.phone || '-'}</span>,
    },
    {
      id: 'categories',
      header: 'Categories',
      cell: (row) => (
        <div>
          {row.categories && row.categories.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.categories.slice(0, 3).map((tag) => (
                <div
                  key={tag._id}
                  className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs"
                >
                  <div
                    className="w-2 h-2 rounded border"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>{tag.name}</span>
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
    setEditingAgent(null);
    loadAllCategorys();
    reset({
      firstName: '',
      lastName: '',
      email: '',
      ccEmail: '',
      phone: '',
      secondPhone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      birthdayMonth: undefined,
      birthdayDay: undefined,
      photoUrl: null,
      facebookUrl: '',
      linkedinUrl: '',
      twitterUrl: '',
      instagramUrl: '',
      tiktokUrl: '',
      websiteUrl: '',
      categories: [],
      agency: undefined,
      agencyPhone: '',
      agentTeam: undefined,
      internalNotes: '',
      internalAdminNotes: '',
      excludeFromMassEmail: false,
      unsubscribedFromMassEmails: false,
    });
    setDialogOpen(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    loadAllCategorys();
    // Convert category ObjectIds to names for display
    const categoryNames = (agent.categories || []).map((c) => 
      typeof c === 'object' && c.name ? c.name : String(c)
    );
    reset({
      firstName: agent.firstName || '',
      lastName: agent.lastName || '',
      email: agent.email || '',
      ccEmail: agent.ccEmail || '',
      phone: agent.phone || '',
      secondPhone: agent.secondPhone || '',
      address: agent.address || '',
      city: agent.city || '',
      state: agent.state || '',
      zip: agent.zip || '',
      birthdayMonth: agent.birthdayMonth as any || undefined,
      birthdayDay: agent.birthdayDay || undefined,
      photoUrl: agent.photoUrl || null,
      facebookUrl: agent.facebookUrl || '',
      linkedinUrl: agent.linkedinUrl || '',
      twitterUrl: agent.twitterUrl || '',
      instagramUrl: agent.instagramUrl || '',
      tiktokUrl: agent.tiktokUrl || '',
      websiteUrl: agent.websiteUrl || '',
      categories: categoryNames,
      agency: agent.agency && typeof agent.agency === 'object' ? agent.agency._id : agent.agency || undefined,
      agencyPhone: agent.agencyPhone || '',
      agentTeam: agent.agentTeam && typeof agent.agentTeam === 'object' ? agent.agentTeam._id : agent.agentTeam || undefined,
      internalNotes: agent.internalNotes || '',
      internalAdminNotes: agent.internalAdminNotes || '',
      excludeFromMassEmail: agent.excludeFromMassEmail || false,
      unsubscribedFromMassEmails: agent.unsubscribedFromMassEmails || false,
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (agent: Agent) => {
    setAgentToDelete(agent);
  };

  const handleConfirmDelete = async () => {
    if (!agentToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/agents/${agentToDelete._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }

      toast.success('Agent deleted successfully');
      await loadAgents(pagination.page, pagination.limit, searchQuery, selectedFilterCategorys);
      await loadAvailableCategorys();
      setAgentToDelete(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to delete agent');
    } finally {
      setIsDeleting(false);
    }
  };


  const onSubmit = async (values: AgentFormValues) => {
    try {
      setSaving(true);

      // Categories are now stored as strings (names) in the form
      // Filter out empty strings and send to API
      const categoryNames = (values.categories || []).filter((name) => 
        typeof name === 'string' && name.trim().length > 0
      );

      const url = editingAgent ? '/api/agents' : '/api/agents';
      const method = editingAgent ? 'PUT' : 'POST';

      // Prepare payload - handle empty strings and null values
      const payload: any = {
        ...values,
        categories: categoryNames,
        // Handle null explicitly to clear the field, undefined to keep existing value
        photoUrl: values.photoUrl === null ? null : (values.photoUrl || undefined),
        ccEmail: values.ccEmail?.trim() || undefined,
        facebookUrl: values.facebookUrl?.trim() || undefined,
        linkedinUrl: values.linkedinUrl?.trim() || undefined,
        twitterUrl: values.twitterUrl?.trim() || undefined,
        instagramUrl: values.instagramUrl?.trim() || undefined,
        tiktokUrl: values.tiktokUrl?.trim() || undefined,
        websiteUrl: values.websiteUrl?.trim() || undefined,
        // Explicitly set to null if falsy so backend receives it and can clear the field
        // If undefined/null/empty, send null. Otherwise send the value.
        agency: values.agency ? values.agency : null,
        agentTeam: values.agentTeam ? values.agentTeam : null,
      };

      if (editingAgent) {
        payload._id = editingAgent._id;
      }

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
        throw new Error(errorData.error || 'Failed to save agent');
      }

      toast.success(`Agent ${editingAgent ? 'updated' : 'created'} successfully`);
      await loadAgents(pagination.page, pagination.limit, searchQuery, selectedFilterCategorys);
      await loadAvailableCategorys();
      await loadAllCategorys();
      setDialogOpen(false);
      setEditingAgent(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to save agent');
    } finally {
      setSaving(false);
    }
  };

  const tagOptions: MultiSelectOption[] = availableCategorys.map((tag) => ({
    value: tag._id,
    label: tag.name,
    description: tag.color,
  }));

  // Category options for CreatableSelect (using names as values)
  const categoryOptions = allCategorysForInput.map((category) => ({
    value: category.name,
    label: category.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Agents</h3>
          <p className="text-sm text-muted-foreground">Manage your agents</p>
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
                  placeholder="Search by first name, last name, or email..."
                  value={searchInput}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Filter by Categories</Label>
              <MultiSelect
                value={selectedFilterCategorys}
                onChange={handleCategorysChange}
                options={tagOptions}
                placeholder="Select categories..."
                emptyText="No categories found"
                disabled={loadingCategorys}
                maxBadges={3}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Agents</CardTitle>
          <CardDescription>Manage your agents</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={agents}
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
            emptyMessage="No agents found. Click 'Create' to add your first agent."
          />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAgent ? 'Edit Agent' : 'Create Agent'}</DialogTitle>
            <DialogDescription>
              {editingAgent ? 'Update agent details' : 'Create a new agent'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Photo</Label>
              <Controller
                name="photoUrl"
                control={control}
                render={({ field }) => (
                  <ImageUpload
                    value={field.value || null}
                    onChange={field.onChange}
                    shape="circle"
                    disabled={saving}
                  />
                )}
              />
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
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
              </div>
            </div>

            {/* Email Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
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

            {/* Phone Fields */}
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
                <Label htmlFor="secondPhone">Second Phone</Label>
                <Controller
                  name="secondPhone"
                  control={control}
                  render={({ field }) => (
                    <Input id="secondPhone" type="tel" {...field} />
                  )}
                />
              </div>
            </div>

            {/* Address Fields */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Controller
                name="address"
                control={control}
                render={({ field }) => (
                  <Input id="address" {...field} />
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Controller
                  name="city"
                  control={control}
                  render={({ field }) => (
                    <Input id="city" {...field} />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Controller
                  name="state"
                  control={control}
                  render={({ field }) => (
                    <Input id="state" {...field} />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip">ZIP</Label>
                <Controller
                  name="zip"
                  control={control}
                  render={({ field }) => (
                    <Input id="zip" {...field} />
                  )}
                />
              </div>
            </div>

            {/* Birthday Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthdayMonth">Birthday Month</Label>
                <Controller
                  name="birthdayMonth"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="birthdayMonth">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month} value={month}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthdayDay">Day</Label>
                <Controller
                  name="birthdayDay"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                    >
                      <SelectTrigger id="birthdayDay">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={day} value={day.toString()}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Agency and Agent Team Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agency">Agency Name</Label>
                <Controller
                  name="agency"
                  control={control}
                  render={({ field }) => {
                    const agencyName = editingAgent && editingAgent.agency
                      ? (typeof editingAgent.agency === 'object' ? editingAgent.agency.name : undefined)
                      : undefined;
                    return (
                      <AgencySearchSelect
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                        disabled={saving}
                        selectedName={agencyName}
                      />
                    );
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agentTeam">Agent Team</Label>
                <Controller
                  name="agentTeam"
                  control={control}
                  render={({ field }) => {
                    const teamName = editingAgent && editingAgent.agentTeam
                      ? (typeof editingAgent.agentTeam === 'object' ? editingAgent.agentTeam.name : undefined)
                      : undefined;
                    return (
                      <AgentTeamSearchSelect
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                        disabled={saving}
                        selectedName={teamName}
                      />
                    );
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agencyPhone">Agency Phone</Label>
              <Controller
                name="agencyPhone"
                control={control}
                render={({ field }) => (
                  <Input id="agencyPhone" type="tel" {...field} placeholder="Enter agency phone" />
                )}
              />
            </div>

            {/* Categorys */}
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
                    options={categoryOptions}
                    placeholder="Type and press Enter to add categories..."
                    isClearable
                    isDisabled={saving || loadingAllCategorys}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
                  />
                )}
              />
            </div>

            {/* Social Media URLs */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium">Social Media & Links</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="facebookUrl">Facebook URL</Label>
                  <Controller
                    name="facebookUrl"
                    control={control}
                    render={({ field }) => (
                      <Input id="facebookUrl" type="url" placeholder="https://facebook.com/..." {...field} />
                    )}
                  />
                  {errors.facebookUrl && (
                    <p className="text-sm text-destructive">{errors.facebookUrl.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                  <Controller
                    name="linkedinUrl"
                    control={control}
                    render={({ field }) => (
                      <Input id="linkedinUrl" type="url" placeholder="https://linkedin.com/in/..." {...field} />
                    )}
                  />
                  {errors.linkedinUrl && (
                    <p className="text-sm text-destructive">{errors.linkedinUrl.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitterUrl">Twitter URL</Label>
                  <Controller
                    name="twitterUrl"
                    control={control}
                    render={({ field }) => (
                      <Input id="twitterUrl" type="url" placeholder="https://twitter.com/..." {...field} />
                    )}
                  />
                  {errors.twitterUrl && (
                    <p className="text-sm text-destructive">{errors.twitterUrl.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instagramUrl">Instagram URL</Label>
                  <Controller
                    name="instagramUrl"
                    control={control}
                    render={({ field }) => (
                      <Input id="instagramUrl" type="url" placeholder="https://instagram.com/..." {...field} />
                    )}
                  />
                  {errors.instagramUrl && (
                    <p className="text-sm text-destructive">{errors.instagramUrl.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tiktokUrl">TikTok URL</Label>
                  <Controller
                    name="tiktokUrl"
                    control={control}
                    render={({ field }) => (
                      <Input id="tiktokUrl" type="url" placeholder="https://tiktok.com/@..." {...field} />
                    )}
                  />
                  {errors.tiktokUrl && (
                    <p className="text-sm text-destructive">{errors.tiktokUrl.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website URL</Label>
                  <Controller
                    name="websiteUrl"
                    control={control}
                    render={({ field }) => (
                      <Input id="websiteUrl" type="url" placeholder="https://..." {...field} />
                    )}
                  />
                  {errors.websiteUrl && (
                    <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Controller
                  name="excludeFromMassEmail"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="excludeFromMassEmail"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      />
                      <Label htmlFor="excludeFromMassEmail" className="font-medium cursor-pointer">
                        Exclude from Mass Email - Do not contact
                      </Label>
                    </div>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Controller
                  name="unsubscribedFromMassEmails"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="unsubscribedFromMassEmails"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      />
                      <Label htmlFor="unsubscribedFromMassEmails" className="font-medium cursor-pointer">
                        Unsubscribed from Mass Emails
                      </Label>
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Internal Notes */}
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
                  setEditingAgent(null);
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
                  editingAgent ? 'Update' : 'Create'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(agentToDelete)} onOpenChange={(open) => !open && !isDeleting && setAgentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{agentToDelete ? getAgentDisplayName(agentToDelete) : ''}"? This action cannot be undone.
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

