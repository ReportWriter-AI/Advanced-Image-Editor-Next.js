"use client";

import { useEffect, useState, useMemo, type CSSProperties } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Info, ArrowLeft, X, Plus, Edit2, Trash2, Check, Copy, GripVertical } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

const schedulingOptionsSchema = z.object({
  inProgressBookingsBlockSchedule: z.boolean(),
  restrictReferralSources: z.boolean(),
  referralSources: z.string().optional(),
  defaultConfirmed: z.boolean(),
  allowClientCcEmails: z.boolean(),
  captureBuyerAddress: z.boolean(),
  captureClientsAgentAddress: z.boolean(),
  captureListingAgentAddress: z.boolean(),
});

type SchedulingOptionsFormValues = z.infer<typeof schedulingOptionsSchema>;

type CustomField = {
  _id?: string;
  name: string;
  fieldKey?: string;
  fieldType: 'Text' | 'Number' | 'Checkbox' | 'Calendar' | 'Paragraph' | 'Dropdown' | 'Date' | 'Date & Time';
  requiredForOnlineScheduler: boolean;
  displayOnSpectoraApp: boolean;
  showInOnlineSchedulerOrGetQuote: boolean;
  calendarIcon?: string;
  dropdownOptions?: string[];
  orderIndex?: number;
};

const customFieldSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  fieldType: z.enum(['Text', 'Number', 'Checkbox', 'Calendar', 'Paragraph', 'Dropdown', 'Date', 'Date & Time']),
  requiredForOnlineScheduler: z.boolean(),
  displayOnSpectoraApp: z.boolean(),
  showInOnlineSchedulerOrGetQuote: z.boolean(),
  calendarIcon: z.string().optional(),
  dropdownOptions: z.array(z.string()).optional(),
});

type CustomFieldFormValues = z.infer<typeof customFieldSchema>;

// Popular Lucide icons for calendar field
const calendarIcons = [
  'CheckCircle', 'XCircle', 'AlertCircle', 'Info', 'Star', 'Heart', 'Flag',
  'Home', 'Building', 'Car', 'Calendar', 'Clock', 'MapPin', 'Phone', 'Mail',
  'User', 'Users', 'Shield', 'Lock', 'Unlock', 'Key', 'Bell', 'BellRing',
  'Zap', 'Flame', 'Droplet', 'Sun', 'Moon', 'Cloud', 'CloudRain', 'Snowflake',
];

// Sortable Row Component
function SortableCustomFieldRow({
  field,
  onEdit,
  onDelete,
  onCopyKey,
  disabled,
}: {
  field: CustomField;
  onEdit: (field: CustomField) => void;
  onDelete: (field: CustomField) => void;
  onCopyKey: (key: string) => void;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field._id || '' });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-muted/30 ${isDragging ? 'z-50' : ''}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            disabled={disabled}
            className="cursor-grab active:cursor-grabbing disabled:cursor-not-allowed text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="font-medium">{field.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">{field.fieldType}</td>
      <td className="px-4 py-3">
        {field.requiredForOnlineScheduler ? 'Yes' : 'No'}
      </td>
      <td className="px-4 py-3">
        {field.displayOnSpectoraApp ? 'Yes' : 'No'}
      </td>
      <td className="px-4 py-3">
        {field.showInOnlineSchedulerOrGetQuote ? 'Yes' : 'No'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          {field.fieldKey && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopyKey(field.fieldKey!)}
              disabled={disabled}
              title="Copy field key"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(field)}
            disabled={disabled}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(field)}
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function SchedulingOptionsPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customFieldsModalOpen, setCustomFieldsModalOpen] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false);
  const [showCustomFieldForm, setShowCustomFieldForm] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [dropdownOptionInput, setDropdownOptionInput] = useState('');
  const [reorderBusy, setReorderBusy] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Sort custom fields by orderIndex
  const orderedCustomFields = useMemo(() => {
    return [...customFields].sort((a, b) => {
      const aOrder = a.orderIndex ?? 0;
      const bOrder = b.orderIndex ?? 0;
      return aOrder - bOrder;
    });
  }, [customFields]);

  const form = useForm<SchedulingOptionsFormValues>({
    resolver: zodResolver(schedulingOptionsSchema),
    defaultValues: {
      inProgressBookingsBlockSchedule: false,
      restrictReferralSources: false,
      referralSources: '',
      defaultConfirmed: false,
      allowClientCcEmails: false,
      captureBuyerAddress: false,
      captureClientsAgentAddress: false,
      captureListingAgentAddress: false,
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = form;

  const restrictReferralSources = watch('restrictReferralSources');

  const customFieldForm = useForm<CustomFieldFormValues>({
    resolver: zodResolver(customFieldSchema),
    defaultValues: {
      name: '',
      fieldType: 'Text',
      requiredForOnlineScheduler: false,
      displayOnSpectoraApp: true,
      showInOnlineSchedulerOrGetQuote: false,
      calendarIcon: undefined,
      dropdownOptions: [],
    },
  });

  const {
    control: customFieldControl,
    handleSubmit: handleCustomFieldSubmit,
    reset: resetCustomFieldForm,
    watch: watchCustomField,
    setValue: setCustomFieldValue,
    formState: { errors: customFieldErrors },
  } = customFieldForm;

  const selectedFieldType = watchCustomField('fieldType');
  const selectedCalendarIcon = watchCustomField('calendarIcon');
  const dropdownOptions = watchCustomField('dropdownOptions') || [];

  useEffect(() => {
    const loadSchedulingOptions = async () => {
      try {
        setInitialLoading(true);
        const response = await fetch('/api/scheduling-options', {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to load scheduling options');
        }

        const data = await response.json();

        reset({
          inProgressBookingsBlockSchedule: data.inProgressBookingsBlockSchedule ?? false,
          restrictReferralSources: data.restrictReferralSources ?? false,
          referralSources: data.referralSources || '',
          defaultConfirmed: data.defaultConfirmed ?? false,
          allowClientCcEmails: data.allowClientCcEmails ?? false,
          captureBuyerAddress: data.captureBuyerAddress ?? false,
          captureClientsAgentAddress: data.captureClientsAgentAddress ?? false,
          captureListingAgentAddress: data.captureListingAgentAddress ?? false,
        });
      } catch (error: any) {
        console.error(error);
        toast.error(error.message || 'Unable to load scheduling options');
      } finally {
        setInitialLoading(false);
      }
    };

    loadSchedulingOptions();
  }, [reset]);

  const onSubmit = async (values: SchedulingOptionsFormValues) => {
    try {
      setSaving(true);
      const response = await fetch('/api/scheduling-options', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save scheduling options');
      }

      const data = await response.json();

      reset({
        inProgressBookingsBlockSchedule: data.inProgressBookingsBlockSchedule ?? false,
        restrictReferralSources: data.restrictReferralSources ?? false,
        referralSources: data.referralSources || '',
        defaultConfirmed: data.defaultConfirmed ?? false,
        allowClientCcEmails: data.allowClientCcEmails ?? false,
        captureBuyerAddress: data.captureBuyerAddress ?? false,
        captureClientsAgentAddress: data.captureClientsAgentAddress ?? false,
        captureListingAgentAddress: data.captureListingAgentAddress ?? false,
      });

      toast.success('Scheduling options updated successfully');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to save scheduling options');
    } finally {
      setSaving(false);
    }
  };

  const loadCustomFields = async () => {
    try {
      setCustomFieldsLoading(true);
      const response = await fetch('/api/scheduling-options/custom-fields', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load custom fields');
      }

      const data = await response.json();
      setCustomFields(data.customFields || []);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to load custom fields');
    } finally {
      setCustomFieldsLoading(false);
    }
  };

  useEffect(() => {
    if (customFieldsModalOpen) {
      loadCustomFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFieldsModalOpen]);

  const handleOpenCustomFieldsModal = () => {
    setCustomFieldsModalOpen(true);
    setShowCustomFieldForm(false);
    setEditingField(null);
  };

  const handleCreateCustomField = () => {
    setShowCustomFieldForm(true);
    setEditingField(null);
    resetCustomFieldForm({
      name: '',
      fieldType: 'Text',
      requiredForOnlineScheduler: false,
      displayOnSpectoraApp: true,
      showInOnlineSchedulerOrGetQuote: false,
      calendarIcon: undefined,
      dropdownOptions: [],
    });
  };

  const handleEditCustomField = (field: CustomField) => {
    setEditingField(field);
    setShowCustomFieldForm(true);
    resetCustomFieldForm({
      name: field.name,
      fieldType: field.fieldType,
      requiredForOnlineScheduler: field.requiredForOnlineScheduler,
      displayOnSpectoraApp: field.displayOnSpectoraApp,
      showInOnlineSchedulerOrGetQuote: field.showInOnlineSchedulerOrGetQuote,
      calendarIcon: field.calendarIcon,
      dropdownOptions: field.dropdownOptions || [],
    });
  };

  const handleBackToFieldsList = () => {
    setShowCustomFieldForm(false);
    setEditingField(null);
    resetCustomFieldForm();
  };

  const onCustomFieldSubmit = async (values: CustomFieldFormValues) => {
    try {
      const url = editingField
        ? '/api/scheduling-options/custom-fields'
        : '/api/scheduling-options/custom-fields';
      const method = editingField ? 'PUT' : 'POST';

      const payload = editingField
        ? { ...values, _id: editingField._id }
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
        throw new Error(errorData.error || 'Failed to save custom field');
      }

      toast.success(`Custom field ${editingField ? 'updated' : 'created'} successfully`);
      await loadCustomFields();
      handleBackToFieldsList();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to save custom field');
    }
  };

  const handleDeleteClick = (field: CustomField) => {
    setFieldToDelete(field);
  };

  const handleCloseDeleteDialog = () => {
    if (!isDeleting) {
      setFieldToDelete(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fieldToDelete?._id) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/scheduling-options/custom-fields?id=${fieldToDelete._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete custom field');
      }

      toast.success('Custom field deleted successfully');
      await loadCustomFields();
      setFieldToDelete(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Unable to delete custom field');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddDropdownOption = () => {
    if (dropdownOptionInput.trim()) {
      const currentOptions = dropdownOptions || [];
      setCustomFieldValue('dropdownOptions', [...currentOptions, dropdownOptionInput.trim()]);
      setDropdownOptionInput('');
    }
  };

  const handleRemoveDropdownOption = (index: number) => {
    const currentOptions = dropdownOptions || [];
    setCustomFieldValue('dropdownOptions', currentOptions.filter((_, i) => i !== index));
  };

  const handleSelectIcon = (iconName: string) => {
    setCustomFieldValue('calendarIcon', iconName);
    setShowIconPicker(false);
  };

  const handleCopyFieldKey = async (fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(`[${fieldKey}]`);
      toast.success('Field key copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy field key');
    }
  };

  const commitReorder = async (reorderedFields: CustomField[]) => {
    setReorderBusy(true);
    try {
      const fieldIds = reorderedFields.map((field) => field._id).filter(Boolean) as string[];

      const response = await fetch('/api/scheduling-options/custom-fields/reorder', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fieldIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reorder custom fields');
      }

      toast.success('Custom fields reordered successfully');
      await loadCustomFields();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to reorder custom fields');
      await loadCustomFields(); // Reload to revert changes
    } finally {
      setReorderBusy(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (reorderBusy || customFieldsLoading) {
      return;
    }

    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedCustomFields.findIndex((field) => field._id === active.id);
    const newIndex = orderedCustomFields.findIndex((field) => field._id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = arrayMove(orderedCustomFields, oldIndex, newIndex).map((field, index) => ({
      ...field,
      orderIndex: index,
    }));

    setCustomFields(reordered);
    commitReorder(reordered);
  };

  const renderCheckboxField = (
    name: string,
    label: string,
    field: any,
    description?: string
  ) => (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Checkbox
          id={name}
          checked={field.value}
          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
        />
        <div className="flex items-center gap-2 flex-1">
          <Label htmlFor={name} className="font-medium cursor-pointer">
            {label}
          </Label>
          {description && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={description}
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-left">
                {description}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground pl-7">{description}</p>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Scheduling Options</h2>
          <p className="text-muted-foreground">Configure your scheduling system settings</p>
        </div>

        {initialLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading scheduling options...
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Scheduling Options</CardTitle>
                <CardDescription>
                  Configure how your scheduling system works
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Controller
                  name="inProgressBookingsBlockSchedule"
                  control={control}
                  render={({ field }) =>
                    renderCheckboxField(
                      'inProgressBookingsBlockSchedule',
                      'In-Progress bookings block schedule',
                      field,
                      'The "New Inspection" form will block the calendar until the form is submitted (or for 10 minutes if abandoned), creating a warning for others and blocking the Online Scheduler. This is useful if you have multiple office staff, call centers, or online schedulers taking orders simultaneously.'
                    )
                  }
                />

                <Controller
                  name="restrictReferralSources"
                  control={control}
                  render={({ field }) =>
                    renderCheckboxField(
                      'restrictReferralSources',
                      'Restrict Referral Sources',
                      field,
                      'Restricts possible referral source value to a list of sources that you define.'
                    )
                  }
                />

                {restrictReferralSources && (
                  <div className="space-y-2 pl-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="referralSources">Referral Sources</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="It will show as a dropdown, separate the options by comma (e.g., Google, Facebook)"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-left">
                          It will show as a dropdown, separate the options by comma (e.g., Google, Facebook)
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Controller
                      name="referralSources"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="referralSources"
                          placeholder="Google, Facebook, Referral, etc."
                          {...field}
                        />
                      )}
                    />
                    <p className="text-sm text-muted-foreground">
                      It will show as a dropdown, separate the options by comma (e.g., Google, Facebook)
                    </p>
                  </div>
                )}

                <Controller
                  name="defaultConfirmed"
                  control={control}
                  render={({ field }) =>
                    renderCheckboxField(
                      'defaultConfirmed',
                      'Default Confirmed',
                      field,
                      'This sets the default value for "Confirmed Inspection" in the "New Inspection" form to Yes. Uncheck this if you want to separate the start of the new inspection order from it being confirmed'
                    )
                  }
                />

                <Controller
                  name="allowClientCcEmails"
                  control={control}
                  render={({ field }) =>
                    renderCheckboxField(
                      'allowClientCcEmails',
                      'Allow for use of Client CC emails',
                      field,
                      'This will dictate whether or not any cc emails associated with the client record are included in any inspection specific email communication: Automations, Actions or Manual Inspection Emails. This setting may be overridden on a per inspection basis. Changes to this setting will only apply to inspections that have not yet been scheduled.'
                    )
                  }
                />

                <Controller
                  name="captureBuyerAddress"
                  control={control}
                  render={({ field }) =>
                    renderCheckboxField(
                      'captureBuyerAddress',
                      'Capture buyer address',
                      field,
                      'This adds fields to capture client addresses in the New Inspection form, the Online Scheduler, and the Inspection Request form.'
                    )
                  }
                />

                <Controller
                  name="captureClientsAgentAddress"
                  control={control}
                  render={({ field }) =>
                    renderCheckboxField(
                      'captureClientsAgentAddress',
                      "Capture client's agent's address",
                      field,
                      'This adds fields to capture agent addresses in the New Inspection form, the Online Scheduler, and the Inspection Request form.'
                    )
                  }
                />

                <Controller
                  name="captureListingAgentAddress"
                  control={control}
                  render={({ field }) =>
                    renderCheckboxField(
                      'captureListingAgentAddress',
                      "Capture listing agent's address",
                      field,
                      'This adds fields to capture agent addresses in the New Inspection form, the Online Scheduler, and the Inspection Request form.'
                    )
                  }
                />
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardContent className="py-6">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Custom Fields</h3>
                    <p className="text-sm text-muted-foreground">
                      Create and manage custom fields for your scheduling system
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleOpenCustomFieldsModal}
                    className="min-w-[200px]"
                  >
                    Manage Custom Fields
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Custom Fields Modal */}
      <Dialog open={customFieldsModalOpen} onOpenChange={setCustomFieldsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Custom Fields</DialogTitle>
            <DialogDescription>
              Create and manage custom fields for your scheduling system
            </DialogDescription>
          </DialogHeader>

          {!showCustomFieldForm ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={handleCreateCustomField}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </div>

              {customFieldsLoading ? (
                <div className="py-12 text-center text-muted-foreground">
                  Loading custom fields...
                </div>
              ) : customFields.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No custom fields found. Click "Create" to add one.
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full divide-y divide-muted text-sm">
                      <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Field Type</th>
                          <th className="px-4 py-3">Required</th>
                          <th className="px-4 py-3">Display on App</th>
                          <th className="px-4 py-3">Show in Scheduler</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <SortableContext
                        items={orderedCustomFields.map((f) => f._id || '')}
                        strategy={verticalListSortingStrategy}
                      >
                        <tbody className="divide-y divide-muted">
                          {orderedCustomFields.map((field) => (
                            <SortableCustomFieldRow
                              key={field._id}
                              field={field}
                              onEdit={handleEditCustomField}
                              onDelete={handleDeleteClick}
                              onCopyKey={handleCopyFieldKey}
                              disabled={reorderBusy}
                            />
                          ))}
                        </tbody>
                      </SortableContext>
                    </table>
                  </div>
                </DndContext>
              )}
            </div>
          ) : (
            <form onSubmit={handleCustomFieldSubmit(onCustomFieldSubmit)} className="space-y-4">
              <div className="mb-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToFieldsList}
                  className="bg-red-500 hover:bg-red-600 text-white mb-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <h3 className="text-lg font-semibold">
                  {editingField ? 'Edit Custom Field' : 'Create Custom Field'}
                </h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customFieldName">Name</Label>
                  <Controller
                    name="name"
                    control={customFieldControl}
                    render={({ field }) => (
                      <Input id="customFieldName" {...field} />
                    )}
                  />
                  {customFieldErrors.name && (
                    <p className="text-sm text-destructive">{customFieldErrors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customFieldType">Field Type</Label>
                  <Controller
                    name="fieldType"
                    control={customFieldControl}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!!editingField}
                      >
                        <SelectTrigger id="customFieldType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          <SelectItem value="Text">Text</SelectItem>
                          <SelectItem value="Number">Number</SelectItem>
                          <SelectItem value="Checkbox">Checkbox</SelectItem>
                          <SelectItem value="Calendar">Calendar</SelectItem>
                          <SelectItem value="Paragraph">Paragraph</SelectItem>
                          <SelectItem value="Dropdown">Dropdown</SelectItem>
                          <SelectItem value="Date">Date</SelectItem>
                          <SelectItem value="Date & Time">Date & Time</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {selectedFieldType === 'Calendar' && (
                  <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      This field will present in the order form with options for N/A, Yes and No. If the selection is N/A for an order then no icon will show in with the order in the calendar. If the selection is Yes for the order then the icon selected below will show up in green on the order in the calendar. If the selection is No for the order then the icon selected below will show up in red on the order in the calendar.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowIconPicker(!showIconPicker)}
                      >
                        Select Icon
                        {selectedCalendarIcon && (
                          <span className="ml-2">
                            {(() => {
                              const IconComponent = (LucideIcons as any)[selectedCalendarIcon];
                              return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
                            })()}
                          </span>
                        )}
                      </Button>
                      {selectedCalendarIcon && (
                        <span className="text-sm text-muted-foreground">
                          Selected: {selectedCalendarIcon}
                        </span>
                      )}
                    </div>
                    {showIconPicker && (
                      <div className="grid grid-cols-8 gap-2 p-4 border rounded-lg bg-background max-h-[300px] overflow-y-auto">
                        {calendarIcons.map((iconName) => {
                          const IconComponent = (LucideIcons as any)[iconName];
                          if (!IconComponent) return null;
                          return (
                            <button
                              key={iconName}
                              type="button"
                              onClick={() => handleSelectIcon(iconName)}
                              className={`p-2 border rounded hover:bg-muted ${
                                selectedCalendarIcon === iconName ? 'bg-primary text-primary-foreground' : ''
                              }`}
                            >
                              <IconComponent className="h-5 w-5" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {selectedFieldType === 'Dropdown' && (
                  <div className="space-y-2">
                    <Label>Dropdown Options</Label>
                    <div className="flex gap-2">
                      <Input
                        value={dropdownOptionInput}
                        onChange={(e) => setDropdownOptionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDropdownOption();
                          }
                        }}
                        placeholder="Enter option and press Enter"
                      />
                      <Button type="button" onClick={handleAddDropdownOption}>
                        Add
                      </Button>
                    </div>
                    {dropdownOptions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {dropdownOptions.map((option, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
                          >
                            <span>{option}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDropdownOption(index)}
                              className="text-destructive hover:text-destructive/80"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Controller
                  name="requiredForOnlineScheduler"
                  control={customFieldControl}
                  render={({ field }) =>
                    renderCheckboxField(
                      'requiredForOnlineScheduler',
                      'Required answer for Online Scheduler',
                      field
                    )
                  }
                />

                <Controller
                  name="displayOnSpectoraApp"
                  control={customFieldControl}
                  render={({ field }) =>
                    renderCheckboxField(
                      'displayOnSpectoraApp',
                      'Display on Spectora app',
                      field
                    )
                  }
                />

                <Controller
                  name="showInOnlineSchedulerOrGetQuote"
                  control={customFieldControl}
                  render={({ field }) =>
                    renderCheckboxField(
                      'showInOnlineSchedulerOrGetQuote',
                      'Show in Online Scheduler or Get a Quote',
                      field
                    )
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleBackToFieldsList}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingField ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={Boolean(fieldToDelete)} onOpenChange={handleCloseDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Field?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the custom field "{fieldToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

