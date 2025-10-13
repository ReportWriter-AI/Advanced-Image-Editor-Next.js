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
}

const HeaderImageUploader: React.FC<HeaderImageUploaderProps> = ({ 
  currentImage, 
  headerName = '',
  headerAddress = '',
  onImageUploaded,
  onImageRemoved,
  onHeaderNameChanged,
  onHeaderAddressChanged
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localHeaderName, setLocalHeaderName] = useState(headerName);
  const [localHeaderAddress, setLocalHeaderAddress] = useState(headerAddress);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

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

      tempUrl = URL.createObjectURL(file);
      setPreviewUrl(tempUrl);

      const formData = new FormData();
      formData.append('file', file);

      console.log('Uploading header image to R2... (converted:', isHeic, ')');
      const response = await fetch('/api/r2api', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        console.error('Upload failed response:', data);
        throw new Error(data.error || 'Failed to upload image');
      }
      console.log('Upload successful, URL:', data.url);
      onImageUploaded(data.url);
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
              src={currentImage} 
              alt="Current header" 
              className="header-image-preview"
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