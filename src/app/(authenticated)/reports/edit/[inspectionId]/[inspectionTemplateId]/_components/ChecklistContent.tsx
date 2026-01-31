"use client";

import { useMemo, useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  ArrowLeftRight,
  Loader2,
  PlusCircle,
  Edit2,
  Trash2,
  GripVertical,
} from "lucide-react";
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
import {
  useInspectionTemplateChecklistsQuery,
  useCreateInspectionTemplateChecklistMutation,
  useUpdateInspectionTemplateChecklistMutation,
  useDeleteInspectionTemplateChecklistMutation,
  useReorderInspectionTemplateChecklistsMutation,
  useUpdateChecklistAnswerMutation,
  InspectionTemplateChecklist,
} from "@/components/api/queries/inspectionTemplateChecklists";
import { ChecklistItemForm } from "./ChecklistItemForm";
import { ChecklistFieldInput } from "./ChecklistFieldInput";
import { Checkbox } from "@/components/ui/checkbox";
import { TipTapEditor } from "@/components/TipTapEditor";
import { Label } from "@/components/ui/label";
// import { CreatableConcatenatedInput } from "@/components/ui/creatable-concatenated-input";
import { useReusableDropdownsQuery } from "@/components/api/queries/reusableDropdowns";
import { ChecklistImageUpload, ChecklistImage } from "./ChecklistImageUpload";
import { cn, stripHtmlToText } from "@/lib/utils";
import { DefectsSection } from "./DefectsSection";
import { getChecklistFieldIcon } from "@/lib/checklist-utils";
import DefectsList from "@/components/DefectsList";

interface ChecklistContentProps {
  inspectionId: string;
  inspectionTemplateId: string;
  sectionId: string;
  subsectionId: string | null;
  subsectionName?: string;
  sectionName?: string;
}

interface SortableChecklistItemProps {
  checklist: InspectionTemplateChecklist;
  onEdit: () => void;
  onDelete: () => void;
  onMoveType?: () => void;
  disabled: boolean;
  reorderDisabled: boolean;
  onAnswerChange?: (checklistId: string, answerData: Partial<InspectionTemplateChecklist>) => void;
  inspectionId: string;
  inspectionTemplateId: string;
  sectionId: string;
  subsectionId: string;
  onMediaUpdate?: (checklistId: string, media: Array<{ url: string; mediaType: 'image' | 'video' | '360pic'; location?: string; order: number }>) => void;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function SortableChecklistItem({
  checklist,
  onEdit,
  onDelete,
  onMoveType,
  disabled,
  reorderDisabled,
  onAnswerChange,
  inspectionId,
  inspectionTemplateId,
  sectionId,
  subsectionId,
  onMediaUpdate,
}: SortableChecklistItemProps) {
  const { data: dropdownsData } = useReusableDropdownsQuery();

  // Expand/collapse state - default is minimized (false)
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper function to truncate comment
  const truncateComment = (comment: string | undefined, maxLength: number = 80): string => {
    if (!comment || comment.length <= maxLength) return comment || '';
    return comment.substring(0, maxLength) + '...';
  };

  // Toggle handler for expand/collapse
  const handleToggle = () => setIsExpanded(!isExpanded);

  // Convert API format (Array<{id, value}>) to options format (Array<{value, label}>)
  const locationOptions = useMemo(() => {
    if (!dropdownsData?.data?.location) return [];
    return dropdownsData.data.location.map((item: { id: string; value: string }) => ({
      value: item.value,
      label: item.value,
    }));
  }, [dropdownsData]);

  const [locationValue, setLocationValue] = useState(checklist.location || "");
  const [commentValue, setCommentValue] = useState(checklist.comment || "");

  // Image upload state
  const [images, setImages] = useState<ChecklistImage[]>([]);
  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});

  const prevLocationRef = useRef<string | undefined>(checklist.location);
  const prevCommentRef = useRef<string | undefined>(checklist.comment);

  // Debounce location and comment changes
  const debouncedLocation = useDebounce(locationValue, 500);
  const debouncedComment = useDebounce(commentValue, 500);

  // Load media from database on checklist load
  useEffect(() => {
    if (checklist.media && Array.isArray(checklist.media)) {
      const loadedImages: ChecklistImage[] = checklist.media
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((mediaItem) => ({
          url: mediaItem.url,
          mediaType: mediaItem.mediaType,
          location: mediaItem.location,
          order: mediaItem.order,
        }));
      setImages(loadedImages);
      
      // Populate locationInputs from loaded media
      const inputs: Record<string, string> = {};
      loadedImages.forEach((img, idx) => {
        if (img.location) {
          inputs[`${checklist._id}-${idx}`] = img.location;
        }
      });
      setLocationInputs(inputs);
    } else {
      setImages([]);
      setLocationInputs({});
    }
  }, [checklist._id, checklist.media]);

  // Sync with checklist changes
  useEffect(() => {
    const newLocation = checklist.location || "";
    const newComment = checklist.comment || "";

    if (newLocation !== (prevLocationRef.current || "")) {
      setLocationValue(newLocation);
      prevLocationRef.current = checklist.location;
    }

    if (newComment !== (prevCommentRef.current || "")) {
      setCommentValue(newComment);
      prevCommentRef.current = checklist.comment;
    }
  }, [checklist.location, checklist.comment]);

  // Save debounced location changes
  useEffect(() => {
    if (debouncedLocation !== (prevLocationRef.current || "") && onAnswerChange) {
      onAnswerChange(checklist._id || "", { location: debouncedLocation });
      prevLocationRef.current = debouncedLocation;
    }
  }, [debouncedLocation, checklist._id, onAnswerChange]);

  // Save debounced comment changes
  useEffect(() => {
    if (debouncedComment !== (prevCommentRef.current || "") && onAnswerChange) {
      onAnswerChange(checklist._id || "", { comment: debouncedComment });
      prevCommentRef.current = debouncedComment;
    }
  }, [debouncedComment, checklist._id, onAnswerChange]);

  // Proxy helper for reliable image loading
  const getProxiedSrc = useCallback((url: string | null | undefined) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('/api/proxy-image?') || url.startsWith('blob:')) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }, []);

  // Upload file to R2 storage
  const handleMediaUpload = useCallback(async (file: File): Promise<string> => {
    // Normalize smartphone EXIF orientation for JPEG/PNG before upload (HEIC handled on server)
    const fixOrientationIfNeeded = async (f: File): Promise<File> => {
      try {
        if (!f.type.startsWith('image/') || /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)) return f;
        const exifr: any = (await import('exifr/dist/full.esm.mjs')) as any;
        const orientation: number | undefined = await exifr.orientation(f);
        if (!orientation || orientation === 1) return f;

        const imgUrl = URL.createObjectURL(f);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = imgUrl;
        });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(imgUrl); return f; }
        const w = img.naturalWidth || img.width; const h = img.naturalHeight || img.height;
        switch (orientation) {
          case 2: canvas.width=w; canvas.height=h; ctx.translate(w,0); ctx.scale(-1,1); break;
          case 3: canvas.width=w; canvas.height=h; ctx.translate(w,h); ctx.rotate(Math.PI); break;
          case 4: canvas.width=w; canvas.height=h; ctx.translate(0,h); ctx.scale(1,-1); break;
          case 5: canvas.width=h; canvas.height=w; ctx.rotate(0.5*Math.PI); ctx.scale(1,-1); ctx.translate(0,-h); break;
          case 6: canvas.width=h; canvas.height=w; ctx.rotate(0.5*Math.PI); ctx.translate(0,-h); break;
          case 7: canvas.width=h; canvas.height=w; ctx.rotate(0.5*Math.PI); ctx.translate(w,-h); ctx.scale(-1,1); break;
          case 8: canvas.width=h; canvas.height=w; ctx.rotate(-0.5*Math.PI); ctx.translate(-w,0); break;
          default: canvas.width=w; canvas.height=h; break;
        }
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(imgUrl);
        const blob: Blob = await new Promise((resolve)=> canvas.toBlob((b)=> resolve(b || new Blob()), 'image/jpeg', 0.95));
        return new File([blob], f.name.replace(/\.(png|jpg|jpeg|webp)$/i,'') + '.jpg', { type: 'image/jpeg' });
      } catch (e) {
        console.warn('EXIF normalize skipped:', e); return f;
      }
    };

    try {
      let processedFile = await fixOrientationIfNeeded(file);
      
      // Get presigned upload URL from server
      const presignedRes = await fetch(
        `/api/r2api?action=presigned&fileName=${encodeURIComponent(processedFile.name)}&contentType=${encodeURIComponent(processedFile.type)}`
      );
      
      if (!presignedRes.ok) {
        throw new Error('Failed to get presigned upload URL');
      }
      
      const { uploadUrl, publicUrl } = await presignedRes.json();
      
      // Upload file directly to R2 using presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: processedFile,
        headers: {
          'Content-Type': processedFile.type,
        },
      });
      
      if (!uploadRes.ok) {
        throw new Error(`Direct R2 upload failed with status ${uploadRes.status}`);
      }

      return publicUrl;
    } catch (error: any) {
      console.error('❌ Error uploading file:', error);
      throw error;
    }
  }, []);

  // Save media array to database
  const saveMediaToDatabase = useCallback((mediaArray: Array<{ url: string; mediaType: 'image' | 'video' | '360pic'; location?: string; order: number }>) => {
    if (onMediaUpdate && checklist._id) {
      onMediaUpdate(checklist._id, mediaArray);
    }
  }, [onMediaUpdate, checklist._id]);

  // Handler for file selection with mediaType
  const handleImagesSelect = useCallback(async (checklistId: string, files: File[], mediaType: 'image' | 'video' | '360pic') => {
    if (!checklist._id || checklistId !== checklist._id) return;

    try {
      // Get current media to determine next order
      const currentMedia = images.filter(img => typeof img.url === 'string');
      const maxOrder = currentMedia.length > 0 
        ? Math.max(...currentMedia.map(img => img.order || 0))
        : -1;

      // Upload files sequentially
      const uploadedMedia: Array<{ url: string; mediaType: 'image' | 'video' | '360pic'; location?: string; order: number }> = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const publicUrl = await handleMediaUpload(file);
        uploadedMedia.push({
          url: publicUrl,
          mediaType,
          order: maxOrder + i + 1,
        });
      }

      // Update local state
      const newImages: ChecklistImage[] = uploadedMedia.map(media => ({
        url: media.url,
        mediaType: media.mediaType,
        location: media.location,
        order: media.order,
      }));

      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);

      // Save to database
      const mediaArray = updatedImages
        .filter(img => typeof img.url === 'string')
        .map(img => ({
          url: img.url as string,
          mediaType: img.mediaType,
          location: img.location,
          order: img.order,
        }));
      saveMediaToDatabase(mediaArray);
    } catch (error: any) {
      console.error('Error uploading files:', error);
      alert(`Failed to upload files: ${error.message || 'Unknown error'}`);
    }
  }, [images, checklist._id, handleMediaUpload, saveMediaToDatabase]);

  // Handler for image deletion
  const handleImageDelete = useCallback((checklistId: string, imageIndex: number) => {
    if (!checklist._id || checklistId !== checklist._id) return;

    const checklistImages = images.filter(img => typeof img.url === 'string');
    const imageToDelete = checklistImages[imageIndex];
    const updatedImages = images.filter(img => img !== imageToDelete);
    
    // Build reindexed location inputs
    const reindexedInputs: Record<string, string> = {};
    checklistImages.forEach((img, idx) => {
      if (idx !== imageIndex) {
        const oldKey = `${checklistId}-${idx}`;
        const newKey = `${checklistId}-${idx < imageIndex ? idx : idx - 1}`;
        const locationValue = locationInputs[oldKey] || img.location || '';
        if (locationValue) {
          reindexedInputs[newKey] = locationValue;
        }
      }
    });
    
    setLocationInputs(reindexedInputs);
    setImages(updatedImages);

    // Save to database with reordered media
    const mediaArray = updatedImages
      .filter(img => typeof img.url === 'string')
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((img, idx) => ({
        url: img.url as string,
        mediaType: img.mediaType,
        location: reindexedInputs[`${checklistId}-${idx}`] || img.location,
        order: idx, // Reorder
      }));
    saveMediaToDatabase(mediaArray);
  }, [images, checklist._id, locationInputs, saveMediaToDatabase]);

  // Handler for location change
  const handleLocationChange = useCallback((checklistId: string, imageIndex: number, location: string) => {
    if (!checklist._id || checklistId !== checklist._id) return;

    const inputKey = `${checklistId}-${imageIndex}`;
    setLocationInputs(prev => ({ ...prev, [inputKey]: location }));
    
    const checklistImages = images.filter(img => typeof img.url === 'string');
    const imageToUpdate = checklistImages[imageIndex];
    const updatedImages = images.map(i => 
      i === imageToUpdate ? { ...i, location } : i
    );
    setImages(updatedImages);

    // Save to database
    const mediaArray = updatedImages
      .filter(img => typeof img.url === 'string')
      .map(img => ({
        url: img.url as string,
        mediaType: img.mediaType,
        location: img.location,
        order: img.order,
      }));
    saveMediaToDatabase(mediaArray);
  }, [images, checklist._id, saveMediaToDatabase]);

  // Handler for media reorder
  const handleMediaReorder = useCallback((checklistId: string, reorderedMedia: ChecklistImage[]) => {
    if (!checklist._id || checklistId !== checklist._id) return;
    // Get current images for reference
    const currentImages = images.filter(img => typeof img.url === 'string');
    
    // Update locationInputs keys to match new indices by matching URL
    const newLocationInputs: Record<string, string> = {};
    reorderedMedia.forEach((img, newIdx) => {
      if (typeof img.url === 'string') {
        // Find the old index by matching URL
        const oldIdx = currentImages.findIndex(oldImg => 
          typeof oldImg.url === 'string' && oldImg.url === img.url
        );
        
        if (oldIdx !== -1) {
          const oldKey = `${checklist._id}-${oldIdx}`;
          // Use location from locationInputs if available, otherwise from image.location
          newLocationInputs[`${checklist._id}-${newIdx}`] = 
            locationInputs[oldKey] || img.location || '';
        } else if (img.location) {
          newLocationInputs[`${checklist._id}-${newIdx}`] = img.location;
        }
      }
    });
    
    setLocationInputs(newLocationInputs);
    setImages(reorderedMedia);
    
    // Update order indices and save to database
    const mediaArray = reorderedMedia
      .filter(img => typeof img.url === 'string')
      .map((img, idx) => ({
        url: img.url as string,
        mediaType: img.mediaType,
        location: newLocationInputs[`${checklist._id}-${idx}`] || img.location,
        order: idx, // Update order based on new index
      }));
    
    saveMediaToDatabase(mediaArray);
  }, [checklist._id, images, locationInputs, saveMediaToDatabase]);

  // Handler for image update (e.g., after annotation)
  const handleImageUpdate = useCallback((checklistId: string, imageIndex: number, newImageUrl: string) => {
    if (!checklist._id || checklistId !== checklist._id) return;
    
    const updatedImages = images.map((img, idx) => 
      idx === imageIndex ? { ...img, url: newImageUrl } : img
    );
    setImages(updatedImages);
    
    // Save to database
    const mediaArray = updatedImages
      .filter(img => typeof img.url === 'string')
      .map(img => ({
        url: img.url as string,
        mediaType: img.mediaType,
        location: img.location,
        order: img.order,
      }));
    saveMediaToDatabase(mediaArray);
  }, [images, checklist._id, saveMediaToDatabase]);

  // Get images for current checklist
  const checklistImages = useMemo(() => {
    return images.filter(img => typeof img.url === 'string').sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [images]);

  const {
    attributes: sortableAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: checklist._id || "",
    disabled: reorderDisabled,
  });

  const { role, tabIndex, ...attributes } = sortableAttributes;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isWithField = (checklist.type === 'status' || checklist.type === 'information') && checklist.field;

  // Handler for checkbox that toggles both expanded state and checked value
  const handleCheckboxChange = (checked: boolean | string) => {
    setIsExpanded(!isExpanded);
    if (onAnswerChange) {
      onAnswerChange(checklist._id || "", { defaultChecked: Boolean(checked) });
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50")}>
      <div className="rounded-lg border p-4 hover:bg-muted/30 transition-colors duration-200">
        <div className="flex items-center justify-between gap-2 bg-muted/40 rounded-md py-1.5 px-2">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Checkbox */}
              <Checkbox
                checked={checklist.defaultChecked || false}
                onCheckedChange={handleCheckboxChange}
                disabled={disabled}
              />
              {/* Clickable title area */}
              <div
                className="flex items-center gap-2 flex-1 cursor-pointer hover:opacity-70 transition-opacity"
                onClick={handleToggle}
                aria-expanded={isExpanded}
              >
                <span className="text-sm font-medium">{checklist.name}</span>
              </div>
            </div>
            {/* Truncated comment in minimized view (checkbox or no field only) */}
            {!isExpanded && checklist.comment && (!checklist.field || checklist.field === 'checkbox') && (() => {
              const plain = stripHtmlToText(checklist.comment || '');
              return plain ? (
                <div className="ml-6 text-sm text-muted-foreground">
                  {truncateComment(plain, 80)}
                </div>
              ) : null;
            })()}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Field type icon */}
            {checklist.field && getChecklistFieldIcon(checklist.field)}
            <Button
              variant="outline"
              size="icon"
              onClick={onEdit}
              disabled={disabled}
              title="Edit checklist"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onDelete}
              disabled={disabled}
              title="Delete checklist"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            {(checklist.type === "status" || checklist.type === "information") && onMoveType && (
              <Button
                variant="outline"
                size="icon"
                onClick={onMoveType}
                disabled={disabled}
                title={checklist.type === "status" ? "Move to Information" : "Move to Status"}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              {...attributes}
              role="button"
              tabIndex={reorderDisabled ? -1 : 0}
              aria-disabled={reorderDisabled}
              className={cn(
                reorderDisabled && "cursor-not-allowed opacity-40"
              )}
              title="Drag to reorder"
              {...(!reorderDisabled ? listeners : {})}
            >
              <GripVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Field component - always visible when item has a field */}
        {isWithField && onAnswerChange && (
          <div className="mt-2">
            <ChecklistFieldInput
              checklist={checklist}
              onAnswerChange={(answerData) => onAnswerChange(checklist._id || "", answerData)}
              disabled={disabled}
              hideTitleAndCheckbox={true}
            />
          </div>
        )}

        {/* Expanded view - Location, Comment, Images only */}
        {isExpanded && (
          <div className="mt-3 space-y-3">
            {/* Location field for status and information checklists */}
            {/* {(checklist.type === 'status' || checklist.type === 'information') && (
              <div className="space-y-2">
                <CreatableConcatenatedInput
                  value={locationValue}
                  onChange={setLocationValue}
                  label="Location"
                  placeholder="Search location..."
                  inputPlaceholder="Enter location"
                  options={locationOptions}
                  disabled={disabled}
                />
              </div>
            )} */}

            {/* Comment field for all checklist types */}
            <div className="space-y-2">
              <Label htmlFor={`comment-${checklist._id}`}>Comment</Label>
              <TipTapEditor
                id={`comment-${checklist._id}`}
                value={commentValue}
                onChange={(html) => setCommentValue(html)}
                disabled={disabled}
                placeholder="Enter comment..."
                variant="full"
              />
            </div>

            {/* Image upload section - status and information checklists */}
            {(checklist.type === 'status' || checklist.type === 'information') && (
              <ChecklistImageUpload
                checklistId={checklist._id || ""}
                images={checklistImages}
                onImagesSelect={handleImagesSelect}
                onImageDelete={handleImageDelete}
                onLocationChange={handleLocationChange}
                onMediaReorder={handleMediaReorder}
                onImageUpdate={handleImageUpdate}
                locationOptions={locationOptions}
                locationInputs={locationInputs}
                inspectionId={inspectionId}
                getProxiedSrc={getProxiedSrc}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChecklistContent({
  inspectionId,
  inspectionTemplateId,
  sectionId,
  subsectionId,
  subsectionName,
  sectionName,
}: ChecklistContentProps) {
  const [createStatusFormOpen, setCreateStatusFormOpen] = useState(false);
  const [createInformationFormOpen, setCreateInformationFormOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<InspectionTemplateChecklist | null>(null);
  const [deletingChecklistId, setDeletingChecklistId] = useState<string | null>(null);
  const [statusChecklistsLocal, setStatusChecklistsLocal] = useState<InspectionTemplateChecklist[]>([]);
  const [informationChecklistsLocal, setInformationChecklistsLocal] = useState<InspectionTemplateChecklist[]>([]);

  const { data, isLoading, error } = useInspectionTemplateChecklistsQuery(
    inspectionId,
    inspectionTemplateId,
    sectionId,
    subsectionId || ""
  );

  const createChecklistMutation = useCreateInspectionTemplateChecklistMutation(inspectionId, inspectionTemplateId, sectionId, subsectionId || "");
  const updateChecklistMutation = useUpdateInspectionTemplateChecklistMutation(inspectionId, inspectionTemplateId, sectionId, subsectionId || "");
  const deleteChecklistMutation = useDeleteInspectionTemplateChecklistMutation(inspectionId, inspectionTemplateId, sectionId, subsectionId || "");
  const reorderChecklistsMutation = useReorderInspectionTemplateChecklistsMutation(inspectionId, inspectionTemplateId, sectionId, subsectionId || "");
  const updateAnswerMutation = useUpdateChecklistAnswerMutation(inspectionId, inspectionTemplateId, sectionId, subsectionId || "");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const checklists = useMemo(() => {
    if (!data?.data?.checklists) return [];
    return Array.isArray(data.data.checklists) ? data.data.checklists : [];
  }, [data]);

  // Sync local state with query data
  useEffect(() => {
    if (data?.data?.checklists) {
      const checklistsArray = Array.isArray(data.data.checklists) ? data.data.checklists : [];
      const status = [...checklistsArray]
        .filter(c => c.type === 'status')
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      const information = [...checklistsArray]
        .filter(c => c.type === 'information')
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setStatusChecklistsLocal(status);
      setInformationChecklistsLocal(information);
    }
  }, [data]);

  const statusChecklists = statusChecklistsLocal;
  const informationChecklists = informationChecklistsLocal;

  const handleCreateStatusChecklist = async (values: any) => {
    try {
      await createChecklistMutation.mutateAsync({
        type: 'status',
        ...values,
      });
      setCreateStatusFormOpen(false);
    } catch (error) {
      console.error("Create status checklist error:", error);
    }
  };

  const handleCreateInformationChecklist = async (values: any) => {
    try {
      await createChecklistMutation.mutateAsync({
        type: 'information',
        ...values,
      });
      setCreateInformationFormOpen(false);
    } catch (error) {
      console.error("Create information checklist error:", error);
    }
  };

  const handleUpdateChecklist = async (values: any) => {
    if (!editingChecklist?._id) return;

    try {
      await updateChecklistMutation.mutateAsync({
        checklistId: editingChecklist._id,
        checklistData: {
          ...values,
          orderIndex: editingChecklist.orderIndex,
        },
      });
      setEditingChecklist(null);
    } catch (error) {
      console.error("Update checklist error:", error);
    }
  };

  const handleDeleteChecklist = async () => {
    if (!deletingChecklistId) return;

    try {
      await deleteChecklistMutation.mutateAsync(deletingChecklistId);
      setDeletingChecklistId(null);
    } catch (error) {
      console.error("Delete checklist error:", error);
    }
  };

  const handleMoveType = useCallback(
    async (checklist: InspectionTemplateChecklist) => {
      if (!checklist._id) return;
      const newType = checklist.type === "status" ? "information" : "status";
      const targetList = newType === "status" ? statusChecklists : informationChecklists;
      const lastOrderIndex =
        targetList.length > 0
          ? Math.max(...targetList.map((c) => c.orderIndex ?? 0)) + 1
          : 0;
      try {
        await updateChecklistMutation.mutateAsync({
          checklistId: checklist._id,
          checklistData: { type: newType, orderIndex: lastOrderIndex },
        });
      } catch (error) {
        console.error("Move checklist type error:", error);
      }
    },
    [statusChecklists, informationChecklists, updateChecklistMutation]
  );

  const handleAnswerChange = useCallback(
    async (checklistId: string, answerData: Partial<InspectionTemplateChecklist>) => {
      try {
        await updateAnswerMutation.mutateAsync({
          checklistId,
          answerData,
        });
      } catch (error) {
        console.error("Update checklist answer error:", error);
      }
    },
    [updateAnswerMutation]
  );

  // Handler for media updates
  const handleMediaUpdate = useCallback(
    async (checklistId: string, media: Array<{ url: string; mediaType: 'image' | 'video' | '360pic'; location?: string; order: number }>) => {
      try {
        await updateAnswerMutation.mutateAsync({
          checklistId,
          answerData: { media },
        });
      } catch (error) {
        console.error("Update checklist media error:", error);
      }
    },
    [updateAnswerMutation]
  );


  const isReorderDisabled = 
    createChecklistMutation.isPending ||
    updateChecklistMutation.isPending ||
    deleteChecklistMutation.isPending ||
    reorderChecklistsMutation.isPending ||
    !!editingChecklist ||
    !!deletingChecklistId;

  const commitStatusReorder = useCallback(
    async (nextStatusChecklists: InspectionTemplateChecklist[]) => {
      try {
        // Get all checklists and update only status ones
        // Status checklists come first, then information checklists
        const statusIds = new Set(nextStatusChecklists.map(c => c._id).filter(Boolean));
        
        // Create payload: status checklists first, then information checklists
        const payload: Array<{ id: string; order: number }> = [];
        
        // Add status checklists with new order
        nextStatusChecklists.forEach((checklist, index) => {
          if (checklist._id) {
            payload.push({
              id: checklist._id,
              order: index + 1,
            });
          }
        });
        
        // Add information checklists with their existing relative order, offset by status count
        const sortedInformation = [...informationChecklistsLocal].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        sortedInformation.forEach((checklist, index) => {
          if (checklist._id) {
            payload.push({
              id: checklist._id,
              order: nextStatusChecklists.length + index + 1,
            });
          }
        });

        await reorderChecklistsMutation.mutateAsync({ checklists: payload });
      } catch (error: any) {
        console.error("Error reordering status checklists:", error);
      }
    },
    [statusChecklistsLocal, informationChecklistsLocal, reorderChecklistsMutation]
  );

  const commitInformationReorder = useCallback(
    async (nextInformationChecklists: InspectionTemplateChecklist[]) => {
      try {
        // Get all checklists and update only information ones
        // Status checklists come first, then information checklists
        const sortedStatus = [...statusChecklistsLocal].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        
        // Create payload: status checklists first, then information checklists
        const payload: Array<{ id: string; order: number }> = [];
        
        // Add status checklists with their existing relative order
        sortedStatus.forEach((checklist, index) => {
          if (checklist._id) {
            payload.push({
              id: checklist._id,
              order: index + 1,
            });
          }
        });
        
        // Add information checklists with new order, offset by status count
        nextInformationChecklists.forEach((checklist, index) => {
          if (checklist._id) {
            payload.push({
              id: checklist._id,
              order: sortedStatus.length + index + 1,
            });
          }
        });

        await reorderChecklistsMutation.mutateAsync({ checklists: payload });
      } catch (error: any) {
        console.error("Error reordering information checklists:", error);
      }
    },
    [statusChecklistsLocal, informationChecklistsLocal, reorderChecklistsMutation]
  );

  const handleStatusDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (isReorderDisabled || isLoading) {
        return;
      }

      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = statusChecklists.findIndex((checklist) => checklist._id === active.id);
      const newIndex = statusChecklists.findIndex((checklist) => checklist._id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(statusChecklists, oldIndex, newIndex).map((checklist, index) => ({
        ...checklist,
        orderIndex: index + 1,
      }));

      setStatusChecklistsLocal(reordered);
      void commitStatusReorder(reordered);
    },
    [statusChecklists, commitStatusReorder, isReorderDisabled, isLoading]
  );

  const handleInformationDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (isReorderDisabled || isLoading) {
        return;
      }

      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = informationChecklists.findIndex((checklist) => checklist._id === active.id);
      const newIndex = informationChecklists.findIndex((checklist) => checklist._id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(informationChecklists, oldIndex, newIndex).map((checklist, index) => ({
        ...checklist,
        orderIndex: index + 1,
      }));

      setInformationChecklistsLocal(reordered);
      void commitInformationReorder(reordered);
    },
    [informationChecklists, commitInformationReorder, isReorderDisabled, isLoading]
  );

  if (!subsectionId) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">No subsection selected</p>
          <p className="text-sm">Select a subsection from the sidebar to view its checklists</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h2 className="text-2xl font-bold">Checklists</h2>
          {subsectionName && (
            <p className="text-muted-foreground">{subsectionName}</p>
          )}
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Failed to load checklists"}
              </p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading checklists...
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Status Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Status</CardTitle>
                <Button onClick={() => setCreateStatusFormOpen(true)} size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </CardHeader>
              <CardContent>
                {statusChecklists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No status checklists yet.</p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStatusDragEnd}>
                    <SortableContext
                      items={statusChecklists.map((checklist) => checklist._id || "")}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {statusChecklists.map((checklist) => (
                          <SortableChecklistItem
                            key={checklist._id}
                            checklist={checklist}
                            onEdit={() => setEditingChecklist(checklist)}
                            onDelete={() => setDeletingChecklistId(checklist._id || null)}
                            onMoveType={() => handleMoveType(checklist)}
                            disabled={createChecklistMutation.isPending || updateChecklistMutation.isPending}
                            reorderDisabled={isReorderDisabled}
                            onAnswerChange={handleAnswerChange}
                            onMediaUpdate={handleMediaUpdate}
                            inspectionId={inspectionId}
                            inspectionTemplateId={inspectionTemplateId}
                            sectionId={sectionId}
                            subsectionId={subsectionId || ""}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>

            {/* Information Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Information</CardTitle>
                <Button onClick={() => setCreateInformationFormOpen(true)} size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </CardHeader>
              <CardContent>
                {informationChecklists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No information checklists yet.</p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInformationDragEnd}>
                    <SortableContext
                      items={informationChecklists.map((checklist) => checklist._id || "")}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {informationChecklists.map((checklist) => (
                          <SortableChecklistItem
                            key={checklist._id}
                            checklist={checklist}
                            onEdit={() => setEditingChecklist(checklist)}
                            onDelete={() => setDeletingChecklistId(checklist._id || null)}
                            onMoveType={() => handleMoveType(checklist)}
                            disabled={createChecklistMutation.isPending || updateChecklistMutation.isPending}
                            reorderDisabled={isReorderDisabled}
                            onAnswerChange={handleAnswerChange}
                            onMediaUpdate={handleMediaUpdate}
                            inspectionId={inspectionId}
                            inspectionTemplateId={inspectionTemplateId}
                            sectionId={sectionId}
                            subsectionId={subsectionId || ""}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>

            {/* Defects Section */}
            {/* <DefectsSection
              inspectionId={inspectionId}
              templateId={inspectionTemplateId}
              sectionId={sectionId}
              subsectionId={subsectionId || ""}
              subsectionName={subsectionName}
              sectionName={sectionName}
            /> */}
            <DefectsList
              inspectionId={inspectionId}
              templateId={inspectionTemplateId}
              sectionId={sectionId}
              subsectionId={subsectionId || ""}
              hideFilter={true}
            />
          </>
        )}
      </div>

      <ChecklistItemForm
        open={createStatusFormOpen}
        onOpenChange={setCreateStatusFormOpen}
        onSubmit={handleCreateStatusChecklist}
        type="status"
        isSubmitting={createChecklistMutation.isPending}
      />

      <ChecklistItemForm
        open={createInformationFormOpen}
        onOpenChange={setCreateInformationFormOpen}
        onSubmit={handleCreateInformationChecklist}
        type="information"
        isSubmitting={createChecklistMutation.isPending}
      />

      {editingChecklist && (
        <ChecklistItemForm
          open={!!editingChecklist}
          onOpenChange={(open) => !open && setEditingChecklist(null)}
          onSubmit={handleUpdateChecklist}
          type={editingChecklist.type as 'status' | 'information'}
          initialValues={editingChecklist}
          isSubmitting={updateChecklistMutation.isPending}
        />
      )}

      <AlertDialog
        open={!!deletingChecklistId}
        onOpenChange={(open) => !open && setDeletingChecklistId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Checklist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this checklist item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteChecklistMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChecklist}
              disabled={deleteChecklistMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteChecklistMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
