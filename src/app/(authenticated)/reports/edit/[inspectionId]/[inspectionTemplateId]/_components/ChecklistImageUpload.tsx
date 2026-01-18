"use client";

import React, { useRef, useCallback, useState, type CSSProperties } from "react";
import FileUpload from "@/components/FileUpload";
import { CreatableConcatenatedInput } from "@/components/ui/creatable-concatenated-input";
import { GripVertical } from "lucide-react";
import ImageEditorModal from "@/components/ImageEditorModal";
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
import { cn } from "@/lib/utils";

export interface ChecklistImage {
  url: string | File;
  mediaType: 'image' | 'video' | '360pic';
  location?: string;
  order: number;
}

interface ChecklistImageUploadProps {
  checklistId: string;
  images: ChecklistImage[];
  onImagesSelect: (checklistId: string, files: File[], mediaType: 'image' | 'video' | '360pic') => void;
  onImageDelete: (checklistId: string, imageIndex: number) => void;
  onLocationChange: (checklistId: string, imageIndex: number, location: string) => void;
  onMediaReorder?: (checklistId: string, reorderedMedia: ChecklistImage[]) => void;
  onImageUpdate?: (checklistId: string, imageIndex: number, newImageUrl: string) => void;
  locationOptions: Array<{ value: string; label: string }>;
  locationInputs: Record<string, string>;
  inspectionId: string;
  getProxiedSrc: (url: string | null | undefined) => string;
}

interface SortableMediaItemProps {
  checklistId: string;
  image: ChecklistImage;
  imageIndex: number;
  locationOptions: Array<{ value: string; label: string }>;
  locationInput: string;
  onImageDelete: (checklistId: string, imageIndex: number) => void;
  onLocationChange: (checklistId: string, imageIndex: number, location: string) => void;
  getProxiedSrc: (url: string | null | undefined) => string;
  inspectionId: string;
  onOpenEditor: (imageUrl: string, imageIndex: number) => void;
}

function SortableMediaItem({
  checklistId,
  image,
  imageIndex,
  locationOptions,
  locationInput,
  onImageDelete,
  onLocationChange,
  getProxiedSrc,
  inspectionId,
  onOpenEditor,
}: SortableMediaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${checklistId}-${imageIndex}`,
  });

  const { role, tabIndex, ...sortableAttributes } = attributes;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const previewUrl = (() => {
    if (typeof image.url === 'string') {
      return getProxiedSrc(image.url);
    } else if (image.url && typeof image.url === 'object' && image.url instanceof File) {
      return URL.createObjectURL(image.url);
    }
    return '';
  })();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-50")}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '180px' }}>
        <div style={{ position: 'relative', width: '180px', height: '180px', borderRadius: '0.375rem', overflow: 'hidden', border: '2px solid #10b981' }}>
          {previewUrl ? (
            image.mediaType === 'video' ? (
              <video
                src={previewUrl}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                controls
                onError={(e) => {
                  console.error('Video preview failed:', previewUrl);
                  (e.target as HTMLVideoElement).style.display = 'none';
                }}
              />
            ) : (
              <img
                src={previewUrl}
                alt={`Image ${imageIndex + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  console.error('Image preview failed:', previewUrl);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', color: '#9ca3af' }}>
              No preview
            </div>
          )}
          <button
            onClick={() => onImageDelete(checklistId, imageIndex)}
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              padding: '0.25rem 0.4rem',
              fontSize: '0.75rem',
              borderRadius: '0.25rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              fontWeight: 600
            }}
            title="Delete image"
          >
            ✕
          </button>
          <button
            {...sortableAttributes}
            role="button"
            tabIndex={0}
            {...listeners}
            style={{
              position: 'absolute',
              top: '6px',
              left: '6px',
              padding: '0.25rem 0.4rem',
              fontSize: '0.75rem',
              borderRadius: '0.25rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              cursor: 'grab',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Drag to reorder"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        </div>

        {/* Location input using CreatableConcatenatedInput */}
        <div style={{ position: 'relative', width: '180px' }}>
          <CreatableConcatenatedInput
            value={locationInput}
            onChange={(newLocation) => {
              onLocationChange(checklistId, imageIndex, newLocation);
            }}
            label="Location"
            placeholder="Search location..."
            inputPlaceholder="Enter location"
            options={locationOptions}
          />
        </div>

        {image.mediaType !== 'video' && (
          <button
            onClick={() => {
              const imageUrl = typeof image.url === 'string' ? image.url : previewUrl;
              onOpenEditor(imageUrl, imageIndex);
            }}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.75rem',
              borderRadius: '0.25rem',
              backgroundColor: '#a466da',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              width: '180px',
              fontWeight: 600
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#934ad3'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#a466da'}
            title="Annotate image with arrows, circles, and highlights"
          >
            🖊️ Annotate
          </button>
        )}
      </div>
    </div>
  );
}

export function ChecklistImageUpload({
  checklistId,
  images,
  onImagesSelect,
  onImageDelete,
  onLocationChange,
  onMediaReorder,
  onImageUpdate,
  locationOptions,
  locationInputs,
  inspectionId,
  getProxiedSrc,
}: ChecklistImageUploadProps) {
  const threeSixtyInputRef = useRef<HTMLInputElement>(null);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editorImageUrl, setEditorImageUrl] = useState<string>('');
  const [editorImageIndex, setEditorImageIndex] = useState<number>(-1);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !onMediaReorder) {
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);

      // Extract indices from IDs (format: `${checklistId}-${index}`)
      const activeIndex = parseInt(activeId.split('-').pop() || '0', 10);
      const overIndex = parseInt(overId.split('-').pop() || '0', 10);

      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
        return;
      }

      const reorderedImages = arrayMove(images, activeIndex, overIndex).map((img, idx) => ({
        ...img,
        order: idx,
      }));

      onMediaReorder(checklistId, reorderedImages);
    },
    [images, checklistId, onMediaReorder]
  );

  const handleThreeSixtyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    threeSixtyInputRef.current?.click();
  };

  const handleThreeSixtyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onImagesSelect(checklistId, files, '360pic');
      e.target.value = '';
    }
  };

  const handleOpenEditor = (imageUrl: string, imageIndex: number) => {
    setEditorImageUrl(imageUrl);
    setEditorImageIndex(imageIndex);
    setImageEditorOpen(true);
  };

  const handleEditorSave = async (result: any) => {
    console.log('Editor save result:', result);
    
    if (result?.imageUrl && editorImageIndex >= 0) {
      // Trigger parent to save to database
      if (onImageUpdate) {
        onImageUpdate(checklistId, editorImageIndex, result.imageUrl);
      }
    }
    
    setImageEditorOpen(false);
  };

  return (
    <>
      <div style={{ marginTop: '0.75rem', marginLeft: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
        {/* Hidden file input for 360° uploads */}
        <input
          type="file"
          ref={threeSixtyInputRef}
          onChange={handleThreeSixtyFileChange}
          accept="image/*,.heic,.heif"
          multiple
          style={{ display: 'none' }}
        />
        <div style={{ marginBottom: '0.5rem' }}>
          <FileUpload
            onFilesSelect={(files) => {
              // Determine mediaType based on file type
              const hasVideo = files.some(f => f.type.startsWith('video/'));
              const mediaType = hasVideo ? 'video' : 'image';
              onImagesSelect(checklistId, files, mediaType);
            }}
            id={`file-upload-${checklistId}`}
            labels={{ photo: 'Photo', video: 'Video' }}
            layoutColumns={2}
            extraButtons={[
              (
                <button
                  key={`btn-360-${checklistId}`}
                  onClick={handleThreeSixtyClick}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 0.75rem',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: `1px solid #ef4444`,
                    transition: 'background-color 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    minHeight: '42px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ef4444';
                  }}
                  title="Upload 360° picture"
                >
                  <span
                    aria-hidden
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '16px',
                      height: '16px',
                      borderRadius: '9999px',
                      border: '2px solid #ffffff',
                      backgroundColor: '#ffffff',
                      color: '#ef4444',
                      fontSize: '0.8rem',
                      fontWeight: 900,
                      lineHeight: 1
                    }}
                  >
                    ✓
                  </span>
                  <span>360° Pic</span>
                </button>
              )
            ]}
          />
        </div>

        {/* Display existing images */}
        {images.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={images.map((_, idx) => `${checklistId}-${idx}`)}
              strategy={verticalListSortingStrategy}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                {images.map((img, idx) => (
                  <SortableMediaItem
                    key={`${checklistId}-${idx}`}
                    checklistId={checklistId}
                    image={img}
                    imageIndex={idx}
                    locationOptions={locationOptions}
                    locationInput={locationInputs[`${checklistId}-${idx}`] ?? img.location ?? ''}
                    onImageDelete={onImageDelete}
                    onLocationChange={onLocationChange}
                    getProxiedSrc={getProxiedSrc}
                    inspectionId={inspectionId}
                    onOpenEditor={handleOpenEditor}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Image Editor Modal */}
      <ImageEditorModal
        isOpen={imageEditorOpen}
        onClose={() => setImageEditorOpen(false)}
        mode="annotation"
        inspectionId={inspectionId}
        imageUrl={editorImageUrl}
        checklistId={checklistId}
        onSave={handleEditorSave}
        originalImageUrl={editorImageUrl}
      />
    </>
  );
}
