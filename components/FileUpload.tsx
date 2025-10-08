import React, { useRef } from "react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  id?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  accept = "image/*", 
  id = "file-upload" 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset the input so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
      {/* Hidden file inputs */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange} 
        id={id} 
        className="hidden" 
        accept={accept}
      />
      <input 
        type="file" 
        ref={cameraInputRef}
        onChange={handleFileChange} 
        id={`${id}-camera`} 
        className="hidden" 
        accept="image/*"
        capture="environment"
      />
      
      {/* Upload icon */}
      <div className="mb-3">
        <i className="fas fa-cloud-upload-alt text-3xl text-gray-400"></i>
      </div>
      
      {/* Upload buttons */}
      <div className="flex gap-2 justify-center">
        <label 
          htmlFor={id} 
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors text-sm font-medium"
        >
          <i className="fas fa-folder-open"></i>
          Choose Image
        </label>
        
        <label
          htmlFor={`${id}-camera`}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg cursor-pointer hover:bg-green-600 transition-colors text-sm font-medium"
        >
          <i className="fas fa-camera"></i>
          Take Photo
        </label>
      </div>
    </div>
  );
};

export default FileUpload;