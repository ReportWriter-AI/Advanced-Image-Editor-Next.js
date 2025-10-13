"use client";
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from './FileUpload';

interface ISectionChecklist {
  _id: string;
  text: string;
  comment?: string;
  type: 'status' | 'information';
  tab: 'information' | 'limitations'; // Which tab to display this item in
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
  isThreeSixty?: boolean; // 360° photo flag
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
  custom_answers: Map<string, Set<string>>; // Track custom answers added via "Add" button (inspection-specific)
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

  // Track inspection-specific checklists (not saved to template)
  // Key: sectionId, Value: array of inspection-only checklists for that section
  const [inspectionChecklists, setInspectionChecklists] = useState<Map<string, ISectionChecklist[]>>(new Map());

  // Auto-save state
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Local input values for location fields (to prevent last character issue)
  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});

  // Custom answer inputs for ad-hoc answers during inspection
  const [customAnswerInputs, setCustomAnswerInputs] = useState<Record<string, string>>({});

  // Location dropdown management
  const [locationDropdownOpen, setLocationDropdownOpen] = useState<Record<string, boolean>>({});

  // 360° photo checkbox state (key: checklist_id, value: boolean)
  const [isThreeSixtyMap, setIsThreeSixtyMap] = useState<Record<string, boolean>>({});

  // Predefined location options (same as defect upload page)
  const LOCATION_OPTIONS = [
    'Addition', 'All Locations', 'Apartment', 'Attic', 'Back Porch', 'Back Room', 'Balcony',
    'Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bedroom 4', 'Bedroom 5', 'Both Locations', 'Breakfast',
    'Carport', 'Carport Entry', 'Closet', 'Crawlspace', 'Dining', 'Downstairs', 'Downstairs Bathroom',
    'Downstairs Bathroom Closet', 'Downstairs Hallway', 'Downstairs Hall Closet', 'Driveway', 'Entry',
    'Family Room', 'Front Entry', 'Front of House', 'Front Porch', 'Front Room', 'Garage', 'Garage Entry',
    'Garage Storage Closet', 'Guest Bathroom', 'Guest Bedroom', 'Guest Bedroom Closet', 'Half Bathroom',
    'Hallway', 'Heater Operation Temp', 'HVAC Closet', 'Keeping Room', 'Kitchen', 'Kitchen Pantry',
    'Left Side of House', 'Left Wall', 'Living Room', 'Living Room Closet', 'Laundry Room',
    'Laundry Room Closet', 'Master Bathroom', 'Master Bedroom', 'Master Closet', 'Most Locations',
    'Multiple Locations', 'Office', 'Office Closet', 'Outdoor Storage', 'Patio', 'Rear Entry',
    'Rear of House', 'Rear Wall', 'Right Side of House', 'Right Wall', 'Shop', 'Side Entry', 'Staircase',
    'Sun Room', 'Top of Stairs', 'Upstairs Bathroom', 'Upstairs Bedroom 1', 'Upstairs Bedroom 1 Closet',
    'Upstairs Bedroom 2', 'Upstairs Bedroom 2 Closet', 'Upstairs Bedroom 3', 'Upstairs Bedroom 3 Closet',
    'Upstairs Bedroom 4', 'Upstairs Bedroom 4 Closet', 'Upstairs Hallway', 'Upstairs Laundry Room',
    'Utility Room', 'Water Heater Closet', 'Water Heater Output Temp'
  ];

  // Admin checklist management
  const [checklistFormOpen, setChecklistFormOpen] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [checklistFormData, setChecklistFormData] = useState<{
    text: string;
    comment: string;
    type: 'status' | 'information';
    tab: 'information' | 'limitations';
    answer_choices: string[];
  }>({ text: '', comment: '', type: 'status', tab: 'information', answer_choices: [] });
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [newAnswerChoice, setNewAnswerChoice] = useState('');
  const [editingAnswerIndex, setEditingAnswerIndex] = useState<number | null>(null);
  const [editingAnswerValue, setEditingAnswerValue] = useState('');

  const fetchSections = useCallback(async () => {
    setLoadingSections(true);
    setError(null);
    try {
  const res = await fetch('/api/information-sections/sections', { cache: 'no-store' });
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
  const res = await fetch(`/api/information-sections/${inspectionId}`, { cache: 'no-store' });
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

  // Load inspection-specific checklists from localStorage on mount
  useEffect(() => {
    if (!inspectionId) return;
    
    try {
      const storageKey = `inspection_checklists_${inspectionId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert plain object to Map
        const checklistsMap = new Map<string, ISectionChecklist[]>();
        Object.entries(parsed).forEach(([sectionId, checklists]) => {
          checklistsMap.set(sectionId, checklists as ISectionChecklist[]);
        });
        setInspectionChecklists(checklistsMap);
        console.log('📂 Loaded inspection-specific checklists from localStorage:', checklistsMap);
      }
    } catch (error) {
      console.error('Error loading inspection checklists:', error);
    }
  }, [inspectionId]);

  // Save inspection-specific checklists to localStorage whenever they change
  useEffect(() => {
    if (!inspectionId || inspectionChecklists.size === 0) return;
    
    try {
      const storageKey = `inspection_checklists_${inspectionId}`;
      // Convert Map to plain object for JSON storage
      const checklistsObj: Record<string, ISectionChecklist[]> = {};
      inspectionChecklists.forEach((checklists, sectionId) => {
        if (checklists.length > 0) {
          checklistsObj[sectionId] = checklists;
        }
      });
      localStorage.setItem(storageKey, JSON.stringify(checklistsObj));
      console.log('💾 Saved inspection-specific checklists to localStorage');
    } catch (error) {
      console.error('Error saving inspection checklists:', error);
    }
  }, [inspectionId, inspectionChecklists]);

  // Helper function to get all checklist items for a block (including inspection-only)
  const getBlockChecklists = (block: IInformationBlock): any[] => {
    const sectionId = typeof block.section_id === 'string' ? block.section_id : block.section_id._id;
    const existingIds = block.selected_checklist_ids || [];
    
    // Check if there are inspection-only selections for this section
    const blockStorageKey = `inspection_selections_${inspectionId}_${sectionId}`;
    const storedSelections = localStorage.getItem(blockStorageKey);
    const inspectionOnlyIds = storedSelections ? JSON.parse(storedSelections) : [];
    
    if (inspectionOnlyIds.length === 0) {
      return existingIds; // No inspection-only items selected
    }
    
    // Get inspection checklists for this section
    const inspectionChecklistsForSection = inspectionChecklists.get(sectionId) || [];
    
    // Filter to only selected inspection-only checklists
    const selectedInspectionChecklists = inspectionChecklistsForSection.filter(
      checklist => inspectionOnlyIds.includes(checklist._id)
    );
    
    // Merge with existing checklists
    return [...existingIds, ...selectedInspectionChecklists];
  };

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
      if (!pendingData) return;

      try {
        const annotation = JSON.parse(pendingData);
        console.log('🎨 Found pending annotation:', annotation);

        // Check if we should auto-reopen the modal
        const returnToSectionData = localStorage.getItem('returnToSection');
        const shouldReopenModal = returnToSectionData && !modalOpen;

        // If modal is open, update the formState immediately
        if (modalOpen && formState) {
          console.log('📝 Modal is open, updating formState with annotation');
          
          // Find the image in formState that matches the checklistId
          const imageIndex = formState.images.findIndex(img => img.checklist_id === annotation.checklistId);

          if (imageIndex !== -1) {
            console.log(`✅ Found image at index ${imageIndex}, updating with annotated version`);
            
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
            
            // Clear the pending annotation ONLY after successful save
            localStorage.removeItem('pendingAnnotation');
            console.log('✅ Annotation processing complete, cleared from localStorage');
          } else {
            console.warn('⚠️ Image not found in formState images, will retry...');
            // Don't clear localStorage - let polling retry
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
                  console.log(`✅ Found image at index ${imageIndex} in block`);
                  
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
                  const shouldReopenModal = returnToSectionData && !modalOpen;

                  // INSTANT REOPEN: Open modal immediately with updated data (before saving)
                  if (shouldReopenModal && returnToSectionData) {
                    try {
                      const { sectionId } = JSON.parse(returnToSectionData);
                      console.log('🚀 INSTANT REOPEN: Opening modal immediately');
                      
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
                      console.error('❌ Error auto-opening section:', e);
                      localStorage.removeItem('returnToSection');
                    }
                  }

                    // BACKGROUND SAVE: Save to database in the background (doesn't block UI)
                    console.log('💾 Saving annotation to database in background...');
                    try {
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
                        
                        // Clear the pending annotation ONLY after successful database save
                        localStorage.removeItem('pendingAnnotation');
                        console.log('✅ Cleared pendingAnnotation from localStorage after successful save');
                        
                        // Refresh blocks if modal wasn't reopened
                        if (!shouldReopenModal) {
                          await fetchBlocks();
                        }
                      } else {
                        console.error('❌ Failed to save annotation:', updateJson.error);
                        alert('❌ Failed to save annotation. Please try again.');
                        // Don't clear localStorage - allow retry
                      }
                    } catch (saveError) {
                      console.error('❌ Error saving annotation to database:', saveError);
                      alert('❌ Error saving annotation. Please try again.');
                      // Don't clear localStorage - allow retry
                    }
                  } else {
                    console.warn('⚠️ Image not found in block images');
                    // Clear anyway - bad data
                    localStorage.removeItem('pendingAnnotation');
                  }
                } else {
                  console.warn('⚠️ Block not found for checklist:', annotation.checklistId);
                  // Clear anyway - bad data
                  localStorage.removeItem('pendingAnnotation');
                }
              } else {
                console.error('❌ Failed to fetch blocks');
                // Don't clear - let retry happen
              }
            } catch (error) {
              console.error('❌ Error saving annotation to database:', error);
              // Don't clear localStorage - allow retry
            }
          }
        } catch (error) {
          console.error('❌ Error processing pending annotation:', error);
          // Only clear if it's a parse error (bad JSON)
          localStorage.removeItem('pendingAnnotation');
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

    // IMPROVED POLLING: More aggressive to catch race conditions
    // Poll localStorage every 300ms for 6 seconds (20 attempts instead of 6)
    // This gives much better reliability when events don't fire
    let pollCount = 0;
    const maxPolls = 20; // 6 seconds total (20 * 300ms)
    const pollInterval = setInterval(() => {
      pollCount++;
      const pending = localStorage.getItem('pendingAnnotation');
      if (pending) {
        console.log(`📡 Poll #${pollCount}/${maxPolls}: Found pending annotation, processing...`);
        checkPendingAnnotation();
      }
      if (pollCount >= maxPolls) {
        console.log(`⏱️ Polling complete after ${pollCount} attempts`);
        clearInterval(pollInterval);
      }
    }, 300); // Check every 300ms (was 500ms)

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, [modalOpen, formState, inspectionId, fetchBlocks]);

  const openAddModal = async (section: ISection, existingBlock?: IInformationBlock) => {
    // First, fetch the latest section data from database to ensure we have fresh checklist data
    let latestSection = section;
    try {
  const sectionsRes = await fetch('/api/information-sections/sections', { cache: 'no-store' });
      if (sectionsRes.ok) {
        const sectionsData = await sectionsRes.json();
        if (sectionsData.success && sectionsData.data) {
          const freshSection = sectionsData.data.find((s: ISection) => s._id === section._id);
          if (freshSection) {
            latestSection = freshSection;
            console.log('✅ Loaded fresh section data with', freshSection.checklists.length, 'checklists');
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch latest section data, using cached version:', error);
    }
    
    // Merge template checklists with inspection-specific checklists
    const inspectionSpecificChecklists = inspectionChecklists.get(section._id) || [];
    const mergedSection: ISection = {
      ...latestSection,
      checklists: [...latestSection.checklists, ...inspectionSpecificChecklists]
    };
    
    setActiveSection(mergedSection);

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

            // Load inspection-only selections from localStorage
            const storageKey = `inspection_selections_${inspectionId}_${section._id}`;
            const storedSelections = localStorage.getItem(storageKey);
            const inspectionOnlyIds = storedSelections ? JSON.parse(storedSelections) : [];
            
            // Merge database selections with inspection-only selections
            const allSelectedIds = Array.from(new Set([...selectedIds, ...inspectionOnlyIds]));

            const selectedAnswersMap = convertSelectedAnswersToMap(latestBlock.selected_answers);
            
            setFormState({
              section_id: section._id,
              selected_checklist_ids: new Set(allSelectedIds),
              selected_answers: selectedAnswersMap,
              custom_answers: extractCustomAnswers(selectedAnswersMap, section._id),
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

            // Load inspection-only selections from localStorage
            const storageKey = `inspection_selections_${inspectionId}_${section._id}`;
            const storedSelections = localStorage.getItem(storageKey);
            const inspectionOnlyIds = storedSelections ? JSON.parse(storedSelections) : [];
            
            // Merge database selections with inspection-only selections
            const allSelectedIds = Array.from(new Set([...selectedIds, ...inspectionOnlyIds]));

            const selectedAnswersMap = convertSelectedAnswersToMap(existingBlock.selected_answers);
            
            setFormState({
              section_id: section._id,
              selected_checklist_ids: new Set(allSelectedIds),
              selected_answers: selectedAnswersMap,
              custom_answers: extractCustomAnswers(selectedAnswersMap, section._id),
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

        // Load inspection-only selections from localStorage
        const storageKey = `inspection_selections_${inspectionId}_${section._id}`;
        const storedSelections = localStorage.getItem(storageKey);
        const inspectionOnlyIds = storedSelections ? JSON.parse(storedSelections) : [];
        
        // Merge database selections with inspection-only selections
        const allSelectedIds = Array.from(new Set([...selectedIds, ...inspectionOnlyIds]));

        const selectedAnswersMap = convertSelectedAnswersToMap(existingBlock.selected_answers);
        
        setFormState({
          section_id: section._id,
          selected_checklist_ids: new Set(allSelectedIds),
          selected_answers: selectedAnswersMap,
          custom_answers: extractCustomAnswers(selectedAnswersMap, section._id),
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
        custom_answers: new Map(), // Empty for new blocks
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

  // Helper function to extract custom answers (answers not in template) from selected_answers
  const extractCustomAnswers = (
    selectedAnswersMap: Map<string, Set<string>>, 
    sectionId: string
  ): Map<string, Set<string>> => {
    const customAnswersMap = new Map<string, Set<string>>();
    const section = sections.find(s => s._id === sectionId);
    
    if (!section) return customAnswersMap;
    
    selectedAnswersMap.forEach((answers, checklistId) => {
      const checklist = section.checklists.find(cl => cl._id === checklistId);
      if (!checklist) return;
      
      const templateChoices = checklist.answer_choices || [];
      const customAnswers = new Set<string>();
      
      answers.forEach(answer => {
        if (!templateChoices.includes(answer)) {
          customAnswers.add(answer);
        }
      });
      
      if (customAnswers.size > 0) {
        customAnswersMap.set(checklistId, customAnswers);
      }
    });
    
    return customAnswersMap;
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

  // Get all answers for a checklist (template + custom answers added via "Add" button)
  const getAllAnswers = (checklistId: string, templateChoices: string[] = []): string[] => {
    const customAnswersForItem = formState?.custom_answers.get(checklistId) || new Set<string>();
    const allAnswers = new Set([...templateChoices, ...Array.from(customAnswersForItem)]);
    
    return Array.from(allAnswers);
  };

  // Check if an answer is a custom answer (not in template)
  const isCustomAnswer = (checklistId: string, answer: string, templateChoices: string[] = []): boolean => {
    return !templateChoices.includes(answer) && (formState?.custom_answers.get(checklistId)?.has(answer) || false);
  };

  // Add custom answer for inspection (one-time use, not saved to template)
  const addCustomAnswer = (checklistId: string) => {
    const inputKey = `custom-${checklistId}`;
    const customAnswer = customAnswerInputs[inputKey]?.trim();
    
    if (!customAnswer) {
      alert('Please enter a custom answer');
      return;
    }
    
    // Check if already exists in template
    const checklist = activeSection?.checklists.find(cl => cl._id === checklistId);
    const templateChoices = checklist?.answer_choices || [];
    
    if (templateChoices.includes(customAnswer)) {
      alert('This option already exists in the template. Please use the existing option.');
      return;
    }
    
    // Check if already exists in custom answers
    const customAnswersForItem = formState?.custom_answers.get(checklistId) || new Set<string>();
    if (customAnswersForItem.has(customAnswer)) {
      alert('This custom answer already exists');
      return;
    }
    
    // Add to custom_answers map so it persists in UI even when unchecked
    const newCustomAnswers = new Map(formState?.custom_answers || new Map());
    const currentCustomAnswers = new Set(newCustomAnswers.get(checklistId) || new Set<string>());
    currentCustomAnswers.add(customAnswer);
    newCustomAnswers.set(checklistId, currentCustomAnswers);
    
    // Also add to selected answers (auto-select it)
    const newAnswers = new Map(formState?.selected_answers || new Map());
    const currentAnswers = new Set(newAnswers.get(checklistId) || new Set<string>());
    currentAnswers.add(customAnswer);
    newAnswers.set(checklistId, currentAnswers);
    
    const updatedFormState = { 
      ...formState!, 
      custom_answers: newCustomAnswers,
      selected_answers: newAnswers 
    };
    setFormState(updatedFormState);
    
    // Clear input
    setCustomAnswerInputs(prev => ({
      ...prev,
      [inputKey]: ''
    }));
    
    // Trigger auto-save
    setTimeout(() => performAutoSaveWithState(updatedFormState), 100);
  };

  // Add custom answer AND save it permanently to the template
  const addCustomAnswerPermanently = async (checklistId: string) => {
    const inputKey = `custom-${checklistId}`;
    const customAnswer = customAnswerInputs[inputKey]?.trim();
    
    if (!customAnswer) {
      alert('Please enter a custom answer');
      return;
    }

    try {
      // Find the checklist item
      const checklist = activeSection?.checklists.find(cl => cl._id === checklistId);
      
      if (!checklist) {
        alert('Checklist item not found');
        return;
      }

      console.log('📝 Before save - Current answer_choices:', checklist.answer_choices);
      console.log('➕ Adding new answer:', customAnswer);

      // Check if answer already exists in template
      if (checklist.answer_choices?.includes(customAnswer)) {
        alert('This option already exists in the template');
        return;
      }

      // Add to template via API
      const updatedChoices = [...(checklist.answer_choices || []), customAnswer];
      console.log('📤 Sending to API - updatedChoices:', updatedChoices);
      
      const res = await fetch(`/api/checklists/${checklistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: checklist.text,
          comment: checklist.comment,
          type: checklist.type,
          tab: checklist.tab,
          answer_choices: updatedChoices
        }),
      });
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save to template');

      console.log('✅ API response:', json.data);

      // Update activeSection immediately with new choice (before fetching sections)
      if (activeSection) {
        const updatedChecklists = activeSection.checklists.map(cl => {
          if (cl._id === checklistId) {
            return {
              ...cl,
              answer_choices: updatedChoices
            };
          }
          return cl;
        });
        const newActiveSection = {
          ...activeSection,
          checklists: updatedChecklists
        };
        setActiveSection(newActiveSection);
        console.log('✅ Updated activeSection with new answer choice:', customAnswer);
        console.log('📋 Current answer_choices for this item:', updatedChoices);
      }

      // Refresh sections in background to sync with database
      fetchSections();

      // Remove from custom_answers since it's now a template choice
      const newCustomAnswers = new Map(formState?.custom_answers || new Map());
      const currentCustomAnswers = new Set(newCustomAnswers.get(checklistId) || new Set<string>());
      currentCustomAnswers.delete(customAnswer);
      
      if (currentCustomAnswers.size > 0) {
        newCustomAnswers.set(checklistId, currentCustomAnswers);
      } else {
        newCustomAnswers.delete(checklistId);
      }

      // Add to selected answers for current inspection
      const newAnswers = new Map(formState?.selected_answers || new Map());
      const currentAnswers = new Set(newAnswers.get(checklistId) || new Set<string>());
      currentAnswers.add(customAnswer);
      newAnswers.set(checklistId, currentAnswers);

      const updatedFormState = {
        ...formState!,
        custom_answers: newCustomAnswers,
        selected_answers: newAnswers
      };
      setFormState(updatedFormState);

      // Clear input
      setCustomAnswerInputs(prev => ({
        ...prev,
        [inputKey]: ''
      }));

      // Trigger auto-save
      setTimeout(() => performAutoSaveWithState(updatedFormState), 100);

      console.log('✅ Answer saved to template and selected for this inspection!');
    } catch (e: any) {
      alert('Error saving to template: ' + e.message);
    }
  };

  const handleSave = async () => {
    if (!formState || !inspectionId) return;
    setSaving(true);

    console.log('💾 Saving information block with images:', {
      images: formState.images,
      imageCount: formState.images.length,
      imagesWithChecklistId: formState.images.filter(img => img.checklist_id).length
    });

    // Separate template checklist IDs from inspection-only IDs
    const allSelectedIds = Array.from(formState.selected_checklist_ids);
    const templateIds = allSelectedIds.filter(id => !id.startsWith('temp_'));
    const inspectionOnlyIds = allSelectedIds.filter(id => id.startsWith('temp_'));
    
    // Save inspection-only selections to localStorage
    if (activeSection) {
      const storageKey = `inspection_selections_${inspectionId}_${activeSection._id}`;
      if (inspectionOnlyIds.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(inspectionOnlyIds));
      } else {
        localStorage.removeItem(storageKey);
      }
    }

    // Convert selected_answers Map to array format for API
    const selectedAnswersArray = Array.from(formState.selected_answers.entries()).map(([checklist_id, answers]) => ({
      checklist_id,
      selected_answers: Array.from(answers)
    }));

    try {
      if (editingBlockId) {
        // Update existing block (only save template IDs to database)
        const res = await fetch(`/api/information-sections/${inspectionId}?blockId=${editingBlockId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_checklist_ids: templateIds,
            selected_answers: selectedAnswersArray,
            custom_text: formState.custom_text,
            images: formState.images,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to update block');
      } else {
        // Create new block (only save template IDs to database)
        const res = await fetch(`/api/information-sections/${inspectionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: formState.section_id,
            selected_checklist_ids: templateIds,
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

    // Separate template checklist IDs from inspection-only IDs
    const allSelectedIds = Array.from(stateToSave.selected_checklist_ids);
    const templateIds = allSelectedIds.filter(id => !id.startsWith('temp_'));
    const inspectionOnlyIds = allSelectedIds.filter(id => id.startsWith('temp_'));
    
    // Save inspection-only selections to localStorage
    if (activeSection) {
      const storageKey = `inspection_selections_${inspectionId}_${activeSection._id}`;
      if (inspectionOnlyIds.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(inspectionOnlyIds));
      } else {
        localStorage.removeItem(storageKey);
      }
    }

    // Convert selected_answers Map to array format for API
    const selectedAnswersArray = Array.from(stateToSave.selected_answers.entries()).map(([checklist_id, answers]) => ({
      checklist_id,
      selected_answers: Array.from(answers)
    }));

    try {
      // Check if the block is now empty (no template items and no custom text)
      const hasSelectedItems = templateIds.length > 0;
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
        // Update existing block (only save template IDs to database)
        const res = await fetch(`/api/information-sections/${inspectionId}?blockId=${editingBlockId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_checklist_ids: templateIds,
            selected_answers: selectedAnswersArray,
            custom_text: stateToSave.custom_text,
            images: stateToSave.images,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to update block');
      } else if (!isEmpty) {
        // Create new block only if it's not empty (only save template IDs to database)
        const res = await fetch(`/api/information-sections/${inspectionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: stateToSave.section_id,
            selected_checklist_ids: templateIds,
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

    console.log('📸 File selected for checklist:', checklistId, 'type:', file.type);

    // Check file size and warn for large files (360° photos)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 100) {
      alert(`File size (${fileSizeMB.toFixed(1)}MB) exceeds the 100MB limit. Please compress the image or choose a smaller file.`);
      return;
    }

    // For 360° photos, check image dimensions to prevent uploading massive files
    if (isThreeSixtyMap[checklistId] && file.type.startsWith('image/')) {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = URL.createObjectURL(file);
        });
        
        const megapixels = (img.width * img.height) / 1000000;
        console.log('📐 360° Image dimensions:', img.width, 'x', img.height, '(' + megapixels.toFixed(1), 'MP)');
        
        // Warn if image is too large
        if (megapixels > 50) {
          const proceed = confirm(
            `⚠️ This 360° image is VERY LARGE (${megapixels.toFixed(1)} megapixels).\n\n` +
            `Size: ${img.width}×${img.height}\n` +
            `This will likely FAIL to load in the browser.\n\n` +
            `Recommended maximum: 8192×4096 (33 MP)\n` +
            `Suggested tools: TinyPNG, Squoosh, or IrfanView\n\n` +
            `Upload anyway? (Not recommended)`
          );
          if (!proceed) {
            URL.revokeObjectURL(img.src);
            return;
          }
        } else if (megapixels > 33) {
          const proceed = confirm(
            `⚠️ This 360° image is quite large (${megapixels.toFixed(1)} megapixels).\n\n` +
            `Size: ${img.width}×${img.height}\n` +
            `Recommended: 8192×4096 (33 MP) for best performance\n\n` +
            `Continue uploading?`
          );
          if (!proceed) {
            URL.revokeObjectURL(img.src);
            return;
          }
        }
        
        URL.revokeObjectURL(img.src);
      } catch (err) {
        console.error('Failed to check image dimensions:', err);
        // Continue with upload if dimension check fails
      }
    }

    // Show progress indicator for large files
    if (fileSizeMB > 10) {
      console.log(`⏳ Uploading large file (${fileSizeMB.toFixed(1)}MB), this may take a minute...`);
    }

    try {
      // Upload image to R2
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/r2api', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Upload failed with status ${uploadRes.status}`);
      }

      const uploadData = await uploadRes.json();

      console.log('✅ File uploaded to R2:', uploadData.url, 'kind:', uploadData.type);

      // Check if this should be a 360° photo
      const isThreeSixty = isThreeSixtyMap[checklistId] || false;
      console.log('🔍 360° checkbox state for checklist', checklistId, ':', isThreeSixty);

      // Add image to formState
      const newImage: IBlockImage = {
        url: uploadData.url,
        annotations: undefined,
        checklist_id: checklistId,
        isThreeSixty: isThreeSixty, // Include 360° flag
        // We'll reuse the existing image structure; location/annotations remain compatible for video
      };

      console.log('💾 Adding image to formState:', newImage);
      console.log('📸 isThreeSixty field value:', newImage.isThreeSixty);

      const updatedFormState = {
        ...formState,
        images: [...formState.images, newImage],
      };
      
      setFormState(updatedFormState);

      // DON'T reset the 360° checkbox - keep it checked for multiple uploads
      // User can manually uncheck if they want to upload regular images
      // setIsThreeSixtyMap(prev => ({ ...prev, [checklistId]: false }));

      console.log('✅ FormState updated, total images:', formState.images.length + 1);
      console.log('📌 Image uploaded successfully. Auto-saving now...');

      // Save immediately with the updated state
      await performAutoSaveWithState(updatedFormState);

    } catch (error: any) {
      console.error('❌ Error uploading file:', error);
      
      // Show user-friendly error message
      const errorMessage = error.message || 'Unknown error occurred';
      if (errorMessage.includes('100MB')) {
        alert('File is too large. 360° photos should be compressed to under 100MB.');
      } else if (errorMessage.includes('File size exceeds')) {
        alert('File size exceeds the limit. Please compress the image or choose a smaller file.');
      } else {
        alert(`Failed to upload image/video: ${errorMessage}\n\nFor large 360° photos, please ensure they are under 100MB.`);
      }
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
  const openChecklistForm = (type: 'status' | 'information', existingChecklist?: ISectionChecklist, tab?: 'information' | 'limitations') => {
    if (existingChecklist) {
      setEditingChecklistId(existingChecklist._id);
      
      // Get custom answers for this checklist item from current inspection
      const customAnswersForItem = formState?.custom_answers.get(existingChecklist._id) || new Set<string>();
      const templateChoices = existingChecklist.answer_choices || [];
      
      // Combine template choices with custom answers
      const allChoices = [...templateChoices, ...Array.from(customAnswersForItem)];
      
      setChecklistFormData({
        text: existingChecklist.text,
        comment: existingChecklist.comment || '',
        type: existingChecklist.type,
        tab: existingChecklist.tab || 'information',
        answer_choices: allChoices,
      });
    } else {
      setEditingChecklistId(null);
      setChecklistFormData({ 
        text: '', 
        comment: '', 
        type, 
        tab: tab || 'information',
        answer_choices: [] 
      });
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
  const handleSaveChecklist = async (saveToTemplate: boolean = true) => {
    if (!activeSection || !checklistFormData.text.trim()) {
      alert('Checklist name is required');
      return;
    }

    setSavingChecklist(true);
    try {
      if (editingChecklistId) {
        // EDITING EXISTING CHECKLIST
        const isTemporary = editingChecklistId.startsWith('temp_');
        
        if (isTemporary) {
          // Editing inspection-only item - update in inspectionChecklists Map
          const sectionId = activeSection._id;
          const currentInspectionChecklists = inspectionChecklists.get(sectionId) || [];
          
          const updatedInspectionChecklists = currentInspectionChecklists.map(cl => {
            if (cl._id === editingChecklistId) {
              return {
                ...cl,
                text: checklistFormData.text,
                comment: checklistFormData.comment,
                type: checklistFormData.type,
                tab: checklistFormData.tab,
                answer_choices: checklistFormData.answer_choices
              };
            }
            return cl;
          });
          
          const newInspectionChecklistsMap = new Map(inspectionChecklists);
          newInspectionChecklistsMap.set(sectionId, updatedInspectionChecklists);
          setInspectionChecklists(newInspectionChecklistsMap);
          
          // Update activeSection immediately
          const updatedChecklists = activeSection.checklists.map(cl => {
            if (cl._id === editingChecklistId) {
              return {
                ...cl,
                text: checklistFormData.text,
                comment: checklistFormData.comment,
                type: checklistFormData.type,
                tab: checklistFormData.tab,
                answer_choices: checklistFormData.answer_choices
              };
            }
            return cl;
          });
          setActiveSection({
            ...activeSection,
            checklists: updatedChecklists
          });
          
          console.log('✅ Updated inspection-only checklist:', editingChecklistId);
        } else {
          // Editing template item - save to database
          // Get the original checklist to determine which choices are custom
          const originalChecklist = activeSection.checklists.find(cl => cl._id === editingChecklistId);
          const originalTemplateChoices = originalChecklist?.answer_choices || [];
          const existingCustomAnswers = formState?.custom_answers.get(editingChecklistId) || new Set<string>();
          
          // Separate current choices (from checklistFormData) into template vs custom
          const templateChoices: string[] = [];
          const customAnswers = new Set<string>();
          
          checklistFormData.answer_choices.forEach(choice => {
            // Check if this was a custom answer
            if (existingCustomAnswers.has(choice)) {
              // It's a custom answer, keep it custom
              customAnswers.add(choice);
            } else {
              // It's a template choice (either original or newly added via "Save to Template")
              templateChoices.push(choice);
            }
          });
          
          // Update existing checklist - only save template choices to DB
          const res = await fetch(`/api/checklists/${editingChecklistId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: checklistFormData.text,
              comment: checklistFormData.comment,
              type: checklistFormData.type,
              tab: checklistFormData.tab,
              answer_choices: templateChoices,
            }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || 'Failed to update checklist');
          
          // Refresh sections from database to get the updated data
          await fetchSections();
          
          // Wait a bit for state to update, then refresh activeSection and sections
          setTimeout(async () => {
            // Refetch to get the latest sections
            const sectionsRes = await fetch('/api/information-sections/sections', { cache: 'no-store' });
            if (sectionsRes.ok) {
              const sectionsData = await sectionsRes.json();
              if (sectionsData.success && sectionsData.data) {
                const freshSections = sectionsData.data;
                
                // Update sections state so the list reflects changes
                setSections(freshSections);
                
                // Update activeSection so the modal reflects changes
                const updatedSection = freshSections.find((s: ISection) => s._id === activeSection._id);
                if (updatedSection) {
                  const inspectionSpecificChecklists = inspectionChecklists.get(activeSection._id) || [];
                  const mergedSection: ISection = {
                    ...updatedSection,
                    checklists: [...updatedSection.checklists, ...inspectionSpecificChecklists]
                  };
                  setActiveSection(mergedSection);
                  console.log('✅ Refreshed section and activeSection with latest checklist data');
                }
              }
            }
          }, 100);
          
          // Update custom_answers in formState
          const newCustomAnswers = new Map(formState?.custom_answers || new Map());
          if (customAnswers.size > 0) {
            newCustomAnswers.set(editingChecklistId, customAnswers);
          } else {
            newCustomAnswers.delete(editingChecklistId);
          }
          setFormState({
            ...formState!,
            custom_answers: newCustomAnswers
          });
        }
      } else {
        // CREATING NEW CHECKLIST
        if (saveToTemplate) {
          // Save to Template - Create in database permanently
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
          
          // Add the newly created checklist to activeSection immediately
          const newChecklist: ISectionChecklist = json.data;
          setActiveSection({
            ...activeSection,
            checklists: [...activeSection.checklists, newChecklist]
          });
          
          console.log('✅ Created template checklist:', newChecklist._id);
        } else {
          // Add to This Inspection Only - Save to inspectionChecklists state (persisted in localStorage)
          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const newChecklist: ISectionChecklist = {
            _id: tempId,
            text: checklistFormData.text,
            comment: checklistFormData.comment || '',
            type: checklistFormData.type,
            tab: checklistFormData.tab,
            answer_choices: checklistFormData.answer_choices,
            order_index: activeSection.checklists.length
          };
          
          // Add to inspection-specific checklists map
          const currentInspectionChecklists = inspectionChecklists.get(activeSection._id) || [];
          const updatedInspectionChecklists = [...currentInspectionChecklists, newChecklist];
          
          const newInspectionChecklistsMap = new Map(inspectionChecklists);
          newInspectionChecklistsMap.set(activeSection._id, updatedInspectionChecklists);
          setInspectionChecklists(newInspectionChecklistsMap);
          
          // Also add to activeSection's checklists (for immediate UI update)
          setActiveSection({
            ...activeSection,
            checklists: [...activeSection.checklists, newChecklist]
          });
          
          console.log('✅ Added inspection-only checklist:', tempId);
          console.log('💾 Will be saved to localStorage for this inspection only');
        }
      }

      setChecklistFormOpen(false);
      setEditingChecklistId(null);
      setChecklistFormData({ text: '', comment: '', type: 'status', tab: 'information', answer_choices: [] });
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
  // Admin: Delete checklist
  const handleDeleteChecklist = async (checklistId: string) => {
    // Check if this is a temporary inspection-only checklist
    const isTemporary = checklistId.startsWith('temp_');
    
    if (isTemporary) {
      // Delete from inspection-specific checklists (localStorage)
      if (!confirm('Are you sure you want to delete this checklist item from this inspection?')) return;
      
      if (!activeSection) return;
      
      // Find and remove from inspectionChecklists
      const currentInspectionChecklists = inspectionChecklists.get(activeSection._id) || [];
      const updatedInspectionChecklists = currentInspectionChecklists.filter(cl => cl._id !== checklistId);
      
      const newInspectionChecklistsMap = new Map(inspectionChecklists);
      if (updatedInspectionChecklists.length > 0) {
        newInspectionChecklistsMap.set(activeSection._id, updatedInspectionChecklists);
      } else {
        newInspectionChecklistsMap.delete(activeSection._id);
      }
      setInspectionChecklists(newInspectionChecklistsMap);
      
      // Update activeSection to remove it from UI
      setActiveSection({
        ...activeSection,
        checklists: activeSection.checklists.filter(cl => cl._id !== checklistId)
      });
      
      console.log('✅ Deleted inspection-only checklist:', checklistId);
    } else {
      // Delete from template (database)
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
    }
  };

  const sectionBlocks = (sectionId: string) =>
    blocks.filter(b => (typeof b.section_id === 'string' ? b.section_id === sectionId : (b.section_id as ISection)._id === sectionId));

  // Helper function to check if a section is complete
  // A section is complete when it has at least one block with selected checklist items
  const isSectionComplete = useCallback((sectionId: string): boolean => {
    const sectionBlocksList = sectionBlocks(sectionId);
    if (sectionBlocksList.length === 0) return false;
    
    // Check if at least one block has selected items
    return sectionBlocksList.some(block => {
      const checklists = getBlockChecklists(block);
      return checklists.length > 0;
    });
  }, [blocks, inspectionChecklists]);

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
        {sections.filter(section => section.order_index !== 17).map(section => {
          const isComplete = isSectionComplete(section._id);
          
          return (
          <div key={section._id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '1rem', backgroundColor: 'white', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ fontWeight: 500, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isComplete && <span style={{ fontSize: '1.25rem', color: '#22c55e' }}>✅</span>}
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
                      {getBlockChecklists(block).map((cl: any) => (
                        <div key={cl._id || cl} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '0.25rem',
                              backgroundColor: cl.type === 'status' ? '#dbeafe' : '#d1fae5',
                              color: cl.type === 'status' ? '#1e40af' : '#065f46',
                              fontWeight: 600,
                              textTransform: 'uppercase' as const
                            }}>
                              {cl.type || 'info'}
                            </span>
                            <span style={{ fontWeight: 'bold' }}>{cl.text || cl}</span>
                          </div>
                          {cl.comment && cl.comment.trim() !== '' && (
                            <div style={{ 
                              marginLeft: '1rem', 
                              color: '#6b7280',
                              fontSize: '0.875rem',
                              paddingTop: '0.125rem'
                            }}>
                              {cl.comment}
                            </div>
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
        );
        })}
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
                {(() => {
                  // Check if any status field checklist item is selected
                  const statusChecklists = activeSection.checklists.filter(cl => cl.type === 'status');
                  const hasStatusSelected = statusChecklists.some(cl => formState.selected_checklist_ids.has(cl._id));
                  
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <h5 style={{ fontWeight: 600, fontSize: '1rem', color: '#1f2937', borderBottom: '2px solid #3b82f6', paddingBottom: '0.5rem', flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {hasStatusSelected && <span style={{ fontSize: '1.125rem', color: '#22c55e' }}>✅</span>}
                        Status Fields
                      </h5>
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
                  );
                })()}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeSection.checklists
                    .filter(cl => cl.type === 'status')
                    .map(cl => {
                      const isSelected = formState.selected_checklist_ids.has(cl._id);
                      const checklistImages = getChecklistImages(cl._id);

                      return (
                        <div key={cl._id} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: isSelected ? '#eff6ff' : 'transparent', border: '1px solid #e5e7eb' }}>
                          {/* Header - clickable to toggle selection */}
                          <label style={{ display: 'flex', fontSize: '0.875rem', cursor: 'pointer', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleChecklist(cl._id)}
                              style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, color: '#1f2937' }}>{cl.text}</div>
                              {cl.comment && (
                                <div style={{ marginLeft: '0rem', marginTop: '0.25rem', color: '#6b7280', fontSize: '0.8rem' }}>
                                  {cl.comment.length > 150 ? cl.comment.slice(0, 150) + '…' : cl.comment}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }} onClick={(e) => e.preventDefault()}>
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
                          </label>

                          {/* Content area - NOT clickable to toggle */}
                          <div>
                                
                                {/* Answer Choices & Custom Answer - show when selected */}
                                {isSelected && (
                                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                                    {getAllAnswers(cl._id, cl.answer_choices || []).length > 0 && (
                                      <>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.5rem' }}>
                                          Select Options:
                                        </div>
                                        <div style={{ 
                                          display: 'grid', 
                                          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                                          gap: '0.5rem' 
                                        }}>
                                          {getAllAnswers(cl._id, cl.answer_choices || []).map((choice, idx) => {
                                            const selectedAnswers = getSelectedAnswers(cl._id);
                                            const isAnswerSelected = selectedAnswers.has(choice);
                                            const isCustom = isCustomAnswer(cl._id, choice, cl.answer_choices || []);
                                            
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
                                                  position: 'relative'
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
                                                <span style={{ color: '#374151', userSelect: 'none', flex: 1 }}>
                                                  {choice}
                                                </span>
                                                {isCustom && (
                                                  <span style={{ 
                                                    fontSize: '0.6rem', 
                                                    backgroundColor: '#fbbf24', 
                                                    color: '#78350f',
                                                    padding: '0.1rem 0.3rem',
                                                    borderRadius: '0.2rem',
                                                    fontWeight: 600
                                                  }}>
                                                    Custom
                                                  </span>
                                                )}
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </>
                                    )}

                                    {/* Custom Answer Input */}
                                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.5rem' }}>
                                        Add Custom Answer:
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                        <input
                                          type="text"
                                          placeholder="Type custom answer..."
                                          value={customAnswerInputs[`custom-${cl._id}`] || ''}
                                          onChange={(e) => setCustomAnswerInputs(prev => ({
                                            ...prev,
                                            [`custom-${cl._id}`]: e.target.value
                                          }))}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              addCustomAnswer(cl._id);
                                            }
                                          }}
                                          style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            fontSize: '0.75rem',
                                            borderRadius: '0.25rem',
                                            border: '1px solid #d1d5db',
                                            outline: 'none'
                                          }}
                                        />
                                        <button
                                          onClick={() => addCustomAnswer(cl._id)}
                                          style={{
                                            padding: '0.5rem 0.75rem',
                                            fontSize: '0.7rem',
                                            borderRadius: '0.25rem',
                                            backgroundColor: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            fontWeight: 600
                                          }}
                                          title="Add answer for this inspection only"
                                        >
                                          Add
                                        </button>
                                        <button
                                          onClick={() => addCustomAnswerPermanently(cl._id)}
                                          style={{
                                            padding: '0.5rem 0.75rem',
                                            fontSize: '0.7rem',
                                            borderRadius: '0.25rem',
                                            backgroundColor: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            fontWeight: 600
                                          }}
                                          title="Save to template permanently for all future inspections"
                                        >
                                          Save to Template
                                        </button>
                                      </div>
                                      <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.375rem', fontStyle: 'italic' }}>
                                        💡 <strong>Add</strong> = Use only for this inspection • <strong>Save to Template</strong> = Add permanently for all inspections
                                      </div>
                                    </div>
                                  </div>
                                )}

                          {/* Image upload section - show only when item is selected */}
                          {isSelected && (
                            <div style={{ marginTop: '0.75rem', marginLeft: '1.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                              {/* 360° Photo Checkbox */}
                              <div style={{
                                background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                                padding: '10px 16px',
                                borderRadius: '8px',
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.2)'
                              }}>
                                <input
                                  type="checkbox"
                                  id={`isThreeSixty-info-${cl._id}`}
                                  checked={isThreeSixtyMap[cl._id] || false}
                                  onChange={(e) => setIsThreeSixtyMap(prev => ({
                                    ...prev,
                                    [cl._id]: e.target.checked
                                  }))}
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    cursor: 'pointer',
                                    accentColor: '#ffffff'
                                  }}
                                />
                                <label 
                                  htmlFor={`isThreeSixty-info-${cl._id}`} 
                                  style={{
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                >
                                  <i className="fas fa-sync" style={{ fontSize: '16px' }}></i>
                                  This is a 360° photo
                                </label>
                              </div>

                              {/* Help text for 360° photos */}
                              {isThreeSixtyMap[cl._id] && (
                                <div style={{
                                  backgroundColor: '#fef3c7',
                                  border: '1px solid #fbbf24',
                                  borderRadius: '6px',
                                  padding: '8px 12px',
                                  marginBottom: '12px',
                                  fontSize: '12px',
                                  color: '#92400e'
                                }}>
                                  <strong>📸 360° Photo Tips:</strong>
                                  <ul style={{ margin: '4px 0 0 20px', paddingLeft: 0 }}>
                                    <li>File size limit: <strong>100 MB</strong></li>
                                    <li><strong>⚠️ Recommended dimensions: 8192×4096 (33 MP max)</strong></li>
                                    <li>Optimal: <strong>4096×2048</strong> at <strong>85% quality</strong> (~5-10 MB)</li>
                                    <li>Images larger than 50 MP may fail to load in browser</li>
                                    <li>Compress large files using: TinyPNG, Squoosh, or IrfanView</li>
                                  </ul>
                                </div>
                              )}
                              
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
                                        {/\.(mp4|mov|webm|3gp|3gpp|m4v)(\?.*)?$/i.test(img.url) ? (
                                          <video
                                            src={img.url}
                                            controls
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' }}
                                          />
                                        ) : (
                                          <img
                                            src={img.url}
                                            alt={`Image ${idx + 1}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          />
                                        )}
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

                                      {/* Location Dropdown */}
                                      <div style={{ position: 'relative', width: '180px' }}>
                                        <select
                                          value={locationInputs[`${cl._id}-${idx}`] ?? img.location ?? ''}
                                          onChange={(e) => {
                                            const newLocation = e.target.value;
                                            const inputKey = `${cl._id}-${idx}`;
                                            
                                            // Update local input state immediately for instant feedback
                                            setLocationInputs(prev => ({
                                              ...prev,
                                              [inputKey]: newLocation
                                            }));
                                            
                                            // Update formState
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
                                            
                                            // Trigger auto-save
                                            setTimeout(() => performAutoSaveWithState(updatedFormState), 100);
                                          }}
                                          style={{
                                            padding: '0.5rem',
                                            fontSize: '0.75rem',
                                            borderRadius: '0.25rem',
                                            border: '1px solid #d1d5db',
                                            width: '180px',
                                            outline: 'none',
                                            backgroundColor: 'white',
                                            cursor: 'pointer'
                                          }}
                                          onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                                          onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                                        >
                                          <option value="">Select Location</option>
                                          {LOCATION_OPTIONS.map((loc) => (
                                            <option key={loc} value={loc}>{loc}</option>
                                          ))}
                                        </select>
                                      </div>

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
                {(() => {
                  // Check if any limitations/information checklist item is selected
                  const limitationsChecklists = activeSection.checklists.filter(cl => cl.tab === 'limitations');
                  const hasLimitationsSelected = limitationsChecklists.some(cl => formState.selected_checklist_ids.has(cl._id));
                  
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <h5 style={{ fontWeight: 600, fontSize: '1rem', color: '#1f2937', borderBottom: '2px solid #10b981', paddingBottom: '0.5rem', flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {hasLimitationsSelected && <span style={{ fontSize: '1.125rem', color: '#22c55e' }}>✅</span>}
                        Limitations / Information
                      </h5>
                      <button
                        onClick={() => openChecklistForm('information', undefined, 'limitations')}
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
                  );
                })()}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeSection.checklists
                    .filter(cl => cl.tab === 'limitations')
                    .map(cl => {
                      const isSelected = formState.selected_checklist_ids.has(cl._id);
                      const checklistImages = getChecklistImages(cl._id);

                      return (
                        <div key={cl._id} style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: isSelected ? '#f0fdf4' : 'transparent', border: '1px solid #e5e7eb' }}>
                          {/* Header - clickable to toggle selection */}
                          <label style={{ display: 'flex', fontSize: '0.875rem', cursor: 'pointer', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleChecklist(cl._id)}
                              style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, color: '#1f2937' }}>{cl.text}</div>
                              {cl.comment && (
                                <div style={{ marginLeft: '0rem', marginTop: '0.25rem', color: '#6b7280', fontSize: '0.8rem' }}>
                                  {cl.comment.length > 150 ? cl.comment.slice(0, 150) + '…' : cl.comment}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }} onClick={(e) => e.preventDefault()}>
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
                          </label>

                          {/* Content area - NOT clickable to toggle */}
                          <div>
                                
                                {/* Answer Choices - show when selected */}
                                {isSelected && (cl.answer_choices && cl.answer_choices.length > 0 || getSelectedAnswers(cl._id).size > 0) && (
                                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.5rem' }}>
                                      Select Options:
                                    </div>
                                    <div style={{ 
                                      display: 'grid', 
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                                      gap: '0.5rem' 
                                    }}>
                                      {getAllAnswers(cl._id, cl.answer_choices || []).map((choice, idx) => {
                                        const selectedAnswers = getSelectedAnswers(cl._id);
                                        const isAnswerSelected = selectedAnswers.has(choice);
                                        const isCustom = isCustomAnswer(cl._id, choice, cl.answer_choices || []);
                                        
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
                                              position: 'relative'
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
                                            <span style={{ color: '#374151', userSelect: 'none', flex: 1 }}>
                                              {choice}
                                            </span>
                                            {isCustom && (
                                              <span style={{ 
                                                fontSize: '0.6rem', 
                                                backgroundColor: '#fbbf24', 
                                                color: '#78350f',
                                                padding: '0.1rem 0.3rem',
                                                borderRadius: '0.2rem',
                                                fontWeight: 600
                                              }}>
                                                Custom
                                              </span>
                                            )}
                                          </label>
                                        );
                                      })}
                                    </div>

                                    {/* Custom Answer Input */}
                                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.5rem' }}>
                                        Add Custom Answer:
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                        <input
                                          type="text"
                                          placeholder="Type custom answer..."
                                          value={customAnswerInputs[`custom-${cl._id}`] || ''}
                                          onChange={(e) => setCustomAnswerInputs(prev => ({
                                            ...prev,
                                            [`custom-${cl._id}`]: e.target.value
                                          }))}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              addCustomAnswer(cl._id);
                                            }
                                          }}
                                          style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            fontSize: '0.75rem',
                                            borderRadius: '0.25rem',
                                            border: '1px solid #d1d5db',
                                            outline: 'none'
                                          }}
                                        />
                                        <button
                                          onClick={() => addCustomAnswer(cl._id)}
                                          style={{
                                            padding: '0.5rem 0.75rem',
                                            fontSize: '0.7rem',
                                            borderRadius: '0.25rem',
                                            backgroundColor: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            fontWeight: 600
                                          }}
                                          title="Add answer for this inspection only"
                                        >
                                          Add
                                        </button>
                                        <button
                                          onClick={() => addCustomAnswerPermanently(cl._id)}
                                          style={{
                                            padding: '0.5rem 0.75rem',
                                            fontSize: '0.7rem',
                                            borderRadius: '0.25rem',
                                            backgroundColor: '#059669',
                                            color: 'white',
                                            border: 'none',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            fontWeight: 600
                                          }}
                                          title="Save to template permanently for all future inspections"
                                        >
                                          Save to Template
                                        </button>
                                      </div>
                                      <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.375rem', fontStyle: 'italic' }}>
                                        💡 <strong>Add</strong> = Use only for this inspection • <strong>Save to Template</strong> = Add permanently for all inspections
                                      </div>
                                    </div>
                                  </div>
                                )}

                          {/* Image upload section - show only when item is selected */}
                          {isSelected && (
                            <div style={{ marginTop: '0.75rem', marginLeft: '1.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                              {/* 360° Photo Checkbox */}
                              <div style={{
                                background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                                padding: '10px 16px',
                                borderRadius: '8px',
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.2)'
                              }}>
                                <input
                                  type="checkbox"
                                  id={`isThreeSixty-limit-${cl._id}`}
                                  checked={isThreeSixtyMap[cl._id] || false}
                                  onChange={(e) => setIsThreeSixtyMap(prev => ({
                                    ...prev,
                                    [cl._id]: e.target.checked
                                  }))}
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    cursor: 'pointer',
                                    accentColor: '#ffffff'
                                  }}
                                />
                                <label 
                                  htmlFor={`isThreeSixty-limit-${cl._id}`} 
                                  style={{
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                >
                                  <i className="fas fa-sync" style={{ fontSize: '16px' }}></i>
                                  This is a 360° photo
                                </label>
                              </div>

                              {/* Help text for 360° photos */}
                              {isThreeSixtyMap[cl._id] && (
                                <div style={{
                                  backgroundColor: '#fef3c7',
                                  border: '1px solid #fbbf24',
                                  borderRadius: '6px',
                                  padding: '8px 12px',
                                  marginBottom: '12px',
                                  fontSize: '12px',
                                  color: '#92400e'
                                }}>
                                  <strong>📸 360° Photo Tips:</strong>
                                  <ul style={{ margin: '4px 0 0 20px', paddingLeft: 0 }}>
                                    <li>File size limit: <strong>100 MB</strong></li>
                                    <li><strong>⚠️ Recommended dimensions: 8192×4096 (33 MP max)</strong></li>
                                    <li>Optimal: <strong>4096×2048</strong> at <strong>85% quality</strong> (~5-10 MB)</li>
                                    <li>Images larger than 50 MP may fail to load in browser</li>
                                    <li>Compress large files using: TinyPNG, Squoosh, or IrfanView</li>
                                  </ul>
                                </div>
                              )}
                              
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

                                      {/* Location Dropdown */}
                                      <div style={{ position: 'relative', width: '180px' }}>
                                        <select
                                          value={locationInputs[`${cl._id}-${idx}`] ?? img.location ?? ''}
                                          onChange={(e) => {
                                            const newLocation = e.target.value;
                                            const inputKey = `${cl._id}-${idx}`;
                                            
                                            // Update local input state immediately for instant feedback
                                            setLocationInputs(prev => ({
                                              ...prev,
                                              [inputKey]: newLocation
                                            }));
                                            
                                            // Update formState
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
                                            
                                            // Trigger auto-save
                                            setTimeout(() => performAutoSaveWithState(updatedFormState), 100);
                                          }}
                                          style={{
                                            padding: '0.5rem',
                                            fontSize: '0.75rem',
                                            borderRadius: '0.25rem',
                                            border: '1px solid #d1d5db',
                                            width: '180px',
                                            outline: 'none',
                                            backgroundColor: 'white',
                                            cursor: 'pointer'
                                          }}
                                          onFocus={(e) => e.currentTarget.style.borderColor = '#10b981'}
                                          onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                                        >
                                          <option value="">Select Location</option>
                                          {LOCATION_OPTIONS.map((loc) => (
                                            <option key={loc} value={loc}>{loc}</option>
                                          ))}
                                        </select>
                                      </div>

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
                  setChecklistFormData({ text: '', comment: '', type: 'status', tab: 'information', answer_choices: [] });
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
                  Manage predefined options for this checklist item. Add new options using "Add Custom Answer" in the inspection block editor.
                </p>

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
                    {checklistFormData.answer_choices.map((choice, index) => {
                      // Check if this choice is a custom answer (inspection-specific)
                      const originalChecklist = activeSection?.checklists.find(cl => cl._id === editingChecklistId);
                      const isCustomAnswer = originalChecklist && !(originalChecklist.answer_choices || []).includes(choice);
                      
                      return (
                      <div 
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem',
                          backgroundColor: isCustomAnswer ? '#fef3c7' : '#f9fafb',
                          borderRadius: '0.25rem',
                          border: `1px solid ${isCustomAnswer ? '#f59e0b' : '#e5e7eb'}`
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
                            <span style={{ flex: 1, fontSize: '0.875rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {choice}
                              {isCustomAnswer && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  padding: '0.125rem 0.375rem',
                                  borderRadius: '0.25rem',
                                  backgroundColor: '#f59e0b',
                                  color: 'white'
                                }}>
                                  Custom
                                </span>
                              )}
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
                      );
                    })}
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

            {/* Footer with Save Options and Help Text */}
            <div style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              {/* Help text for new checklists */}
              {!editingChecklistId && (
                <div style={{ 
                  padding: '0.75rem 1rem', 
                  backgroundColor: '#eff6ff', 
                  borderBottom: '1px solid #e5e7eb' 
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#1e40af', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>💡</span>
                    <div>
                      <strong>Add to This Inspection</strong> = Use only for this inspection • <strong>Save to Template</strong> = Add permanently for all inspections
                    </div>
                  </div>
                </div>
              )}
              
              <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setChecklistFormOpen(false);
                  setEditingChecklistId(null);
                  setChecklistFormData({ text: '', comment: '', type: 'status', tab: 'information', answer_choices: [] });
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
              
              {/* Show two-tier save options only when creating NEW checklist (not editing) */}
              {!editingChecklistId ? (
                <>
                  {/* Add to This Inspection Only button */}
                  <button
                    onClick={() => handleSaveChecklist(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.375rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: savingChecklist ? 0.5 : 1,
                      fontWeight: 500,
                      whiteSpace: 'nowrap'
                    }}
                    disabled={savingChecklist}
                    onMouseOver={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#2563eb')}
                    onMouseOut={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#3b82f6')}
                    title="Add this checklist item only for this inspection"
                  >
                    {savingChecklist ? 'Adding...' : 'Add to This Inspection'}
                  </button>
                  {/* Save to Template button */}
                  <button
                    onClick={() => handleSaveChecklist(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.375rem',
                      backgroundColor: '#059669',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: savingChecklist ? 0.5 : 1,
                      fontWeight: 500,
                      whiteSpace: 'nowrap'
                    }}
                    disabled={savingChecklist}
                    onMouseOver={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#047857')}
                    onMouseOut={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#059669')}
                    title="Save to template permanently for all future inspections"
                  >
                    {savingChecklist ? 'Saving...' : 'Save to Template'}
                  </button>
                </>
              ) : (
                /* When editing existing checklist, show single Update button */
                <button
                  onClick={() => handleSaveChecklist(true)}
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
                  {savingChecklist ? 'Updating...' : 'Update'}
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InformationSections;
