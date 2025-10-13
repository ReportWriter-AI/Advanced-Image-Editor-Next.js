import React, { useRef } from "react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  id?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  accept = "image/*,.heic,.heif", 
  id = "file-upload" 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Light client-side validation to avoid round-trip on completely unsupported types
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        alert('Unsupported file type. Please select an image or video.');
        e.target.value = '';
        return;
      }
      onFileSelect(file);
      // Reset the input so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  return (
    <div>
      {/* Hidden file inputs - ensure they are completely hidden */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange} 
        id={id} 
        style={{ display: 'none' }}
        accept="image/*,.heic,.heif"
      />
      <input 
        type="file" 
        ref={cameraInputRef}
        onChange={handleFileChange} 
        id={`${id}-camera`} 
        style={{ display: 'none' }}
        accept="image/*,.heic,.heif"
        /* No capture attribute: lets users switch between cameras in OS UI */
      />
      <input 
        type="file" 
        ref={videoInputRef}
        onChange={handleFileChange} 
        id={`${id}-video`} 
        style={{ display: 'none' }}
        accept="video/*"
        /* No capture attribute: lets users switch between cameras in OS UI */
      />
      
      {/* Upload buttons in a clean grid layout */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
        gap: '0.5rem',
        maxWidth: '500px'
      }}>
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
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
        >
          📷 Upload Image
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
          📸 Take Photo
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
          🎥 Take Video
        </label>
      </div>
    </div>
  );
};

export default FileUpload;