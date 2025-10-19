"use client";

import React, { useState, useRef, useEffect } from "react";
// Dynamic import type for heic2any (ESM only) - will lazy load when needed
type Heic2AnyModule = (options: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob>;

interface HeaderImageUploaderProps {
  currentImage?: string;
  headerName?: string;
  headerAddress?: string;
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved: () => void;
  onHeaderNameChanged: (text: string) => void;
  onHeaderAddressChanged: (text: string) => void;
  getProxiedSrc?: (url: string | null | undefined) => string;
}

const HeaderImageUploader: React.FC<HeaderImageUploaderProps> = ({ 
  currentImage, 
  headerName = '',
  headerAddress = '',
  onImageUploaded,
  onImageRemoved,
  onHeaderNameChanged,
  onHeaderAddressChanged,
  getProxiedSrc
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localHeaderName, setLocalHeaderName] = useState(headerName);
  const [localHeaderAddress, setLocalHeaderAddress] = useState(headerAddress);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Normalize smartphone photo orientation using EXIF, return a new JPEG File if rotation/flip needed
  const fixImageOrientation = async (inputFile: File): Promise<File> => {
    try {
      // Only attempt on images (skip videos) and common formats; HEIC is handled separately
      if (!inputFile.type.startsWith('image/')) return inputFile;

  // Use ESM build to avoid UMD warning
  const exifr: any = (await import('exifr/dist/full.esm.mjs')) as any;
      const orientation: number | undefined = await exifr.orientation(inputFile);
      if (!orientation || orientation === 1) return inputFile; // No transform needed

      // Draw onto canvas with the correct transform
      const imgUrl = URL.createObjectURL(inputFile);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = imgUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(imgUrl);
        return inputFile;
      }

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      // Set canvas size and apply orientation-specific transforms
      switch (orientation) {
        case 2: // mirror horizontal
          canvas.width = width; canvas.height = height;
          ctx.translate(width, 0); ctx.scale(-1, 1);
          break;
        case 3: // rotate 180
          canvas.width = width; canvas.height = height;
          ctx.translate(width, height); ctx.rotate(Math.PI);
          break;
        case 4: // mirror vertical
          canvas.width = width; canvas.height = height;
          ctx.translate(0, height); ctx.scale(1, -1);
          break;
        case 5: // mirror horizontal and rotate 270 CW
          canvas.width = height; canvas.height = width;
          ctx.rotate(0.5 * Math.PI); ctx.scale(1, -1); ctx.translate(0, -height);
          break;
        case 6: // rotate 90 CW
          canvas.width = height; canvas.height = width;
          ctx.rotate(0.5 * Math.PI); ctx.translate(0, -height);
          break;
        case 7: // mirror horizontal and rotate 90 CW
          canvas.width = height; canvas.height = width;
          ctx.rotate(0.5 * Math.PI); ctx.translate(width, -height); ctx.scale(-1, 1);
          break;
        case 8: // rotate 270 CW
          canvas.width = height; canvas.height = width;
          ctx.rotate(-0.5 * Math.PI); ctx.translate(-width, 0);
          break;
        default:
          canvas.width = width; canvas.height = height;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(imgUrl);

      // Convert canvas back to a JPEG File
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.95)
      );
      const normalized = new File([blob], inputFile.name.replace(/\.(png|jpg|jpeg|webp)$/i, '') + '.jpg', { type: 'image/jpeg' });
      return normalized;
    } catch (err) {
      console.warn('EXIF orientation normalization skipped:', err);
      return inputFile;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;

    let file = originalFile;
    const lowerName = file.name.toLowerCase();
    const isHeic = lowerName.endsWith('.heic') || lowerName.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';

    let tempUrl: string | null = null;
    try {
      setUploading(true);
      // For preview, if it's HEIC/HEIF convert first so we can preview; many browsers can't show HEIC.
      if (isHeic) {
        // Lazy import heic2any only when needed
        const heic2any: any = (await import('heic2any')).default || (await import('heic2any'));
        const convertedBlob: Blob = await (heic2any as Heic2AnyModule)({ blob: file, toType: 'image/jpeg', quality: 0.9 });
        file = new File([convertedBlob], `${file.name.replace(/\.(heic|heif)$/i,'')}.jpg`, { type: 'image/jpeg' });
      }

      // Normalize EXIF orientation for JPEG/PNG after optional HEIC conversion
      try {
        file = await fixImageOrientation(file);
      } catch (e) {
        console.warn('Orientation fix failed, using original:', e);
      }

      tempUrl = URL.createObjectURL(file);
      setPreviewUrl(tempUrl);

      console.log('Uploading header image to R2 using presigned URL... (converted:', isHeic, ')');
      
      // NEW: Direct R2 upload using presigned URL
      const presignedRes = await fetch(
        `/api/r2api?action=presigned&fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
      );
      
      if (!presignedRes.ok) {
        throw new Error('Failed to get presigned upload URL');
      }
      
      const { uploadUrl, publicUrl } = await presignedRes.json();
      console.log('✅ Got presigned URL, uploading directly to R2...');
      
      // Upload file DIRECTLY to R2
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Direct R2 upload failed with status ${response.status}`);
      }
      
      console.log('✅ Upload successful, URL:', publicUrl);
      onImageUploaded(publicUrl);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Failed to upload image: ${error.message || 'Please try again.'}`);
    } finally {
      setUploading(false);
      if (tempUrl) {
        URL.revokeObjectURL(tempUrl);
      }
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // Update local state when prop changes
  useEffect(() => { setLocalHeaderName(headerName); }, [headerName]);
  useEffect(() => { setLocalHeaderAddress(headerAddress); }, [headerAddress]);

  const makeHandler = (setter: React.Dispatch<React.SetStateAction<string>>, cb: (v: string)=>void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setter(value);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(()=>cb(value),500);
  };

  return (
    <div className="header-image-uploader">
      <div className="header-text-input">
        <label htmlFor="header-name" className="text-input-label">Name (Header Line 1)</label>
        <input
          type="text"
          id="header-name"
          value={localHeaderName}
          onChange={makeHandler(setLocalHeaderName, onHeaderNameChanged)}
          placeholder="Client / Property Name"
          className="text-input"
        />
      </div>
      <div className="header-text-input" style={{ marginTop: '12px' }}>
        <label htmlFor="header-address" className="text-input-label">Address (Header Line 2)</label>
        <input
          type="text"
          id="header-address"
          value={localHeaderAddress}
          onChange={makeHandler(setLocalHeaderAddress, onHeaderAddressChanged)}
          placeholder="Street, City"
          className="text-input"
        />
        <p className="text-input-hint">Name will appear above address on the header image</p>
      </div>
      
      {currentImage ? (
        <div className="current-header-image">
          <h4>Current Header Image</h4>
          <div className="image-with-text-preview">
            <img 
              src={getProxiedSrc ? getProxiedSrc(currentImage) : currentImage} 
              alt="Current header" 
              className="header-image-preview"
              onError={(e) => {
                console.error('Failed to load header image preview:', currentImage);
                if (getProxiedSrc && !(e.currentTarget.src?.includes('/api/proxy-image?'))) {
                  e.currentTarget.src = getProxiedSrc(currentImage) || '';
                }
              }}
            />
            {(localHeaderName || localHeaderAddress) && (
              <div className="header-text-overlay" style={{ lineHeight: 1.15, flexDirection: 'column' }}>
                {localHeaderName && <span style={{ display:'block' }}>{localHeaderName}</span>}
                {localHeaderAddress && <span style={{ display:'block' }}>{localHeaderAddress}</span>}
              </div>
            )}
          </div>
          <button 
            onClick={onImageRemoved}
            className="btn clear-header-btn"
            disabled={uploading}
          >
            Remove Header Image
          </button>
        </div>
      ) : (
        <div className="upload-container">
          <h4>Upload Header Image</h4>
          <div className="upload-options">
            <div className="upload-buttons">
              {/* File input for gallery/file selection */}
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange} 
                id="header-image-upload" 
                className="hidden" 
                accept="image/jpeg,image/png,image/jpg,image/webp,image/heic,image/heif,.jpeg,.jpg,.png,.webp,.heic,.heif,image/*"
                disabled={uploading}
              />
              {/* Camera input for mobile camera access */}
              <input 
                type="file"
                ref={cameraInputRef}
                onChange={handleFileChange} 
                id="header-camera-upload" 
                className="hidden" 
                accept="image/*"
                capture="environment"
                disabled={uploading}
              />
              <label 
                htmlFor="header-image-upload" 
                className={`btn upload-btn ${uploading ? 'disabled' : ''}`}
              >
                <i className="fas fa-upload mr-2"></i>
                {uploading ? 'Uploading...' : 'Choose from Gallery'}
              </label>
              <label 
                htmlFor="header-camera-upload" 
                className={`btn upload-btn ${uploading ? 'disabled' : ''}`}
                style={{ marginLeft: '10px' }}
              >
                <i className="fas fa-camera mr-2"></i>
                {uploading ? 'Uploading...' : 'Take Photo'}
              </label>
            </div>
            
            <p className="upload-hint">
              For best results, use a landscape image with a 16:9 aspect ratio
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeaderImageUploader;