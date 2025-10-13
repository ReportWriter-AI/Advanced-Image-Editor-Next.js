"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import HeaderImageUploader from './HeaderImageUploader';
import dynamic from 'next/dynamic';

const InformationSections = dynamic(() => import('./InformationSections'), { ssr: false });
const ThreeSixtyViewer = dynamic(() => import('./ThreeSixtyViewer'), { 
  ssr: false,
  loading: () => (
    <div style={{ 
      width: '100%', 
      height: '400px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#000',
      borderRadius: '8px'
    }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', color: 'white' }}></i>
    </div>
  )
});

interface Defect {
  _id: string;
  inspection_id: string;
  image: string;
  location: string;
  section: string;
  subsection: string;
  defect_description: string;
  defect_short_description: string;
  materials: string;
  material_total_cost: number;
  labor_type: string;
  labor_rate: number;
  hours_required: number;
  recommendation: string;
  color?: string;
  type: string;
  thumbnail: string;
  video: string;
  isThreeSixty?: boolean; // 360° photo flag
}

interface DefectEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectionId: string;
  inspectionName: string;
  _isPlaying?: boolean; 
}

export default function DefectEditModal({ isOpen, onClose, inspectionId, inspectionName }: DefectEditModalProps) {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<Defect>>({});
  const [inspectionDetails, setInspectionDetails] = useState<{headerImage?: string, headerText?: string, headerName?: string, headerAddress?: string}>({});
  const [savingHeaderImage, setSavingHeaderImage] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'defects' | 'information'>('defects');
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);



  // Fetch inspection details
  const fetchInspectionDetails = async () => {
    try {
      const response = await fetch(`/api/inspections/${inspectionId}`);
      if (response.ok) {
        const data = await response.json();
        setInspectionDetails(data);
      } else {
        console.error('Failed to fetch inspection details');
      }
    } catch (error) {
      console.error('Error fetching inspection details:', error);
    }
  };

  // Fetch defects and inspection details when modal opens
  useEffect(() => {
    if (isOpen && inspectionId) {
      fetchDefects();
      fetchInspectionDetails();
      
      // Flag to prevent showing the alert multiple times
      let hasAlerted = false;
      
      // Check for pending annotation and switch to Information Sections tab
      const checkForPendingAnnotation = () => {
        const pending = localStorage.getItem('pendingAnnotation');
        if (pending && !hasAlerted) {
          try {
            const annotation = JSON.parse(pending);
            if (annotation.inspectionId === inspectionId) {
              console.log('🔄 Switching to Information Sections tab for pending annotation');
              setActiveTab('information');
              // Show success notification immediately - don't wait for processing
              alert('✅ Image saved successfully!');
              hasAlerted = true; // Set flag to prevent duplicate alerts
            }
          } catch (e) {
            console.error('Error parsing pending annotation:', e);
          }
        }
      };
      
      // Check immediately
      checkForPendingAnnotation();
      
      // Also poll for 3 seconds to handle race condition where image-editor saves after modal opens
      let pollCount = 0;
      const maxPolls = 6; // 3 seconds (6 checks * 500ms)
      
      const pollInterval = setInterval(() => {
        pollCount++;
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          return;
        }
        
        const pending = localStorage.getItem('pendingAnnotation');
        if (pending && !hasAlerted) {
          try {
            const annotation = JSON.parse(pending);
            if (annotation.inspectionId === inspectionId) {
              console.log('📡 Polling detected pending annotation');
              setActiveTab('information');
              alert('✅ Image saved successfully!');
              hasAlerted = true;
              clearInterval(pollInterval);
            }
          } catch (e) {
            console.error('Error in polling:', e);
          }
        }
      }, 500);
      
      return () => clearInterval(pollInterval);
    } else if (!isOpen) {
      // Reset tab to defects when modal closes
      setActiveTab('defects');
    }
  }, [isOpen, inspectionId]);


  const fetchDefects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/defects/${inspectionId}`);
      if (response.ok) {
        const data = await response.json();
        // Ensure data is an array and has proper structure
        const safeData = Array.isArray(data) ? data : [];
        setDefects(safeData);
      } else {
        console.error('Failed to fetch defects');
        setDefects([]);
      }
    } catch (error) {
      console.error('Error fetching defects:', error);
      setDefects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDefect = async (defectId: string) => {
    if (!confirm('Are you sure you want to delete this defect?')) {
      return;
    }

    console.log(defectId)

    try {
      setDeleting(defectId);
      const response = await fetch(`/api/defects/${defectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDefects(prev => prev.filter(defect => defect._id !== defectId));
      } else {
        alert('Failed to delete defect. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting defect:', error);
      alert('Error deleting defect. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const setHeaderImage = async (imageUrl: string) => {
    try {
      setSavingHeaderImage(true);
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ headerImage: imageUrl }),
      });

      if (response.ok) {
        setInspectionDetails(prev => ({ ...prev, headerImage: imageUrl }));
        alert('Header image updated successfully');
      } else {
        alert('Failed to update header image');
      }
    } catch (error) {
      console.error('Error updating header image:', error);
      alert('Error updating header image');
    } finally {
      setSavingHeaderImage(false);
    }
  };
  
  const setHeaderName = async (text: string) => {
    try {
      setInspectionDetails(prev => ({ ...prev, headerName: text }));
      await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ headerName: text })
      });
    } catch(e){ console.error('Error updating header name', e); }
  };
  const setHeaderAddress = async (text: string) => {
    try {
      setInspectionDetails(prev => ({ ...prev, headerAddress: text }));
      await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ headerAddress: text })
      });
    } catch(e){ console.error('Error updating header address', e); }
  };

  const calculateTotalCost = (defect: Defect) => {
    const materialCost = defect.material_total_cost || 0;
    const laborRate = defect.labor_rate || 0;
    const hours = defect.hours_required || 0;
    const laborCost = laborRate * hours;
    return materialCost + laborCost;
  };

  const startEditing = (defect: Defect) => {
    setEditingId(defect._id);
    setEditedValues({ ...defect });
    setLastSaved(null);
  };

  const cancelEditing = () => {
    // Clear any pending auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setEditingId(null);
    setEditedValues({});
    setLastSaved(null);
  };

  const handleFieldChange = (field: keyof Defect, value: string) => {
    setEditedValues(prev => {
      let parsed: any = value;
      if (field === 'material_total_cost' || field === 'labor_rate' || field === 'hours_required') {
        const num = parseFloat(value);
        parsed = isNaN(num) ? 0 : num;
      }
      return { ...prev, [field]: parsed };
    });
    
    // Trigger auto-save with debounce
    triggerAutoSave();
  };

  // Auto-save function with debouncing
  const triggerAutoSave = useCallback(() => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new timer to save after 1 second of inactivity
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 1000);
  }, [editingId, editedValues, defects]);

  const performAutoSave = async () => {
    if (!editingId) return;
    const index = defects.findIndex(d => d._id === editingId);
    if (index === -1) return;
  
    const updated: Defect = { ...defects[index], ...(editedValues as Defect) };
  
    setAutoSaving(true);
    
    try {
      const response = await fetch(`/api/defects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: updated.inspection_id,
          defect_description: updated.defect_description,
          materials: updated.materials,
          material_total_cost: updated.material_total_cost,
          location: updated.location,
          labor_type: updated.labor_type,
          labor_rate: updated.labor_rate,
          hours_required: updated.hours_required,
          recommendation: updated.recommendation,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Auto-save error:", errorData.error);
        return;
      }
  
      const result = await response.json();
      console.log("✅ Auto-saved successfully:", result.message);
  
      // Update local state
      setDefects(prev =>
        prev.map(d => (d._id === editingId ? updated : d))
      );
      
      // Update last saved timestamp
      const now = new Date();
      setLastSaved(now.toLocaleTimeString());
      
    } catch (err) {
      console.error("Auto-save error:", err);
    } finally {
      setAutoSaving(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const saveEdited = async () => {
    if (!editingId) return;
    const index = defects.findIndex(d => d._id === editingId);
    if (index === -1) return;
  
    const updated: Defect = { ...defects[index], ...(editedValues as Defect) };
  
    // Log all values for the edited defect
    console.log('Edited defect values:', updated);
  
    try {
      // Call API to persist changes
      const response = await fetch(`/api/defects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: updated.inspection_id, // required
          defect_description: updated.defect_description,
          materials: updated.materials,
          material_total_cost: updated.material_total_cost,
          location: updated.location,
          labor_type: updated.labor_type,
          labor_rate: updated.labor_rate,
          hours_required: updated.hours_required,
          recommendation: updated.recommendation,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating defect:", errorData.error);
        alert(`Update failed: ${errorData.error}`);
        return;
      }
  
      const result = await response.json();
      console.log("✅ Defect updated successfully:", result.message);
  
      // Update local state so UI reflects new values
      setDefects(prev =>
        prev.map(d => (d._id === editingId ? updated : d))
      );
  
      setEditingId(null);
      setEditedValues({});
    } catch (err) {
      console.error("Unexpected error while saving defect:", err);
      alert("Something went wrong while saving changes.");
    }
  };
  

  const getDisplayDefect = (defect: Defect): Defect => {
    if (editingId === defect._id) {
      return { ...defect, ...(editedValues as Partial<Defect>) } as Defect;
    }
    return defect;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay"
      onClick={onClose}
    >
      <div 
        className="modal-content defect-edit-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-body">
          <div className="modal-header">
            <h2>Edit Inspection - {inspectionName}</h2>
            <button className="modal-close-btn" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* Tabs */}
          <div className="modal-tabs-container" style={{ padding: '0 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setActiveTab('defects')}
                style={{
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'defects' ? '3px solid #dc2626' : '3px solid transparent',
                  fontWeight: 600,
                  color: activeTab === 'defects' ? '#dc2626' : '#6b7280',
                  cursor: 'pointer'
                }}
              >
                Defects
              </button>
              <button
                onClick={() => setActiveTab('information')}
                style={{
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'information' ? '3px solid #dc2626' : '3px solid transparent',
                  fontWeight: 600,
                  color: activeTab === 'information' ? '#dc2626' : '#6b7280',
                  cursor: 'pointer'
                }}
              >
                Information Sections
              </button>
            </div>
          </div>

          <div style={{ padding: '24px' }}>
          {activeTab === 'defects' && (
            <>
              {/* Header Image Upload */}
              <div className="header-image-section">
                <h3>Report Header Image</h3>
                <p className="section-description">Upload a custom image to use as the header for this inspection report.</p>
                
                <div className="header-image-container">
                  <HeaderImageUploader 
                    currentImage={inspectionDetails.headerImage}
                    headerName={inspectionDetails.headerName || (inspectionDetails.headerText ? inspectionDetails.headerText.split('\n')[0] : '')}
                    headerAddress={inspectionDetails.headerAddress || (inspectionDetails.headerText ? inspectionDetails.headerText.split('\n').slice(1).join(' ') : '')}
                    onImageUploaded={(imageUrl) => setHeaderImage(imageUrl)}
                    onImageRemoved={() => setHeaderImage('')}
                    onHeaderNameChanged={(text) => setHeaderName(text)}
                    onHeaderAddressChanged={(text) => setHeaderAddress(text)}
                  />
                </div>
              </div>
              
              <div className="section-divider"></div>
              <h3>Manage Defects</h3>
              
              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading defects...</p>
                </div>
              ) : defects.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-exclamation-triangle empty-icon"></i>
                  <h3>No Defects Found</h3>
                  <p>This inspection has no defects recorded.</p>
                </div>
              ) : (
                <div className="defects-list">
                  {defects.map((defect, index) => {
                    const displayDefect = getDisplayDefect(defect);
                    const isEditing = editingId === defect._id;
                    return (
                      <div key={defect._id} className="defect-card">
                        <div className="defect-header">
                          <h3>Defect #{index + 1}</h3>
                          <div className="defect-actions">
                            {!isEditing && (
                              <button
                                className="professional-edit-btn"
                                onClick={() => startEditing(defect)}
                                title="Edit defect"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                            )}
                            {isEditing && (
                              <>
                                <div className="auto-save-indicator" style={{ 
                                  marginRight: '10px', 
                                  fontSize: '13px',
                                  color: autoSaving ? '#f59e0b' : '#10b981',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}>
                                  {autoSaving ? (
                                    <>
                                      <i className="fas fa-spinner fa-spin"></i>
                                      <span>Saving...</span>
                                    </>
                                  ) : lastSaved ? (
                                    <>
                                      <i className="fas fa-check-circle"></i>
                                      <span>Saved at {lastSaved}</span>
                                    </>
                                  ) : (
                                    <>
                                      <i className="fas fa-info-circle"></i>
                                      <span>Auto-save enabled</span>
                                    </>
                                  )}
                                </div>
                                <button 
                                  className="cancel-defect-btn" 
                                  onClick={cancelEditing}
                                  title="Done editing"
                                  style={{ background: '#10b981' }}
                                >
                                  <i className="fas fa-check"></i>
                                </button>
                              </>
                            )}
                            <button
                              className="delete-defect-btn"
                              onClick={() => handleDeleteDefect(defect._id)}
                              disabled={deleting === defect._id}
                            >
                              {deleting === defect._id ? (
                                <i className="fas fa-spinner fa-spin"></i>
                              ) : (
                                <i className="fas fa-trash"></i>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="defect-content">
                          <div className="defect-image">
                            {displayDefect.isThreeSixty && displayDefect.image ? (
                              <ThreeSixtyViewer
                                imageUrl={displayDefect.image}
                                alt={`360° view - ${displayDefect.defect_short_description || 'defect'}`}
                                height="400px"
                              />
                            ) : displayDefect.type === "video" && displayDefect.video ? (
                              <>
                                {playingVideoId !== displayDefect._id ? (
                                  <img
                                    src={displayDefect.thumbnail || "/placeholder-image.jpg"}
                                    alt="Video thumbnail"
                                    style={{ maxWidth: "100%", maxHeight: "200px", cursor: "pointer" }}
                                    onClick={() => setPlayingVideoId(displayDefect._id)}
                                  />
                                ) : (
                                  <video
                                    src={displayDefect.video}
                                    controls
                                    autoPlay
                                    style={{ maxWidth: "100%", maxHeight: "200px" }}
                                  />
                                )}
                              </>
                            ) : (
                              <img
                                src={
                                  displayDefect.image ||
                                  displayDefect.thumbnail ||
                                  "/placeholder-image.jpg"
                                }
                                alt="Defect"
                              />
                            )}
                          </div>
                          <div className="defect-details">
                            <div className="detail-row">
                              <strong>Location:</strong>{' '}
                              {isEditing ? (
                                <input
                                  className="defect-input"
                                  type="text"
                                  value={editedValues.location ?? displayDefect.location ?? ''}
                                  onChange={(e) => handleFieldChange('location', e.target.value)}
                                />
                              ) : (
                                displayDefect.location || 'Not specified'
                              )}
                            </div>
                            <div className="detail-row">
                              <strong>Section:</strong>{' '}
                              {isEditing ? (
                                <input
                                  className="defect-input"
                                  type="text"
                                  value={editedValues.section ?? displayDefect.section ?? ''}
                                  onChange={(e) => handleFieldChange('section', e.target.value)}
                                />
                              ) : (
                                displayDefect.section || 'Not specified'
                              )}
                            </div>
                            <div className="detail-row">
                              <strong>Subsection:</strong>{' '}
                              {isEditing ? (
                                <input
                                  className="defect-input"
                                  type="text"
                                  value={editedValues.subsection ?? displayDefect.subsection ?? ''}
                                  onChange={(e) => handleFieldChange('subsection', e.target.value)}
                                />
                              ) : (
                                displayDefect.subsection || 'Not specified'
                              )}
                            </div>
                            <div className="detail-row">
                              <strong>Description:</strong>{' '}
                              {isEditing ? (
                                <textarea
                                  className="defect-input"
                                  value={editedValues.defect_description ?? displayDefect.defect_description ?? ''}
                                  onChange={(e) => handleFieldChange('defect_description', e.target.value)}
                                />
                              ) : (
                                displayDefect.defect_description || 'No description available'
                              )}
                            </div>
                            <div className="detail-row">
                              <strong>Materials:</strong>{' '}
                              {isEditing ? (
                                <input
                                  className="defect-input"
                                  type="text"
                                  value={editedValues.materials ?? displayDefect.materials ?? ''}
                                  onChange={(e) => handleFieldChange('materials', e.target.value)}
                                />
                              ) : (
                                displayDefect.materials || 'No materials specified'
                              )}
                            </div>
                            <div className="detail-row">
                              <strong>Material Cost:</strong>{' '}
                              {isEditing ? (
                                <input
                                  className="defect-input"
                                  type="number"
                                  step="0.01"
                                  value={String(editedValues.material_total_cost ?? displayDefect.material_total_cost ?? 0)}
                                  onChange={(e) => handleFieldChange('material_total_cost', e.target.value)}
                                />
                              ) : (
                                formatCurrency(displayDefect.material_total_cost || 0)
                              )}
                            </div>
                            <div className="detail-row">
                              <strong>Labor:</strong>{' '}
                              {isEditing ? (
                                <input
                                  className="defect-input"
                                  type="text"
                                  value={editedValues.labor_type ?? displayDefect.labor_type ?? ''}
                                  onChange={(e) => handleFieldChange('labor_type', e.target.value)}
                                />
                              ) : (
                                displayDefect.labor_type || 'Not specified'
                              )}{' '}
                              {isEditing ? (
                                <>
                                  at
                                  <input
                                    className="defect-input"
                                    style={{ width: 100, marginLeft: 6, marginRight: 6 }}
                                    type="number"
                                    step="0.01"
                                    value={String(editedValues.labor_rate ?? displayDefect.labor_rate ?? 0)}
                                    onChange={(e) => handleFieldChange('labor_rate', e.target.value)}
                                  />
                                  /hr
                                </>
                              ) : (
                                <> at {formatCurrency(displayDefect.labor_rate || 0)}/hr</>
                              )}
                            </div>
                            <div className="detail-row">
                              <strong>Hours:</strong>{' '}
                              {isEditing ? (
                                <input
                                  className="defect-input"
                                  type="number"
                                  step="0.1"
                                  value={String(editedValues.hours_required ?? displayDefect.hours_required ?? 0)}
                                  onChange={(e) => handleFieldChange('hours_required', e.target.value)}
                                />
                              ) : (
                                displayDefect.hours_required || 0
                              )}
                            </div>
                            <div className="detail-row">
                              <strong>Recommendation:</strong>{' '}
                              {isEditing ? (
                                <textarea
                                  className="defect-input"
                                  value={editedValues.recommendation ?? displayDefect.recommendation ?? ''}
                                  onChange={(e) => handleFieldChange('recommendation', e.target.value)}
                                />
                              ) : (
                                displayDefect.recommendation || 'No recommendation available'
                              )}
                            </div>
                            <div className="detail-row total-cost">
                              <strong>Total Cost:</strong>{' '}
                              {formatCurrency(
                                calculateTotalCost({
                                  ...displayDefect,
                                  material_total_cost: Number(
                                    isEditing
                                      ? editedValues.material_total_cost ?? displayDefect.material_total_cost ?? 0
                                      : displayDefect.material_total_cost ?? 0
                                  ),
                                  labor_rate: Number(
                                    isEditing
                                      ? editedValues.labor_rate ?? displayDefect.labor_rate ?? 0
                                      : displayDefect.labor_rate ?? 0
                                  ),
                                  hours_required: Number(
                                    isEditing
                                      ? editedValues.hours_required ?? displayDefect.hours_required ?? 0
                                      : displayDefect.hours_required ?? 0
                                  ),
                                } as Defect)
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {activeTab === 'information' && (
            <InformationSections inspectionId={inspectionId} />
          )}
          </div>

          <div className="modal-footer">
            <button className="modal-btn secondary-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
