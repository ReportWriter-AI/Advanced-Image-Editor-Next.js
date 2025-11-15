"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AlertCircle, BadgeCheck, Loader2, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DiscountCode {
  _id: string;
  code: string;
  type: "percent" | "amount";
  value: number;
  description?: string;
  notes?: string;
  appliesToServicesDetails: Array<{
    serviceId: string;
    serviceName: string | null;
  }>;
  appliesToAddOnsDetails: Array<{
    serviceId: string;
    serviceName: string | null;
    addOnName: string;
  }>;
  maxUses?: number;
  expirationDate?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

export default function DiscountCodesPage() {
  const router = useRouter();
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<MessageState>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<DiscountCode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDiscountCodes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/discount-codes", { credentials: "include" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch discount codes");
      }
      setDiscountCodes(Array.isArray(result.discountCodes) ? result.discountCodes : []);
    } catch (error: any) {
      console.error("Error fetching discount codes:", error);
      setMessage({ type: "error", text: error.message || "Failed to load discount codes" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscountCodes();
  }, [fetchDiscountCodes]);

  const noCodes = useMemo(() => !loading && discountCodes.length === 0, [loading, discountCodes.length]);

  const openDeleteDialog = (code: DiscountCode) => {
    setCodeToDelete(code);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!codeToDelete?._id) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/discount-codes/${codeToDelete._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete discount code");
      }
      toast.success("Discount code deleted");
      setDeleteDialogOpen(false);
      setCodeToDelete(null);
      fetchDiscountCodes();
    } catch (error: any) {
      console.error("Delete discount code error:", error);
      toast.error(error.message || "Failed to delete discount code");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderAssociations = (items: string[]) => {
    if (!items.length) {
      return <span className="text-xs text-muted-foreground">None</span>;
    }

    const preview = items.slice(0, 2);
    const remaining = items.length - preview.length;
    const content = preview.join(", ");

    if (remaining <= 0) {
      return <span className="text-xs text-muted-foreground">{content}</span>;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default text-xs text-muted-foreground underline">{`${preview.join(", ")} +${remaining} more`}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">
            {items.join(", ")}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Discount Codes</h1>
            <p className="text-muted-foreground">
              Manage promotional codes for your services and add-ons.
            </p>
          </div>
          <Button onClick={() => router.push("/discount-codes/create")}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Discount Code
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
                <BadgeCheck className="h-5 w-5 text-green-600" />
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
              Loading discount codes...
            </CardContent>
          </Card>
        ) : noCodes ? (
          <Card>
            <CardContent className="space-y-4 p-10 text-center text-muted-foreground">
              <p>No discount codes yet.</p>
              <Button variant="link" onClick={() => router.push("/discount-codes/create")}>
                Create your first discount code
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Existing Codes</CardTitle>
              <CardDescription>View and manage discount codes available to your clients.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full divide-y divide-muted border-collapse text-sm">
                <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Services</th>
                    <th className="px-4 py-3">Add-ons</th>
                    <th className="px-4 py-3">Max Uses</th>
                    <th className="px-4 py-3">Expiration</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted">
                  {discountCodes.map((code) => {
                    const serviceNames = code.appliesToServicesDetails
                      .map((detail) => detail.serviceName || "Unknown service");
                    const addOnNames = code.appliesToAddOnsDetails.map(
                      (detail) => `${detail.addOnName} (${detail.serviceName || "Service"})`
                    );
                    const formattedValue =
                      code.type === "percent"
                        ? `${code.value.toFixed(2)}%`
                        : `$${code.value.toFixed(2)}`;
                    const expiration = code.expirationDate
                      ? format(new Date(code.expirationDate), "PPP")
                      : "No expiration";
                    const maxUsesLabel =
                      typeof code.maxUses === "number" ? code.maxUses : "Unlimited";

                    return (
                      <tr key={code._id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 align-top font-medium text-foreground">{code.code}</td>
                        <td className="px-4 py-3 align-top capitalize">{code.type}</td>
                        <td className="px-4 py-3 align-top">{formattedValue}</td>
                        <td className="px-4 py-3 align-top">{renderAssociations(serviceNames)}</td>
                        <td className="px-4 py-3 align-top">{renderAssociations(addOnNames)}</td>
                        <td className="px-4 py-3 align-top">{maxUsesLabel}</td>
                        <td className="px-4 py-3 align-top text-sm text-muted-foreground">{expiration}</td>
                        <td className="px-4 py-3 text-center align-top">
                          <Badge variant={code.active ? "secondary" : "outline"}>
                            {code.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right align-top">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => router.push(`/discount-codes/${code._id}`)}
                              title="Edit discount code"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => openDeleteDialog(code)}
                              title="Delete discount code"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Discount Code</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-semibold">{codeToDelete?.code}</span>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setCodeToDelete(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}


