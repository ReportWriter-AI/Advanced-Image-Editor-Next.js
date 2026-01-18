"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/ui/data-table';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Edit, Trash2, Plus, RotateCcw, Search } from 'lucide-react';
import { format } from 'date-fns';

interface Inspection {
  id: string;
  date: string;
  inspectionEndTime?: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  clients?: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    isCompany?: boolean;
    formattedName?: string;
  }>;
  agents?: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    formattedName?: string;
  }>;
  listingAgent?: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    formattedName?: string;
  }>;
}

const mapInspection = (item: any): Inspection => ({
  id: (item && (item.id || item._id))?.toString?.() || Math.random().toString(36).slice(2, 9),
  date: item?.date
    ? new Date(item.date).toLocaleDateString()
    : new Date().toLocaleDateString(),
  inspectionEndTime: item?.inspectionEndTime?.date || undefined,
  location: item?.location || undefined,
  clients: item?.clients || [],
  agents: item?.agents || [],
  listingAgent: item?.listingAgent || [],
});

export default function InspectionsPage() {
  const router = useRouter();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectionPendingDelete, setInspectionPendingDelete] = useState<string | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'today' | 'tomorrow' | 'pending' | 'in-progress' | 'trash'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch inspections on component mount and when filter/search changes
  useEffect(() => {
    fetchInspections();
  }, [filter, searchQuery]);

  const fetchInspections = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('filter', filter);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      
      const url = `/api/inspections${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const mappedInspections: Inspection[] = Array.isArray(data)
          ? data.map(mapInspection)
          : [];
        setInspections(mappedInspections);
      } else {
        console.error('Failed to fetch inspections');
      }
    } catch (error) {
      console.error('Error fetching inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle row click to open inspection editor
  const handleRowClick = (inspectionId: string) => {
    router.push(`/inspections/${inspectionId}/edit`);
  };

  // Handle document click to view inspection report
  const handleDocumentClick = (inspectionId: string) => {
    router.push(`/inspection_report/${inspectionId}`);
  };

  // Handle edit click to edit inspection defects
  const handleEditClick = (inspectionId: string) => {
    router.push(`/inspections/${inspectionId}/edit`);
  };

  // Handle delete click to delete inspection
  const handleDeleteClick = (inspectionId: string) => {
    setDeleteError(null);
    setInspectionPendingDelete(inspectionId);
  };

  const confirmDeleteInspection = async () => {
    if (!inspectionPendingDelete) return;

    try {
      setDeleteInFlight(true);
      setDeleteError(null);

      const response = await fetch(`/api/inspections/${inspectionPendingDelete}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete inspection');
      }

      // Refresh the inspections list
      await fetchInspections();
      setInspectionPendingDelete(null);
    } catch (error: any) {
      console.error('Error deleting inspection:', error);
      setDeleteError(error.message || 'Failed to delete inspection');
    } finally {
      setDeleteInFlight(false);
    }
  };

  const closeDeleteDialog = () => {
    if (deleteInFlight) return;
    setInspectionPendingDelete(null);
    setDeleteError(null);
  };

  const handleAddInspection = () => {
    router.push('/inspections/create');
  };

  // Helper function to format client names (comma-separated)
  const formatClientNames = (clients: Inspection['clients']): string => {
    if (!clients || !Array.isArray(clients) || clients.length === 0) return '';
    return clients
      .map((client) => {
        if (client.formattedName) return client.formattedName;
        if (client.isCompany) return client.companyName || '';
        const name = `${client.firstName || ''} ${client.lastName || ''}`.trim();
        return name || '';
      })
      .filter((name) => name)
      .join(', ');
  };

  // Helper function to format agent names (comma-separated)
  const formatAgentNames = (agents: Inspection['agents']): string => {
    if (!agents || !Array.isArray(agents) || agents.length === 0) return '';
    return agents
      .map((agent) => {
        if (agent.formattedName) return agent.formattedName;
        const name = `${agent.firstName || ''} ${agent.lastName || ''}`.trim();
        return name || '';
      })
      .filter((name) => name)
      .join(', ');
  };

  // Helper function to format listing agent names (comma-separated)
  const formatListingAgentNames = (listingAgents: Inspection['listingAgent']): string => {
    if (!listingAgents || !Array.isArray(listingAgents) || listingAgents.length === 0) return '';
    return listingAgents
      .map((agent) => {
        if (agent.formattedName) return agent.formattedName;
        const name = `${agent.firstName || ''} ${agent.lastName || ''}`.trim();
        return name || '';
      })
      .filter((name) => name)
      .join(', ');
  };

  // Handle undelete click to restore inspection
  const handleUndeleteClick = async (inspectionId: string) => {
    try {
      setDeleteInFlight(true);
      setDeleteError(null);

      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PATCH',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to restore inspection');
      }

      // Refresh the inspections list
      await fetchInspections();
    } catch (error: any) {
      console.error('Error restoring inspection:', error);
      setDeleteError(error.message || 'Failed to restore inspection');
    } finally {
      setDeleteInFlight(false);
    }
  };

  const columns: Column<Inspection>[] = [
    {
      id: 'address',
      header: 'Address',
      cell: (row) => (
        <span className="text-muted-foreground">{row.location?.address || ''}</span>
      ),
    },
    {
      id: 'city',
      header: 'City',
      cell: (row) => (
        <span className="text-muted-foreground">{row.location?.city || ''}</span>
      ),
    },
    {
      id: 'state',
      header: 'State',
      cell: (row) => (
        <span className="text-muted-foreground">{row.location?.state || ''}</span>
      ),
    },
    {
      id: 'zip',
      header: 'Zip',
      cell: (row) => (
        <span className="text-muted-foreground">{row.location?.zip || ''}</span>
      ),
    },
    {
      id: 'clientName',
      header: 'Client Name',
      cell: (row) => (
        <span className="text-muted-foreground">{formatClientNames(row.clients)}</span>
      ),
    },
    {
      id: 'agentName',
      header: 'Agent Name',
      cell: (row) => (
        <span className="text-muted-foreground">{formatAgentNames(row.agents)}</span>
      ),
    },
    {
      id: 'listingAgentName',
      header: 'Listing Agent Name',
      cell: (row) => (
        <span className="text-muted-foreground">{formatListingAgentNames(row.listingAgent)}</span>
      ),
    },
    {
      id: 'inspectionEndTime',
      header: 'Inspection End Time',
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.inspectionEndTime 
            ? format(new Date(row.inspectionEndTime), 'PPp') 
            : '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {filter !== 'trash' ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDocumentClick(row.id);
                }}
                className="h-8 w-8"
                title="View Document"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditClick(row.id);
                }}
                className="h-8 w-8"
                title="Edit Inspection"
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
                title="Delete Inspection"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleUndeleteClick(row.id);
              }}
              className="h-8 w-8"
              title="Restore Inspection"
              disabled={deleteInFlight}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inspections</h1>
          <p className="text-muted-foreground mt-1">
            Manage your property inspections efficiently
          </p>
        </div>
        <Button onClick={handleAddInspection}>
          <Plus className="h-4 w-4 mr-2" />
          Add Inspection
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="space-y-4">
        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('today')}
          >
            Today
          </Button>
          <Button
            variant={filter === 'tomorrow' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('tomorrow')}
          >
            Tomorrow
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pending
          </Button>
          <Button
            variant={filter === 'in-progress' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('in-progress')}
          >
            In Progress
          </Button>
          <Button
            variant={filter === 'trash' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('trash')}
          >
            Trash
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by address, city, state, zip, client name, agent name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={inspections}
        loading={loading}
        emptyMessage="No inspections found. Get started by creating your first inspection."
        onRowClick={(row) => handleRowClick(row.id)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(inspectionPendingDelete)} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inspection?</AlertDialogTitle>
            <AlertDialogDescription>
              This inspection will be moved to trash. You can restore it later if needed.
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
              onClick={confirmDeleteInspection}
              disabled={deleteInFlight}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInFlight ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
