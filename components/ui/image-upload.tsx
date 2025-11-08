"use client";

import { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

type ShapeVariant = 'circle' | 'rounded' | 'square';

const shapeClassMap: Record<ShapeVariant, string> = {
  circle: 'rounded-full',
  rounded: 'rounded-xl',
  square: 'rounded-none',
};

export interface ImageUploadProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  label?: string;
  description?: string;
  accept?: string;
  disabled?: boolean;
  shape?: ShapeVariant;
  className?: string;
  imageClassName?: string;
  uploadUrl?: string;
  withRemoveButton?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  label,
  description,
  accept = 'image/*',
  disabled = false,
  shape = 'circle',
  className,
  imageClassName,
  uploadUrl = '/api/r2api',
  withRemoveButton = true,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const hasImage = Boolean(value);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload image');
      }

      const data = await response.json();

      if (!data?.url) {
        throw new Error('Upload succeeded but no URL was returned');
      }

      onChange?.(data.url);
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      console.error('Image upload failed:', error);
      toast.error(error.message || 'Image upload failed');
    } finally {
      setIsUploading(false);
      // Reset value so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    if (disabled || isUploading) return;
    onChange?.(null);
  };

  const handleTrigger = () => {
    if (disabled || isUploading) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={cn('space-y-3', className)}>
      {(label || description) && (
        <div className="space-y-1">
          {label && <p className="text-sm font-medium leading-none text-foreground">{label}</p>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleTrigger}
          disabled={disabled || isUploading}
          className={cn(
            'relative flex h-24 w-24 items-center justify-center overflow-hidden border border-dashed border-border bg-muted transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            shapeClassMap[shape],
            imageClassName
          )}
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : hasImage ? (
            <img src={value ?? ''} alt="Uploaded" className="h-full w-full object-cover" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
          )}
        </button>

        {withRemoveButton && hasImage && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || isUploading}
            className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>

      <input
        type="file"
        accept={accept}
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />
    </div>
  );
}

export default ImageUpload;
