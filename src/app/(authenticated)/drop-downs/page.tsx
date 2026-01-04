"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, AlertCircle } from "lucide-react"

type SaveState = {
  status: "idle" | "saving" | "saved" | "error"
  message?: string
}

interface DropdownData {
  foundation: string
  role: string
  referralSources: string
}

export default function ReusableDropdownsPage() {
  const [foundation, setFoundation] = useState<string>("")
  const [role, setRole] = useState<string>("")
  const [referralSources, setReferralSources] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({
    foundation: { status: "idle" },
    role: { status: "idle" },
    referralSources: { status: "idle" },
  })
  const initializedRef = useRef(false)
  const lastSavedRef = useRef<DropdownData>({
    foundation: "",
    role: "",
    referralSources: "",
  })
  const saveTimersRef = useRef<Record<string, NodeJS.Timeout>>({})

  const fetchDropdowns = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/reusable-dropdowns", {
        credentials: "include",
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || "Failed to load dropdowns")
      }

      const data = (await response.json()) as DropdownData

      setFoundation(data.foundation || "")
      setRole(data.role || "")
      setReferralSources(data.referralSources || "")

      lastSavedRef.current = {
        foundation: data.foundation || "",
        role: data.role || "",
        referralSources: data.referralSources || "",
      }

      initializedRef.current = true
    } catch (err: any) {
      console.error("fetchDropdowns error", err)
      setError(err?.message || "Failed to load dropdowns")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDropdowns()
  }, [fetchDropdowns])

  const handleAutoSave = useCallback(
    async (field: keyof DropdownData, value: string) => {
      if (!initializedRef.current) return

      // Check if value has changed
      if (lastSavedRef.current[field] === value) {
        return
      }

      setSaveStates((prev) => ({
        ...prev,
        [field]: { status: "saving" },
      }))

      try {
        const response = await fetch("/api/reusable-dropdowns", {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            [field]: value,
          }),
        })

        if (!response.ok) {
          const result = await response.json().catch(() => ({}))
          throw new Error(result.error || "Failed to update dropdowns")
        }

        const result = await response.json() as DropdownData

        // Update last saved values
        lastSavedRef.current = {
          ...lastSavedRef.current,
          [field]: result[field] || "",
        }

        setSaveStates((prev) => ({
          ...prev,
          [field]: { status: "idle" },
        }))

        toast.success("Saved successfully")
      } catch (err: any) {
        console.error("autoSave error", err)
        setSaveStates((prev) => ({
          ...prev,
          [field]: { status: "error", message: err?.message || "Update failed" },
        }))
        toast.error(err?.message || "Failed to save")
      }
    },
    []
  )

  const handleFieldChange = useCallback(
    (field: keyof DropdownData, value: string) => {
      // Update local state
      if (field === "foundation") {
        setFoundation(value)
      } else if (field === "role") {
        setRole(value)
      } else if (field === "referralSources") {
        setReferralSources(value)
      }

      // Clear existing timer for this field
      if (saveTimersRef.current[field]) {
        clearTimeout(saveTimersRef.current[field])
      }

      // Set new timer for auto-save (5 seconds)
      saveTimersRef.current[field] = setTimeout(() => {
        handleAutoSave(field, value)
      }, 5000)
    },
    [handleAutoSave]
  )

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer)
      })
    }
  }, [])

  const getStatusIcon = (state: SaveState) => {
    if (state.status === "saving") {
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />
    }
    if (state.status === "error") {
      return <AlertCircle className="h-4 w-4 text-destructive" />
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border/50 bg-card/60 py-16 backdrop-blur-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading dropdowns...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Drop-Downs</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Manage dropdown options for foundation, role, and referral sources.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">{error}</p>
              </div>
            </div>
          </div>
        )}

        <Card className="overflow-hidden border border-border/50 bg-gradient-to-br from-card via-card to-card/80 shadow-lg backdrop-blur-sm">
          <CardHeader className="space-y-4 border-b border-border/30 bg-gradient-to-r from-muted/20 to-transparent px-6 py-5">
            <CardTitle className="text-xl">Drop-Downs</CardTitle>
            <CardDescription>
              Write values as comma-separated (e.g., Value1, Value2, Value3)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Foundation Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="foundation">Foundation</Label>
                {getStatusIcon(saveStates.foundation)}
              </div>
              <Input
                id="foundation"
                value={foundation}
                onChange={(e) => handleFieldChange("foundation", e.target.value)}
                placeholder="Enter foundation options..."
              />
              {saveStates.foundation.status === "error" && saveStates.foundation.message && (
                <p className="text-sm text-destructive">{saveStates.foundation.message}</p>
              )}
            </div>

            {/* Role Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="role">Role</Label>
                {getStatusIcon(saveStates.role)}
              </div>
              <Input
                id="role"
                value={role}
                onChange={(e) => handleFieldChange("role", e.target.value)}
                placeholder="Enter role options..."
              />
              {saveStates.role.status === "error" && saveStates.role.message && (
                <p className="text-sm text-destructive">{saveStates.role.message}</p>
              )}
            </div>

            {/* Referral Sources Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="referralSources">Referral Sources</Label>
                {getStatusIcon(saveStates.referralSources)}
              </div>
              <Input
                id="referralSources"
                value={referralSources}
                onChange={(e) => handleFieldChange("referralSources", e.target.value)}
                placeholder="Enter referral source options..."
              />
              {saveStates.referralSources.status === "error" && saveStates.referralSources.message && (
                <p className="text-sm text-destructive">{saveStates.referralSources.message}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

