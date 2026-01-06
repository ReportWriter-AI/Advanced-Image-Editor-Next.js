"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Controller, FormProvider, useFieldArray, useForm, useFormContext, useWatch } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { DAY_KEYS, type DayKey, DAY_LABELS } from "@/src/constants/availability"
import {
  ALLOWED_TIMES,
  normalizeDaysRecord,
  timeToMinutes,
  validateOpenSchedule,
  validateTimeSlots,
  formatTimeLabel,
} from "@/src/lib/availability-utils"
import { toast } from "sonner"
import type { TimeBlock } from "@/src/models/Availability"
import {
  AlertCircle,
  CalendarIcon,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  PlusCircle,
  RefreshCw,
  X,
} from "lucide-react"
import { format } from "date-fns"

type AvailabilityMode = "openSchedule" | "timeSlots"

type TimeBlockForm = {
  start: string
  end: string
}

type TimeSlotForm = {
  time: string
}

type DayForm = {
  openSchedule: TimeBlockForm[]
  timeSlots: TimeSlotForm[]
}

type DateSpecificForm = {
  date: Date | null
  start: string
  end: string
}

type InspectorForm = {
  inspectorId: string
  inspectorName: string
  inspectorFirstName: string
  email?: string
  days: Record<DayKey, DayForm>
  dateSpecific: DateSpecificForm[]
}

type AvailabilityFormValues = {
  viewMode: AvailabilityMode
  inspectors: InspectorForm[]
}

interface AvailabilityApiInspector {
  inspectorId: string
  inspectorName: string
  inspectorFirstName: string
  email?: string
  availability: Record<DayKey, { openSchedule: TimeBlock[]; timeSlots: string[] }>
  dateSpecific: Array<{ date: string; start: string; end: string }>
}

interface AvailabilityApiResponse {
  inspectors: AvailabilityApiInspector[]
  allowedTimes?: string[]
  viewMode?: AvailabilityMode
}

type SaveState = {
  status: "idle" | "saving" | "saved" | "error"
  message?: string
}

const DEFAULT_FORM_VALUES: AvailabilityFormValues = {
  viewMode: "openSchedule",
  inspectors: [],
}

function createEmptyDay(): DayForm {
  return {
    openSchedule: [],
    timeSlots: [],
  }
}

const todayStartOfDay = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function parseISODate(value: string): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

function formatDateToISO(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function buildInspectorPayload(days: Record<DayKey, DayForm>, dateSpecific: DateSpecificForm[] | undefined) {
  const dayPayload = DAY_KEYS.reduce(
    (acc, day) => {
      const current = days?.[day] ?? createEmptyDay()
      acc[day] = {
        openSchedule: (current.openSchedule ?? []).map((block) => ({
          start: block.start,
          end: block.end,
        })),
        timeSlots: (current.timeSlots ?? []).map((slot) => slot.time),
      }
      return acc
    },
    {} as Record<DayKey, { openSchedule: TimeBlock[]; timeSlots: string[] }>,
  )

  const dateSpecificPayload =
    dateSpecific
      ?.filter((entry) => entry.date && entry.start)
      .map((entry) => ({
        date: formatDateToISO(entry.date!),
        start: entry.start,
        end: entry.end && entry.end !== "" ? entry.end : entry.start,
      })) ?? []

  return {
    days: dayPayload,
    dateSpecific: dateSpecificPayload,
  }
}

function mapInspectorToForm(inspector: AvailabilityApiInspector): InspectorForm {
  const normalized = normalizeDaysRecord(inspector.availability)

  return {
    inspectorId: inspector.inspectorId,
    inspectorName: inspector.inspectorName,
    inspectorFirstName: inspector.inspectorFirstName,
    email: inspector.email,
    days: DAY_KEYS.reduce(
      (acc, day) => {
        const dayData = normalized[day] ?? { openSchedule: [], timeSlots: [] }

        const sortedBlocks = [...(dayData.openSchedule ?? [])].sort(
          (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start),
        )

        acc[day] = {
          openSchedule: sortedBlocks.map((block) => ({
            start: block.start,
            end: block.end,
          })),
          timeSlots: (dayData.timeSlots ?? []).map((time) => ({ time })),
        }
        return acc
      },
      {} as Record<DayKey, DayForm>,
    ),
    dateSpecific:
      inspector.dateSpecific?.map((entry) => ({
        date: parseISODate(entry.date),
        start: entry.start,
        end: entry.end ?? entry.start,
      })) ?? [],
  }
}

function findNextAvailableBlock(blocks: TimeBlockForm[], allowedTimes: string[]): TimeBlockForm | null {
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))

  for (let i = 0; i < allowedTimes.length - 1; i += 1) {
    const candidateStart = allowedTimes[i]
    const candidateEnd = allowedTimes[i + 1]

    const overlap = sorted.some((block) => {
      return (
        timeToMinutes(candidateStart) < timeToMinutes(block.end) &&
        timeToMinutes(candidateEnd) > timeToMinutes(block.start)
      )
    })

    if (!overlap) {
      return { start: candidateStart, end: candidateEnd }
    }
  }

  return null
}

function addMinutesToTime(value: string | undefined | null, minutesToAdd: number) {
  if (!value || typeof value !== "string") {
    // Return a safe default (00:00 + minutesToAdd) if value is undefined/null
    const defaultMinutes = minutesToAdd
    const clamped = Math.min(Math.max(defaultMinutes, 0), 23 * 60 + 59)
    const newHours = Math.floor(clamped / 60)
    const newMinutes = clamped % 60
    return `${newHours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`
  }
  const [hours, minutes] = value.split(":").map(Number)
  const totalMinutes = hours * 60 + minutes + minutesToAdd
  const clamped = Math.min(Math.max(totalMinutes, 0), 23 * 60 + 59)
  const newHours = Math.floor(clamped / 60)
  const newMinutes = clamped % 60
  return `${newHours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`
}

function AvailabilityPage() {
  const form = useForm<AvailabilityFormValues>({
    defaultValues: DEFAULT_FORM_VALUES,
  })
  const [allowedTimes, setAllowedTimes] = useState<string[]>(ALLOWED_TIMES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})
  const [updatingViewMode, setUpdatingViewMode] = useState(false)
  const initializedRef = useRef(false)
  const lastSavedPayloadRef = useRef<Record<string, string>>({})
  const abortControllersRef = useRef<Record<string, AbortController>>({})
  const debounceTimersRef = useRef<Record<string, NodeJS.Timeout>>({})
  const requestVersionsRef = useRef<Record<string, number>>({})

  const viewMode = useWatch({ control: form.control, name: "viewMode" })

  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/availability", {
        credentials: "include",
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || "Failed to load availability")
      }

      const data = (await response.json()) as AvailabilityApiResponse

      const mappedInspectors = (data.inspectors ?? []).map(mapInspectorToForm)
      const nextAllowedTimes = data.allowedTimes && data.allowedTimes.length > 0 ? data.allowedTimes : ALLOWED_TIMES

      setAllowedTimes(nextAllowedTimes)
      const serverViewMode: AvailabilityMode =
        data.viewMode === "timeSlots" ? "timeSlots" : "openSchedule"
      form.reset({
        viewMode: serverViewMode,
        inspectors: mappedInspectors,
      })

      const initialPayloads: Record<string, string> = {}
      mappedInspectors.forEach((inspector) => {
        initialPayloads[inspector.inspectorId] = JSON.stringify(
          buildInspectorPayload(inspector.days, inspector.dateSpecific),
        )
      })
      lastSavedPayloadRef.current = initialPayloads
      setSaveStates({})

      initializedRef.current = true
    } catch (err: any) {
      console.error("fetchAvailability error", err)
      const errorMessage = err?.message || "Failed to load availability"
      setError(errorMessage)
      toast.error(errorMessage, {
        duration: 5000,
        action: {
          label: "Retry",
          onClick: fetchAvailability,
        },
      })
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    fetchAvailability()
  }, [fetchAvailability])

  const handleAutoSave = useCallback(
    async (inspectorId: string, days: Record<DayKey, DayForm>, dateSpecific: DateSpecificForm[]) => {
      if (!initializedRef.current) return
      if (!inspectorId) return

      const payload = buildInspectorPayload(days, dateSpecific)
      const payloadKey = JSON.stringify(payload)
      
      // Skip if payload hasn't changed
      if (lastSavedPayloadRef.current[inspectorId] === payloadKey) {
        return
      }

      // Cancel any in-flight request for this inspector
      if (abortControllersRef.current[inspectorId]) {
        abortControllersRef.current[inspectorId].abort()
      }

      // Create new abort controller for this request
      const abortController = new AbortController()
      abortControllersRef.current[inspectorId] = abortController

      // Increment request version for deduplication
      const currentVersion = (requestVersionsRef.current[inspectorId] || 0) + 1
      requestVersionsRef.current[inspectorId] = currentVersion

      setSaveStates((prev) => ({
        ...prev,
        [inspectorId]: { status: "saving" },
      }))

      try {
        const response = await fetch("/api/availability", {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inspectorId, ...payload }),
          signal: abortController.signal,
        })

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return
        }

        if (!response.ok) {
          const result = await response.json().catch(() => ({}))
          throw new Error(result.error || "Failed to update availability")
        }

        const result = await response.json()
        
        // Check if this response is still the latest version (handle out-of-order responses)
        if (requestVersionsRef.current[inspectorId] !== currentVersion) {
          // This response is stale, ignore it
          return
        }

        const inspectors = form.getValues("inspectors")
        const inspectorIndex = inspectors.findIndex((item) => item.inspectorId === inspectorId)
        const inspectorName = inspectorIndex >= 0 ? inspectors[inspectorIndex]?.inspectorName : undefined
        const updatedAvailability = result?.availability as
          | Record<DayKey, { openSchedule: TimeBlock[]; timeSlots: string[] }>
          | undefined

        if (updatedAvailability) {
          const mapped = DAY_KEYS.reduce(
            (acc, day) => {
              const dayData = updatedAvailability?.[day] ?? { openSchedule: [], timeSlots: [] }
              acc[day] = {
                openSchedule: (dayData.openSchedule ?? []).map((block) => ({
                  start: block.start,
                  end: block.end,
                })),
                timeSlots: (dayData.timeSlots ?? []).map((time) => ({ time })),
              }
              return acc
            },
            {} as Record<DayKey, DayForm>,
          )

          const updatedDateSpecific =
            (result?.dateSpecific as Array<{ date: string; start: string; end: string }> | undefined) ?? []
          const mappedDateSpecific: DateSpecificForm[] = updatedDateSpecific.map((entry) => ({
            date: parseISODate(entry.date),
            start: entry.start,
            end: entry.end,
          }))

          if (inspectorIndex >= 0) {
            form.setValue(`inspectors.${inspectorIndex}.days`, mapped, {
              shouldDirty: false,
              shouldTouch: false,
            })
            form.setValue(`inspectors.${inspectorIndex}.dateSpecific`, mappedDateSpecific, {
              shouldDirty: false,
              shouldTouch: false,
            })
            lastSavedPayloadRef.current[inspectorId] = JSON.stringify(buildInspectorPayload(mapped, mappedDateSpecific))
          } else {
            lastSavedPayloadRef.current[inspectorId] = payloadKey
          }
        } else {
          lastSavedPayloadRef.current[inspectorId] = payloadKey
        }

        // Clean up abort controller on success
        delete abortControllersRef.current[inspectorId]

        setSaveStates((prev) => ({
          ...prev,
          [inspectorId]: { status: "saved" },
        }))
        toast.success("Availability updated successfully")
      } catch (err: any) {
        // Ignore abort errors
        if (err?.name === "AbortError" || abortController.signal.aborted) {
          return
        }

        console.error("autoSave error", err)
        
        // Only update error state if this is still the latest request
        if (requestVersionsRef.current[inspectorId] === currentVersion) {
          const errorMessage = err?.message || "Failed to save availability"
          setSaveStates((prev) => ({
            ...prev,
            [inspectorId]: { status: "error", message: errorMessage },
          }))
          
          // Show error toast with retry option
          toast.error(errorMessage, {
            duration: 5000,
            action: {
              label: "Retry",
              onClick: () => {
                // Retry the save with current form values
                const currentInspector = form.getValues("inspectors").find(
                  (item) => item.inspectorId === inspectorId
                )
                if (currentInspector) {
                  handleAutoSave(inspectorId, currentInspector.days, currentInspector.dateSpecific)
                }
              },
            },
          })
        }
        
        // Clean up abort controller on error
        delete abortControllersRef.current[inspectorId]
      }
    },
    [form],
  )

  const handleModeToggle = async (mode: AvailabilityMode) => {
    if (viewMode === mode) return
    form.setValue("viewMode", mode, { shouldDirty: false, shouldTouch: false })
    try {
      setUpdatingViewMode(true)
      const response = await fetch("/api/availability/view-mode", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ viewMode: mode }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || "Failed to save view preference")
      }
    } catch (err: any) {
      console.error("handleModeToggle error", err)
      const errorMessage = err?.message || "Failed to save view preference"
      toast.error(errorMessage, {
        duration: 5000,
        action: {
          label: "Retry",
          onClick: () => handleModeToggle(mode),
        },
      })
      // Revert view mode on error
      form.setValue("viewMode", viewMode, { shouldDirty: false, shouldTouch: false })
    } finally {
      setUpdatingViewMode(false)
    }
  }

  const inspectors = useWatch({ control: form.control, name: "inspectors" })

  return (
    <FormProvider {...form}>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-6">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight">Schedule Management</h1>
                <p className="mt-2 text-lg text-muted-foreground">
                  Manage inspector availability across the week and set date-specific times.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 backdrop-blur-sm p-1.5">
                <Button
                  type="button"
                  variant={viewMode === "openSchedule" ? "default" : "ghost"}
                  className={cn(
                    "rounded-md px-4 py-2 font-medium transition-all",
                    viewMode === "openSchedule" && "shadow-lg",
                    updatingViewMode && "opacity-70"
                  )}
                  onClick={() => handleModeToggle("openSchedule")}
                  disabled={updatingViewMode}
                >
                  Open Schedule
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "timeSlots" ? "default" : "ghost"}
                  className={cn(
                    "rounded-md px-4 py-2 font-medium transition-all",
                    viewMode === "timeSlots" && "shadow-lg",
                    updatingViewMode && "opacity-70"
                  )}
                  onClick={() => handleModeToggle("timeSlots")}
                  disabled={updatingViewMode}
                >
                  Time Slots
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">{error}</p>
                  <Button variant="outline" size="sm" className="mt-3 bg-transparent" onClick={fetchAvailability}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Try again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border/50 bg-card/60 py-16 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Loading availability data...</p>
            </div>
          ) : inspectors.length === 0 ? (
            /* Redesigned empty state */
            <div className="flex flex-col items-center justify-center rounded-lg border border-border/50 bg-card/60 py-16 backdrop-blur-sm text-center">
              <Clock className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-medium text-foreground">No inspectors found</p>
              <p className="mt-2 text-muted-foreground">Add team members to manage their availability.</p>
            </div>
          ) : (
            /* Redesigned inspector cards grid layout */
            <div className="grid gap-6 auto-rows-max">
              {inspectors.map((_, index) => {
                const inspector = form.getValues(`inspectors.${index}`)
                if (!inspector) return null
                return (
                  <InspectorAvailabilityCard
                    key={inspector.inspectorId}
                    index={index}
                    allowedTimes={allowedTimes}
                    viewMode={viewMode}
                    onAutoSave={handleAutoSave}
                    saveState={saveStates[inspector.inspectorId] ?? { status: "idle" }}
                    isInitialized={initializedRef.current}
                    inspectorFirstName={inspector.inspectorFirstName}
                    debounceTimersRef={debounceTimersRef}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </FormProvider>
  )
}

interface InspectorAvailabilityCardProps {
  index: number
  allowedTimes: string[]
  viewMode: AvailabilityMode
  onAutoSave: (inspectorId: string, days: Record<DayKey, DayForm>, dateSpecific: DateSpecificForm[]) => void
  saveState: SaveState
  isInitialized: boolean
  inspectorFirstName: string
  debounceTimersRef: React.MutableRefObject<Record<string, NodeJS.Timeout>>
}

function InspectorAvailabilityCard({
  index,
  allowedTimes,
  viewMode,
  onAutoSave,
  saveState,
  isInitialized,
  inspectorFirstName,
  debounceTimersRef,
}: InspectorAvailabilityCardProps) {
  const { control, getValues, setError, clearErrors, formState, setValue } = useFormContext<AvailabilityFormValues>()
  const inspector = useWatch({ control, name: `inspectors.${index}` })
  const days = useWatch({ control, name: `inspectors.${index}.days` }) as Record<DayKey, DayForm>
  const dateSpecific = (useWatch({ control, name: `inspectors.${index}.dateSpecific` }) as DateSpecificForm[]) ?? []
  const [expanded, setExpanded] = useState(true)
  const [dateDialogOpen, setDateDialogOpen] = useState(false)

  useEffect(() => {
    if (!isInitialized || !inspector?.inspectorId || !days) return

    // Cancel previous debounce timer for this inspector
    const inspectorId = inspector.inspectorId
    if (debounceTimersRef.current[inspectorId]) {
      clearTimeout(debounceTimersRef.current[inspectorId])
    }

    // Set new debounce timer (increased to 1000ms for better batching)
    const timerId = setTimeout(() => {
      const payload = buildInspectorPayload(days, dateSpecific ?? [])
      const openScheduleErrors = DAY_KEYS.some((day) => {
        const result = validateOpenSchedule(payload.days[day].openSchedule)
        return Boolean(result)
      })
      const timeSlotErrors = DAY_KEYS.some((day) => {
        const result = validateTimeSlots(payload.days[day].timeSlots)
        return Boolean(result)
      })

      if (!openScheduleErrors && !timeSlotErrors) {
        onAutoSave(inspectorId, days, dateSpecific ?? [])
      }
      
      // Clear timer reference after execution
      delete debounceTimersRef.current[inspectorId]
    }, 1000)

    debounceTimersRef.current[inspectorId] = timerId

    return () => {
      if (debounceTimersRef.current[inspectorId]) {
        clearTimeout(debounceTimersRef.current[inspectorId])
        delete debounceTimersRef.current[inspectorId]
      }
    }
  }, [days, dateSpecific, inspector?.inspectorId, isInitialized, onAutoSave])

  const inspectorErrors = formState.errors.inspectors?.[index]

  const statusContent = useMemo(() => {
    if (saveState.status === "saving") {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
        </span>
      )
    }

    if (saveState.status === "error") {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {saveState.message || "Failed to save"}
        </span>
      )
    }

    return null
  }, [saveState])

  if (!inspector) return null

  const scheduleTitle = inspector.inspectorName?.endsWith("s")
    ? `${inspector.inspectorName}' Schedule`
    : `${inspector.inspectorName}'s Schedule`

  const handleSaveDateSpecific = (entries: DateSpecificForm[]) => {
    const sanitized = entries.filter((entry) => entry.date && entry.start && (viewMode === "timeSlots" || entry.end))
    const normalized = sanitized.map((entry) => ({
      date: entry.date ? new Date(entry.date) : null,
      start: entry.start,
      end:
        viewMode === "timeSlots"
          ? addMinutesToTime(entry.start, 60)
          : entry.end && entry.end !== ""
            ? entry.end
            : entry.start,
    }))

    const sorted = normalized.sort((a, b) => {
      if (!a.date || !b.date) return 0
      if (a.date.getTime() === b.date.getTime()) {
        return timeToMinutes(a.start) - timeToMinutes(b.start)
      }
      return a.date.getTime() - b.date.getTime()
    })

    setValue(`inspectors.${index}.dateSpecific`, sorted, {
      shouldDirty: true,
      shouldTouch: true,
    })
    setDateDialogOpen(false)
  }

  return (
    <Card className="overflow-hidden border border-border/50 bg-gradient-to-br from-card via-card to-card/80 shadow-lg backdrop-blur-sm transition-all hover:border-border/80">
      <CardHeader className="space-y-4 border-b border-border/30 bg-gradient-to-r from-muted/20 to-transparent px-6 py-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-transparent"
                  onClick={() => setExpanded((prev) => !prev)}
                  aria-expanded={expanded}
                  aria-label={expanded ? "Collapse schedule" : "Expand schedule"}
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
              <CardTitle className="text-xl">{scheduleTitle}</CardTitle>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setDateDialogOpen(true)} className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              Date-specific times
            </Button>
            {statusContent}
          </div>

          {inspectorErrors && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
              <AlertCircle className="h-4 w-4" />
              Validation issues detected
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-6">
          <div className="overflow-x-auto -mx-6 px-6">
            <div className="flex gap-4 min-w-max">
              {DAY_KEYS.map((day) => (
                <div key={day} className="flex-shrink-0 w-[350px]">
                  <DayScheduleCard
                    inspectorIndex={index}
                    dayKey={day}
                    allowedTimes={allowedTimes}
                    viewMode={viewMode}
                    setError={setError}
                    clearErrors={clearErrors}
                    getValues={getValues}
                    inspectorFirstName={inspectorFirstName}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}

      <DateSpecificAvailabilityDialog
        open={dateDialogOpen}
        onOpenChange={setDateDialogOpen}
        entries={dateSpecific ?? []}
        onSave={handleSaveDateSpecific}
        allowedTimes={allowedTimes}
        mode={viewMode}
      />
    </Card>
  )
}

interface DayScheduleCardProps {
  inspectorIndex: number
  dayKey: DayKey
  allowedTimes: string[]
  viewMode: AvailabilityMode
  setError: ReturnType<typeof useFormContext<AvailabilityFormValues>>["setError"]
  clearErrors: ReturnType<typeof useFormContext<AvailabilityFormValues>>["clearErrors"]
  getValues: ReturnType<typeof useFormContext<AvailabilityFormValues>>["getValues"]
  inspectorFirstName: string
}

function DayScheduleCard({
  inspectorIndex,
  dayKey,
  allowedTimes,
  viewMode,
  setError,
  clearErrors,
  getValues,
  inspectorFirstName,
}: DayScheduleCardProps) {
  const { control, formState } = useFormContext<AvailabilityFormValues>()

  const openSchedulePath = `inspectors.${inspectorIndex}.days.${dayKey}.openSchedule` as const
  const timeSlotsPath = `inspectors.${inspectorIndex}.days.${dayKey}.timeSlots` as const

  const {
    fields: openScheduleFields,
    remove: removeBlock,
    replace: replaceBlocks,
  } = useFieldArray({
    control,
    name: openSchedulePath,
  })

  const {
    fields: timeSlotFields,
    remove: removeSlot,
    replace: replaceSlots,
  } = useFieldArray({
    control,
    name: timeSlotsPath,
  })

  const dayErrors = formState.errors.inspectors?.[inspectorIndex]?.days?.[dayKey] as
    | {
      openSchedule?: { message?: string }
      timeSlots?: { message?: string }
    }
    | undefined

  const openScheduleErrorMessage = dayErrors?.openSchedule?.message
  const timeSlotsErrorMessage = dayErrors?.timeSlots?.message

  const startTimeOptions = useMemo(() => allowedTimes.slice(0, -1), [allowedTimes])

  const handleAddBlock = () => {
    const currentBlocks = getValues(openSchedulePath) ?? []
    const next = findNextAvailableBlock(currentBlocks, allowedTimes)

    if (!next) {
      setError(openSchedulePath as any, {
        type: "manual",
        message: "No additional block can be added without overlapping.",
      })
      return
    }

    const updated = [...currentBlocks, next].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
    replaceBlocks(updated)
    clearErrors(openSchedulePath as any)
  }

  const handleAddSlot = () => {
    const currentSlots = getValues(timeSlotsPath) ?? []
    const usedTimes = currentSlots.map((slot: TimeSlotForm) => slot.time)
    const next = allowedTimes.find((time) => !usedTimes.includes(time))

    if (!next) {
      setError(timeSlotsPath as any, {
        type: "manual",
        message: "All available times are already selected.",
      })
      return
    }

    const updated = [...currentSlots, { time: next }].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
    replaceSlots(updated)
    clearErrors(timeSlotsPath as any)
  }

  const updateOpenSchedule = (indexToUpdate: number, partial: Partial<TimeBlockForm>) => {
    const currentBlocks = (getValues(openSchedulePath) ?? []) as TimeBlockForm[]
    const updated = currentBlocks.map((block, idx) =>
      idx === indexToUpdate
        ? {
          ...block,
          ...partial,
        }
        : block,
    )

    const sorted = [...updated].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
    const validationError = validateOpenSchedule(sorted)

    if (validationError) {
      setError(openSchedulePath as any, {
        type: "manual",
        message: validationError,
      })
      return
    }

    replaceBlocks(sorted)
    clearErrors(openSchedulePath as any)
  }

  const updateTimeSlot = (slotIndex: number, time: string) => {
    const currentSlots = (getValues(timeSlotsPath) ?? []) as TimeSlotForm[]
    const updated = currentSlots.map((slot, idx) => (idx === slotIndex ? { time } : slot))

    const validationError = validateTimeSlots(updated.map((slot) => slot.time))

    if (validationError) {
      setError(timeSlotsPath as any, {
        type: "manual",
        message: validationError,
      })
      return
    }

    const sorted = [...updated].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
    replaceSlots(sorted)
    clearErrors(timeSlotsPath as any)
  }

  const hasAnyData = openScheduleFields.length > 0 || timeSlotFields.length > 0
  const unavailableMessage = `${inspectorFirstName} unavailable`

  return (
    /* Redesigned day card with modern styling and improved layout */
    <div className="group rounded-lg border border-border/40 bg-card/60 shadow-sm transition-all hover:border-border/70 hover:shadow-md backdrop-blur-sm">
      {/* Day header */}
      <div className="flex items-center justify-between border-b border-border/20 bg-gradient-to-r from-muted/40 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">{DAY_LABELS[dayKey]}</span>
        </div>
        {viewMode === "openSchedule" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddBlock}
            className="h-7 gap-1 px-2 bg-transparent"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Block</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSlot}
            className="h-7 gap-1 px-2 bg-transparent"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Slot</span>
          </Button>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-col p-4 min-h-48">
        {viewMode === "openSchedule" ? (
          <div className="space-y-2 flex-1">
            {openScheduleFields.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-8 text-center">
                {hasAnyData ? "No open schedule" : unavailableMessage}
              </p>
            ) : (
              <div className="space-y-2">
                {openScheduleFields.map((field, idx) => {
                  const startValue = getValues(`${openSchedulePath}.${idx}.start` as const) ?? allowedTimes[0] ?? "00:00"
                  const endOptions = allowedTimes.filter((time) => timeToMinutes(time) > timeToMinutes(startValue))

                  return (
                    <div key={field.id} className="relative rounded-md border border-border/30 bg-muted/20 p-2.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-5 w-5 text-destructive/60 hover:text-destructive"
                        onClick={() => {
                          removeBlock(idx)
                          clearErrors(openSchedulePath as any)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <div className="flex gap-2 pr-6">
                        <div className="flex-1">
                          <Controller
                            control={control}
                            name={`${openSchedulePath}.${idx}.start` as const}
                            render={({ field: controllerField }) => (
                              <Select
                                value={controllerField.value}
                                onValueChange={(value) => {
                                  const currentBlocks = (getValues(openSchedulePath) ?? []) as TimeBlockForm[]
                                  const currentBlock = currentBlocks[idx]
                                  let candidateEnd: string | undefined

                                  if (currentBlock && currentBlock.end && timeToMinutes(currentBlock.end) > timeToMinutes(value)) {
                                    candidateEnd = currentBlock.end
                                  } else {
                                    candidateEnd = allowedTimes.find(
                                      (time) => timeToMinutes(time) > timeToMinutes(value),
                                    )
                                  }

                                  if (!candidateEnd) {
                                    setError(openSchedulePath as any, {
                                      type: "manual",
                                      message: "Start time must be earlier than 11:00 PM.",
                                    })
                                    return
                                  }
                                  updateOpenSchedule(idx, { start: value, end: candidateEnd })
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Start" />
                                </SelectTrigger>
                                <SelectContent className="max-h-40 overflow-y-auto">
                                  {startTimeOptions.map((time) => (
                                    <SelectItem key={time} value={time} className="text-xs">
                                      {formatTimeLabel(time)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>

                        <div className="flex-1">
                          <Controller
                            control={control}
                            name={`${openSchedulePath}.${idx}.end` as const}
                            render={({ field: controllerField }) => (
                              <Select
                                value={controllerField.value}
                                onValueChange={(value) => {
                                  updateOpenSchedule(idx, { end: value })
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="End" />
                                </SelectTrigger>
                                <SelectContent className="max-h-40 overflow-y-auto">
                                  {endOptions.map((time) => (
                                    <SelectItem key={time} value={time} className="text-xs">
                                      {formatTimeLabel(time)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {openScheduleErrorMessage && <p className="text-xs text-destructive mt-2">{openScheduleErrorMessage}</p>}
          </div>
        ) : (
          <div className="space-y-2 flex-1">
            {timeSlotFields.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-8 text-center">
                {hasAnyData ? "No time slots" : unavailableMessage}
              </p>
            ) : (
              <div className="space-y-2">
                {timeSlotFields.map((field, idx) => (
                  <div key={field.id} className="relative rounded-md border border-border/30 bg-muted/20 p-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-5 w-5 text-destructive/60 hover:text-destructive"
                      onClick={() => {
                        removeSlot(idx)
                        clearErrors(timeSlotsPath as any)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Controller
                      control={control}
                      name={`${timeSlotsPath}.${idx}.time` as const}
                      render={({ field: controllerField }) => (
                        <Select
                          value={controllerField.value}
                          onValueChange={(value) => {
                            updateTimeSlot(idx, value)
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs pr-6">
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                          <SelectContent className="max-h-40 overflow-y-auto">
                            {allowedTimes.map((time) => (
                              <SelectItem key={time} value={time} className="text-xs">
                                {formatTimeLabel(time)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
            {timeSlotsErrorMessage && <p className="text-xs text-destructive mt-2">{timeSlotsErrorMessage}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

interface DateSpecificAvailabilityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: DateSpecificForm[]
  onSave: (entries: DateSpecificForm[]) => void
  allowedTimes: string[]
  mode: AvailabilityMode
}

function DateSpecificAvailabilityDialog({
  open,
  onOpenChange,
  entries,
  onSave,
  allowedTimes,
  mode,
}: DateSpecificAvailabilityDialogProps) {
  const [draftEntries, setDraftEntries] = useState<DateSpecificForm[]>([])

  useEffect(() => {
    if (open) {
      setDraftEntries(
        (entries ?? []).map((entry) => ({
          date: entry.date ? new Date(entry.date) : null,
          start: entry.start,
          end: mode === "timeSlots" ? addMinutesToTime(entry.start, 60) : (entry.end ?? entry.start),
        })),
      )
    }
  }, [open, entries, mode])

  const isTimeSlotsMode = mode === "timeSlots"

  const getDefaultStart = () => {
    const options = isTimeSlotsMode ? allowedTimes : allowedTimes.slice(0, -1)
    return options[0] ?? ALLOWED_TIMES[0] ?? ""
  }

  const getNextEnd = (start: string) => {
    if (isTimeSlotsMode) {
      return addMinutesToTime(start, 60)
    }
    const options = allowedTimes.filter((time) => timeToMinutes(time) > timeToMinutes(start))
    return options[0] ?? addMinutesToTime(start, 60)
  }

  const handleAddEntry = () => {
    const start = getDefaultStart()
    const end = getNextEnd(start)
    setDraftEntries((prev) => [...prev, { date: null, start, end }])
  }

  const handleRemoveEntry = (index: number) => {
    setDraftEntries((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleDateChange = (index: number, date: Date | undefined) => {
    setDraftEntries((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, date: date ?? null } : entry)))
  }

  const handleStartChange = (index: number, start: string) => {
    setDraftEntries((prev) =>
      prev.map((entry, idx) => {
        if (idx !== index) return entry
        if (isTimeSlotsMode) {
          return {
            ...entry,
            start,
            end: addMinutesToTime(start, 60),
          }
        }
        const newEnd = entry.end && timeToMinutes(entry.end) > timeToMinutes(start) ? entry.end : getNextEnd(start)
        return {
          ...entry,
          start,
          end: newEnd,
        }
      }),
    )
  }

  const handleEndChange = (index: number, end: string) => {
    if (isTimeSlotsMode) {
      return
    }
    setDraftEntries((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, end } : entry)))
  }

  const handleSave = () => {
    const normalizedEntries = draftEntries.map((entry) => ({
      ...entry,
      end: isTimeSlotsMode ? addMinutesToTime(entry.start, 60) : entry.end,
    }))
    onSave(normalizedEntries)
  }

  const today = todayStartOfDay()

  const isSaveDisabled = draftEntries.some((entry) => {
    if (!entry.date || !entry.start) {
      return true
    }
    if (isTimeSlotsMode) {
      return false
    }
    if (!entry.end) {
      return true
    }
    return timeToMinutes(entry.end) <= timeToMinutes(entry.start)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Date-specific availability</DialogTitle>
          <DialogDescription>
            Set availability for specific dates. These override the weekly schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button type="button" variant="outline" size="sm" onClick={handleAddEntry} className="gap-2 bg-transparent">
            <PlusCircle className="h-4 w-4" />
            Add date
          </Button>

          {draftEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No dates added yet.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {draftEntries.map((entry, index) => {
                const startOptions = (isTimeSlotsMode ? allowedTimes : allowedTimes.slice(0, -1)) ?? []
                const endOptions = isTimeSlotsMode
                  ? []
                  : allowedTimes.filter((time) => timeToMinutes(time) > timeToMinutes(entry.start))

                return (
                  <div key={index} className="relative rounded-lg border border-border/30 bg-muted/20 p-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 text-destructive/60 hover:text-destructive"
                      onClick={() => handleRemoveEntry(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <div className="flex flex-col gap-3 pr-8">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "justify-start text-left font-normal text-sm",
                                !entry.date && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {entry.date ? format(entry.date, "MMM d, yyyy") : "Pick date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={entry.date ?? undefined}
                              onSelect={(date: Date | undefined) => handleDateChange(index, date)}
                              disabled={(date: Date) => !date || date < today}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>

                        <div className={cn("flex gap-2", !isTimeSlotsMode && "sm:flex-row")}>
                          <Select value={entry.start} onValueChange={(value) => handleStartChange(index, value)}>
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Start" />
                            </SelectTrigger>
                            <SelectContent className="max-h-40 overflow-y-auto">
                              {startOptions.map((time) => (
                                <SelectItem key={time} value={time} className="text-sm">
                                  {formatTimeLabel(time)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {!isTimeSlotsMode && (
                            <Select
                              value={entry.end}
                              onValueChange={(value) => handleEndChange(index, value)}
                              disabled={endOptions.length === 0}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="End" />
                              </SelectTrigger>
                              <SelectContent className="max-h-40 overflow-y-auto">
                                {endOptions.length === 0 ? (
                                  <SelectItem value="" disabled className="text-sm">
                                    No times available
                                  </SelectItem>
                                ) : (
                                  endOptions.map((time) => (
                                    <SelectItem key={time} value={time} className="text-sm">
                                      {formatTimeLabel(time)}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={draftEntries.length > 0 && isSaveDisabled}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AvailabilityPage
