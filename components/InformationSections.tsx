"use client";
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from './FileUpload';

interface ISectionChecklist {
  _id: string;
  text: string;
  comment?: string;
  type: 'status' | 'information';
  answer_choices?: string[]; // NEW: Predefined answer choices for this checklist item
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
  selected_answers?: Array<{ checklist_id: string; selected_answers: string[] }>; // NEW: Selected answer choices
  custom_text?: string;
  images: IBlockImage[];
}

interface AddBlockFormState {
  section_id: string;
  selected_checklist_ids: Set<string>;
  selected_answers: Map<string, Set<string>>; // NEW: Maps checklist_id to set of selected answer choices
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

  // Auto-save state
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Local input values for location fields (to prevent last character issue)
  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});

  // Admin checklist management
  const [checklistFormOpen, setChecklistFormOpen] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [checklistFormData, setChecklistFormData] = useState<{
    text: string;
    comment: string;
    type: 'status' | 'information';
    answer_choices: string[];
  }>({ text: '', comment: '', type: 'status', answer_choices: [] });
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [newAnswerChoice, setNewAnswerChoice] = useState('');
  const [editingAnswerIndex, setEditingAnswerIndex] = useState<number | null>(null);
  const [editingAnswerValue, setEditingAnswerValue] = useState('');

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

  // Initialize locationInputs from formState when images load
  useEffect(() => {
    if (!formState) return;
    
    const newLocationInputs: Record<string, string> = {};
    
    // Group images by checklist_id first, then create keys using the correct filtered index
    const imagesByChecklist: Record<string, typeof formState.images> = {};
    formState.images.forEach(img => {
      if (img.checklist_id) {
        if (!imagesByChecklist[img.checklist_id]) {
          imagesByChecklist[img.checklist_id] = [];
        }
        imagesByChecklist[img.checklist_id].push(img);
      }
    });
    
    // Now create location input keys using the filtered index (matching the rendering logic)
    Object.entries(imagesByChecklist).forEach(([checklistId, images]) => {
      images.forEach((img, idx) => {
        const inputKey = `${checklistId}-${idx}`;
        if (img.location) {
          newLocationInputs[inputKey] = img.location;
        }
      });
    });
    
    setLocationInputs(newLocationInputs);
  }, [formState?.images.length]); // Only run when images array length changes (add/remove)

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

          // Check if we should auto-reopen the modal
          const returnToSectionData = localStorage.getItem('returnToSection');
          const shouldReopenModal = returnToSectionData && !modalOpen;

          // If modal is open, update the formState immediately
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

              const updatedFormState = {
                ...formState,
                images: updatedImages
              };

              setFormState(updatedFormState);

              console.log('✅ Updated image with annotations in formState');
              
              // Trigger auto-save to persist the change
              await performAutoSaveWithState(updatedFormState);
            }
          } else {
            // Modal is closed - save to database and optionally reopen
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

                    // Create updated block with new image
                    const updatedBlock = {
                      ...targetBlock,
                      images: updatedImages
                    };

                    // Check if we should reopen the modal
                    const returnToSectionData = localStorage.getItem('returnToSection');
                    const shouldReopenModal = returnToSectionData && !modalOpen;

                    // INSTANT REOPEN: Open modal immediately with updated data (before saving)
                    if (shouldReopenModal && returnToSectionData) {
                      try {
                        const { sectionId } = JSON.parse(returnToSectionData);
                        console.log('� INSTANT REOPEN: Opening modal immediately');
                        
                        // Find the section - if sections is empty, fetch it
                        let section = sections.find((s: ISection) => s._id === sectionId);
                        
                        if (!section) {
                          console.log('⚠️ Sections not loaded yet, fetching...');
                          // Fetch sections if not available
                          const sectionsRes = await fetch('/api/information-sections/sections');
                          const sectionsJson = await sectionsRes.json();
                          
                          if (sectionsJson.success) {
                            setSections(sectionsJson.data);
                            section = sectionsJson.data.find((s: ISection) => s._id === sectionId);
                          }
                        }
                        
                        if (section) {
                          console.log('✅ Opening modal INSTANTLY with annotated image');
                          // Update blocks state immediately
                          setBlocks(blocksJson.data.map((b: IInformationBlock) => 
                            b._id === targetBlock._id ? updatedBlock : b
                          ));
                          
                          // Open modal immediately - user sees annotated image instantly!
                          openAddModal(section, updatedBlock);
                        }
                        
                        // Clear the return section data
                        localStorage.removeItem('returnToSection');
                      } catch (e) {
                        console.error('Error auto-opening section:', e);
                        localStorage.removeItem('returnToSection');
                      }
                    }

                    // BACKGROUND SAVE: Save to database in the background (doesn't block UI)
                    console.log('💾 Saving annotation to database in background...');
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
                      console.log('✅ Annotation saved to database (background)');
                      
                      // Refresh blocks if modal wasn't reopened
                      if (!shouldReopenModal) {
                        await fetchBlocks();
                      }
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
              selected_answers: convertSelectedAnswersToMap(latestBlock.selected_answers),
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
              selected_answers: convertSelectedAnswersToMap(existingBlock.selected_answers),
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
          selected_answers: convertSelectedAnswersToMap(existingBlock.selected_answers),
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
        selected_answers: new Map(), // Empty for new blocks
        custom_text: '',
        images: [],
      });
    }

    setModalOpen(true);
  };

  const toggleChecklist = (id: string) => {
    if (!formState) return;
    const setIds = new Set(formState.selected_checklist_ids);
    if (setIds.has(id)) {
      // Unchecking - clear answers for this checklist
      setIds.delete(id);
      const newAnswers = new Map(formState.selected_answers);
      newAnswers.delete(id);
      const updatedFormState = { ...formState, selected_checklist_ids: setIds, selected_answers: newAnswers };
      setFormState(updatedFormState);
      setTimeout(() => performAutoSaveWithState(updatedFormState), 100);
    } else {
      // Checking - just add to selected
      setIds.add(id);
      const updatedFormState = { ...formState, selected_checklist_ids: setIds };
      setFormState(updatedFormState);
      setTimeout(() => performAutoSaveWithState(updatedFormState), 100);
    }
  };

  // Helper function to convert selected_answers array from DB to Map
  const convertSelectedAnswersToMap = (selectedAnswersArray?: Array<{ checklist_id: string; selected_answers: string[] }>): Map<string, Set<string>> => {
    const answersMap = new Map<string, Set<string>>();
    if (selectedAnswersArray && Array.isArray(selectedAnswersArray)) {
      selectedAnswersArray.forEach(item => {
        if (item && item.checklist_id && Array.isArray(item.selected_answers)) {
          answersMap.set(item.checklist_id, new Set(item.selected_answers));
        }
      });
    }
    return answersMap;
  };

  // Toggle answer choice for a specific checklist item
  const toggleAnswer = (checklistId: string, answer: string) => {
    if (!formState) return;
    
    const newAnswers = new Map(formState.selected_answers);
    const currentAnswers = newAnswers.get(checklistId) || new Set<string>();
    const updatedAnswers = new Set(currentAnswers);
    
    if (updatedAnswers.has(answer)) {
      updatedAnswers.delete(answer);
    } else {
      updatedAnswers.add(answer);
    }
    
    if (updatedAnswers.size > 0) {
      newAnswers.set(checklistId, updatedAnswers);
    } else {
      newAnswers.delete(checklistId);
    }
    
    const updatedFormState = { ...formState, selected_answers: newAnswers };
    setFormState(updatedFormState);
    
    // Trigger immediate auto-save with updated state
    setTimeout(() => performAutoSaveWithState(updatedFormState), 100);
  };

  // Get selected answers for a checklist item
  const getSelectedAnswers = (checklistId: string): Set<string> => {
    return formState?.selected_answers.get(checklistId) || new Set<string>();
  };

  const handleSave = async () => {
    if (!formState || !inspectionId) return;
    setSaving(true);

    console.log('💾 Saving information block with images:', {
      images: formState.images,
      imageCount: formState.images.length,
      imagesWithChecklistId: formState.images.filter(img => img.checklist_id).length
    });

    // Convert selected_answers Map to array format for API
    const selectedAnswersArray = Array.from(formState.selected_answers.entries()).map(([checklist_id, answers]) => ({
      checklist_id,
      selected_answers: Array.from(answers)
    }));

    try {
      if (editingBlockId) {
        // Update existing block
        const res = await fetch(`/api/information-sections/${inspectionId}?blockId=${editingBlockId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_checklist_ids: Array.from(formState.selected_checklist_ids),
            selected_answers: selectedAnswersArray,
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
            selected_answers: selectedAnswersArray,
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

  // Auto-save function with debouncing (for location text inputs)
  // Takes optional newState parameter to save the most recent state
  const triggerAutoSave = useCallback((stateToSave?: AddBlockFormState) => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new timer to save after 1 second of inactivity
    autoSaveTimerRef.current = setTimeout(async () => {
      const finalState = stateToSave || formState;
      if (finalState) {
        await performAutoSaveWithState(finalState);
      }
    }, 1000);
  }, [formState, editingBlockId, inspectionId]);

  // Auto-save immediately (for image uploads and checkbox toggles)
  const performAutoSaveImmediate = useCallback(async () => {
    await performAutoSave();
  }, [formState, editingBlockId, inspectionId]);

  // Perform auto-save with specific state (for immediate saves after state changes)
  const performAutoSaveWithState = async (stateToSave: AddBlockFormState) => {
    if (!stateToSave || !inspectionId) return;
    
    setAutoSaving(true);

    console.log('💾 Auto-saving information block with images:', {
      images: stateToSave.images,
      imageCount: stateToSave.images.length,
      imagesWithChecklistId: stateToSave.images.filter(img => img.checklist_id).length
    });

    // Convert selected_answers Map to array format for API
    const selectedAnswersArray = Array.from(stateToSave.selected_answers.entries()).map(([checklist_id, answers]) => ({
      checklist_id,
      selected_answers: Array.from(answers)
    }));

    try {
      // Check if the block is now empty (no selected items and no custom text)
      const hasSelectedItems = stateToSave.selected_checklist_ids.size > 0;
      const hasCustomText = stateToSave.custom_text && stateToSave.custom_text.trim().length > 0;
      const isEmpty = !hasSelectedItems && !hasCustomText;

      if (editingBlockId && isEmpty) {
        // Delete the block if it's empty, but keep the modal open
        console.log('🗑️ Block is empty, deleting in background...');
        const res = await fetch(`/api/information-sections/${inspectionId}?blockId=${editingBlockId}`, {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to delete block');
        
        // Reset editingBlockId so future saves will create a new block
        setEditingBlockId(null);
        
        // Refresh blocks list in background
        await fetchBlocks();
        
        console.log('✅ Empty block deleted successfully (modal stays open)');
      } else if (editingBlockId) {
        // Update existing block
        const res = await fetch(`/api/information-sections/${inspectionId}?blockId=${editingBlockId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_checklist_ids: Array.from(stateToSave.selected_checklist_ids),
            selected_answers: selectedAnswersArray,
            custom_text: stateToSave.custom_text,
            images: stateToSave.images,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to update block');
      } else if (!isEmpty) {
        // Create new block only if it's not empty
        const res = await fetch(`/api/information-sections/${inspectionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: stateToSave.section_id,
            selected_checklist_ids: Array.from(stateToSave.selected_checklist_ids),
            selected_answers: selectedAnswersArray,
            custom_text: stateToSave.custom_text,
            images: stateToSave.images,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to save block');
        
        // If this was a new block, set the editingBlockId so subsequent saves are updates
        if (json.data && json.data._id) {
          setEditingBlockId(json.data._id);
        }
      }

      // Update last saved timestamp
      const now = new Date();
      setLastSaved(now.toLocaleTimeString());
      
      console.log('✅ Auto-saved successfully at', now.toLocaleTimeString());
      
    } catch (e: any) {
      console.error('Auto-save error:', e);
    } finally {
      setAutoSaving(false);
    }
  };

  const performAutoSave = async () => {
    if (!formState) return;
    await performAutoSaveWithState(formState);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

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

      const updatedFormState = {
        ...formState,
        images: [...formState.images, newImage],
      };
      
      setFormState(updatedFormState);

      console.log('✅ FormState updated, total images:', formState.images.length + 1);
      console.log('📌 Image uploaded successfully. Auto-saving now...');

      // Save immediately with the updated state
      await performAutoSaveWithState(updatedFormState);

    } catch (error) {
      console.error('❌ Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    }
  };

  const handleImageDelete = (checklistId: string, imageIndex: number) => {
    if (!formState) return;

    const checklistImages = formState.images.filter(img => img.checklist_id === checklistId);
    const imageToDelete = checklistImages[imageIndex];

    const updatedFormState = {
      ...formState,
      images: formState.images.filter(img => img !== imageToDelete),
    };
    
    setFormState(updatedFormState);
    
    // Trigger immediate auto-save with updated state
    setTimeout(() => performAutoSaveWithState(updatedFormState), 100);
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
    
    // Trigger debounced auto-save (waits 1 second after user stops typing)
    triggerAutoSave();
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
        answer_choices: existingChecklist.answer_choices || [],
      });
    } else {
      setEditingChecklistId(null);
      setChecklistFormData({ text: '', comment: '', type, answer_choices: [] });
    }
    setNewAnswerChoice('');
    setEditingAnswerIndex(null);
    setEditingAnswerValue('');
    setChecklistFormOpen(true);
  };

  // Admin: Add new answer choice
  const handleAddAnswerChoice = () => {
    const trimmed = newAnswerChoice.trim();
    if (!trimmed) return;
    
    if (checklistFormData.answer_choices.includes(trimmed)) {
      alert('This option already exists');
      return;
    }

    setChecklistFormData({
      ...checklistFormData,
      answer_choices: [...checklistFormData.answer_choices, trimmed]
    });
    setNewAnswerChoice('');
  };

  // Admin: Start editing an answer choice
  const startEditingAnswer = (index: number) => {
    setEditingAnswerIndex(index);
    setEditingAnswerValue(checklistFormData.answer_choices[index]);
  };

  // Admin: Save edited answer choice
  const saveEditedAnswer = () => {
    if (editingAnswerIndex === null) return;
    
    const trimmed = editingAnswerValue.trim();
    if (!trimmed) return;

    const updatedChoices = [...checklistFormData.answer_choices];
    updatedChoices[editingAnswerIndex] = trimmed;
    
    setChecklistFormData({
      ...checklistFormData,
      answer_choices: updatedChoices
    });
    setEditingAnswerIndex(null);
    setEditingAnswerValue('');
  };

  // Admin: Delete answer choice
  const deleteAnswerChoice = (index: number) => {
    const updatedChoices = checklistFormData.answer_choices.filter((_, i) => i !== index);
    setChecklistFormData({
      ...checklistFormData,
      answer_choices: updatedChoices
    });
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
      setChecklistFormData({ text: '', comment: '', type: 'status', answer_choices: [] });
      setNewAnswerChoice('');
      setEditingAnswerIndex(null);
      setEditingAnswerValue('');
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
            <strong>To fix this:</strong><br />
            1. Run the seed script: <code style={{ backgroundColor: '#f3f4f6', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>node scripts/seed-information-sections.js</code><br />
            2. Make sure your .env.local has the correct MONGODB_URI<br />
            3. Refresh this page after seeding
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sections.filter(section => section.order_index !== 17).map(section => (
          <div key={section._id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '1rem', backgroundColor: 'white', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ fontWeight: 500, fontSize: '1rem' }}>
                {section.name}
                {section.order_index === 1 && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}></span>}
              </h3>
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
                                
                                {/* Answer Choices - show when selected and choices exist */}
                                {isSelected && cl.answer_choices && cl.answer_choices.length > 0 && (
                                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.5rem' }}>
                                      Select Options:
                                    </div>
                                    <div style={{ 
                                      display: 'grid', 
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                                      gap: '0.5rem' 
                                    }}>
                                      {cl.answer_choices.map((choice, idx) => {
                                        const selectedAnswers = getSelectedAnswers(cl._id);
                                        const isAnswerSelected = selectedAnswers.has(choice);
                                        
                                        return (
                                          <label 
                                            key={idx}
                                            style={{ 
                                              display: 'flex', 
                                              alignItems: 'center',
                                              gap: '0.4rem',
                                              padding: '0.4rem 0.5rem',
                                              borderRadius: '0.25rem',
                                              backgroundColor: isAnswerSelected ? '#dbeafe' : '#f9fafb',
                                              border: `1px solid ${isAnswerSelected ? '#3b82f6' : '#e5e7eb'}`,
                                              cursor: 'pointer',
                                              fontSize: '0.75rem',
                                              transition: 'all 0.15s ease',
                                            }}
                                            onMouseEnter={(e) => {
                                              if (!isAnswerSelected) {
                                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                e.currentTarget.style.borderColor = '#d1d5db';
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              if (!isAnswerSelected) {
                                                e.currentTarget.style.backgroundColor = '#f9fafb';
                                                e.currentTarget.style.borderColor = '#e5e7eb';
                                              }
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isAnswerSelected}
                                              onChange={() => toggleAnswer(cl._id, choice)}
                                              style={{ cursor: 'pointer' }}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            <span style={{ color: '#374151', userSelect: 'none' }}>
                                              {choice}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
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
                                        value={locationInputs[`${cl._id}-${idx}`] ?? img.location ?? ''}
                                        onChange={(e) => {
                                          const newLocation = e.target.value;
                                          const inputKey = `${cl._id}-${idx}`;
                                          
                                          // Update local input state immediately for instant feedback
                                          setLocationInputs(prev => ({
                                            ...prev,
                                            [inputKey]: newLocation
                                          }));
                                          
                                          // Update formState (this might have slight delay)
                                          const checklistImages = formState.images.filter(i => i.checklist_id === cl._id);
                                          const imageToUpdate = checklistImages[idx];
                                          const updatedImages = formState.images.map(i =>
                                            i === imageToUpdate ? { ...i, location: newLocation } : i
                                          );
                                          const updatedFormState = {
                                            ...formState,
                                            images: updatedImages,
                                          };
                                          setFormState(updatedFormState);
                                          
                                          // Trigger debounced auto-save with the updated state
                                          triggerAutoSave(updatedFormState);
                                        }}
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
                                          // Store section info so we can return to this section after annotation
                                          localStorage.setItem('returnToSection', JSON.stringify({
                                            sectionId: activeSection._id,
                                            sectionName: activeSection.name,
                                            blockId: editingBlockId
                                          }));
                                          
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
                                
                                {/* Answer Choices - show when selected and choices exist */}
                                {isSelected && cl.answer_choices && cl.answer_choices.length > 0 && (
                                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.5rem' }}>
                                      Select Options:
                                    </div>
                                    <div style={{ 
                                      display: 'grid', 
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                                      gap: '0.5rem' 
                                    }}>
                                      {cl.answer_choices.map((choice, idx) => {
                                        const selectedAnswers = getSelectedAnswers(cl._id);
                                        const isAnswerSelected = selectedAnswers.has(choice);
                                        
                                        return (
                                          <label 
                                            key={idx}
                                            style={{ 
                                              display: 'flex', 
                                              alignItems: 'center',
                                              gap: '0.4rem',
                                              padding: '0.4rem 0.5rem',
                                              borderRadius: '0.25rem',
                                              backgroundColor: isAnswerSelected ? '#d1fae5' : '#f9fafb',
                                              border: `1px solid ${isAnswerSelected ? '#10b981' : '#e5e7eb'}`,
                                              cursor: 'pointer',
                                              fontSize: '0.75rem',
                                              transition: 'all 0.15s ease',
                                            }}
                                            onMouseEnter={(e) => {
                                              if (!isAnswerSelected) {
                                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                e.currentTarget.style.borderColor = '#d1d5db';
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              if (!isAnswerSelected) {
                                                e.currentTarget.style.backgroundColor = '#f9fafb';
                                                e.currentTarget.style.borderColor = '#e5e7eb';
                                              }
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isAnswerSelected}
                                              onChange={() => toggleAnswer(cl._id, choice)}
                                              style={{ cursor: 'pointer' }}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            <span style={{ color: '#374151', userSelect: 'none' }}>
                                              {choice}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
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
                                        value={locationInputs[`${cl._id}-${idx}`] ?? img.location ?? ''}
                                        onChange={(e) => {
                                          const newLocation = e.target.value;
                                          const inputKey = `${cl._id}-${idx}`;
                                          
                                          // Update local input state immediately for instant feedback
                                          setLocationInputs(prev => ({
                                            ...prev,
                                            [inputKey]: newLocation
                                          }));
                                          
                                          // Update formState (this might have slight delay)
                                          const checklistImages = formState.images.filter(i => i.checklist_id === cl._id);
                                          const imageToUpdate = checklistImages[idx];
                                          const updatedImages = formState.images.map(i =>
                                            i === imageToUpdate ? { ...i, location: newLocation } : i
                                          );
                                          const updatedFormState = {
                                            ...formState,
                                            images: updatedImages,
                                          };
                                          setFormState(updatedFormState);
                                          
                                          // Trigger debounced auto-save with the updated state
                                          triggerAutoSave(updatedFormState);
                                        }}
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
                                          // Store section info so we can return to this section after annotation
                                          localStorage.setItem('returnToSection', JSON.stringify({
                                            sectionId: activeSection._id,
                                            sectionName: activeSection.name,
                                            blockId: editingBlockId
                                          }));
                                          
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
              padding: '1rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
              flexShrink: 0,
              backgroundColor: 'white'
            }}>
              {/* Auto-save status indicator */}
              <div style={{ 
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
                    <span>Changes auto-save</span>
                  </>
                )}
              </div>
              
              <button
                onClick={async () => { 
                  // Save before closing
                  if (formState && (formState.selected_checklist_ids.size > 0 || formState.custom_text || formState.images.length > 0)) {
                    await handleSave();
                  } else {
                    // No data to save, just close
                    setModalOpen(false); 
                    setActiveSection(null); 
                    setEditingBlockId(null);
                    setLastSaved(null);
                    // Clear any pending auto-save timer
                    if (autoSaveTimerRef.current) {
                      clearTimeout(autoSaveTimerRef.current);
                    }
                  }
                }}
                disabled={saving}
                style={{ 
                  padding: '0.5rem 1.5rem', 
                  fontSize: '0.875rem', 
                  borderRadius: '0.25rem', 
                  backgroundColor: saving ? '#9ca3af' : '#10b981', 
                  color: 'white',
                  border: 'none', 
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 600
                }}
                onMouseOver={(e) => !saving && (e.currentTarget.style.backgroundColor = '#059669')}
                onMouseOut={(e) => !saving && (e.currentTarget.style.backgroundColor = '#10b981')}
              >{saving ? 'Saving...' : '✓ Done'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Form Modal (Admin) */}
      {checklistFormOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '0.375rem', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', width: '100%', maxWidth: '40rem', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ borderBottom: '1px solid #e5e7eb', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9fafb' }}>
              <h4 style={{ fontWeight: 600, fontSize: '1.125rem', color: '#111827' }}>
                {editingChecklistId ? 'Edit' : 'Add New'} Checklist Item
              </h4>
              <button
                onClick={() => {
                  setChecklistFormOpen(false);
                  setEditingChecklistId(null);
                  setChecklistFormData({ text: '', comment: '', type: 'status', answer_choices: [] });
                  setNewAnswerChoice('');
                  setEditingAnswerIndex(null);
                  setEditingAnswerValue('');
                }}
                style={{ color: '#6b7280', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.25rem' }}
              >✕</button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', flex: 1 }}>
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

              {/* Answer Choices Management */}
              <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>
                  📋 Answer Choices (Select Options)
                </label>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  Add predefined options that users can select for this checklist item
                </p>

                {/* Add New Choice */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    type="text"
                    value={newAnswerChoice}
                    onChange={(e) => setNewAnswerChoice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAnswerChoice();
                      }
                    }}
                    placeholder="Enter new option..."
                    style={{
                      flex: 1,
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                  />
                  <button
                    onClick={handleAddAnswerChoice}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.375rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 500,
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    + Add
                  </button>
                </div>

                {/* List of Choices */}
                {checklistFormData.answer_choices.length > 0 ? (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.5rem',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                    padding: '0.75rem'
                  }}>
                    {checklistFormData.answer_choices.map((choice, index) => (
                      <div 
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem',
                          backgroundColor: '#f9fafb',
                          borderRadius: '0.25rem',
                          border: '1px solid #e5e7eb'
                        }}
                      >
                        {editingAnswerIndex === index ? (
                          <>
                            <input
                              type="text"
                              value={editingAnswerValue}
                              onChange={(e) => setEditingAnswerValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  saveEditedAnswer();
                                } else if (e.key === 'Escape') {
                                  setEditingAnswerIndex(null);
                                  setEditingAnswerValue('');
                                }
                              }}
                              autoFocus
                              style={{
                                flex: 1,
                                border: '1px solid #3b82f6',
                                borderRadius: '0.25rem',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.875rem',
                                outline: 'none'
                              }}
                            />
                            <button
                              onClick={saveEditedAnswer}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                borderRadius: '0.25rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              title="Save"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => {
                                setEditingAnswerIndex(null);
                                setEditingAnswerValue('');
                              }}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                borderRadius: '0.25rem',
                                backgroundColor: '#6b7280',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, fontSize: '0.875rem', color: '#374151' }}>
                              {choice}
                            </span>
                            <button
                              onClick={() => startEditingAnswer(index)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                borderRadius: '0.25rem',
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteAnswerChoice(index)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                borderRadius: '0.25rem',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '1rem',
                    textAlign: 'center',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.375rem',
                    border: '1px dashed #d1d5db',
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}>
                    No answer choices added yet. Add options above.
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', backgroundColor: '#f9fafb' }}>
              <button
                onClick={() => {
                  setChecklistFormOpen(false);
                  setEditingChecklistId(null);
                  setChecklistFormData({ text: '', comment: '', type: 'status', answer_choices: [] });
                  setNewAnswerChoice('');
                  setEditingAnswerIndex(null);
                  setEditingAnswerValue('');
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
