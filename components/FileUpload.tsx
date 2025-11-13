import React, { useRef } from "react";

interface FileUploadProps {
  // New: support selecting multiple files at once
  onFilesSelect: (files: File[]) => void;
  accept?: string;
  id?: string;
  labels?: { upload?: string; photo?: string; video?: string };
  layoutColumns?: number; // e.g., 2 to force two columns (2x2 when 4 buttons)
  extraButtons?: React.ReactNode[]; // optional extra buttons appended to the grid
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFilesSelect, 
  accept = "image/*,.heic,.heif", 
  id = "file-upload",
  labels,
  layoutColumns,
  extraButtons = []
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Image inputs: allow multiple selection
  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const filtered = files.filter((f) => f.type.startsWith('image/') || /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name));
    if (!filtered.length) {
      alert('Unsupported file type. Please select image files.');
      e.target.value = '';
      return;
    }
    onFilesSelect(filtered);
    // Reset the input so the same file(s) can be selected again if needed
    e.target.value = '';
  };

  // Video input: single file selection
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      alert('Unsupported file type. Please select a video.');
      e.target.value = '';
      return;
    }
    onFilesSelect([file]);
    e.target.value = '';
  };

  return (
    <div>
      {/* Hidden file inputs - ensure they are completely hidden */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleImagesChange} 
        id={id} 
        style={{ display: 'none' }}
        accept={accept}
        multiple
      />
      <input 
        type="file" 
        ref={cameraInputRef}
        onChange={handleImagesChange} 
        id={`${id}-camera`} 
        style={{ display: 'none' }}
        accept={accept}
        multiple
        /* No capture attribute: lets users switch between cameras in OS UI */
      />
      <input 
        type="file" 
        ref={videoInputRef}
        onChange={handleVideoChange} 
        id={`${id}-video`} 
        style={{ display: 'none' }}
        accept="video/*"
        /* No capture attribute: lets users switch between cameras in OS UI */
      />
      
      {/* Upload buttons in a clean grid layout */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: layoutColumns ? `repeat(${layoutColumns}, minmax(140px, 1fr))` : 'repeat(auto-fit, minmax(140px, 1fr))', 
        gap: '0.5rem',
        maxWidth: '100%',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
        overflowX: 'hidden'
      }}>
        {/* Optional extra buttons (e.g., 360° Pic) can be prepended for custom layouts */}
        {extraButtons && extraButtons.length > 0 && extraButtons.map((node, idx) => (
          <div key={`extra-${idx}`} style={{ display: 'contents' }}>
            {node}
          </div>
        ))}
        <label 
          htmlFor={id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.625rem 0.75rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#8230c9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
        >
          📷 {labels?.upload ?? 'Upload Image'}
        </label>
        
        <label
          htmlFor={`${id}-camera`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.625rem 0.75rem',
            backgroundColor: '#10b981',
            color: 'white',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
        >
          📸 {labels?.photo ?? 'Take Photo'}
        </label>
        
        <label
          htmlFor={`${id}-video`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.625rem 0.75rem',
            backgroundColor: '#8b5cf6',
            color: 'white',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#7c3aed')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#8b5cf6')}
        >
          🎥 {labels?.video ?? 'Take Video'}
        </label>
      </div>
    </div>
  );
};

export default FileUpload;