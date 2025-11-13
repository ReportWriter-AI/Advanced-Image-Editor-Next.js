"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  GripVertical,
  Info,
  Layers,
  Loader2,
  Pencil,
  PlusCircle,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

interface Service {
  _id: string;
  name: string;
  serviceCategory: string;
  description?: string;
  hiddenFromScheduler: boolean;
  baseCost: number;
  baseDurationHours: number;
  defaultInspectionEvents: string[];
  organizationServiceId?: string;
  orderIndex?: number;
  createdAt: string;
  updatedAt: string;
}

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<MessageState>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const orderedServices = useMemo(() => {
    return [...services].sort((a, b) => {
      const aOrder = Number.isFinite(a.orderIndex) ? (a.orderIndex as number) : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(b.orderIndex) ? (b.orderIndex as number) : Number.MAX_SAFE_INTEGER;

      if (aOrder === bOrder) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      return aOrder - bOrder;
    });
  }, [services]);

  const noServices = useMemo(
    () => !loading && orderedServices.length === 0,
    [loading, orderedServices.length]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/services", { credentials: "include" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to fetch services");
      }

      const data = await response.json();
      const normalized: Service[] = Array.isArray(data.services)
        ? data.services.map((service: Service, index: number) => ({
            ...service,
            orderIndex:
              typeof service.orderIndex === "number" && Number.isFinite(service.orderIndex)
                ? service.orderIndex
                : index + 1,
          }))
        : [];
      setServices(normalized);
    } catch (error: any) {
      console.error("Error fetching services:", error);
      setMessage({ type: "error", text: error.message || "Failed to load services" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const openDeleteDialog = (service: Service) => {
    if (reorderBusy) {
      return;
    }
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/services/${serviceToDelete._id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete service");
      }

      setMessage({ type: "success", text: result.message || "Service deleted" });
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
      fetchServices();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to delete service" });
    } finally {
      setIsDeleting(false);
    }
  };

  const commitReorder = useCallback(
    async (nextServices: Service[]) => {
      setReorderBusy(true);
      try {
        const payload = nextServices.map((service, index) => ({
          id: service._id,
          order: index + 1,
        }));

        const response = await fetch("/api/services/reorder", {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ services: payload }),
        });

        if (!response.ok) {
          const json = await response.json().catch(() => ({}));
          throw new Error((json as { error?: string }).error || "Failed to reorder services");
        }

        toast.success("Service order updated");
      } catch (error: any) {
        console.error("Error reordering services:", error);
        setMessage({ type: "error", text: error.message || "Failed to reorder services" });
        await fetchServices();
        toast.error(error.message || "Failed to reorder services");
      } finally {
        setReorderBusy(false);
      }
    },
    [fetchServices]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (reorderBusy || loading) {
        return;
      }

      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = orderedServices.findIndex((service) => service._id === active.id);
      const newIndex = orderedServices.findIndex((service) => service._id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(orderedServices, oldIndex, newIndex).map((service, index) => ({
        ...service,
        orderIndex: index + 1,
      }));

      setServices(reordered);
      void commitReorder(reordered);
    },
    [orderedServices, commitReorder, reorderBusy, loading]
  );

  const reorderDisabled =
    reorderBusy || loading || isDeleting || duplicatingId !== null || orderedServices.length <= 1;

  const handleDuplicateService = useCallback(
    async (serviceId: string) => {
      if (reorderBusy || loading || isDeleting || duplicatingId !== null) {
        return;
      }

      setDuplicatingId(serviceId);
      try {
        const response = await fetch(`/api/services/${serviceId}/duplicate`, {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          const json = await response.json().catch(() => ({}));
          throw new Error((json as { error?: string }).error || "Failed to duplicate service");
        }

        toast.success("Service duplicated");
        await fetchServices();
      } catch (error: any) {
        console.error("Duplicate service error:", error);
        toast.error(error.message || "Failed to duplicate service");
      } finally {
        setDuplicatingId(null);
      }
    },
    [fetchServices, reorderBusy, loading, isDeleting, duplicatingId]
  );

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Services</h1>
            <p className="text-muted-foreground">
              Manage your inspection services, pricing, and scheduling options.
            </p>
          </div>
          <Button onClick={() => router.push("/services/create")}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Service
          </Button>
        </div>

        {message && (
          <Card
            className={
              message.type === "success"
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }
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

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading services...
            </CardContent>
          </Card>
        ) : noServices ? (
          <Card>
            <CardContent className="space-y-4 p-10 text-center text-muted-foreground">
              <p>No services found yet.</p>
              <Link href="/services/create" className="text-primary underline">
                Create your first service
              </Link>
            </CardContent>
          </Card>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full divide-y divide-muted border-collapse text-sm">
                <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center">Order</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Base Cost</th>
                    <th className="px-4 py-3">Base Duration</th>
                    <th className="px-4 py-3">Default Events</th>
                    <th className="px-4 py-3">Org Service ID</th>
                    <th className="px-4 py-3 text-center">Hidden</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <SortableContext
                  items={orderedServices.map((service) => service._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="divide-y divide-muted">
                    {orderedServices.map((service) => (
                      <SortableServiceRow
                        key={service._id}
                        service={service}
                        reorderDisabled={reorderDisabled}
                        reorderBusy={reorderBusy}
                        duplicatingId={duplicatingId}
                        onEdit={() => router.push(`/services/${service._id}`)}
                        onDuplicate={() => handleDuplicateService(service._id)}
                        onDelete={() => openDeleteDialog(service)}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </div>
          </DndContext>
        )}

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Service</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {" "}
                <span className="font-semibold">{serviceToDelete?.name}</span>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setServiceToDelete(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteService} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

interface SortableServiceRowProps {
  service: Service;
  reorderDisabled: boolean;
  reorderBusy: boolean;
  duplicatingId: string | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SortableServiceRow({
  service,
  reorderDisabled,
  reorderBusy,
  duplicatingId,
  onEdit,
  onDuplicate,
  onDelete,
}: SortableServiceRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: service._id,
    disabled: reorderDisabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const eventSummary = service.defaultInspectionEvents.join(", ");
  const isDuplicating = duplicatingId === service._id;
  const duplicateDisabled = reorderBusy || isDuplicating;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-muted/30 ${isDragging ? "opacity-60" : ""}`}
      data-service-id={service._id}
    >
      <td className="w-12 px-4 py-3 align-top">
        <button
          type="button"
          className={`flex h-8 w-8 items-center justify-center rounded border ${
            reorderDisabled ? "cursor-not-allowed opacity-40" : "cursor-grab hover:bg-muted"
          }`}
          aria-label="Drag to reorder"
          disabled={reorderDisabled}
          {...attributes}
          {...(!reorderDisabled ? listeners : {})}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="max-w-xs px-4 py-3 align-top">
        <span className="font-medium text-foreground">{service.name}</span>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span>{service.serviceCategory || "—"}</span>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        {service.baseCost !== undefined ? `$${service.baseCost.toFixed(2)}` : "—"}
      </td>
      <td className="px-4 py-3 align-top">
        {service.baseDurationHours !== undefined
          ? `${service.baseDurationHours.toFixed(2)} hrs`
          : "—"}
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">{eventSummary || "—"}</td>
      <td className="px-4 py-3 align-top">{service.organizationServiceId || "—"}</td>
      <td className="px-4 py-3 text-center align-top">
        {service.hiddenFromScheduler ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                Hidden
                <Info className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              This addon will not be available in your online scheduler.
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">Visible</span>
        )}
      </td>
      <td className="px-4 py-3 text-right align-top">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onDuplicate}
            title="Duplicate service"
            disabled={duplicateDisabled}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onEdit}
            title="Edit service"
            disabled={reorderBusy || isDuplicating}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={onDelete}
            title="Delete service"
            disabled={reorderBusy || isDuplicating}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}



