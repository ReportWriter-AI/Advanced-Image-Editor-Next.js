"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Plus } from "lucide-react";
import { getTriggerByKey } from "@/src/lib/automation-triggers";

interface Action {
  id: string;
  name: string;
  category: string | { _id: string; name: string };
  automationTrigger: string;
  isActive: boolean;
  conditions?: Array<{
    type: string;
    operator: string;
    value?: string;
    serviceId?: string;
    addonName?: string;
    serviceCategory?: string;
    categoryId?: string;
    yearBuild?: number;
    foundation?: string;
    squareFeet?: number;
    zipCode?: string;
    city?: string;
    state?: string;
  }>;
  conditionLogic?: "AND" | "OR";
  communicationType?: "EMAIL" | "TEXT";
  sendTiming?: "AFTER" | "BEFORE";
  sendDelay?: number;
  sendDelayUnit?: "MINUTES" | "HOURS" | "DAYS" | "WEEKS" | "MONTHS";
  onlyTriggerOnce?: boolean;
  // alsoSendOnRecurringInspections?: boolean;
  sendEvenWhenNotificationsDisabled?: boolean;
  sendDuringCertainHoursOnly?: boolean;
  startTime?: string;
  endTime?: string;
  doNotSendOnWeekends?: boolean;
  emailTo?: string[];
  emailCc?: string[];
  emailBcc?: string[];
  emailFrom?: "COMPANY" | "INSPECTOR";
  emailSubject?: string;
  emailBody?: string;
}

const mapAction = (item: any): Action => {
  const id = (item && (item.id || item._id))?.toString?.() || Math.random().toString(36).slice(2, 9);
  return {
    id,
    name: item?.name || "",
    category: item?.category || "",
    automationTrigger: item?.automationTrigger || "",
    isActive: item?.isActive !== undefined ? item.isActive : true,
    conditions: item?.conditions || [],
    conditionLogic: item?.conditionLogic || "AND",
    communicationType: item?.communicationType,
    sendTiming: item?.sendTiming,
    sendDelay: item?.sendDelay,
    sendDelayUnit: item?.sendDelayUnit,
    onlyTriggerOnce: item?.onlyTriggerOnce,
    // alsoSendOnRecurringInspections: item?.alsoSendOnRecurringInspections,
    sendEvenWhenNotificationsDisabled: item?.sendEvenWhenNotificationsDisabled,
    sendDuringCertainHoursOnly: item?.sendDuringCertainHoursOnly,
    startTime: item?.startTime,
    endTime: item?.endTime,
    doNotSendOnWeekends: item?.doNotSendOnWeekends,
    emailTo: item?.emailTo || [],
    emailCc: item?.emailCc || [],
    emailBcc: item?.emailBcc || [],
    emailFrom: item?.emailFrom,
    emailSubject: item?.emailSubject || "",
    emailBody: item?.emailBody || "",
  };
};

export default function ActionsList() {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPendingDelete, setActionPendingDelete] = useState<string | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchActions();
  }, []);

  const fetchActions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/automations/actions", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const mappedActions: Action[] = Array.isArray(data)
          ? data.map(mapAction)
          : [];
        setActions(mappedActions);
      } else {
        console.error("Failed to fetch actions");
      }
    } catch (error) {
      console.error("Error fetching actions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (actionId: string) => {
    router.push(`/automations/actions/${actionId}/edit`);
  };

  const handleDeleteClick = (actionId: string) => {
    setDeleteError(null);
    setActionPendingDelete(actionId);
  };

  const confirmDeleteAction = async () => {
    if (!actionPendingDelete) return;

    try {
      setDeleteInFlight(true);
      setDeleteError(null);

      const response = await fetch(`/api/automations/actions/${actionPendingDelete}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete action");
      }

      await fetchActions();
      setActionPendingDelete(null);
    } catch (error: any) {
      console.error("Error deleting action:", error);
      setDeleteError(error.message || "Failed to delete action");
    } finally {
      setDeleteInFlight(false);
    }
  };

  const closeDeleteDialog = () => {
    if (deleteInFlight) return;
    setActionPendingDelete(null);
    setDeleteError(null);
  };

  const handleAddAction = () => {
    router.push("/automations/actions/new");
  };

  const getCategoryName = (category: string | { _id: string; name: string }): string => {
    if (typeof category === "string") {
      return category;
    }
    return category?.name || "—";
  };

  const getTriggerTitle = (triggerKey: string): string => {
    const trigger = getTriggerByKey(triggerKey);
    return trigger?.title || triggerKey;
  };

  const columns: Column<Action>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => <span className="text-muted-foreground">{row.name}</span>,
    },
    {
      id: "category",
      header: "Category",
      cell: (row) => (
        <span className="text-muted-foreground">{getCategoryName(row.category)}</span>
      ),
    },
    {
      id: "automationTrigger",
      header: "Trigger",
      cell: (row) => (
        <span className="text-muted-foreground">{getTriggerTitle(row.automationTrigger)}</span>
      ),
    },
    {
      id: "isActive",
      header: "Status",
      cell: (row) => (
        <span className={row.isActive ? "text-green-600" : "text-muted-foreground"}>
          {row.isActive ? "Active" : "Inactive"}
        </span>
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
            title="Edit Action"
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
            title="Delete Action"
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
          <h2 className="text-2xl font-bold tracking-tight">Actions</h2>
          <p className="text-muted-foreground mt-1">Manage your automation actions</p>
        </div>
        <Button onClick={handleAddAction}>
          <Plus className="h-4 w-4 mr-2" />
          Add Action
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={actions}
        loading={loading}
        emptyMessage="No actions found. Get started by creating your first action."
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(actionPendingDelete)} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete action?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the action.
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
              onClick={confirmDeleteAction}
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
