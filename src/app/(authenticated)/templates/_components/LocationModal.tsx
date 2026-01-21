"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreatableTagInput } from "@/components/ui/creatable-tag-input";
import { useReusableDropdownsQuery, useUpdateReusableDropdownsMutation, type ReusableDropdown } from "@/components/api/queries/reusableDropdowns";
import { Loader2 } from "lucide-react";

interface LocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationModal({ open, onOpenChange }: LocationModalProps) {
  const { data: dropdownsData, isLoading, error } = useReusableDropdownsQuery();
  const updateMutation = useUpdateReusableDropdownsMutation();
  
  // Convert API format (Array<{id, value}>) to CreatableTagInput format (string[])
  const locationValues = useMemo(() => {
    if (!dropdownsData?.data?.location) return [];
    return dropdownsData.data.location.map((item: { id: string; value: string }) => item.value);
  }, [dropdownsData]);

  // Store the original location array to maintain IDs
  const originalLocations = useMemo(() => {
    if (!dropdownsData?.data?.location) return [];
    return dropdownsData.data.location;
  }, [dropdownsData]);

  // Optimistic state for immediate UI updates
  const [optimisticLocationValues, setOptimisticLocationValues] = useState<string[]>([]);

  // Sync optimistic state with query data (only when not pending mutation)
  useEffect(() => {
    if (locationValues.length > 0 && !updateMutation.isPending) {
      setOptimisticLocationValues(locationValues);
    } else if (locationValues.length === 0 && !updateMutation.isPending) {
      // Handle case when locations are cleared
      setOptimisticLocationValues([]);
    }
  }, [locationValues, updateMutation.isPending]);

  const handleLocationChange = (newValues: string[]) => {
    // Immediately update optimistic state for instant UI feedback
    setOptimisticLocationValues(newValues);

    // Convert string[] back to Array<{id, value}>
    const updatedLocations = newValues.map((value: string) => {
      // Try to find existing location with this value to preserve ID
      const existing = originalLocations.find((loc: { id: string; value: string }) => loc.value === value);
      if (existing) {
        return existing;
      }
      // Generate new ID for new locations
      return {
        id: crypto.randomUUID(),
        value: value.trim(),
      };
    });

    // Update only the location field, preserving other fields
    updateMutation.mutate({
      location: updatedLocations,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Locations</DialogTitle>
          <DialogDescription>
            Add or remove locations. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">
                Failed to load locations. Please try again.
              </p>
            </div>
          ) : (
            <CreatableTagInput
              value={optimisticLocationValues.length > 0 ? optimisticLocationValues : locationValues}
              onChange={handleLocationChange}
              label="Locations"
              placeholder="Add a location..."
              helperText="Type and press Enter to add a new location"
              disabled={updateMutation.isPending}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
