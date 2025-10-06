"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from './FileUpload';

interface ISectionChecklist { 
  _id: string; 
  text: string; 
  comment?: string;
  type: 'status' | 'information';
  order_index: number; 
}

interface ISection { 
  _id: string; 
  name: string; 
  order_index: number; 
  checklists: ISectionChecklist[]; 
}

interface IBlockImage { 
  url: string; 
  annotations?: string; 
  checklist_id?: string; // Associate image with specific checklist item
  location?: string; // Location tag for the image (e.g., "Garage", "Left Side of House")
}

interface IInformationBlock {
  _id: string;
  inspection_id: string;
  section_id: ISection | string;
  selected_checklist_ids: ISectionChecklist[] | string[];
  custom_text?: string;
  images: IBlockImage[];
}

interface AddBlockFormState {
  section_id: string;
  selected_checklist_ids: Set<string>;
  custom_text: string;
  images: IBlockImage[]; // Store images for the block
}

interface InformationSectionsProps {
  inspectionId: string;
}

const InformationSections: React.FC<InformationSectionsProps> = ({ inspectionId }) => {
  const router = useRouter();
  const [sections, setSections] = useState<ISection[]>([]);
  const [blocks, setBlocks] = useState<IInformationBlock[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<ISection | null>(null);
  const [formState, setFormState] = useState<AddBlockFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Admin checklist management
  const [checklistFormOpen, setChecklistFormOpen] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [checklistFormData, setChecklistFormData] = useState<{
    text: string;
    comment: string;
    type: 'status' | 'information';
  }>({ text: '', comment: '', type: 'status' });
  const [savingChecklist, setSavingChecklist] = useState(false);

  const fetchSections = useCallback(async () => {
    setLoadingSections(true);
    setError(null);
    try {
      const res = await fetch('/api/information-sections/sections');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load sections');
      setSections(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingSections(false);
    }
  }, []);

  const fetchBlocks = useCallback(async () => {
    if (!inspectionId) return;
    setLoadingBlocks(true);
    try {
      const res = await fetch(`/api/information-sections/${inspectionId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load information blocks');
      setBlocks(json.data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingBlocks(false);
    }
  }, [inspectionId]);

  useEffect(() => { fetchSections(); }, [fetchSections]);
  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  // Check for pending annotations from image-editor
  useEffect(() => {
    const checkPendingAnnotation = async () => {
      const pendingData = localStorage.getItem('pendingAnnotation');
      if (pendingData) {
        try {
          const annotation = JSON.parse(pendingData);
          console.log('🎨 Found pending annotation:', annotation);
          
          // Clear the pending annotation immediately
          localStorage.removeItem('pendingAnnotation');
          
          // If modal is open, update the formState
          if (modalOpen && formState) {
            // Find the image in formState that matches the checklistId
            const imageIndex = formState.images.findIndex(img => img.checklist_id === annotation.checklistId);
            
            if (imageIndex !== -1) {
              // Update the existing image with the annotated version
              const updatedImages = [...formState.images];
              updatedImages[imageIndex] = {
                ...updatedImages[imageIndex],
                url: annotation.imageUrl,
                annotations: annotation.annotations
              };
              
              setFormState({
                ...formState,
                images: updatedImages
              });
              
              console.log('✅ Updated image with annotations in formState');
            }
          } else {
            // Modal is closed - need to save directly to the database
            console.log('💾 Modal closed, saving annotation directly to database');
            
            try {
              // Fetch all blocks to find the one containing this checklist
              const blocksRes = await fetch(`/api/information-sections/${inspectionId}`);
              const blocksJson = await blocksRes.json();
              
              if (blocksJson.success) {
                // Find the block that has this checklist selected
                const targetBlock = blocksJson.data.find((block: IInformationBlock) => {
                  const checklistIds = Array.isArray(block.selected_checklist_ids)
                    ? block.selected_checklist_ids.map((cl: any) => typeof cl === 'string' ? cl : cl._id)
                    : [];
                  return checklistIds.includes(annotation.checklistId);
                });
                
                if (targetBlock) {
                  console.log('📦 Found target block:', targetBlock._id);
                  
                  // Find the image to update
                  const imageIndex = targetBlock.images.findIndex((img: IBlockImage) => img.checklist_id === annotation.checklistId);
                  
                  if (imageIndex !== -1) {
                    // Update the image with the annotated version
                    const updatedImages = [...targetBlock.images];
                    updatedImages[imageIndex] = {
                      ...updatedImages[imageIndex],
                      url: annotation.imageUrl,
                      annotations: annotation.annotations
                    };
                    
                    // Save the updated block
                    const updateRes = await fetch(`/api/information-sections/${inspectionId}?blockId=${targetBlock._id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        selected_checklist_ids: Array.isArray(targetBlock.selected_checklist_ids)
                          ? targetBlock.selected_checklist_ids.map((cl: any) => typeof cl === 'string' ? cl : cl._id)
                          : [],
                        custom_text: targetBlock.custom_text || '',
                        images: updatedImages,
                      }),
                    });
                    
                    const updateJson = await updateRes.json();
                    if (updateJson.success) {
                      console.log('✅ Annotation saved directly to database');
                      // Note: Success alert is shown by DefectEditModal, not here (to avoid duplicate)
                      // Refresh blocks to show the updated image
                      await fetchBlocks();
                    } else {
                      console.error('❌ Failed to save annotation:', updateJson.error);
                      alert('❌ Failed to save annotation. Please try again.');
                    }
                  } else {
                    console.warn('⚠️ Image not found in block images');
                  }
                } else {
                  console.warn('⚠️ Block not found for checklist:', annotation.checklistId);
                }
              }
            } catch (error) {
              console.error('❌ Error saving annotation to database:', error);
            }
          }
        } catch (error) {
          console.error('❌ Error processing pending annotation:', error);
          localStorage.removeItem('pendingAnnotation');
        }
      }
    };

    // Check immediately
    checkPendingAnnotation();

    // Check on window focus (when user returns from image-editor)
    const handleFocus = () => {
      console.log('🔍 Window focused, checking for pending annotation');
      checkPendingAnnotation();
    };
    
    // Listen for storage events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pendingAnnotation' && e.newValue) {
        console.log('🔔 Storage event detected for pendingAnnotation');
        setTimeout(() => checkPendingAnnotation(), 100);
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);
    
    // Poll localStorage every 500ms for 3 seconds to catch race conditions
    // (storage events don't fire in the same tab, and focus events might be missed)
    let pollCount = 0;
    const maxPolls = 6; // 3 seconds total
    const pollInterval = setInterval(() => {
      pollCount++;
      const pending = localStorage.getItem('pendingAnnotation');
      if (pending || pollCount >= maxPolls) {
        if (pending) {
          console.log('📡 Polling detected pendingAnnotation');
          checkPendingAnnotation();
        }
        clearInterval(pollInterval);
      }
    }, 500);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, [modalOpen, formState, inspectionId, fetchBlocks]);

  const openAddModal = async (section: ISection, existingBlock?: IInformationBlock) => {
    setActiveSection(section);
    
    if (existingBlock) {
      // Editing existing block - fetch the latest data from the database to ensure we have the most recent version
      console.log('📂 Opening existing block, fetching latest data...');
      
      try {
        const res = await fetch(`/api/information-sections/${inspectionId}`);
        const json = await res.json();
        
        if (json.success) {
          // Find the most up-to-date version of this block
          const latestBlock = json.data.find((b: IInformationBlock) => b._id === existingBlock._id);
          
          if (latestBlock) {
            console.log('✅ Using latest block data with', latestBlock.images.length, 'images');
            
            setEditingBlockId(latestBlock._id);
            const selectedIds = Array.isArray(latestBlock.selected_checklist_ids)
              ? latestBlock.selected_checklist_ids
                  .map((cl: any) => typeof cl === 'string' ? cl : cl._id)
                  .filter(Boolean)
              : [];
            
            setFormState({
              section_id: section._id,
              selected_checklist_ids: new Set(selectedIds),
              custom_text: latestBlock.custom_text || '',
              images: latestBlock.images || [],
            });
          } else {
            // Fallback to the passed block if not found
            console.warn('⚠️ Could not find latest block, using cached data');
            setEditingBlockId(existingBlock._id);
            const selectedIds = Array.isArray(existingBlock.selected_checklist_ids)
              ? existingBlock.selected_checklist_ids
                  .map((cl: any) => typeof cl === 'string' ? cl : cl._id)
                  .filter(Boolean)
              : [];
            
            setFormState({
              section_id: section._id,
              selected_checklist_ids: new Set(selectedIds),
              custom_text: existingBlock.custom_text || '',
              images: existingBlock.images || [],
            });
          }
        } else {
          throw new Error('Failed to fetch latest block data');
        }
      } catch (error) {
        console.error('❌ Error fetching latest block data:', error);
        // Fallback to using the passed block data
        setEditingBlockId(existingBlock._id);
        const selectedIds = Array.isArray(existingBlock.selected_checklist_ids)
          ? existingBlock.selected_checklist_ids
              .map((cl: any) => typeof cl === 'string' ? cl : cl._id)
              .filter(Boolean)
          : [];
        
        setFormState({
          section_id: section._id,
          selected_checklist_ids: new Set(selectedIds),
          custom_text: existingBlock.custom_text || '',
          images: existingBlock.images || [],
        });
      }
    } else {
      // Creating new block
      setEditingBlockId(null);
      setFormState({
        section_id: section._id,
        selected_checklist_ids: new Set(),
        custom_text: '',
        images: [],
      });
    }
    
    setModalOpen(true);
  };

  const toggleChecklist = (id: string) => {
    if (!formState) return;
    const setIds = new Set(formState.selected_checklist_ids);
    setIds.has(id) ? setIds.delete(id) : setIds.add(id);
    setFormState({ ...formState, selected_checklist_ids: setIds });
  };

  const handleSave = async () => {
    if (!formState || !inspectionId) return;
    setSaving(true);
    
    console.log('💾 Saving information block with images:', {
      images: formState.images,
      imageCount: formState.images.length,
      imagesWithChecklistId: formState.images.filter(img => img.checklist_id).length
    });
    
    try {
      if (editingBlockId) {
        // Update existing block
        const res = await fetch(`/api/information-sections/${inspectionId}?blockId=${editingBlockId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_checklist_ids: Array.from(formState.selected_checklist_ids),
            custom_text: formState.custom_text,
            images: formState.images,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to update block');
      } else {
        // Create new block
        const res = await fetch(`/api/information-sections/${inspectionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: formState.section_id,
            selected_checklist_ids: Array.from(formState.selected_checklist_ids),
            custom_text: formState.custom_text,
            images: formState.images,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to save block');
      }
      
      // Refresh blocks
      await fetchBlocks();
      setModalOpen(false);
      setActiveSection(null);
      setFormState(null);
      setEditingBlockId(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (blockId: string) => {
    if (!confirm('Are you sure you want to delete this information block?')) return;
    
    try {
      const res = await fetch(`/api/information-sections/${inspectionId}?blockId=${blockId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete block');
      
      // Refresh blocks
      await fetchBlocks();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Image handling for checklist items
  const handleImageSelect = async (checklistId: string, file: File) => {
    if (!formState) return;

    console.log('📸 Image selected for checklist:', checklistId);

    try {
      // Upload image to R2
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/r2api', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Failed to upload image');
      
      const uploadData = await uploadRes.json();
      
      console.log('✅ Image uploaded to R2:', uploadData.url);
      
      // Add image to formState
      const newImage: IBlockImage = {
        url: uploadData.url,
        annotations: undefined,
        checklist_id: checklistId,
      };

      console.log('💾 Adding image to formState:', newImage);

      setFormState({
        ...formState,
        images: [...formState.images, newImage],
      });
      
      console.log('✅ FormState updated, total images:', formState.images.length + 1);
      
      // Automatically open image editor for annotation
      console.log('🎨 Opening image editor for annotation...');
      const editorUrl = `/image-editor?imageUrl=${encodeURIComponent(uploadData.url)}&returnTo=${encodeURIComponent(window.location.pathname)}&checklistId=${checklistId}&inspectionId=${inspectionId}`;
      router.push(editorUrl);
      
    } catch (error) {
      console.error('❌ Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    }
  };

  const handleImageDelete = (checklistId: string, imageIndex: number) => {
    if (!formState) return;
    
    const checklistImages = formState.images.filter(img => img.checklist_id === checklistId);
    const imageToDelete = checklistImages[imageIndex];
    
    setFormState({
      ...formState,
      images: formState.images.filter(img => img !== imageToDelete),
    });
  };

  const handleLocationUpdate = (checklistId: string, imageIndex: number, location: string) => {
    if (!formState) return;
    
    const checklistImages = formState.images.filter(img => img.checklist_id === checklistId);
    const imageToUpdate = checklistImages[imageIndex];
    
    // Find the image in the full images array and update its location
    const updatedImages = formState.images.map(img => 
      img === imageToUpdate ? { ...img, location } : img
    );
    
    setFormState({
      ...formState,
      images: updatedImages,
    });
    
    console.log('📍 Location updated for image:', location);
  };

  const getChecklistImages = (checklistId: string): IBlockImage[] => {
    if (!formState) return [];
    return formState.images.filter(img => img.checklist_id === checklistId);
  };

  // Admin: Open checklist form for creating/editing
  const openChecklistForm = (type: 'status' | 'information', existingChecklist?: ISectionChecklist) => {
    if (existingChecklist) {
      setEditingChecklistId(existingChecklist._id);
      setChecklistFormData({
        text: existingChecklist.text,
        comment: existingChecklist.comment || '',
        type: existingChecklist.type,
      });
    } else {
      setEditingChecklistId(null);
      setChecklistFormData({ text: '', comment: '', type });
    }
    setChecklistFormOpen(true);
  };

  // Admin: Save checklist (create or update)
  const handleSaveChecklist = async () => {
    if (!activeSection || !checklistFormData.text.trim()) {
      alert('Checklist name is required');
      return;
    }

    setSavingChecklist(true);
    try {
      if (editingChecklistId) {
        // Update existing checklist
        const res = await fetch(`/api/checklists/${editingChecklistId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checklistFormData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to update checklist');
      } else {
        // Create new checklist
        const res = await fetch('/api/checklists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: activeSection._id,
            ...checklistFormData,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to create checklist');
      }

      // Refresh sections to get updated checklists
      await fetchSections();
      setChecklistFormOpen(false);
      setEditingChecklistId(null);
      setChecklistFormData({ text: '', comment: '', type: 'status' });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingChecklist(false);
    }
  };

  // Admin: Delete checklist
  const handleDeleteChecklist = async (checklistId: string) => {
    if (!confirm('Are you sure you want to delete this checklist item? This will remove it from all inspections.')) return;

    try {
      const res = await fetch(`/api/checklists/${checklistId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete checklist');

      // Refresh sections to get updated checklists
      await fetchSections();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const sectionBlocks = (sectionId: string) =>
    blocks.filter(b => (typeof b.section_id === 'string' ? b.section_id === sectionId : (b.section_id as ISection)._id === sectionId));

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Information Sections</h2>
      {loadingSections && <div>Loading sections...</div>}
      {error && <div style={{ color: '#dc2626' }}>{error}</div>}
      
      {!loadingSections && !error && sections.length === 0 && (
        <div style={{ 
          padding: '2rem', 
          backgroundColor: '#fef3c7', 
          border: '1px solid #fbbf24', 
          borderRadius: '0.5rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#92400e', marginBottom: '0.5rem' }}>
            ⚠️ No Sections Found
          </div>
          <div style={{ fontSize: '0.875rem', color: '#78350f', marginBottom: '1rem' }}>
            The database doesn't have any inspection sections configured yet.
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#78350f', backgroundColor: 'white', padding: '0.75rem', borderRadius: '0.375rem', textAlign: 'left' }}>
            <strong>To fix this:</strong><br/>
            1. Run the seed script: <code style={{ backgroundColor: '#f3f4f6', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>node scripts/seed-information-sections.js</code><br/>
            2. Make sure your .env.local has the correct MONGODB_URI<br/>
            3. Refresh this page after seeding
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sections.map(section => (
          <div key={section._id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '1rem', backgroundColor: 'white', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ fontWeight: 500, fontSize: '1rem' }}>{section.name}</h3>
              <button
                onClick={() => openAddModal(section)}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem', borderRadius: '0.25rem', backgroundColor: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              >
                Add Information Block
              </button>
            </div>

            {/* Existing blocks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {loadingBlocks && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading blocks...</div>}
              {sectionBlocks(section._id).map(block => (
                <div key={block._id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.25rem', padding: '0.75rem', backgroundColor: '#f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Selected Items:</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => openAddModal(section, block)}
                        style={{ 
                          padding: '0.25rem 0.5rem', 
                          fontSize: '0.75rem', 
                          borderRadius: '0.25rem', 
                          backgroundColor: '#3b82f6', 
                          color: 'white', 
                          border: 'none', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(block._id)}
                        style={{ 
                          padding: '0.25rem 0.5rem', 
                          fontSize: '0.75rem', 
                          borderRadius: '0.25rem', 
                          backgroundColor: '#ef4444', 
                          color: 'white', 
                          border: 'none', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                    <div style={{ marginLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(block.selected_checklist_ids as any[]).map((cl: any) => (
                        <div key={cl._id || cl} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              padding: '0.1rem 0.4rem', 
                              borderRadius: '0.25rem', 
                              backgroundColor: cl.type === 'status' ? '#dbeafe' : '#d1fae5',
                              color: cl.type === 'status' ? '#1e40af' : '#065f46',
                              fontWeight: 600,
                              textTransform: 'uppercase'
                            }}>
                              {cl.type || 'info'}
                            </span>
                            <span style={{ fontWeight: 'bold' }}>{cl.text || cl}</span>
                          </div>
                          {cl.comment && (
                            <div style={{ marginLeft: '1rem', color: '#6b7280' }}>{cl.comment}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    {block.custom_text && (
                      <div style={{ marginTop: '0.5rem' }}><span style={{ fontWeight: 600 }}>Custom Text:</span> {block.custom_text}</div>
                    )}
                  </div>
                </div>
              ))}
              {sectionBlocks(section._id).length === 0 && (
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>No information blocks yet.</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && activeSection && formState && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 50, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            backgroundColor: 'rgba(0,0,0,0.4)', 
            padding: '1rem',
            overscrollBehavior: 'contain' // Prevent pull-to-refresh on iOS
          }}
          onClick={(e) => {
            // Close modal if clicking overlay
            if (e.target === e.currentTarget) {
              setModalOpen(false);
              setActiveSection(null);
              setEditingBlockId(null);
            }
          }}
        >
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '0.375rem', 
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', 
            width: '100%', 
            maxWidth: '42rem', 
            maxHeight: '85vh', // Reduced from 90vh to ensure space from edges
            overflow: 'hidden', 
            display: 'flex', 
            flexDirection: 'column',
            touchAction: 'pan-y' // Allow vertical scrolling only
          }}>
            <div style={{ 
              borderBottom: '1px solid #e5e7eb', 
              padding: '0.75rem 1rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              flexShrink: 0 // Prevent header from shrinking
            }}>
              <h4 style={{ fontWeight: 600, fontSize: '1.125rem' }}>
                {editingBlockId ? 'Edit' : 'Add'} Information Block - {activeSection.name}
              </h4>
              <button onClick={() => { setModalOpen(false); setActiveSection(null); setEditingBlockId(null); }} style={{ color: '#6b7280', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.25rem' }}>✕</button>
            </div>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '1.5rem 1rem', // Increased top/bottom padding
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.5rem',
              WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
              overscrollBehavior: 'contain' // Prevent pull-to-refresh
            }}>
              {/* Status Fields Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h5 style={{ fontWeight: 600, fontSize: '1rem', color: '#1f2937', borderBottom: '2px solid #3b82f6', paddingBottom: '0.5rem', flex: 1 }}>Status Fields</h5>
                  <button
                    onClick={() => openChecklistForm('status')}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      borderRadius: '0.25rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      marginLeft: '0.5rem',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    + Add New
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeSection.checklists
                    .filter(cl => cl.type === 'status')
                    .map(cl => {
                      const isSelected = formState.selected_checklist_ids.has(cl._id);
                      const checklistImages = getChecklistImages(cl._id);
                      
                      return (
                        <div key={cl._id} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: isSelected ? '#eff6ff' : 'transparent', border: '1px solid #e5e7eb' }}>
                          <label style={{ display: 'flex', fontSize: '0.875rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleChecklist(cl._id)}
                                style={{ marginTop: '0.2rem' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: '#1f2937' }}>{cl.text}</div>
                                {cl.comment && (
                                  <div style={{ marginLeft: '0rem', marginTop: '0.25rem', color: '#6b7280', fontSize: '0.8rem' }}>
                                    {cl.comment.length > 150 ? cl.comment.slice(0, 150) + '…' : cl.comment}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openChecklistForm('status', cl);
                                  }}
                                  style={{
                                    padding: '0.2rem 0.35rem',
                                    fontSize: '0.7rem',
                                    borderRadius: '0.2rem',
                                    backgroundColor: '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d97706'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f59e0b'}
                                  title="Edit checklist"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteChecklist(cl._id);
                                  }}
                                  style={{
                                    padding: '0.2rem 0.35rem',
                                    fontSize: '0.7rem',
                                    borderRadius: '0.2rem',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                                  title="Delete checklist"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </label>
                          
                          {/* Image upload section - show only when item is selected */}
                          {isSelected && (
                            <div style={{ marginTop: '0.75rem', marginLeft: '1.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                              <div style={{ marginBottom: '0.5rem' }}>
                                <FileUpload 
                                  onFileSelect={(file) => handleImageSelect(cl._id, file)}
                                  id={`file-upload-${cl._id}`}
                                />
                              </div>
                              
                              {/* Display existing images */}
                              {checklistImages.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                                  {checklistImages.map((img, idx) => (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '180px' }}>
                                      <div style={{ position: 'relative', width: '180px', height: '180px', borderRadius: '0.375rem', overflow: 'hidden', border: '2px solid #3b82f6' }}>
                                        <img 
                                          src={img.url} 
                                          alt={`Image ${idx + 1}`}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                        <button
                                          onClick={() => handleImageDelete(cl._id, idx)}
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
                                      </div>
                                      
                                      {/* Location Input */}
                                      <input
                                        type="text"
                                        placeholder="Location (e.g., Garage, Left Side)"
                                        value={img.location || ''}
                                        onChange={(e) => handleLocationUpdate(cl._id, idx, e.target.value)}
                                        style={{
                                          padding: '0.5rem',
                                          fontSize: '0.75rem',
                                          borderRadius: '0.25rem',
                                          border: '1px solid #d1d5db',
                                          width: '180px',
                                          outline: 'none'
                                        }}
                                        onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                                      />
                                      
                                      <button
                                        onClick={() => {
                                          // Navigate to image editor with the image URL and inspectionId
                                          const editorUrl = `/image-editor?imageUrl=${encodeURIComponent(img.url)}&returnTo=${encodeURIComponent(window.location.pathname)}&checklistId=${cl._id}&inspectionId=${inspectionId}`;
                                          router.push(editorUrl);
                                        }}
                                        style={{
                                          padding: '0.5rem 0.75rem',
                                          fontSize: '0.75rem',
                                          borderRadius: '0.25rem',
                                          backgroundColor: '#3b82f6',
                                          color: 'white',
                                          border: 'none',
                                          cursor: 'pointer',
                                          width: '180px',
                                          fontWeight: 600
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                                        title="Annotate image with arrows, circles, and highlights"
                                      >
                                        🖊️ Annotate
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  {activeSection.checklists.filter(cl => cl.type === 'status').length === 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>No status fields available</div>
                  )}
                </div>
              </div>

              {/* Limitations/Information Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h5 style={{ fontWeight: 600, fontSize: '1rem', color: '#1f2937', borderBottom: '2px solid #10b981', paddingBottom: '0.5rem', flex: 1 }}>Limitations / Information</h5>
                  <button
                    onClick={() => openChecklistForm('information')}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      borderRadius: '0.25rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      marginLeft: '0.5rem',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    + Add New
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeSection.checklists
                    .filter(cl => cl.type === 'information')
                    .map(cl => {
                      const isSelected = formState.selected_checklist_ids.has(cl._id);
                      const checklistImages = getChecklistImages(cl._id);
                      
                      return (
                        <div key={cl._id} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: isSelected ? '#f0fdf4' : 'transparent', border: '1px solid #e5e7eb' }}>
                          <label style={{ display: 'flex', fontSize: '0.875rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleChecklist(cl._id)}
                                style={{ marginTop: '0.2rem' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: '#1f2937' }}>{cl.text}</div>
                                {cl.comment && (
                                  <div style={{ marginLeft: '0rem', marginTop: '0.25rem', color: '#6b7280', fontSize: '0.8rem' }}>
                                    {cl.comment.length > 150 ? cl.comment.slice(0, 150) + '…' : cl.comment}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openChecklistForm('information', cl);
                                  }}
                                  style={{
                                    padding: '0.2rem 0.35rem',
                                    fontSize: '0.7rem',
                                    borderRadius: '0.2rem',
                                    backgroundColor: '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d97706'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f59e0b'}
                                  title="Edit checklist"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteChecklist(cl._id);
                                  }}
                                  style={{
                                    padding: '0.2rem 0.35rem',
                                    fontSize: '0.7rem',
                                    borderRadius: '0.2rem',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                                  title="Delete checklist"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </label>
                          
                          {/* Image upload section - show only when item is selected */}
                          {isSelected && (
                            <div style={{ marginTop: '0.75rem', marginLeft: '1.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                              <div style={{ marginBottom: '0.5rem' }}>
                                <FileUpload 
                                  onFileSelect={(file) => handleImageSelect(cl._id, file)}
                                  id={`file-upload-${cl._id}`}
                                />
                              </div>
                              
                              {/* Display existing images */}
                              {checklistImages.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                                  {checklistImages.map((img, idx) => (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '180px' }}>
                                      <div style={{ position: 'relative', width: '180px', height: '180px', borderRadius: '0.375rem', overflow: 'hidden', border: '2px solid #10b981' }}>
                                        <img 
                                          src={img.url} 
                                          alt={`Image ${idx + 1}`}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                        <button
                                          onClick={() => handleImageDelete(cl._id, idx)}
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
                                      </div>
                                      
                                      {/* Location Input */}
                                      <input
                                        type="text"
                                        placeholder="Location (e.g., Garage, Left Side)"
                                        value={img.location || ''}
                                        onChange={(e) => handleLocationUpdate(cl._id, idx, e.target.value)}
                                        style={{
                                          padding: '0.5rem',
                                          fontSize: '0.75rem',
                                          borderRadius: '0.25rem',
                                          border: '1px solid #d1d5db',
                                          width: '180px',
                                          outline: 'none'
                                        }}
                                        onFocus={(e) => e.currentTarget.style.borderColor = '#10b981'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                                      />
                                      
                                      <button
                                        onClick={() => {
                                          // Navigate to image editor with the image URL and inspectionId
                                          const editorUrl = `/image-editor?imageUrl=${encodeURIComponent(img.url)}&returnTo=${encodeURIComponent(window.location.pathname)}&checklistId=${cl._id}&inspectionId=${inspectionId}`;
                                          router.push(editorUrl);
                                        }}
                                        style={{
                                          padding: '0.5rem 0.75rem',
                                          fontSize: '0.75rem',
                                          borderRadius: '0.25rem',
                                          backgroundColor: '#3b82f6',
                                          color: 'white',
                                          border: 'none',
                                          cursor: 'pointer',
                                          width: '180px',
                                          fontWeight: 600
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                                        title="Annotate image with arrows, circles, and highlights"
                                      >
                                        🖊️ Annotate
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  {activeSection.checklists.filter(cl => cl.type === 'information').length === 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>No information items available</div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ 
              borderTop: '1px solid #e5e7eb', 
              padding: '1rem 1rem', // Increased padding
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '0.5rem',
              flexShrink: 0, // Prevent footer from shrinking
              backgroundColor: 'white' // Ensure footer has background
            }}>
              <button
                onClick={() => { setModalOpen(false); setActiveSection(null); setEditingBlockId(null); }}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '0.25rem', backgroundColor: '#e5e7eb', border: 'none', cursor: 'pointer' }}
                disabled={saving}
                onMouseOver={(e) => !saving && (e.currentTarget.style.backgroundColor = '#d1d5db')}
                onMouseOut={(e) => !saving && (e.currentTarget.style.backgroundColor = '#e5e7eb')}
              >Cancel</button>
              <button
                onClick={handleSave}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '0.25rem', backgroundColor: '#16a34a', color: 'white', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
                disabled={saving}
                onMouseOver={(e) => !saving && (e.currentTarget.style.backgroundColor = '#15803d')}
                onMouseOut={(e) => !saving && (e.currentTarget.style.backgroundColor = '#16a34a')}
              >{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Form Modal (Admin) */}
      {checklistFormOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '0.375rem', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', width: '100%', maxWidth: '32rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ borderBottom: '1px solid #e5e7eb', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9fafb' }}>
              <h4 style={{ fontWeight: 600, fontSize: '1.125rem', color: '#111827' }}>
                {editingChecklistId ? 'Edit' : 'Add New'} Checklist Item
              </h4>
              <button 
                onClick={() => { 
                  setChecklistFormOpen(false); 
                  setEditingChecklistId(null); 
                  setChecklistFormData({ text: '', comment: '', type: 'status' }); 
                }} 
                style={{ color: '#6b7280', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.25rem' }}
              >✕</button>
            </div>
            
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Type Badge */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Type</label>
                <div style={{
                  display: 'inline-block',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  backgroundColor: checklistFormData.type === 'status' ? '#dbeafe' : '#d1fae5',
                  color: checklistFormData.type === 'status' ? '#1e40af' : '#065f46'
                }}>
                  {checklistFormData.type}
                </div>
              </div>

              {/* Name Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                  Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={checklistFormData.text}
                  onChange={(e) => setChecklistFormData({ ...checklistFormData, text: e.target.value })}
                  placeholder="Enter checklist name..."
                  style={{
                    width: '100%',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                />
              </div>

              {/* Comment Textarea */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                  Comment / Description
                </label>
                <textarea
                  value={checklistFormData.comment}
                  onChange={(e) => setChecklistFormData({ ...checklistFormData, comment: e.target.value })}
                  placeholder="Enter optional comment or description..."
                  style={{
                    width: '100%',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    minHeight: '100px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', backgroundColor: '#f9fafb' }}>
              <button
                onClick={() => { 
                  setChecklistFormOpen(false); 
                  setEditingChecklistId(null); 
                  setChecklistFormData({ text: '', comment: '', type: 'status' }); 
                }}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
                disabled={savingChecklist}
                onMouseOver={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#d1d5db')}
                onMouseOut={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#e5e7eb')}
              >Cancel</button>
              <button
                onClick={handleSaveChecklist}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: savingChecklist ? 0.5 : 1,
                  fontWeight: 500
                }}
                disabled={savingChecklist}
                onMouseOver={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#2563eb')}
                onMouseOut={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#3b82f6')}
              >
                {savingChecklist ? 'Saving...' : editingChecklistId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InformationSections;
