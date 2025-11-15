"use client";
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from './FileUpload';
import LocationSearch from './LocationSearch';
import { LOCATION_OPTIONS } from '../constants/locations';

interface ISectionChecklist {
  _id: string;
  text: string;
  comment?: string;
  type: 'status' | 'information';
  tab: 'information' | 'limitations'; // Which tab to display this item in
  answer_choices?: string[]; // NEW: Predefined answer choices for this checklist item
  default_checked?: boolean; // NEW
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
  // Mobile detection for responsive tweaks in the inline-styled layout
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
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

  // Reorder mode (template-level) for Status and Limitations lists
  const [reorderMode, setReorderMode] = useState<{ status: boolean; limitations: boolean }>({ status: false, limitations: false });
  const [reorderIds, setReorderIds] = useState<{ status: string[]; limitations: string[] }>({ status: [], limitations: [] });
  const dragStateRef = useRef<{ kind: 'status' | 'limitations' | null; draggingId: string | null }>({ kind: null, draggingId: null });
  const reorderDirtyRef = useRef<{ status: boolean; limitations: boolean }>({ status: false, limitations: false });
  // Drag visuals: track dragging item and current target + insert position for subtle UI
  const [dragVisual, setDragVisual] = useState<{ kind: 'status' | 'limitations' | null; draggingId: string | null; overId: string | null; position: 'before' | 'after' | null }>({ kind: null, draggingId: null, overId: null, position: null });
  
  // Option-level drag state for reordering answer choices (template choices only)
  const optionDragStateRef = useRef<{ checklistId: string | null; draggingChoice: string | null }>({ checklistId: null, draggingChoice: null });
  const [optionDragVisual, setOptionDragVisual] = useState<{ checklistId: string | null; draggingChoice: string | null; overChoice: string | null; position: 'before' | 'after' | null; axis: 'horizontal' | 'vertical' | null }>({ checklistId: null, draggingChoice: null, overChoice: null, position: null, axis: null });
  
  // Touch drag state for mobile (iOS Safari fix)
  const optionTouchStateRef = useRef<{
    isDragging: boolean;
    checklistId: string | null;
    draggingChoice: string | null;
    startY: number;
    startX: number;
    currentY: number;
    currentX: number;
    allowDrag?: boolean; // do not start drag if touch began on a checkbox or non-draggable control
    dragEl?: HTMLElement | null; // the label element being dragged for visual feedback
  }>({
    isDragging: false,
    checklistId: null,
    draggingChoice: null,
    startY: 0,
    startX: 0,
    currentY: 0,
    currentX: 0,
    allowDrag: true,
    dragEl: null,
  });
  // Movement threshold in pixels before initiating an option drag on touch
  const OPTION_TOUCH_DRAG_THRESHOLD = 10;
  
  // Auto-scroll during drag
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null); // legacy interval (kept for options if ever needed)
  const modalScrollContainerRef = useRef<HTMLDivElement | null>(null);
  // Smooth auto-scroll with requestAnimationFrame for item dragging
  const scrollRafRef = useRef<number | null>(null);
  const autoScrollStateRef = useRef<{ active: boolean; dir: 'up' | 'down' | null; speed: number }>({ active: false, dir: null, speed: 0 });

  const stopAutoScroll = () => {
    autoScrollStateRef.current = { active: false, dir: null, speed: 0 };
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    // Also clear legacy interval if any
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const runAutoScrollLoop = () => {
    if (scrollRafRef.current) return; // already running
    const tick = () => {
      scrollRafRef.current = requestAnimationFrame(() => {
        const state = autoScrollStateRef.current;
        const container = modalScrollContainerRef.current;
        if (!state.active || !state.dir || !container) {
          // stop loop
          if (scrollRafRef.current) {
            cancelAnimationFrame(scrollRafRef.current);
            scrollRafRef.current = null;
          }
          return;
        }
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (state.dir === 'up') {
          container.scrollTop = Math.max(0, container.scrollTop - state.speed);
        } else {
          container.scrollTop = Math.min(maxScroll, container.scrollTop + state.speed);
        }
        // continue loop
        tick();
      });
    };
    tick();
  };

  // Update auto-scroll speed/direction based on pointer Y
  const updateItemAutoScroll = (clientY: number) => {
    const container = modalScrollContainerRef.current;
    if (!container) return stopAutoScroll();
    const rect = container.getBoundingClientRect();
    const zone = Math.max(48, Math.min(120, Math.floor(rect.height * 0.18))); // 18% of height, clamped

    if (clientY < rect.top + zone && clientY > rect.top) {
      const dist = rect.top + zone - clientY; // 0..zone
      const t = Math.max(0, Math.min(1, dist / zone));
      const max = 28; // px per frame
      const min = 4;
      const speed = min + Math.pow(t, 1.6) * (max - min); // ease-in
      autoScrollStateRef.current = { active: true, dir: 'up', speed };
      runAutoScrollLoop();
    } else if (clientY > rect.bottom - zone && clientY < rect.bottom) {
      const dist = clientY - (rect.bottom - zone); // 0..zone
      const t = Math.max(0, Math.min(1, dist / zone));
      const max = 28;
      const min = 4;
      const speed = min + Math.pow(t, 1.6) * (max - min);
      autoScrollStateRef.current = { active: true, dir: 'down', speed };
      runAutoScrollLoop();
    } else {
      stopAutoScroll();
    }
  };

  // Track inspection-specific checklists (not saved to template)
  // Key: sectionId, Value: array of inspection-only checklists for that section
  const [inspectionChecklists, setInspectionChecklists] = useState<Map<string, ISectionChecklist[]>>(new Map());

  // Track hidden template checklist items per inspection/section (persisted in localStorage)
  // Map key: sectionId, value: array of template checklist IDs hidden for this inspection
  const [hiddenChecklists, setHiddenChecklists] = useState<Map<string, string[]>>(new Map());

  // UI state: which checklist id currently has the delete options menu open
  const [deleteMenuForId, setDeleteMenuForId] = useState<string | null>(null);

  // UI state: which answer choice index has the delete options menu open in edit modal
  const [deleteAnswerMenuForIndex, setDeleteAnswerMenuForIndex] = useState<number | null>(null);

  // UI state: show hidden manager panels inside modal for each area
  const [showHiddenManagerStatus, setShowHiddenManagerStatus] = useState(false);
  const [showHiddenManagerLimits, setShowHiddenManagerLimits] = useState(false);

  // Auto-save state
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const commentSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Local input values for location fields (to prevent last character issue)
  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});

  // Custom answer inputs for ad-hoc answers during inspection
  const [customAnswerInputs, setCustomAnswerInputs] = useState<Record<string, string>>({});

  // Location dropdown management
  const [locationDropdownOpen, setLocationDropdownOpen] = useState<Record<string, boolean>>({});

  // 360° photo checkbox state (key: checklist_id, value: boolean)
  const [isThreeSixtyMap, setIsThreeSixtyMap] = useState<Record<string, boolean>>({});

  // Collapsed/expanded state for selected Status items in the Add/Edit modal
  const [expandedStatusIds, setExpandedStatusIds] = useState<Set<string>>(new Set());
  const isStatusExpanded = useCallback((id: string) => expandedStatusIds.has(id), [expandedStatusIds]);
  const expandStatus = useCallback((id: string) => {
    setExpandedStatusIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const collapseStatus = useCallback((id: string) => {
    setExpandedStatusIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Collapsed/expanded state for selected Limitations/Information items
  const [expandedLimitIds, setExpandedLimitIds] = useState<Set<string>>(new Set());
  const isLimitExpanded = useCallback((id: string) => expandedLimitIds.has(id), [expandedLimitIds]);
  const expandLimit = useCallback((id: string) => {
    setExpandedLimitIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const collapseLimit = useCallback((id: string) => {
    setExpandedLimitIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Proxy helper for reliable image loading
  const getProxiedSrc = useCallback((url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('/api/proxy-image?') || url.startsWith('blob:')) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }, []);

  // Shared location options
  

  // Admin checklist management
  const [checklistFormOpen, setChecklistFormOpen] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [checklistFormData, setChecklistFormData] = useState<{
    text: string;
    comment: string;
    type: 'status' | 'information';
    tab: 'information' | 'limitations';
    answer_choices: string[];
    default_checked: boolean;
  }>({ text: '', comment: '', type: 'status', tab: 'information', answer_choices: [], default_checked: false });
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

      // Load hidden template checklist ids map
      const hiddenKey = `inspection_hidden_checklists_${inspectionId}`;
      const hiddenStored = localStorage.getItem(hiddenKey);
      if (hiddenStored) {
        const parsedHidden = JSON.parse(hiddenStored) as Record<string, string[]>;
        const hiddenMap = new Map<string, string[]>();
        Object.entries(parsedHidden).forEach(([secId, ids]) => hiddenMap.set(secId, ids));
        setHiddenChecklists(hiddenMap);
      }
    } catch (error) {
      console.error('Error loading inspection data from localStorage:', error);
    }
  }, [inspectionId]);

  // Persist inspection-specific checklists to localStorage whenever they change
  useEffect(() => {
    if (!inspectionId) return;
    try {
      const storageKey = `inspection_checklists_${inspectionId}`;
      const obj: Record<string, ISectionChecklist[]> = {};
      inspectionChecklists.forEach((arr, secId) => { obj[secId] = arr; });
      localStorage.setItem(storageKey, JSON.stringify(obj));
    } catch (error) {
      console.error('Error saving inspection-specific checklists to localStorage:', error);
    }
  }, [inspectionId, inspectionChecklists]);

  // Persist hidden template checklist ids per inspection
  useEffect(() => {
    if (!inspectionId) return;
    try {
      const hiddenKey = `inspection_hidden_checklists_${inspectionId}`;
      const obj: Record<string, string[]> = {};
      hiddenChecklists.forEach((ids, secId) => { obj[secId] = ids; });
      localStorage.setItem(hiddenKey, JSON.stringify(obj));
    } catch (error) {
      console.error('Error saving hidden checklist ids:', error);
    }
  }, [inspectionId, hiddenChecklists]);

  // Helpers for hidden items
  const getHiddenIdsForSection = (sectionId: string): string[] => {
    return hiddenChecklists.get(sectionId) || [];
  };

  const isChecklistHidden = (sectionId: string, checklistId: string): boolean => {
    const ids = hiddenChecklists.get(sectionId) || [];
    return ids.includes(checklistId);
  };

  const hideChecklistForInspection = (sectionId: string, checklistId: string) => {
    // Only template items can be hidden
    if (checklistId.startsWith('temp_')) return;
    const current = hiddenChecklists.get(sectionId) || [];
    if (current.includes(checklistId)) return;
    const updated = new Map(hiddenChecklists);
    updated.set(sectionId, [...current, checklistId]);
    setHiddenChecklists(updated);

    // Also unselect it in current form state if selected
    if (formState && formState.section_id === sectionId && formState.selected_checklist_ids.has(checklistId)) {
      const newIds = new Set(formState.selected_checklist_ids);
      newIds.delete(checklistId);
      const newAnswers = new Map(formState.selected_answers);
      newAnswers.delete(checklistId);
      const updatedState = { ...formState, selected_checklist_ids: newIds, selected_answers: newAnswers };
      setFormState(updatedState);
      setTimeout(() => performAutoSaveWithState(updatedState), 100);
    }
  };

  const unhideChecklistForInspection = (sectionId: string, checklistId: string) => {
    const current = hiddenChecklists.get(sectionId) || [];
    const updatedIds = current.filter(id => id !== checklistId);
    const updated = new Map(hiddenChecklists);
    if (updatedIds.length > 0) updated.set(sectionId, updatedIds); else updated.delete(sectionId);
    setHiddenChecklists(updated);
  };

  // -------- Reorder helpers (template-level) --------
  const beginReorder = (kind: 'status' | 'limitations', section: ISection) => {
    const base = kind === 'status'
      ? section.checklists.filter(cl => cl.type === 'status')
      : section.checklists.filter(cl => cl.tab === 'limitations');
    const ordered = [...base].sort((a, b) => a.order_index - b.order_index).map(cl => cl._id);
    setReorderIds(prev => ({ ...prev, [kind]: ordered }));
    reorderDirtyRef.current[kind] = false;
    setReorderMode(prev => ({ ...prev, [kind]: true }));
  };

  const cancelReorder = (kind: 'status' | 'limitations') => {
    setReorderMode(prev => ({ ...prev, [kind]: false }));
    setReorderIds(prev => ({ ...prev, [kind]: [] }));
    reorderDirtyRef.current[kind] = false;
    dragStateRef.current = { kind: null, draggingId: null };
    // Clear auto-scroll interval
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  // Auto-scroll logic during drag (desktop pointer) using smooth RAF
  const handleDragMove = (e: React.DragEvent<HTMLDivElement>) => {
    updateItemAutoScroll(e.clientY);
  };

  const onDragStartItem = (kind: 'status' | 'limitations', id: string) => (
    (e: React.DragEvent<HTMLDivElement>) => {
      dragStateRef.current = { kind, draggingId: id };
      e.dataTransfer.effectAllowed = 'move';
      // Visual: mark dragging
      setDragVisual({ kind, draggingId: id, overId: null, position: null });
      // Slightly better drag image (fallback to element itself)
      try { e.dataTransfer.setDragImage(e.currentTarget, 10, 10); } catch {}
    }
  );

  // --- Touch/Pointer fallback for item reordering (iOS Safari) ---
  const itemTouchStateRef = useRef<{
    isDragging: boolean;
    kind: 'status' | 'limitations' | null;
    draggingId: string | null;
  }>({ isDragging: false, kind: null, draggingId: null });

  const lockModalScroll = () => {
    const el = modalScrollContainerRef.current as unknown as HTMLElement | null;
    if (el) {
      el.style.touchAction = 'none';
      // Prevent scroll chaining to the page
      // @ts-ignore
      el.style.overscrollBehavior = 'contain';
      // Keep overflowY as auto for item dragging; we don't want to hide scrollbar here
    }
  };
  const unlockModalScroll = () => {
    const el = modalScrollContainerRef.current as unknown as HTMLElement | null;
    if (el) {
      // Restore to default modal values
      el.style.touchAction = 'pan-y';
      // @ts-ignore
      el.style.overscrollBehavior = 'contain';
      el.style.overflowY = 'auto';
    }
  };

  // Stronger scroll lock for option dragging (also disables wheel scrolling)
  const optionWheelBlockerRef = useRef<((ev: WheelEvent) => void) | null>(null);
  const itemTouchBlockerRef = useRef<((ev: TouchEvent) => void) | null>(null);
  const prevDocOverscrollRef = useRef<{ html: string; body: string } | null>(null);
  const lockModalScrollForOptions = () => {
    const el = modalScrollContainerRef.current as unknown as HTMLElement | null;
    if (el) {
      el.style.touchAction = 'none';
      // @ts-ignore
      el.style.overscrollBehavior = 'contain';
      el.style.overflowY = 'hidden';
    }
    if (typeof window !== 'undefined' && !optionWheelBlockerRef.current) {
      const handler = (ev: WheelEvent) => { ev.preventDefault(); };
      window.addEventListener('wheel', handler, { passive: false });
      optionWheelBlockerRef.current = handler;
    }
  };
  const unlockModalScrollForOptions = () => {
    const el = modalScrollContainerRef.current as unknown as HTMLElement | null;
    if (el) {
      // Restore to modal defaults so scrollbar returns
      el.style.overflowY = 'auto';
      el.style.touchAction = 'pan-y';
      // @ts-ignore
      el.style.overscrollBehavior = 'contain';
    }
    if (typeof window !== 'undefined' && optionWheelBlockerRef.current) {
      window.removeEventListener('wheel', optionWheelBlockerRef.current as any);
      optionWheelBlockerRef.current = null;
    }
  };

  // Block global touchmove during item drag to prevent page scroll/bounce
  const lockGlobalScrollDuringItemDrag = () => {
    if (typeof window !== 'undefined' && !itemTouchBlockerRef.current) {
      const handler = (ev: TouchEvent) => { ev.preventDefault(); };
      window.addEventListener('touchmove', handler, { passive: false });
      itemTouchBlockerRef.current = handler;
    }
    // Save previous overscrollBehavior and then disable
    if (typeof document !== 'undefined') {
      const html = (document.documentElement as HTMLElement);
      const body = (document.body as HTMLElement);
      prevDocOverscrollRef.current = {
        html: (html.style as any).overscrollBehavior || '',
        body: (body.style as any).overscrollBehavior || ''
      };
      (html.style as any).overscrollBehavior = 'none';
      (body.style as any).overscrollBehavior = 'none';
    }
  };
  const unlockGlobalScrollDuringItemDrag = () => {
    if (typeof window !== 'undefined' && itemTouchBlockerRef.current) {
      window.removeEventListener('touchmove', itemTouchBlockerRef.current as any);
      itemTouchBlockerRef.current = null;
    }
    if (typeof document !== 'undefined') {
      const html = (document.documentElement as HTMLElement);
      const body = (document.body as HTMLElement);
      const prev = prevDocOverscrollRef.current;
      (html.style as any).overscrollBehavior = prev ? prev.html : '';
      (body.style as any).overscrollBehavior = prev ? prev.body : '';
      prevDocOverscrollRef.current = null;
    }
  };

  // Ensure no locks linger when modal closes or component unmounts
  useEffect(() => {
    if (!modalOpen) {
      unlockModalScrollForOptions();
      unlockModalScroll();
    }
  }, [modalOpen]);
  useEffect(() => {
    return () => {
      unlockModalScrollForOptions();
      unlockModalScroll();
    };
  }, []);

  const onItemTouchStart = (kind: 'status' | 'limitations', id: string) => (
    (e: React.TouchEvent<HTMLDivElement>) => {
      itemTouchStateRef.current = { isDragging: true, kind, draggingId: id };
      setDragVisual({ kind, draggingId: id, overId: null, position: null });
      (e.currentTarget as HTMLElement).style.opacity = '0.9';
      // Mobile: lock native scrolling while dragging items; we'll auto-scroll programmatically near edges
      lockModalScroll();
      lockGlobalScrollDuringItemDrag();
    }
  );

  const onItemTouchMove = (kind: 'status' | 'limitations') => (
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!itemTouchStateRef.current.isDragging) return;
      const touch = e.touches[0];
      // Find target item under finger
      const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      const itemEl = el ? el.closest('[data-item-id]') as HTMLElement | null : null;
      const overId = itemEl?.getAttribute('data-item-id') || null;
      if (overId) {
        const rect = itemEl!.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const position: 'before' | 'after' = touch.clientY < mid ? 'before' : 'after';
        setDragVisual(prev => ({ ...prev, kind, overId, position }));
      }
      // Smooth auto-scroll near edges using RAF with acceleration
      updateItemAutoScroll(touch.clientY);
    }
  );

  const onItemTouchEnd = (kind: 'status' | 'limitations') => (
    (_e: React.TouchEvent<HTMLDivElement>) => {
      if (!itemTouchStateRef.current.isDragging) return;
      const draggingId = itemTouchStateRef.current.draggingId;
      const overId = dragVisual.overId;
      const insertPosition = dragVisual.position || 'after';
      if (draggingId && overId && draggingId !== overId) {
        setReorderIds(prev => {
          const list = [...prev[kind]];
          const fromIndex = list.indexOf(draggingId);
          let insertIndex = list.indexOf(overId);
          if (fromIndex === -1 || insertIndex === -1) return prev;
          const [dragged] = list.splice(fromIndex, 1);
          insertIndex = list.indexOf(overId);
          if (insertPosition === 'after') insertIndex += 1;
          list.splice(insertIndex, 0, dragged);
          setTimeout(async () => {
            if (activeSection) await persistChecklistOrder(kind, activeSection._id, list);
          }, 50);
          return { ...prev, [kind]: list };
        });
      }
      itemTouchStateRef.current = { isDragging: false, kind: null, draggingId: null };
      setDragVisual({ kind: null, draggingId: null, overId: null, position: null });
      stopAutoScroll();
      unlockModalScroll();
      unlockGlobalScrollDuringItemDrag();
    }
  );

  const onItemTouchCancel = () => (
    () => {
      if (!itemTouchStateRef.current.isDragging) return;
      itemTouchStateRef.current = { isDragging: false, kind: null, draggingId: null };
      setDragVisual({ kind: null, draggingId: null, overId: null, position: null });
      stopAutoScroll();
      unlockModalScroll();
      unlockGlobalScrollDuringItemDrag();
    }
  );

  const onItemPointerDown = (kind: 'status' | 'limitations', id: string) => (
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'touch') return;
      itemTouchStateRef.current = { isDragging: true, kind, draggingId: id };
      setDragVisual({ kind, draggingId: id, overId: null, position: null });
      (e.currentTarget as HTMLElement).style.opacity = '0.9';
      // Touch: lock native scroll; rely on auto-scroll near edges while dragging items
      lockModalScroll();
      lockGlobalScrollDuringItemDrag();
    }
  );
  const onItemPointerUp = (kind: 'status' | 'limitations') => (
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'touch') return;
      if (!itemTouchStateRef.current.isDragging) return;
      onItemTouchEnd(kind)({} as any);
      (e.currentTarget as HTMLElement).style.opacity = '1';
      unlockGlobalScrollDuringItemDrag();
    }
  );

  const onDragOverItem = (kind: 'status' | 'limitations', targetId: string) => (
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      // Calculate position (before/after) based on mouse position
      const targetElement = e.currentTarget;
      const rect = targetElement.getBoundingClientRect();
      const mouseY = e.clientY;
      const elementMiddle = rect.top + rect.height / 2;
      
      // If mouse is above middle, insert before; if below, insert after
      const position = mouseY < elementMiddle ? 'before' : 'after';
      
      setDragVisual(prev => ({ ...prev, kind, overId: targetId, position }));
      // Trigger auto-scroll check
      handleDragMove(e);
    }
  );

  const onDropItem = (kind: 'status' | 'limitations', targetId: string) => (
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const draggingId = dragStateRef.current.draggingId;
      if (!draggingId || dragStateRef.current.kind !== kind) return;
      if (draggingId === targetId) return;
      
      // Get the position from dragVisual state
      const insertPosition = dragVisual.position || 'after';
      
      setReorderIds(prev => {
        const list = [...prev[kind]];
        const fromIndex = list.indexOf(draggingId);
        const toIndex = list.indexOf(targetId);
        if (fromIndex === -1 || toIndex === -1) return prev;
        
        // INSERT LOGIC (araya ekleme) - Trello/Spotify tarzı
        // 1. Sürüklenen elemanı listeden çıkar
        const [draggedItem] = list.splice(fromIndex, 1);
        
        // 2. Hedef konuma ekle
        // 'before' ise hedefin önüne, 'after' ise hedefin arkasına
        let insertIndex = list.indexOf(targetId);
        if (insertIndex === -1) return prev; // Güvenlik kontrolü
        
        if (insertPosition === 'after') {
          insertIndex += 1; // Hedefin arkasına ekle
        }
        // 'before' ise insertIndex olduğu gibi kalır (hedefin önüne)
        
        list.splice(insertIndex, 0, draggedItem);
        
        // AUTO-SAVE: Immediately persist the new order after drag and drop
        setTimeout(async () => {
          if (activeSection) {
            try {
              console.log(`🔄 Auto-saving ${kind} order after drag and drop...`);
              await persistChecklistOrder(kind, activeSection._id, list);
              console.log(`✅ ${kind} order auto-saved successfully!`);
            } catch (error) {
              console.error(`❌ Failed to auto-save ${kind} order:`, error);
            }
          }
        }, 100); // Small delay to ensure state is updated
        
        return { ...prev, [kind]: list };
      });
      reorderDirtyRef.current[kind] = true;
      
      // Clear visual state
      dragStateRef.current = { kind: null, draggingId: null };
      setDragVisual({ kind: null, draggingId: null, overId: null, position: null });
        // Stop any auto-scroll after drop
        stopAutoScroll();
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    }
  );

  const onDragEndItem = () => (
    (_e: React.DragEvent<HTMLDivElement>) => {
      dragStateRef.current = { kind: null, draggingId: null };
      setDragVisual({ kind: null, draggingId: null, overId: null, position: null });
      // Clear auto-scroll interval
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    }
  );

  const persistChecklistOrder = useCallback(
    async (kind: 'status' | 'limitations', sectionId: string, orderedIds: string[]) => {
      const seen = new Set<string>();
      const sanitized: string[] = [];
      for (const rawId of orderedIds) {
        if (typeof rawId !== 'string') continue;
        const trimmed = rawId.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        sanitized.push(trimmed);
      }

      if (!sanitized.length) {
        reorderDirtyRef.current[kind] = false;
        return { templateUpdated: false };
      }

      const orderMap = new Map<string, number>();
      sanitized.forEach((id, index) => orderMap.set(id, index));

      const templateIds = sanitized.filter(id => !id.startsWith('temp_'));
      let templateUpdated = false;

      if (templateIds.length) {
        const res = await fetch('/api/information-sections/sections/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionId, kind, orderedIds: templateIds }),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Failed to save order');
        }
        templateUpdated = true;
      }

      const inspectionOnlyIds = sanitized.filter(id => id.startsWith('temp_'));
      if (inspectionOnlyIds.length) {
        setInspectionChecklists(prev => {
          const existing = prev.get(sectionId);
          if (!existing || !existing.length) return prev;
          const next = new Map(prev);
          const orderedInspection = inspectionOnlyIds
            .map(id => {
              const match = existing.find(item => item._id === id);
              if (!match) return null;
              return { ...match, order_index: orderMap.get(id)! };
            })
            .filter((item): item is ISectionChecklist => !!item);
          const remainingInspection = existing.filter(item => !inspectionOnlyIds.includes(item._id));
          next.set(sectionId, [...orderedInspection, ...remainingInspection]);
          return next;
        });
      }

      setActiveSection(prev => {
        if (!prev || prev._id !== sectionId) return prev;
        const source = prev.checklists || [];
        const checklistMap = new Map(source.map(item => [item._id, item]));
        const ordered = sanitized
          .map(id => checklistMap.get(id))
          .filter((item): item is ISectionChecklist => !!item)
          .map(item => ({ ...item, order_index: orderMap.get(item._id)! }));
        const remaining = source.filter(item => !orderMap.has(item._id));
        return {
          ...prev,
          checklists: [...ordered, ...remaining],
        };
      });

      setReorderIds(prev => ({ ...prev, [kind]: sanitized }));
      reorderDirtyRef.current[kind] = false;

      return { templateUpdated };
    },
    [setActiveSection, setInspectionChecklists, setReorderIds]
  );

  // Persist reordered template options for a checklist item
  const persistOptionOrder = useCallback(
    async (checklistId: string, orderedChoices: string[]) => {
      try {
        // Optimistically update activeSection
        setActiveSection(prev => {
          if (!prev) return prev;
          const updated = prev.checklists.map(cl => {
            if (cl._id === checklistId) {
              return { ...cl, answer_choices: orderedChoices };
            }
            return cl;
          });
          return { ...prev, checklists: updated };
        });

        // Save to template via API (only answer_choices field)
        const res = await fetch(`/api/checklists/${checklistId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer_choices: orderedChoices }),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Failed to save option order');
        }
        // No need to refetch sections immediately; UI already updated
      } catch (err) {
        console.error('Failed to persist option order:', err);
        alert('Failed to save option order. Please try again.');
      }
    },
    [setActiveSection]
  );

  // --- Option drag handlers (template answer choices only) ---
  const onOptionDragStart = (checklistId: string, choice: string, isCustom: boolean) => (
    (e: React.DragEvent<HTMLLabelElement>) => {
      // Only allow dragging template choices
      if (isCustom) return;
      // Don't start drag if initiated on checkbox or interactive control
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.closest('input[type="checkbox"]'))) {
        return;
      }
      // Prevent parent checklist drag handlers
      e.stopPropagation();
      // Hard lock modal/page scroll while dragging options (desktop)
      lockModalScrollForOptions();
      optionDragStateRef.current = { checklistId, draggingChoice: choice };
      setOptionDragVisual({ checklistId, draggingChoice: choice, overChoice: null, position: null, axis: null });
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setDragImage(e.currentTarget, 10, 10); } catch {}
    }
  );

  const onOptionDragOver = (checklistId: string, targetChoice: string, isTargetCustom: boolean) => (
    (e: React.DragEvent<HTMLLabelElement>) => {
  const { checklistId: draggingChecklistId, draggingChoice } = optionDragStateRef.current;
      // Only allow drop on template choices
      if (isTargetCustom) return;
      // Prevent parent checklist drag handlers
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseY = e.clientY;
      const mouseX = e.clientX;
      const centerY = rect.top + rect.height / 2;
      const centerX = rect.left + rect.width / 2;
      const distY = Math.abs(mouseY - centerY);
      const distX = Math.abs(mouseX - centerX);
      const axis: 'horizontal' | 'vertical' = distX >= distY ? 'horizontal' : 'vertical';
      const position: 'before' | 'after' = axis === 'horizontal'
        ? (mouseX < centerX ? 'before' : 'after')
        : (mouseY < centerY ? 'before' : 'after');
      setOptionDragVisual({ checklistId, draggingChoice, overChoice: targetChoice, position, axis });
    }
  );

  const onOptionDrop = (checklistId: string, targetChoice: string, isTargetCustom: boolean, templateChoices: string[]) => (
    async (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const { checklistId: draggingChecklistId, draggingChoice } = optionDragStateRef.current;
      const insertPos = optionDragVisual.position || 'after';
      if (!draggingChoice || draggingChecklistId !== checklistId) return;
      // Only move within template choices
      if (isTargetCustom) return;
      if (!templateChoices || !templateChoices.length) return;
      if (!templateChoices.includes(draggingChoice) || !templateChoices.includes(targetChoice)) return;
      if (draggingChoice === targetChoice) return;

      const list = [...templateChoices];
      const fromIndex = list.indexOf(draggingChoice);
      let toIndex = list.indexOf(targetChoice);
      if (fromIndex === -1 || toIndex === -1) return;

      // Remove from original
      list.splice(fromIndex, 1);
      // Recompute target index after removal if needed
      toIndex = list.indexOf(targetChoice);
      if (insertPos === 'after') toIndex += 1;
      // Insert at new index
      list.splice(toIndex, 0, draggingChoice);

      // Persist and update UI
      await persistOptionOrder(checklistId, list);

      // Clear visuals
      optionDragStateRef.current = { checklistId: null, draggingChoice: null };
      setOptionDragVisual({ checklistId: null, draggingChoice: null, overChoice: null, position: null, axis: null });
      unlockModalScrollForOptions();
    }
  );

  const onOptionDragEnd = () => (
    (_e: React.DragEvent<HTMLLabelElement>) => {
      optionDragStateRef.current = { checklistId: null, draggingChoice: null };
      setOptionDragVisual({ checklistId: null, draggingChoice: null, overChoice: null, position: null, axis: null });
      unlockModalScrollForOptions();
    }
  );

  // Touch handlers for iOS Safari compatibility
  const onOptionTouchStart = (checklistId: string, choice: string, isCustom: boolean) => (
    (e: React.TouchEvent<HTMLLabelElement>) => {
      if (isCustom) return;
      // Do not allow drag to begin from checkbox taps
      const target = e.target as HTMLElement;
      const beganOnCheckbox = target?.tagName === 'INPUT' || !!target.closest('input[type="checkbox"]');
      const touch = e.touches[0];
      optionTouchStateRef.current = {
        isDragging: false, // start as not dragging; wait for threshold
        checklistId,
        draggingChoice: choice,
        startY: touch.clientY,
        startX: touch.clientX,
        currentY: touch.clientY,
        currentX: touch.clientX,
        allowDrag: !beganOnCheckbox,
        dragEl: e.currentTarget as unknown as HTMLElement,
      };
    }
  );

  const onOptionTouchMove = (checklistId: string, templateChoices: string[]) => (
    (e: React.TouchEvent<HTMLDivElement>) => {
      const touchState = optionTouchStateRef.current;
      // Update current coords
      const touch = e.touches[0];
      touchState.currentY = touch.clientY;
      touchState.currentX = touch.clientX;

      // If not yet dragging, check if we crossed the threshold and are allowed to drag
      if (!touchState.isDragging) {
        const dx = Math.abs(touchState.currentX - touchState.startX);
        const dy = Math.abs(touchState.currentY - touchState.startY);
        const movedEnough = Math.max(dx, dy) >= OPTION_TOUCH_DRAG_THRESHOLD;
        if (!movedEnough || !touchState.allowDrag) {
          return; // still a tap/scroll gesture, do nothing
        }
        // Start drag officially
        touchState.isDragging = true;
        optionDragStateRef.current = { checklistId: touchState.checklistId, draggingChoice: touchState.draggingChoice };
        setOptionDragVisual({ checklistId, draggingChoice: touchState.draggingChoice!, overChoice: null, position: null, axis: null });
        // Lock modal scroll hard (also blocks wheel) and set visual
        lockModalScrollForOptions();
        if (touchState.dragEl) {
          try { touchState.dragEl.style.opacity = '0.5'; } catch {}
        }
      }
      // We're dragging now: prevent page scroll via CSS lock and continue
      
      // Find element under touch point
  const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!elementUnderTouch) return;
      
      // Find closest label with data-choice attribute
      const targetLabel = elementUnderTouch.closest('[data-choice]') as HTMLElement;
      if (!targetLabel) return;
      
      const targetChoice = targetLabel.getAttribute('data-choice');
      if (!targetChoice || !templateChoices.includes(targetChoice)) return;
      
      const { draggingChoice } = touchState;
      if (targetChoice === draggingChoice) return;
      
      // Calculate position
      const rect = targetLabel.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const centerX = rect.left + rect.width / 2;
      const distY = Math.abs(touch.clientY - centerY);
      const distX = Math.abs(touch.clientX - centerX);
      const axis: 'horizontal' | 'vertical' = distX >= distY ? 'horizontal' : 'vertical';
      const position: 'before' | 'after' = axis === 'horizontal'
        ? (touch.clientX < centerX ? 'before' : 'after')
        : (touch.clientY < centerY ? 'before' : 'after');
      
      setOptionDragVisual({ 
        checklistId, 
        draggingChoice, 
        overChoice: targetChoice, 
        position, 
        axis 
      });
    }
  );

  const onOptionTouchEnd = (checklistId: string, templateChoices: string[]) => (
    async (e: React.TouchEvent<HTMLLabelElement>) => {
      const touchState = optionTouchStateRef.current;
      // Always cleanup visual if we had a reference
      try { if (touchState.dragEl) touchState.dragEl.style.opacity = '1'; } catch {}
      if (!touchState.isDragging) {
        // Not a drag, just a tap – nothing to reorder
        // Ensure scroll is unlocked in case it was changed elsewhere
  unlockModalScrollForOptions();
        // Reset state below
      } else {
        // Perform drop logic
        const { draggingChoice } = touchState;
        const { overChoice, position } = optionDragVisual;
        
        if (draggingChoice && overChoice && draggingChoice !== overChoice) {
          const list = [...templateChoices];
          const fromIndex = list.indexOf(draggingChoice);
          let toIndex = list.indexOf(overChoice);
          
          if (fromIndex !== -1 && toIndex !== -1) {
            list.splice(fromIndex, 1);
            toIndex = list.indexOf(overChoice);
            if (position === 'after') toIndex += 1;
            list.splice(toIndex, 0, draggingChoice);
            
            await persistOptionOrder(checklistId, list);
          }
        }
      }
      
      optionDragStateRef.current = { checklistId: null, draggingChoice: null };
      setOptionDragVisual({ checklistId: null, draggingChoice: null, overChoice: null, position: null, axis: null });
      
      // Reset state
      optionTouchStateRef.current = {
        isDragging: false,
        checklistId: null,
        draggingChoice: null,
        startY: 0,
        startX: 0,
        currentY: 0,
        currentX: 0,
        allowDrag: true,
        dragEl: null,
      };
      optionDragStateRef.current = { checklistId: null, draggingChoice: null };
      setOptionDragVisual({ checklistId: null, draggingChoice: null, overChoice: null, position: null, axis: null });
    }
  );

  // Touch cancel safety for iOS (e.g., interruption, scroll bounce)
  const onOptionTouchCancel = () => (
    (_e: React.TouchEvent<any>) => {
      if (!optionTouchStateRef.current.isDragging) return;
      // Restore visual and unlock scroll
      try { if (optionTouchStateRef.current.dragEl) optionTouchStateRef.current.dragEl.style.opacity = '1'; } catch {}
  unlockModalScrollForOptions();
      // Reset state
      optionTouchStateRef.current = {
        isDragging: false,
        checklistId: null,
        draggingChoice: null,
        startY: 0,
        startX: 0,
        currentY: 0,
        currentX: 0,
        allowDrag: true,
        dragEl: null,
      };
      optionDragStateRef.current = { checklistId: null, draggingChoice: null };
      setOptionDragVisual({ checklistId: null, draggingChoice: null, overChoice: null, position: null, axis: null });
    }
  );

  // Pointer events fallback (iOS supports PointerEvents) – treat touch pointer as drag
  const onOptionPointerDown = (checklistId: string, choice: string, isCustom: boolean) => (
    (e: React.PointerEvent<HTMLLabelElement>) => {
      if (e.pointerType !== 'touch') return; // only handle touch via pointer events
      if (isCustom) return;
      const target = e.target as HTMLElement;
      const beganOnCheckbox = target?.tagName === 'INPUT' || !!target.closest('input[type="checkbox"]');
      optionTouchStateRef.current = {
        isDragging: false, // wait for threshold like touch logic
        checklistId,
        draggingChoice: choice,
        startY: e.clientY,
        startX: e.clientX,
        currentY: e.clientY,
        currentX: e.clientX,
        allowDrag: !beganOnCheckbox,
        dragEl: e.currentTarget as unknown as HTMLElement,
      };
    }
  );

  const onOptionPointerUp = (checklistId: string, templateChoices: string[]) => (
    async (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'touch') return;
      if (!optionTouchStateRef.current.isDragging) return;
      (e.currentTarget as HTMLElement).style.opacity = '1';
      const draggingChoice = optionTouchStateRef.current.draggingChoice;
      const { overChoice, position } = optionDragVisual;
      if (draggingChoice && overChoice && draggingChoice !== overChoice) {
        const list = [...templateChoices];
        const fromIndex = list.indexOf(draggingChoice);
        let toIndex = list.indexOf(overChoice);
        if (fromIndex !== -1 && toIndex !== -1) {
          list.splice(fromIndex, 1);
          toIndex = list.indexOf(overChoice);
          if (position === 'after') toIndex += 1;
          list.splice(toIndex, 0, draggingChoice);
          await persistOptionOrder(checklistId, list);
        }
      }
      // Unlock scroll and reset state
  unlockModalScrollForOptions();
      optionTouchStateRef.current = {
        isDragging: false,
        checklistId: null,
        draggingChoice: null,
        startY: 0,
        startX: 0,
        currentY: 0,
        currentX: 0,
        allowDrag: true,
        dragEl: null,
      };
      optionDragStateRef.current = { checklistId: null, draggingChoice: null };
      setOptionDragVisual({ checklistId: null, draggingChoice: null, overChoice: null, position: null, axis: null });
    }
  );

  const saveReorder = async (kind: 'status' | 'limitations', section: ISection) => {
    try {
      const sectionId = section._id;
      const currentIds = reorderIds[kind] || [];
      const { templateUpdated } = await persistChecklistOrder(kind, sectionId, currentIds);
      if (templateUpdated) {
        await fetchSections();
      }
      cancelReorder(kind);
    } catch (err: any) {
      alert(err.message || 'Failed to save order');
    }
  };

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

  // Resolve a checklist reference (object or string id) to full metadata from section/template or inspection-only
  const resolveChecklist = (sectionId: string, cl: any): ISectionChecklist | null => {
    if (cl && typeof cl === 'object' && cl._id) return cl as ISectionChecklist;
    const section = sections.find(s => s._id === sectionId);
    const fromTemplate = section?.checklists.find(c => c._id === cl) || null;
    if (fromTemplate) return fromTemplate;
    const fromInspection = (inspectionChecklists.get(sectionId) || []).find(c => c._id === cl) || null;
    return fromInspection;
  };

  // Quick toggle for a selected checklist inside an existing block (outside modal)
  const toggleChecklistInBlock = async (block: IInformationBlock, cl: any) => {
    try {
      const sectionId = typeof block.section_id === 'string' ? block.section_id : block.section_id._id;
      const clId: string = typeof cl === 'string' ? cl : cl._id;

      // Find the section to determine if this is a template item or inspection-only
      const section = sections.find(s => s._id === sectionId);
      const isTemplateItem = !!section?.checklists.some(c => c._id === clId);

      // Helper: backup/restore answers like modal does
      const backupKey = `checklist_backup_${inspectionId}_${clId}`;

      if (isTemplateItem) {
        // Build updated arrays for block
        const currentSelected = Array.isArray(block.selected_checklist_ids) ? block.selected_checklist_ids : [];
        const isCurrentlySelected = currentSelected.some((sel: any) => (typeof sel === 'string' ? sel === clId : sel._id === clId));

        let nextSelected: Array<any> = [];
        if (isCurrentlySelected) {
          // Unselect: remove from selected list
          nextSelected = currentSelected.filter((sel: any) => (typeof sel === 'string' ? sel !== clId : sel._id !== clId));

          // Backup selected answers for this checklist and remove from block
          const existingAnswersArr = Array.isArray(block.selected_answers) ? block.selected_answers : [];
          const answersForId = existingAnswersArr.find(a => a && a.checklist_id === clId);
          if (answersForId && Array.isArray(answersForId.selected_answers) && answersForId.selected_answers.length > 0) {
            localStorage.setItem(backupKey, JSON.stringify(answersForId.selected_answers));
          }
          const cleanedAnswers = existingAnswersArr.filter(a => a && a.checklist_id !== clId);

          // Persist to server
          const body = {
            selected_checklist_ids: nextSelected.map((sel: any) => (typeof sel === 'string' ? sel : sel._id)).filter(Boolean),
            selected_answers: cleanedAnswers,
            custom_text: block.custom_text || '',
            images: Array.isArray(block.images) ? block.images : [],
          };

          const res = await fetch(`/api/information-sections/${inspectionId}?blockId=${block._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || 'Failed to update block');

          // Update local state with server result
          setBlocks(prev => prev.map(b => (b._id === block._id ? json.data : b)));
        } else {
          // Select: add to selected list
          const checklistObj = section?.checklists.find(c => c._id === clId);
          nextSelected = [...currentSelected, checklistObj || clId];

          // Try to restore answers from backup
          const existingAnswersArr = Array.isArray(block.selected_answers) ? block.selected_answers : [];
          let nextAnswers = existingAnswersArr;
          try {
            const backup = localStorage.getItem(backupKey);
            if (backup) {
              const parsed = JSON.parse(backup);
              if (Array.isArray(parsed) && parsed.length > 0) {
                // Merge restored answers (avoid duplicate entry for checklist_id)
                nextAnswers = existingAnswersArr.filter(a => a && a.checklist_id !== clId);
                nextAnswers = [...nextAnswers, { checklist_id: clId, selected_answers: parsed }];
              }
            }
          } catch (e) {
            // ignore backup issues
          }

          // Persist to server
          const body = {
            selected_checklist_ids: nextSelected.map((sel: any) => (typeof sel === 'string' ? sel : sel._id)).filter(Boolean),
            selected_answers: nextAnswers,
            custom_text: block.custom_text || '',
            images: Array.isArray(block.images) ? block.images : [],
          };

          const res = await fetch(`/api/information-sections/${inspectionId}?blockId=${block._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || 'Failed to update block');

          // Update local state with server result
          setBlocks(prev => prev.map(b => (b._id === block._id ? json.data : b)));
        }
      } else {
        // Inspection-only checklist: maintain selection in localStorage only
        const storageKey = `inspection_selections_${inspectionId}_${sectionId}`;
        const raw = localStorage.getItem(storageKey);
        const arr: string[] = raw ? JSON.parse(raw) : [];
        const idx = arr.indexOf(clId);
        if (idx >= 0) {
          arr.splice(idx, 1);
        } else {
          arr.push(clId);
        }
        localStorage.setItem(storageKey, JSON.stringify(arr));
        // Force re-render so getBlockChecklists() re-evaluates
        setBlocks(prev => [...prev]);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to update selection');
    }
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

    // Initialize drag order for Status and Limitations lists on modal open
    try {
      const statusOrdered = [...mergedSection.checklists]
        .filter(cl => cl.type === 'status')
        .sort((a, b) => a.order_index - b.order_index)
        .map(cl => cl._id);
      const limitationsOrdered = [...mergedSection.checklists]
        .filter(cl => cl.tab === 'limitations')
        .sort((a, b) => a.order_index - b.order_index)
        .map(cl => cl._id);
      setReorderIds({ status: statusOrdered, limitations: limitationsOrdered });
      reorderDirtyRef.current = { status: false, limitations: false };
    } catch (e) {
      // Fallback silently if anything goes wrong
    }

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
      // Pre-select any checklist items marked as default_checked in the template/merged section
      const defaultSelectedIds = new Set(
        mergedSection.checklists
          .filter(cl => !!cl.default_checked)
          .map(cl => cl._id)
      );

      // Build default selected answers map from template defaults
      const defaultAnswers = new Map<string, Set<string>>();
      mergedSection.checklists.forEach((cl) => {
        if (cl.default_checked && Array.isArray((cl as any).default_selected_answers) && (cl as any).default_selected_answers.length > 0) {
          defaultAnswers.set(cl._id, new Set((cl as any).default_selected_answers));
        }
      });

      setFormState({
        section_id: section._id,
        selected_checklist_ids: defaultSelectedIds,
        selected_answers: defaultAnswers,
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
      // Unchecking - backup current answers to localStorage before clearing
      setIds.delete(id);
      // If this item was marked as default-checked, uncheck the default toggle too
      const cl = activeSection?.checklists.find(c => c._id === id);
      if (cl?.default_checked) {
        // This will persist to template or local temp checklist item as needed
        toggleDefaultCheckedFor(id, false);
      }
  // Also collapse if it was expanded (Status or Limitations)
      collapseStatus(id);
  collapseLimit(id);
      
      // Backup selected answers for this checklist in localStorage
      const currentAnswers = formState.selected_answers.get(id);
      if (currentAnswers && currentAnswers.size > 0) {
        const backupKey = `checklist_backup_${inspectionId}_${id}`;
        localStorage.setItem(backupKey, JSON.stringify(Array.from(currentAnswers)));
        console.log('💾 Backed up answers to localStorage:', Array.from(currentAnswers));
      }
      
      // Clear from selected_answers
      const newAnswers = new Map(formState.selected_answers);
      newAnswers.delete(id);
      
      const updatedFormState = { 
        ...formState, 
        selected_checklist_ids: setIds, 
        selected_answers: newAnswers
      };
      setFormState(updatedFormState);
      
      // Cancel any pending auto-save and schedule a new one
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        performAutoSaveWithState(updatedFormState);
        autoSaveTimerRef.current = null;
      }, 500);
    } else {
      // Checking - restore from localStorage backup if exists
      setIds.add(id);
      
      // Try to restore answers from localStorage backup
      const backupKey = `checklist_backup_${inspectionId}_${id}`;
      const backupData = localStorage.getItem(backupKey);
      let updatedFormState = { ...formState, selected_checklist_ids: setIds };
      
      if (backupData) {
        try {
          const backedUpAnswers = JSON.parse(backupData);
          if (Array.isArray(backedUpAnswers) && backedUpAnswers.length > 0) {
            // Restore backed-up answers (includes both template AND custom answers)
            const newAnswers = new Map(formState.selected_answers);
            newAnswers.set(id, new Set(backedUpAnswers)); // Restore from localStorage
            updatedFormState = { 
              ...formState, 
              selected_checklist_ids: setIds, 
              selected_answers: newAnswers 
            };
            console.log('♻️ Restored answers from localStorage backup:', backedUpAnswers);
          }
        } catch (e) {
          console.error('Error parsing localStorage backup:', e);
        }
      }
      
      setFormState(updatedFormState);

      // Auto-expand the item's options immediately upon checking
      try {
        const cl = activeSection?.checklists.find(c => c._id === id);
        if (cl) {
          if (cl.type === 'status') {
            expandStatus(id);
          } else {
            // Applies to both limitations and information tabs
            expandLimit(id);
          }
        }
      } catch {}
      
      // Cancel any pending auto-save and schedule a new one
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        performAutoSaveWithState(updatedFormState);
        autoSaveTimerRef.current = null;
      }, 500);
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
      let templateOrderUpdated = false;
      if (activeSection) {
        const sectionId = activeSection._id;
        if (reorderIds.status && reorderIds.status.length && reorderDirtyRef.current.status) {
          const result = await persistChecklistOrder('status', sectionId, reorderIds.status);
          templateOrderUpdated = templateOrderUpdated || result.templateUpdated;
        }
        if (reorderIds.limitations && reorderIds.limitations.length && reorderDirtyRef.current.limitations) {
          const result = await persistChecklistOrder('limitations', sectionId, reorderIds.limitations);
          templateOrderUpdated = templateOrderUpdated || result.templateUpdated;
        }
        if (templateOrderUpdated) {
          await fetchSections();
        }
      }

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
      let templateOrderUpdated = false;
      if (activeSection) {
        const sectionId = activeSection._id;
        if (reorderIds.status && reorderIds.status.length && reorderDirtyRef.current.status) {
          const result = await persistChecklistOrder('status', sectionId, reorderIds.status);
          templateOrderUpdated = templateOrderUpdated || result.templateUpdated;
        }
        if (reorderIds.limitations && reorderIds.limitations.length && reorderDirtyRef.current.limitations) {
          const result = await persistChecklistOrder('limitations', sectionId, reorderIds.limitations);
          templateOrderUpdated = templateOrderUpdated || result.templateUpdated;
        }
        if (templateOrderUpdated) {
          await fetchSections();
        }
      }

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
      // Cleanup scroll interval
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
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

  // Image handling for checklist items (single file)
  const handleImageSelect = async (checklistId: string, file: File) => {
    if (!formState) return;

    console.log('📸 File selected for checklist:', checklistId, 'type:', file.type);

    // Check file size and warn for large files (360° photos)
        const fileSizeMB = file.size / (1024 * 1024);
        // Vercel has a 100MB body size limit on Pro plan, 4.5MB on Hobby
        // Cloudflare has similar limits. Warn at 150MB to avoid upload failures.
        if (fileSizeMB > 150) {
          const proceed = confirm(
            `⚠️ Large file detected (${fileSizeMB.toFixed(1)}MB)\n\n` +
            `Files over 150MB may fail to upload due to server limits.\n` +
            `Recommended: Compress the image before uploading.\n\n` +
            `Tools: TinyPNG, Squoosh, IrfanView, or ImageOptim\n\n` +
            `Continue upload anyway?`
          );
          if (!proceed) return;
        }
        if (fileSizeMB > 200) {
          alert(`File size (${fileSizeMB.toFixed(1)}MB) exceeds the absolute 200MB limit. Please compress the image.`);
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

    // Normalize smartphone EXIF orientation for JPEG/PNG before upload (HEIC handled on server)
    const fixOrientationIfNeeded = async (f: File): Promise<File> => {
      try {
        if (!f.type.startsWith('image/') || /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)) return f;
  // Use ESM build to avoid UMD warning
  const exifr: any = (await import('exifr/dist/full.esm.mjs')) as any;
        const orientation: number | undefined = await exifr.orientation(f);
        if (!orientation || orientation === 1) return f;

        const imgUrl = URL.createObjectURL(f);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = imgUrl;
        });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(imgUrl); return f; }
        const w = img.naturalWidth || img.width; const h = img.naturalHeight || img.height;
        switch (orientation) {
          case 2: canvas.width=w; canvas.height=h; ctx.translate(w,0); ctx.scale(-1,1); break;
          case 3: canvas.width=w; canvas.height=h; ctx.translate(w,h); ctx.rotate(Math.PI); break;
          case 4: canvas.width=w; canvas.height=h; ctx.translate(0,h); ctx.scale(1,-1); break;
          case 5: canvas.width=h; canvas.height=w; ctx.rotate(0.5*Math.PI); ctx.scale(1,-1); ctx.translate(0,-h); break;
          case 6: canvas.width=h; canvas.height=w; ctx.rotate(0.5*Math.PI); ctx.translate(0,-h); break;
          case 7: canvas.width=h; canvas.height=w; ctx.rotate(0.5*Math.PI); ctx.translate(w,-h); ctx.scale(-1,1); break;
          case 8: canvas.width=h; canvas.height=w; ctx.rotate(-0.5*Math.PI); ctx.translate(-w,0); break;
          default: canvas.width=w; canvas.height=h; break;
        }
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(imgUrl);
        const blob: Blob = await new Promise((resolve)=> canvas.toBlob((b)=> resolve(b || new Blob()), 'image/jpeg', 0.95));
        return new File([blob], f.name.replace(/\.(png|jpg|jpeg|webp)$/i,'') + '.jpg', { type: 'image/jpeg' });
      } catch (e) {
        console.warn('EXIF normalize skipped:', e); return f;
      }
    };

    try {
      file = await fixOrientationIfNeeded(file);
      
      // NEW: Direct R2 upload using presigned URL (bypasses Vercel's 4.5MB body limit)
      console.log('🚀 Starting direct R2 upload for file:', file.name, 'size:', file.size);
      
      // Step 1: Get presigned upload URL from server
      const presignedRes = await fetch(
        `/api/r2api?action=presigned&fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
      );
      
      if (!presignedRes.ok) {
        throw new Error('Failed to get presigned upload URL');
      }
      
      const { uploadUrl, publicUrl } = await presignedRes.json();
      console.log('✅ Got presigned URL, uploading directly to R2...');
      
      // Step 2: Upload file DIRECTLY to R2 using presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      
      if (!uploadRes.ok) {
        throw new Error(`Direct R2 upload failed with status ${uploadRes.status}`);
      }
      
      console.log('✅ File uploaded directly to R2:', publicUrl);

      // Check if this should be a 360° photo
      const isThreeSixty = isThreeSixtyMap[checklistId] || false;
      console.log('🔍 360° checkbox state for checklist', checklistId, ':', isThreeSixty);

      // Add image to formState
      const newImage: IBlockImage = {
        url: publicUrl, // Use the public URL from presigned response
        annotations: undefined,
        checklist_id: checklistId,
        isThreeSixty: isThreeSixty, // Include 360° flag
        // We'll reuse the existing image structure; location/annotations remain compatible for video
      };

      console.log('💾 Adding image to formState:', newImage);
      console.log('📸 isThreeSixty field value:', newImage.isThreeSixty);

      // Use functional update to avoid stale state when batching multiple uploads
      let committedState: AddBlockFormState | null = null;
      setFormState(prev => {
        if (!prev) return prev as any;
        const nextState: AddBlockFormState = {
          ...prev,
          images: [...prev.images, newImage],
        };
        committedState = nextState;
        return nextState;
      });

      // DON'T reset the 360° checkbox - keep it checked for multiple uploads
      // User can manually uncheck if they want to upload regular images
      // setIsThreeSixtyMap(prev => ({ ...prev, [checklistId]: false }));

  console.log('✅ FormState updated with new image');
      console.log('📌 Image uploaded successfully. Auto-saving now...');

      // Save immediately with the updated state
      if (committedState) {
        await performAutoSaveWithState(committedState);
      } else if (formState) {
        await performAutoSaveWithState({ ...formState });
      }

    } catch (error: any) {
      console.error('❌ Error uploading file:', error);
      
      // Show user-friendly error message
      const errorMessage = error.message || 'Unknown error occurred';
      if (errorMessage.includes('100MB') || errorMessage.includes('200MB')) {
        alert('File is too large. 360° photos should be compressed to under 200MB for reliable uploads.');
      } else if (errorMessage.includes('File size exceeds')) {
        alert('File size exceeds the limit. Please compress the image or choose a smaller file.');
      } else if (errorMessage.includes('413') || errorMessage.toLowerCase().includes('payload') || errorMessage.toLowerCase().includes('too large')) {
        alert(
          `Upload failed: Server rejected the file (too large).\n\n` +
          `This usually happens with files over 200MB.\n` +
          `Please compress the image using:\n` +
          `• TinyPNG (online)\n` +
          `• Squoosh (online)\n` +
          `• ImageOptim (Mac)\n` +
          `• IrfanView (Windows)\n\n` +
          `Target: Under 10MB for best performance.`
        );
      } else {
        alert(`Failed to upload image/video: ${errorMessage}\n\nFor large files, please compress them to under 200MB.`);
      }
    }
  };

  // New: batch handler for multiple selected files
  const handleImagesSelect = async (checklistId: string, files: File[] | FileList) => {
    const fileArray = Array.from(files || []);
    if (!fileArray.length) return;
    console.log(`📦 ${fileArray.length} file(s) selected for checklist ${checklistId}`);
    // Process sequentially to preserve formState consistency and avoid race conditions
    for (let i = 0; i < fileArray.length; i++) {
      const f = fileArray[i];
      console.log(`⬆️ Uploading ${i + 1}/${fileArray.length}: ${f.name}`);
      // Intentionally await to ensure state updates are serialized
      await handleImageSelect(checklistId, f);
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
        default_checked: !!existingChecklist.default_checked,
      });
    } else {
      setEditingChecklistId(null);
      setChecklistFormData({ 
        text: '', 
        comment: '', 
        type, 
        tab: tab || 'information',
        answer_choices: [],
        default_checked: false,
      });
    }
    setNewAnswerChoice('');
    setEditingAnswerIndex(null);
    setEditingAnswerValue('');
    setChecklistFormOpen(true);
  };

  // Admin: Toggle default_checked with immediate persistence for template items
  const handleDefaultCheckedToggle = async (checked: boolean) => {
    // Update local form state immediately for snappy UI
    setChecklistFormData(prev => ({ ...prev, default_checked: checked }));

    // If turning default ON from the edit modal, ensure the field is selected in current inspection
    if (checked && editingChecklistId && formState && !formState.selected_checklist_ids.has(editingChecklistId)) {
      toggleChecklist(editingChecklistId);
    }

    // If we're editing an existing checklist, persist change
    if (editingChecklistId) {
      const isTemporary = editingChecklistId.startsWith('temp_');
      if (isTemporary) {
        // Update inspection-only (local) checklist instances
        if (activeSection) {
          const sectionId = activeSection._id;
          const currentInspectionChecklists = inspectionChecklists.get(sectionId) || [];
          const updatedInspectionChecklists = currentInspectionChecklists.map(cl =>
            cl._id === editingChecklistId ? { ...cl, default_checked: checked } : cl
          );
          const newInspectionChecklistsMap = new Map(inspectionChecklists);
          newInspectionChecklistsMap.set(sectionId, updatedInspectionChecklists);
          setInspectionChecklists(newInspectionChecklistsMap);

          // Update activeSection immediately
          const updatedChecklists = activeSection.checklists.map(cl =>
            cl._id === editingChecklistId ? { ...cl, default_checked: checked } : cl
          );
          setActiveSection({ ...activeSection, checklists: updatedChecklists });
        }
        return; // Nothing to save to server for temp items
      }

      // Persist to server for template items
      try {
        const res = await fetch(`/api/checklists/${editingChecklistId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ default_checked: checked }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to update');

        // Update local activeSection copy so the change is visible when reopening
        if (activeSection) {
          const updatedChecklists = activeSection.checklists.map(cl =>
            cl._id === editingChecklistId ? { ...cl, default_checked: checked } : cl
          );
          setActiveSection({ ...activeSection, checklists: updatedChecklists });
        }
      } catch (err) {
        console.error('Auto-save default_checked failed:', err);
        alert('Failed to auto-save "Default to checked?". Please try again.');
      }
    }
  };

  // Toggle default_checked from the main Information Block modal for any checklist item
  const toggleDefaultCheckedFor = async (checklistId: string, checked: boolean) => {
    // Update UI immediately
    if (activeSection) {
      const updatedChecklists = activeSection.checklists.map(cl =>
        cl._id === checklistId ? { ...cl, default_checked: checked } : cl
      );
      setActiveSection({ ...activeSection, checklists: updatedChecklists });
    }

    // If turning default ON, ensure the field is selected in the current inspection
    if (checked && formState && !formState.selected_checklist_ids.has(checklistId)) {
      // Reuse existing toggle logic to select and restore any backed up answers
      toggleChecklist(checklistId);
    }

    // If this is an inspection-only temp item, persist only to local state
    if (checklistId.startsWith('temp_')) {
      if (activeSection) {
        const sectionId = activeSection._id;
        const currentInspectionChecklists = inspectionChecklists.get(sectionId) || [];
        const updatedInspectionChecklists = currentInspectionChecklists.map(cl =>
          cl._id === checklistId ? { ...cl, default_checked: checked } : cl
        );
        const newInspectionChecklistsMap = new Map(inspectionChecklists);
        newInspectionChecklistsMap.set(sectionId, updatedInspectionChecklists);
        setInspectionChecklists(newInspectionChecklistsMap);
      }
      return;
    }

    // Persist to server for template items
    try {
      // If turning default ON, capture current selected template answers for this checklist
      let default_selected_answers: string[] | undefined = undefined;
      if (checked && formState && activeSection) {
        const answers = Array.from(formState.selected_answers.get(checklistId) || []);
        const templateChoices = activeSection.checklists.find(cl => cl._id === checklistId)?.answer_choices || [];
        default_selected_answers = answers.filter(a => templateChoices.includes(a));
      }
      // If turning default OFF, clear any stored default_selected_answers
      if (!checked) {
        default_selected_answers = [];
      }

      const res = await fetch(`/api/checklists/${checklistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_checked: checked, default_selected_answers }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to update');
    } catch (err) {
      console.error('Failed to update default_checked:', err);
      alert('Failed to update "Default to checked?". Please try again.');
      // Revert UI on failure
      if (activeSection) {
        const updatedChecklists = activeSection.checklists.map(cl =>
          cl._id === checklistId ? { ...cl, default_checked: !checked } : cl
        );
        setActiveSection({ ...activeSection, checklists: updatedChecklists });
      }
    }
  };

  // Admin: Auto-save checklist text changes
  const handleChecklistTextChange = async (newText: string) => {
    // Update local form state immediately
    setChecklistFormData(prev => ({ ...prev, text: newText }));

    // If we're editing an existing checklist, auto-save after a delay
    if (editingChecklistId && newText.trim()) {
      // Debounce the save to avoid too many API calls
      if (textSaveTimeoutRef.current) {
        clearTimeout(textSaveTimeoutRef.current);
      }
      textSaveTimeoutRef.current = setTimeout(async () => {
        await autoSaveChecklistField('text', newText.trim());
      }, 1000); // Save 1 second after user stops typing
    }
  };

  // Admin: Auto-save checklist comment changes
  const handleChecklistCommentChange = async (newComment: string) => {
    // Update local form state immediately
    setChecklistFormData(prev => ({ ...prev, comment: newComment }));

    // If we're editing an existing checklist, auto-save after a delay
    if (editingChecklistId) {
      // Debounce the save to avoid too many API calls
      if (commentSaveTimeoutRef.current) {
        clearTimeout(commentSaveTimeoutRef.current);
      }
      commentSaveTimeoutRef.current = setTimeout(async () => {
        await autoSaveChecklistField('comment', newComment.trim());
      }, 1000); // Save 1 second after user stops typing
    }
  };

  // Admin: Generic auto-save function for checklist fields
  const autoSaveChecklistField = async (field: string, value: any) => {
    if (!editingChecklistId) return;

    const isTemporary = editingChecklistId.startsWith('temp_');
    
    if (isTemporary) {
      // Update inspection-only (local) checklist instances
      if (activeSection) {
        const sectionId = activeSection._id;
        const currentInspectionChecklists = inspectionChecklists.get(sectionId) || [];
        const updatedInspectionChecklists = currentInspectionChecklists.map(cl =>
          cl._id === editingChecklistId ? { ...cl, [field]: value } : cl
        );
        const newInspectionChecklistsMap = new Map(inspectionChecklists);
        newInspectionChecklistsMap.set(sectionId, updatedInspectionChecklists);
        setInspectionChecklists(newInspectionChecklistsMap);

        // Update activeSection immediately
        const updatedChecklists = activeSection.checklists.map(cl =>
          cl._id === editingChecklistId ? { ...cl, [field]: value } : cl
        );
        setActiveSection({ ...activeSection, checklists: updatedChecklists });
      }
      console.log(`✅ Auto-saved ${field} for inspection-only checklist`);
      return;
    }

    // Persist to server for template items
    try {
      const body: any = {};
      body[field] = value;
      
      const res = await fetch(`/api/checklists/${editingChecklistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to update');

      // Update local activeSection copy so the change is visible when reopening
      if (activeSection) {
        const updatedChecklists = activeSection.checklists.map(cl =>
          cl._id === editingChecklistId ? { ...cl, [field]: value } : cl
        );
        setActiveSection({ ...activeSection, checklists: updatedChecklists });
      }
      console.log(`✅ Auto-saved ${field} to server`);
    } catch (err) {
      console.error(`Auto-save ${field} failed:`, err);
      // Don't show alert for auto-save failures to avoid interrupting user flow
    }
  };

  // Admin: Add new answer choice with auto-save
  const handleAddAnswerChoice = async () => {
    const trimmed = newAnswerChoice.trim();
    if (!trimmed) return;
    
    if (checklistFormData.answer_choices.includes(trimmed)) {
      alert('This option already exists');
      return;
    }

    const updatedChoices = [...checklistFormData.answer_choices, trimmed];
    setChecklistFormData({
      ...checklistFormData,
      answer_choices: updatedChoices
    });
    setNewAnswerChoice('');

    // Auto-save the new answer choices if editing existing checklist
    if (editingChecklistId) {
      await autoSaveChecklistField('answer_choices', updatedChoices);
    }
  };

  // Admin: Start editing an answer choice
  const startEditingAnswer = (index: number) => {
    setEditingAnswerIndex(index);
    setEditingAnswerValue(checklistFormData.answer_choices[index]);
  };

  // Admin: Save edited answer choice with auto-save
  const saveEditedAnswer = async () => {
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

    // Auto-save the updated answer choices if editing existing checklist
    if (editingChecklistId) {
      await autoSaveChecklistField('answer_choices', updatedChoices);
    }
  };

  // Admin: Delete answer choice - show delete options menu
  const deleteAnswerChoice = (index: number) => {
    setDeleteAnswerMenuForIndex(index);
  };

  // Admin: Hide answer choice for this inspection only
  const hideAnswerChoiceForInspection = async (index: number) => {
    // For now, just remove it locally since this is in the edit modal
    // In a full implementation, you might want to track hidden choices separately
    const updatedChoices = checklistFormData.answer_choices.filter((_, i) => i !== index);
    setChecklistFormData({
      ...checklistFormData,
      answer_choices: updatedChoices
    });
    setDeleteAnswerMenuForIndex(null);

    // Auto-save the updated answer choices if editing existing checklist
    if (editingChecklistId) {
      await autoSaveChecklistField('answer_choices', updatedChoices);
    }
  };

  // Admin: Delete answer choice from template permanently
  const deleteAnswerChoiceFromTemplate = async (index: number) => {
    const updatedChoices = checklistFormData.answer_choices.filter((_, i) => i !== index);
    setChecklistFormData({
      ...checklistFormData,
      answer_choices: updatedChoices
    });
    setDeleteAnswerMenuForIndex(null);

    // Auto-save the updated answer choices if editing existing checklist
    if (editingChecklistId) {
      await autoSaveChecklistField('answer_choices', updatedChoices);
    }
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
                answer_choices: checklistFormData.answer_choices,
                default_checked: checklistFormData.default_checked,
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
                answer_choices: checklistFormData.answer_choices,
                default_checked: checklistFormData.default_checked,
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
              default_checked: checklistFormData.default_checked,
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
          // Ensure it appears in the currently displayed order list without reopening modal
          setReorderIds(prev => {
            const isStatus = newChecklist.type === 'status';
            const isLimitation = newChecklist.tab === 'limitations';
            if (isStatus) {
              const current = prev.status && prev.status.length ? [...prev.status] : activeSection.checklists.filter(c => c.type === 'status').sort((a,b)=>a.order_index-b.order_index).map(c=>c._id);
              return { ...prev, status: [...current, newChecklist._id] };
            }
            if (isLimitation) {
              const current = prev.limitations && prev.limitations.length ? [...prev.limitations] : activeSection.checklists.filter(c => c.tab === 'limitations').sort((a,b)=>a.order_index-b.order_index).map(c=>c._id);
              return { ...prev, limitations: [...current, newChecklist._id] };
            }
            return prev;
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
            default_checked: checklistFormData.default_checked,
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
          
          // IMPORTANT: Add to formState.selected_checklist_ids so it appears immediately
          if (formState) {
            const newSelectedIds = new Set(formState.selected_checklist_ids);
            newSelectedIds.add(tempId);
            setFormState({
              ...formState,
              selected_checklist_ids: newSelectedIds
            });
          }

          // Also push into reorderIds for the correct list so it renders in current view immediately
          setReorderIds(prev => {
            const isStatus = newChecklist.type === 'status';
            const isLimitation = newChecklist.tab === 'limitations';
            if (isStatus) {
              const current = prev.status && prev.status.length ? [...prev.status] : activeSection.checklists.filter(c => c.type === 'status').sort((a,b)=>a.order_index-b.order_index).map(c=>c._id);
              return { ...prev, status: [...current, tempId] };
            }
            if (isLimitation) {
              const current = prev.limitations && prev.limitations.length ? [...prev.limitations] : activeSection.checklists.filter(c => c.tab === 'limitations').sort((a,b)=>a.order_index-b.order_index).map(c=>c._id);
              return { ...prev, limitations: [...current, tempId] };
            }
            return prev;
          });
          if (newChecklist.type === 'status') {
            reorderDirtyRef.current.status = true;
          }
          if (newChecklist.tab === 'limitations') {
            reorderDirtyRef.current.limitations = true;
          }
          
          console.log('✅ Added inspection-only checklist:', tempId);
          console.log('💾 Will be saved to localStorage for this inspection only');
        }
      }

      setChecklistFormOpen(false);
      setEditingChecklistId(null);
      setChecklistFormData({ text: '', comment: '', type: 'status', tab: 'information', answer_choices: [], default_checked: false });
      setNewAnswerChoice('');
      setEditingAnswerIndex(null);
      setEditingAnswerValue('');
      setDeleteAnswerMenuForIndex(null);
      // Clear any pending auto-save timers
      if (textSaveTimeoutRef.current) {
        clearTimeout(textSaveTimeoutRef.current);
        textSaveTimeoutRef.current = null;
      }
      if (commentSaveTimeoutRef.current) {
        clearTimeout(commentSaveTimeoutRef.current);
        commentSaveTimeoutRef.current = null;
      }
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
      if (!confirm('Remove this inspection-only item? It will be deleted only from this inspection.')) return;
      if (!activeSection) return;
      const currentInspectionChecklists = inspectionChecklists.get(activeSection._id) || [];
      const updatedInspectionChecklists = currentInspectionChecklists.filter(cl => cl._id !== checklistId);
      const newInspectionChecklistsMap = new Map(inspectionChecklists);
      if (updatedInspectionChecklists.length > 0) newInspectionChecklistsMap.set(activeSection._id, updatedInspectionChecklists); else newInspectionChecklistsMap.delete(activeSection._id);
      setInspectionChecklists(newInspectionChecklistsMap);
      setActiveSection({ ...activeSection, checklists: activeSection.checklists.filter(cl => cl._id !== checklistId) });
      console.log('✅ Deleted inspection-only checklist:', checklistId);
    } else {
      // For template items, show two explicit choices via inline menu
      setDeleteMenuForId(checklistId);
    }
  };

  // Execute the global template delete (with confirm)
  const performGlobalChecklistDelete = async (checklistId: string) => {
    if (!confirm('Delete from template? This removes the item from ALL inspections.')) return;
    try {
      const res = await fetch(`/api/checklists/${checklistId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete checklist');
      
      // Update sections data
      await fetchSections();
      
      // IMMEDIATELY UPDATE activeSection to reflect the deletion in the current modal
      if (activeSection) {
        const updatedChecklists = activeSection.checklists.filter(cl => cl._id !== checklistId);
        setActiveSection({
          ...activeSection,
          checklists: updatedChecklists
        });
        
        // Update reorderIds to remove the deleted item
        setReorderIds(prev => ({
          status: prev.status.filter(id => id !== checklistId),
          limitations: prev.limitations.filter(id => id !== checklistId)
        }));
        
        // Also remove from formState if it was selected
        if (formState && formState.selected_checklist_ids.has(checklistId)) {
          const newSelectedIds = new Set(formState.selected_checklist_ids);
          newSelectedIds.delete(checklistId);
          const newAnswers = new Map(formState.selected_answers);
          newAnswers.delete(checklistId);
          setFormState({
            ...formState,
            selected_checklist_ids: newSelectedIds,
            selected_answers: newAnswers
          });
        }
        
        console.log('✅ Template checklist deleted and UI updated immediately');
      }
      
      // Also close any open menu
      setDeleteMenuForId(null);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const sectionBlocks = (sectionId: string) =>
    blocks.filter(b => (typeof b.section_id === 'string' ? b.section_id === sectionId : (b.section_id as ISection)._id === sectionId));

  // Helper: Section is complete ONLY when ALL Status fields for that section
  // (template + inspection-only) are either selected in some block OR hidden.
  // Limitations/Information do NOT affect completion.
  const isSectionComplete = useCallback((sectionId: string): boolean => {
    const sectionBlocksList = sectionBlocks(sectionId);
    if (sectionBlocksList.length === 0) return false;

    // Build the complete set of Status checklist IDs for this section
    const sectionObj = sections.find(s => s._id === sectionId);
    const templateStatusIds = (sectionObj?.checklists || [])
      .filter(cl => cl.type === 'status')
      .map(cl => cl._id);
    const inspectionStatusIds = (inspectionChecklists.get(sectionId) || [])
      .filter(cl => cl.type === 'status')
      .map(cl => cl._id);
    const allStatusIds = Array.from(new Set([...
      templateStatusIds, ...inspectionStatusIds
    ]));

    // If there are no status fields in the section, treat as incomplete
    if (allStatusIds.length === 0) return false;

    // Union of all selected checklist IDs across all blocks in this section
    const selectedIds = new Set<string>();
    for (const block of sectionBlocksList) {
      const raw = getBlockChecklists(block);
      for (const entry of raw) {
        const id = typeof entry === 'string' ? entry : entry?._id;
        if (id) selectedIds.add(id);
      }
    }

    // Hidden items for this inspection (count as satisfied)
    const hiddenIds = new Set<string>(getHiddenIdsForSection(sectionId) || []);

    // Completion rule: every Status ID must be either selected somewhere or hidden
    return allStatusIds.every(id => selectedIds.has(id) || hiddenIds.has(id));
  }, [blocks, inspectionChecklists, sections]);

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
        {sections.map(section => {
          const isComplete = isSectionComplete(section._id);
          
          return (
          <div key={section._id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '1rem', backgroundColor: 'white', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ fontWeight: 500, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                {/* Spectora-style completion indicator: empty circle or green checkmark */}
                <span style={{ 
                  fontSize: '1rem',
                  color: isComplete ? '#22c55e' : '#d1d5db',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  marginRight: '0.25rem'
                }}>
                  {isComplete ? '✓' : '○'}
                </span>
                <span style={{ color: isComplete ? '#22c55e' : '#374151' }}>
                  {section.name}
                </span>
              </h3>
              {/* Header-level Add button removed by request; users can use per-block Add or the empty-state button below */}
            </div>

            {/* Existing blocks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {loadingBlocks && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading blocks...</div>}
              {sectionBlocks(section._id).map(block => (
                <div key={block._id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.25rem', padding: '0.75rem', backgroundColor: '#f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Selected Items:</div>
                    {!isMobile && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => openAddModal(section, block)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            borderRadius: '0.25rem',
                            backgroundColor: '#a466da',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#934ad3'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#a466da'}
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
                    )}
                  </div>
                  {isMobile && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <button
                        onClick={() => openAddModal(section)}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          fontSize: '0.9rem',
                          borderRadius: '0.5rem',
                          backgroundColor: '#8230c9',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          boxShadow: '0 2px 8px rgba(130,48,201,0.25)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#6f29ac'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8230c9'}
                      >
                        Add Information Block
                      </button>
                      <button
                        onClick={() => openAddModal(section, block)}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          fontSize: '0.9rem',
                          borderRadius: '0.5rem',
                          backgroundColor: '#a466da',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          boxShadow: '0 2px 8px rgba(164,102,218,0.25)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#934ad3'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#a466da'}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(block._id)}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          fontSize: '0.9rem',
                          borderRadius: '0.5rem',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          boxShadow: '0 2px 8px rgba(239,68,68,0.25)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                    <div style={{ marginLeft: '0rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {(() => {
                        const sectionId = typeof block.section_id === 'string' ? block.section_id : block.section_id._id;
                        const rawItems = getBlockChecklists(block);
                        // Resolve to full objects so we can reliably read type/tab/text/comment
                        const resolved = rawItems
                          .map((cl: any) => resolveChecklist(sectionId, cl))
                          .filter(Boolean) as ISectionChecklist[];
                        // Split into Status and Other (Limitations/Information)
                        const statusItems = resolved.filter(item => item.type === 'status');
                        const otherItems = resolved.filter(item => item.type !== 'status');

                        return (
                          <>
                            {/* Status items displayed in a compact 2-column grid to save space */}
                            {statusItems.length > 0 && (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                                  gap: '0.5rem 1rem',
                                  paddingBottom: otherItems.length ? '0.5rem' : 0,
                                  borderBottom: otherItems.length ? '1px solid #f1f5f9' : 'none'
                                }}
                              >
                                {statusItems.map(item => (
                                  <div key={item._id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <input
                                        type="checkbox"
                                        checked={true}
                                        readOnly
                                        aria-readonly="true"
                                        style={{ width: '18px', height: '18px', cursor: 'default', accentColor: '#3b82f6', flexShrink: 0 }}
                                        title="Maintenance Item (selected)"
                                      />
                                      <span style={{ fontWeight: 600, color: '#111827', lineHeight: 1.45, whiteSpace: 'normal' }}>{item.text}</span>
                                    </div>
                                    {item.comment && item.comment.trim() !== '' && (
                                      <div style={{ marginLeft: '2rem', color: '#6b7280', fontSize: '0.8125rem', lineHeight: 1.6 }} title={item.comment}>
                                        {item.comment.length > 150 ? item.comment.slice(0, 150) + '…' : item.comment}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Limitations / Information remain full width list */}
                            {otherItems.map(item => (
                              <div key={item._id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: isMobile ? '0.5rem' : '0.625rem',
                                  flexDirection: 'row',
                                  flexWrap: 'wrap'
                                }}>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    backgroundColor: '#f59e0b',
                                    color: 'white',
                                    fontWeight: 600,
                                    textTransform: 'capitalize' as const,
                                    flexShrink: 0,
                                    lineHeight: 1.2,
                                    minWidth: isMobile ? undefined : '120px',
                                    textAlign: isMobile ? 'left' : 'center',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    {item.tab === 'limitations' ? 'Limitation' : 'Information'}
                                  </span>
                                  <span style={{ fontWeight: 600, color: '#111827', lineHeight: 1.45, whiteSpace: 'normal', flex: 1, minWidth: 0 }}>{item.text}</span>
                                </div>
                                {item.comment && item.comment.trim() !== '' && (
                                  <div style={{ 
                                    marginLeft: isMobile ? 0 : '8.125rem',
                                    color: '#6b7280',
                                    fontSize: '0.8125rem',
                                    paddingTop: '0.125rem',
                                    lineHeight: 1.6,
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-word'
                                  }} title={item.comment}>
                                    {item.comment.length > 150 ? item.comment.slice(0, 150) + '…' : item.comment}
                                  </div>
                                )}
                              </div>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                    {block.custom_text && (
                      <div style={{ marginTop: '0.5rem' }}><span style={{ fontWeight: 600 }}>Custom Text:</span> {block.custom_text}</div>
                    )}
                    {isMobile && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button
                          onClick={() => openAddModal(section, block)}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            fontSize: '0.9rem',
                            borderRadius: '0.5rem',
                            backgroundColor: '#a466da',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 8px rgba(164,102,218,0.25)'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#934ad3'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#a466da'}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(block._id)}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            fontSize: '0.9rem',
                            borderRadius: '0.5rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 8px rgba(239,68,68,0.25)'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sectionBlocks(section._id).length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>No information blocks yet.</div>
                  <button
                    onClick={() => openAddModal(section)}
                    style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', borderRadius: '0.5rem', backgroundColor: '#8230c9', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(130,48,201,0.2)' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#6f29ac'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8230c9'}
                  >
                    Add Information Block
                  </button>
                </div>
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
              <button onClick={() => { setModalOpen(false); setActiveSection(null); setEditingBlockId(null); setDeleteMenuForId(null); setDeleteAnswerMenuForIndex(null); }} style={{ color: '#6b7280', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.25rem' }}>✕</button>
            </div>
            <div
              ref={modalScrollContainerRef}
              style={{
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
                      <h5 style={{ fontWeight: 600, fontSize: '1rem', color: '#1f2937', borderBottom: '2px solid #a466da', paddingBottom: '0.5rem', flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                  {(reorderIds.status && reorderIds.status.length
                      ? reorderIds.status.map(id => activeSection.checklists.find(c => c._id === id)).filter(Boolean) as ISectionChecklist[]
                      : activeSection.checklists.filter(cl => cl.type === 'status'))
                    .filter(cl => !isChecklistHidden(activeSection._id, cl._id))
                    .map(cl => {
                      const isSelected = formState.selected_checklist_ids.has(cl._id);
                      const checklistImages = getChecklistImages(cl._id);

                      return (
                        <div
                          key={cl._id}
                          draggable={true}
                          onDragStart={onDragStartItem('status', cl._id)}
                          onDragOver={onDragOverItem('status', cl._id)}
                          onDrop={onDropItem('status', cl._id)}
                          onDragEnd={onDragEndItem()}
                          onTouchStart={onItemTouchStart('status', cl._id)}
                          onTouchMove={onItemTouchMove('status')}
                          onTouchEnd={onItemTouchEnd('status')}
                          onTouchCancel={onItemTouchCancel()}
                          onPointerDown={onItemPointerDown('status', cl._id)}
                          onPointerUp={onItemPointerUp('status')}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '0.25rem',
                            backgroundColor: dragVisual.draggingId === cl._id ? '#eef2ff' : (isSelected ? '#eff6ff' : 'transparent'),
                            border: `1px solid ${dragVisual.draggingId === cl._id ? '#a466da' : '#e5e7eb'}`,
                            boxShadow: dragVisual.draggingId === cl._id ? '0 2px 8px rgba(59,130,246,0.20)' : 'none',
                            cursor: dragVisual.draggingId === cl._id ? 'grabbing' : 'grab',
                            transition: 'box-shadow 120ms ease, background-color 120ms ease, border-color 120ms ease',
                            position: 'relative',
                            touchAction: 'manipulation'
                          }}
                          data-item-id={cl._id}
                        >
                          {/* Insertion line indicator - BEFORE */}
                          {dragVisual.overId === cl._id && dragVisual.draggingId !== cl._id && dragVisual.position === 'before' && (
                            <div style={{ 
                              position: 'absolute', 
                              top: '-2px', 
                              left: '0', 
                              right: '0', 
                              height: '3px', 
                              backgroundColor: '#a466da',
                              borderRadius: '2px',
                              boxShadow: '0 0 4px rgba(59,130,246,0.5)',
                              zIndex: 10,
                              pointerEvents: 'none'
                            }} />
                          )}
                          
                          {/* Insertion line indicator - AFTER */}
                          {dragVisual.overId === cl._id && dragVisual.draggingId !== cl._id && dragVisual.position === 'after' && (
                            <div style={{ 
                              position: 'absolute', 
                              bottom: '-2px', 
                              left: '0', 
                              right: '0', 
                              height: '3px', 
                              backgroundColor: '#a466da',
                              borderRadius: '2px',
                              boxShadow: '0 0 4px rgba(59,130,246,0.5)',
                              zIndex: 10,
                              pointerEvents: 'none'
                            }} />
                          )}
                          
                          {/* Header - selection checkbox + title row (click to expand when collapsed) */}
                          <div style={{ display: 'flex', fontSize: '0.875rem', alignItems: 'flex-start', gap: '0.625rem', padding: '0.125rem 0' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleChecklist(cl._id)}
                              style={{ marginTop: '0.25rem', cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}
                              onClick={() => { if (isSelected && !isStatusExpanded(cl._id)) { expandStatus(cl._id); } }}
                              role="button"
                              title={isSelected ? (isStatusExpanded(cl._id) ? 'Expanded' : 'Click to expand') : 'Select the checkbox to enable'}
                            >
                              <div style={{ fontWeight: 500, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem', lineHeight: 1.5 }}>
                                <span style={{ cursor: 'grab', color: '#9ca3af', fontSize: '1rem', flexShrink: 0 }}>⋮⋮</span> 
                                <span style={{ flex: 1 }}>{cl.text}</span>
                                {isSelected && isStatusExpanded(cl._id) && (
                                  <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); collapseStatus(cl._id); }}
                                    title="Collapse"
                                    style={{
                                      backgroundColor: 'transparent',
                                      border: '2px solid #d1d5db',
                                      color: '#6b7280',
                                      cursor: 'pointer',
                                      fontSize: '1rem',
                                      fontWeight: 700,
                                      padding: '0.15rem 0.4rem',
                                      borderRadius: '0.25rem'
                                    }}
                                  >
                                    ✕
                                  </button>
                                )}
                                {!isMobile && (
                                  <label
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#4b5563', cursor: 'default' }}
                                    title="When enabled and saved to the template, new inspections will start with this item pre-selected"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!cl.default_checked}
                                      onChange={(e) => { e.stopPropagation(); toggleDefaultCheckedFor(cl._id, e.target.checked); }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                    />
                                    Default to checked?
                                  </label>
                                )}
                              </div>
                              {isMobile && (
                                <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {isSelected && isStatusExpanded(cl._id) && (
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); collapseStatus(cl._id); }}
                                      title="Collapse"
                                      style={{
                                        backgroundColor: 'transparent',
                                        border: '2px solid #d1d5db',
                                        color: '#6b7280',
                                        cursor: 'pointer',
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '0.25rem'
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                  <label
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#4b5563', cursor: 'default' }}
                                    title="When enabled and saved to the template, new inspections will start with this item pre-selected"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!cl.default_checked}
                                      onChange={(e) => { e.stopPropagation(); toggleDefaultCheckedFor(cl._id, e.target.checked); }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                    />
                                    Default to checked?
                                  </label>
                                </div>
                              )}
                              {cl.comment && (
                                <div style={{ marginLeft: '0.5rem', marginTop: '0.375rem', color: '#6b7280', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                                  {cl.comment.length > 150 ? cl.comment.slice(0, 150) + '…' : cl.comment}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.375rem', marginLeft: '0.5rem', position: 'relative', flexShrink: 0 }} onClick={(e) => e.preventDefault()}>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openChecklistForm('status', cl);
                                }}
                                style={{
                                  padding: '0.3rem 0.45rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '0.25rem',
                                  backgroundColor: '#f59e0b',
                                  color: 'white',
                                  border: 'none',
                                  cursor: 'pointer',
                                  lineHeight: 1
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
                                  padding: '0.3rem 0.45rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '0.25rem',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  cursor: 'pointer',
                                  lineHeight: 1
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                                title="Delete checklist"
                              >
                                🗑️
                              </button>
                              {/* Inline delete options menu for template items */}
                              {deleteMenuForId === cl._id && !cl._id.startsWith('temp_') && (
                                <div style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '0.375rem',
                                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                  padding: '0.5rem',
                                  zIndex: 10,
                                  width: '240px'
                                }}>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>Delete Options</div>
                                  <div style={{ fontSize: '0.75rem', color: '#374151', marginBottom: '0.5rem' }}>Choose how to remove this item:</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {activeSection && (
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (!activeSection) return;
                                          hideChecklistForInspection(activeSection._id, cl._id);
                                          setDeleteMenuForId(null);
                                        }}
                                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem', backgroundColor: '#f59e0b', color: 'white', border: 'none', cursor: 'pointer' }}
                                      >
                                        Hide in this inspection
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); performGlobalChecklistDelete(cl._id); }}
                                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem', backgroundColor: '#ef4444', color: 'white', border: 'none', cursor: 'pointer' }}
                                    >
                                      Delete from template (all)
                                    </button>
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteMenuForId(null); }}
                                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem', backgroundColor: '#e5e7eb', color: '#111827', border: 'none', cursor: 'pointer' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Content area - NOT clickable to toggle */}
                          <div>
                                {/* Expanded details: answers and custom answer input */}
                                {isSelected && isStatusExpanded(cl._id) && (
                                  <>
                                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                                      {getAllAnswers(cl._id, cl.answer_choices || []).length > 0 && (() => {
                                        const templateChoices = cl.answer_choices || [];
                                        return (
                                          <>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.5rem' }}>
                                              Select Options:
                                            </div>
                                            <div
                                              className="checklist-options-grid"
                                              onTouchMove={onOptionTouchMove(cl._id, templateChoices)}
                                              onTouchCancel={onOptionTouchCancel()}
                                              onPointerUp={onOptionPointerUp(cl._id, templateChoices)}
                                              style={{ touchAction: optionTouchStateRef.current.isDragging ? 'none' : 'manipulation', overscrollBehavior: 'contain' }}
                                            >
                                              {getAllAnswers(cl._id, cl.answer_choices || []).map((choice, idx) => {
                                                const selectedAnswers = getSelectedAnswers(cl._id);
                                                const isAnswerSelected = selectedAnswers.has(choice);
                                                const isCustom = isCustomAnswer(cl._id, choice, cl.answer_choices || []);
                                                return (
                                                  <label 
                                                    key={idx}
                                                    data-choice={choice}
                                                    style={{ 
                                                      display: 'flex', 
                                                      alignItems: 'center',
                                                      gap: '0.4rem',
                                                      padding: '0.4rem 0.5rem',
                                                      borderRadius: '0.25rem',
                                                      backgroundColor: isAnswerSelected ? '#dbeafe' : '#f9fafb',
                                                      border: `1px solid ${isAnswerSelected ? '#a466da' : '#e5e7eb'}`,
                                                      cursor: 'pointer',
                                                      fontSize: '0.75rem',
                                                      transition: 'all 0.15s ease',
                                                      position: 'relative',
                                                      touchAction: optionTouchStateRef.current.isDragging ? 'none' : 'auto',
                                                      WebkitTapHighlightColor: 'transparent',
                                                      color: isAnswerSelected ? '#111827' : '#374151'
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
                                                    draggable={!isCustom}
                                                    onDragStart={onOptionDragStart(cl._id, choice, isCustom)}
                                                    onDragOver={onOptionDragOver(cl._id, choice, isCustom)}
                                                    onDrop={onOptionDrop(cl._id, choice, isCustom, templateChoices)}
                                                    onDragEnd={onOptionDragEnd()}
                                                    onTouchStart={onOptionTouchStart(cl._id, choice, isCustom)}
                                                    onTouchEnd={onOptionTouchEnd(cl._id, templateChoices)}
                                                    onPointerDown={onOptionPointerDown(cl._id, choice, isCustom)}
                                                  >
                                                    {/* Insertion line indicators for options */}
                                                    {optionDragVisual.checklistId === cl._id && optionDragVisual.draggingChoice !== choice && optionDragVisual.overChoice === choice && !isCustom && optionDragVisual.axis === 'vertical' && optionDragVisual.position === 'before' && (
                                                      <div style={{ position: 'absolute', top: '-2px', left: 0, right: 0, height: '3px', backgroundColor: '#8230c9', borderRadius: '2px', boxShadow: '0 0 4px rgba(130,48,201,0.5)', pointerEvents: 'none' }} />
                                                    )}
                                                    {optionDragVisual.checklistId === cl._id && optionDragVisual.draggingChoice !== choice && optionDragVisual.overChoice === choice && !isCustom && optionDragVisual.axis === 'vertical' && optionDragVisual.position === 'after' && (
                                                      <div style={{ position: 'absolute', bottom: '-2px', left: 0, right: 0, height: '3px', backgroundColor: '#8230c9', borderRadius: '2px', boxShadow: '0 0 4px rgba(130,48,201,0.5)', pointerEvents: 'none' }} />
                                                    )}
                                                    {optionDragVisual.checklistId === cl._id && optionDragVisual.draggingChoice !== choice && optionDragVisual.overChoice === choice && !isCustom && optionDragVisual.axis === 'horizontal' && optionDragVisual.position === 'before' && (
                                                      <div style={{ position: 'absolute', left: '-2px', top: 0, bottom: 0, width: '3px', backgroundColor: '#8230c9', borderRadius: '2px', boxShadow: '0 0 4px rgba(130,48,201,0.5)', pointerEvents: 'none' }} />
                                                    )}
                                                    {optionDragVisual.checklistId === cl._id && optionDragVisual.draggingChoice !== choice && optionDragVisual.overChoice === choice && !isCustom && optionDragVisual.axis === 'horizontal' && optionDragVisual.position === 'after' && (
                                                      <div style={{ position: 'absolute', right: '-2px', top: 0, bottom: 0, width: '3px', backgroundColor: '#8230c9', borderRadius: '2px', boxShadow: '0 0 4px rgba(130,48,201,0.5)', pointerEvents: 'none' }} />
                                                    )}
                                                    <input
                                                      type="checkbox"
                                                      checked={isAnswerSelected}
                                                      onChange={() => toggleAnswer(cl._id, choice)}
                                                      style={{ cursor: 'pointer' }}
                                                      onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <span style={{ color: isAnswerSelected ? '#111827' : '#374151', userSelect: 'none', flex: 1 }}>
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
                                                    {!isCustom && (
                                                      <span title="Drag to reorder" style={{ fontSize: '0.9rem', color: '#9ca3af', cursor: 'grab' }}>⋮⋮</span>
                                                    )}
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          </>
                                        );
                                      })()}

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
                                              backgroundColor: '#a466da',
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
                                  </>
                                )}

                          {/* Image upload section - show only when item is selected and expanded */}
                          {isSelected && isStatusExpanded(cl._id) && (
                            <div style={{ marginTop: '0.75rem', marginLeft: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                              {/* Replaced 360° banner and tips with a compact button + upload actions in a 2x2 grid */}
                              <div style={{ marginBottom: '0.5rem' }}>
                                <FileUpload
                                  onFilesSelect={(files) => handleImagesSelect(cl._id, files)}
                                  id={`file-upload-${cl._id}`}
                                  labels={{ upload: 'Upload', photo: 'Photo', video: 'Video' }}
                                  layoutColumns={2}
                                  extraButtons={[
                                    (
                                      <button
                                        key={`btn-360-${cl._id}`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setIsThreeSixtyMap(prev => ({ ...prev, [cl._id]: !prev[cl._id] }));
                                        }}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '0.5rem',
                                          padding: '0.55rem 0.75rem',
                                          backgroundColor: isThreeSixtyMap[cl._id] ? '#ef4444' : 'transparent',
                                          color: isThreeSixtyMap[cl._id] ? '#ffffff' : '#ef4444',
                                          borderRadius: '0.375rem',
                                          cursor: 'pointer',
                                          fontSize: '0.85rem',
                                          fontWeight: 700,
                                          border: `1px solid #ef4444`,
                                          transition: 'background-color 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s',
                                          whiteSpace: 'nowrap',
                                          width: '100%',
                                          minHeight: '42px',
                                          boxShadow: isThreeSixtyMap[cl._id] ? '0 1px 2px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)'
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isThreeSixtyMap[cl._id]) {
                                            e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)';
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = isThreeSixtyMap[cl._id] ? '#ef4444' : 'transparent';
                                        }}
                                        aria-pressed={isThreeSixtyMap[cl._id] ? 'true' : 'false'}
                                        title="Toggle 360° picture"
                                      >
                                        <span
                                          aria-hidden
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '9999px',
                                            border: isThreeSixtyMap[cl._id] ? '2px solid #ffffff' : '2px solid #ef4444',
                                            backgroundColor: isThreeSixtyMap[cl._id] ? '#ffffff' : 'transparent',
                                            color: '#ef4444',
                                            fontSize: '0.8rem',
                                            fontWeight: 900,
                                            lineHeight: 1
                                          }}
                                        >
                                          {isThreeSixtyMap[cl._id] ? '✓' : ''}
                                        </span>
                                        <span>360° Picture</span>
                                      </button>
                                    )
                                  ]}
                                />
                              </div>

                              {/* Display existing images */}
                              {checklistImages.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                                  {checklistImages.map((img, idx) => {
                                    // Generate preview URL - handle both string URLs and File objects
                                    const getPreviewUrl = (imgData: any) => {
                                      console.log('🖼️ Image data:', imgData);
                                      console.log('🔍 URL type:', typeof imgData.url);
                                      console.log('📦 URL value:', imgData.url);
                                      
                                      if (typeof imgData.url === 'string') {
                                        // String URL from database - use proxy
                                        const proxied = getProxiedSrc(imgData.url);
                                        console.log('✅ String URL proxied:', proxied);
                                        return proxied;
                                      } else if (imgData.url && typeof imgData.url === 'object' && imgData.url instanceof File) {
                                        // File object - create blob URL
                                        const blobUrl = URL.createObjectURL(imgData.url);
                                        console.log('✅ File object blob URL:', blobUrl);
                                        return blobUrl;
                                      }
                                      console.warn('⚠️ No valid URL found');
                                      return '';
                                    };
                                    
                                    const previewUrl = getPreviewUrl(img);
                                    console.log('🎨 Final preview URL:', previewUrl);
                                    const isVideo = /\.(mp4|mov|webm|3gp|3gpp|m4v)(\?.*)?$/i.test(previewUrl);
                                    
                                    return (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '180px' }}>
                                      <div style={{ position: 'relative', width: '180px', height: '180px', borderRadius: '0.375rem', overflow: 'hidden', border: '2px solid #a466da' }}>
                                        {isVideo ? (
                                          <video
                                            src={previewUrl}
                                            controls
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' }}
                                          />
                                        ) : previewUrl ? (
                                          <img
                                            src={previewUrl}
                                            alt={`Image ${idx + 1}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => {
                                              console.error('Image preview failed:', previewUrl);
                                              (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                          />
                                        ) : (
                                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', color: '#9ca3af' }}>
                                            No preview
                                          </div>
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

                                      {/* Location Smart Search */}
                                      <div style={{ position: 'relative', width: '180px' }}>
                                        <LocationSearch
                                          options={LOCATION_OPTIONS}
                                          value={locationInputs[`${cl._id}-${idx}`] ?? img.location ?? ''}
                                          onChangeAction={(newLocation) => {
                                            const inputKey = `${cl._id}-${idx}`;
                                            setLocationInputs(prev => ({ ...prev, [inputKey]: newLocation }));
                                            const checklistImages = formState.images.filter(i => i.checklist_id === cl._id);
                                            const imageToUpdate = checklistImages[idx];
                                            const updatedImages = formState.images.map(i => i === imageToUpdate ? { ...i, location: newLocation } : i);
                                            const updatedFormState = { ...formState, images: updatedImages };
                                            setFormState(updatedFormState);
                                            setTimeout(() => performAutoSaveWithState(updatedFormState), 100);
                                          }}
                                          placeholder="Select Location"
                                          width={180}
                                        />
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
                                          const imageUrl = typeof img.url === 'string' ? img.url : previewUrl;
                                          const editorUrl = `/image-editor?imageUrl=${encodeURIComponent(imageUrl)}&returnTo=${encodeURIComponent(window.location.pathname)}&checklistId=${cl._id}&inspectionId=${inspectionId}`;
                                          router.push(editorUrl);
                                        }}
                                        style={{
                                          padding: '0.5rem 0.75rem',
                                          fontSize: '0.75rem',
                                          borderRadius: '0.25rem',
                                          backgroundColor: '#a466da',
                                          color: 'white',
                                          border: 'none',
                                          cursor: 'pointer',
                                          width: '180px',
                                          fontWeight: 600
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#934ad3'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#a466da'}
                                        title="Annotate image with arrows, circles, and highlights"
                                      >
                                        🖊️ Annotate
                                      </button>
                                    </div>
                                  )})}
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
                  {/* Hidden manager for Status */}
                  {showHiddenManagerStatus && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.375rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Hidden items (this inspection only)</div>
                      {(() => {
                        const hiddenIds = getHiddenIdsForSection(activeSection._id);
                        const hiddenItems = activeSection.checklists.filter(cl => cl.type === 'status' && hiddenIds.includes(cl._id));
                        if (hiddenItems.length === 0) return <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>No hidden status items.</div>;
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {hiddenItems.map(item => (
                              <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
                                <span style={{ fontSize: '0.85rem', color: '#374151' }}>{item.text}</span>
                                <button
                                  onClick={() => unhideChecklistForInspection(activeSection._id, item._id)}
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '0.25rem', backgroundColor: '#10b981', color: 'white', border: 'none', cursor: 'pointer' }}
                                >Unhide</button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Limitations/Information Section */}
              <div>
                {(() => {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <h5 style={{ fontWeight: 600, fontSize: '1rem', color: '#1f2937', borderBottom: '2px solid #10b981', paddingBottom: '0.5rem', flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                  {(reorderIds.limitations && reorderIds.limitations.length
                      ? reorderIds.limitations.map(id => activeSection.checklists.find(c => c._id === id)).filter(Boolean) as ISectionChecklist[]
                      : activeSection.checklists.filter(cl => cl.tab === 'limitations'))
                    .filter(cl => !isChecklistHidden(activeSection._id, cl._id))
                    .map(cl => {
                      const isSelected = formState.selected_checklist_ids.has(cl._id);
                      const checklistImages = getChecklistImages(cl._id);

                      return (
                        <div
                          key={cl._id}
                          draggable={true}
                          onDragStart={onDragStartItem('limitations', cl._id)}
                          onDragOver={onDragOverItem('limitations', cl._id)}
                          onDrop={onDropItem('limitations', cl._id)}
                          onDragEnd={onDragEndItem()}
                          onTouchStart={onItemTouchStart('limitations', cl._id)}
                          onTouchMove={onItemTouchMove('limitations')}
                          onTouchEnd={onItemTouchEnd('limitations')}
                          onTouchCancel={onItemTouchCancel()}
                          onPointerDown={onItemPointerDown('limitations', cl._id)}
                          onPointerUp={onItemPointerUp('limitations')}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '0.25rem',
                            backgroundColor: dragVisual.draggingId === cl._id ? '#ecfdf5' : (isSelected ? '#f0fdf4' : 'transparent'),
                            border: `1px solid ${dragVisual.draggingId === cl._id ? '#10b981' : '#e5e7eb'}`,
                            boxShadow: dragVisual.draggingId === cl._id ? '0 2px 8px rgba(16,185,129,0.18)' : 'none',
                            cursor: dragVisual.draggingId === cl._id ? 'grabbing' : 'grab',
                            transition: 'box-shadow 120ms ease, background-color 120ms ease, border-color 120ms ease',
                            position: 'relative',
                            touchAction: 'manipulation'
                          }}
                          data-item-id={cl._id}
                        >
                          {/* Insertion line indicator - BEFORE */}
                          {dragVisual.overId === cl._id && dragVisual.draggingId !== cl._id && dragVisual.position === 'before' && (
                            <div style={{ 
                              position: 'absolute', 
                              top: '-2px', 
                              left: '0', 
                              right: '0', 
                              height: '3px', 
                              backgroundColor: '#10b981',
                              borderRadius: '2px',
                              boxShadow: '0 0 4px rgba(16,185,129,0.5)',
                              zIndex: 10,
                              pointerEvents: 'none'
                            }} />
                          )}
                          
                          {/* Insertion line indicator - AFTER */}
                          {dragVisual.overId === cl._id && dragVisual.draggingId !== cl._id && dragVisual.position === 'after' && (
                            <div style={{ 
                              position: 'absolute', 
                              bottom: '-2px', 
                              left: '0', 
                              right: '0', 
                              height: '3px', 
                              backgroundColor: '#10b981',
                              borderRadius: '2px',
                              boxShadow: '0 0 4px rgba(16,185,129,0.5)',
                              zIndex: 10,
                              pointerEvents: 'none'
                            }} />
                          )}
                          
                          {/* Header - selection checkbox + title (click to expand when collapsed) */}
                          <div style={{ display: 'flex', fontSize: '0.875rem', alignItems: 'flex-start', gap: '0.625rem', padding: '0.125rem 0' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleChecklist(cl._id)}
                              style={{ marginTop: '0.25rem', cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                            />
                            <div
                              style={{ flex: 1, minWidth: 0 }}
                              onClick={() => { if (isSelected && !isLimitExpanded(cl._id)) { expandLimit(cl._id); } }}
                              role="button"
                              title={isSelected ? (isLimitExpanded(cl._id) ? 'Expanded' : 'Click to expand') : 'Select the checkbox to enable'}
                            >
                              <div style={{ fontWeight: 500, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem', lineHeight: 1.5 }}>
                                <span style={{ cursor: 'grab', color: '#9ca3af', fontSize: '1rem', flexShrink: 0 }}>⋮⋮</span>
                                <span style={{ flex: 1 }}>{cl.text}</span>
                                {isSelected && isLimitExpanded(cl._id) && (
                                  <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); collapseLimit(cl._id); }}
                                    title="Collapse"
                                    style={{
                                      backgroundColor: 'transparent',
                                      border: '2px solid #d1d5db',
                                      color: '#6b7280',
                                      cursor: 'pointer',
                                      fontSize: '1rem',
                                      fontWeight: 700,
                                      padding: '0.15rem 0.4rem',
                                      borderRadius: '0.25rem'
                                    }}
                                  >
                                    ✕
                                  </button>
                                )}
                                {!isMobile && (
                                  <label
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#4b5563', cursor: 'default' }}
                                    title="When enabled and saved to the template, new inspections will start with this item pre-selected"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!cl.default_checked}
                                      onChange={(e) => { e.stopPropagation(); toggleDefaultCheckedFor(cl._id, e.target.checked); }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                    />
                                    Default to checked?
                                  </label>
                                )}
                              </div>
                              {isMobile && (
                                <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {isSelected && isLimitExpanded(cl._id) && (
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); collapseLimit(cl._id); }}
                                      title="Collapse"
                                      style={{
                                        backgroundColor: 'transparent',
                                        border: '2px solid #d1d5db',
                                        color: '#6b7280',
                                        cursor: 'pointer',
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '0.25rem'
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                  <label
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#4b5563', cursor: 'default' }}
                                    title="When enabled and saved to the template, new inspections will start with this item pre-selected"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!cl.default_checked}
                                      onChange={(e) => { e.stopPropagation(); toggleDefaultCheckedFor(cl._id, e.target.checked); }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                    />
                                    Default to checked?
                                  </label>
                                </div>
                              )}
                              {cl.comment && (
                                <div style={{ marginLeft: '0.5rem', marginTop: '0.375rem', color: '#6b7280', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                                  {cl.comment.length > 150 ? cl.comment.slice(0, 150) + '…' : cl.comment}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.375rem', marginLeft: '0.5rem', position: 'relative', flexShrink: 0 }} onClick={(e) => e.preventDefault()}>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openChecklistForm('information', cl);
                                }}
                                style={{
                                  padding: '0.3rem 0.45rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '0.25rem',
                                  backgroundColor: '#f59e0b',
                                  color: 'white',
                                  border: 'none',
                                  cursor: 'pointer',
                                  lineHeight: 1
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
                                  padding: '0.3rem 0.45rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '0.25rem',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  cursor: 'pointer',
                                  lineHeight: 1
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                                title="Delete checklist"
                              >
                                🗑️
                              </button>
                              {/* Inline delete options menu for template items */}
                              {deleteMenuForId === cl._id && !cl._id.startsWith('temp_') && (
                                <div style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '0.375rem',
                                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                  padding: '0.5rem',
                                  zIndex: 10,
                                  width: '240px'
                                }}>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>Delete Options</div>
                                  <div style={{ fontSize: '0.75rem', color: '#374151', marginBottom: '0.5rem' }}>Choose how to remove this item:</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); performGlobalChecklistDelete(cl._id); }}
                                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem', backgroundColor: '#ef4444', color: 'white', border: 'none', cursor: 'pointer' }}
                                    >
                                      Delete from template (all)
                                    </button>
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteMenuForId(null); }}
                                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem', backgroundColor: '#e5e7eb', color: '#111827', border: 'none', cursor: 'pointer' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Content area - NOT clickable to toggle */}
                          <div>
                                
                                {/* Answer Choices - show when selected and expanded */}
                                {isSelected && isLimitExpanded(cl._id) && ((cl.answer_choices && cl.answer_choices.length > 0) || getSelectedAnswers(cl._id).size > 0) && (
                                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.5rem' }}>
                                      Select Options:
                                    </div>
                                    <div
                                      className="checklist-options-grid"
                                      onTouchMove={onOptionTouchMove(cl._id, cl.answer_choices || [])}
                                      onTouchCancel={onOptionTouchCancel()}
                                      onPointerUp={onOptionPointerUp(cl._id, cl.answer_choices || [])}
                                      style={{ touchAction: optionTouchStateRef.current.isDragging ? 'none' : 'manipulation', overscrollBehavior: 'contain' }}
                                    >
                                      {getAllAnswers(cl._id, cl.answer_choices || []).map((choice, idx) => {
                                        const selectedAnswers = getSelectedAnswers(cl._id);
                                        const isAnswerSelected = selectedAnswers.has(choice);
                                        const isCustom = isCustomAnswer(cl._id, choice, cl.answer_choices || []);
                                        const isTemplateChoice = Array.isArray(cl.answer_choices) && cl.answer_choices.includes(choice);
                                        const templateChoices = cl.answer_choices || [];
                                        
                                        return (
                                          <label 
                                            key={idx}
                                            data-choice={choice}
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
                                              position: 'relative',
                                              touchAction: optionTouchStateRef.current.isDragging ? 'none' : 'auto',
                                              WebkitTapHighlightColor: 'transparent',
                                              color: isAnswerSelected ? '#111827' : '#374151'
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
                                            draggable={!isCustom}
                                            onDragStart={onOptionDragStart(cl._id, choice, isCustom)}
                                            onDragOver={onOptionDragOver(cl._id, choice, isCustom)}
                                            onDrop={onOptionDrop(cl._id, choice, isCustom, templateChoices)}
                                            onDragEnd={onOptionDragEnd()}
                                            onTouchStart={onOptionTouchStart(cl._id, choice, isCustom)}
                                            onTouchEnd={onOptionTouchEnd(cl._id, templateChoices)}
                                            onPointerDown={onOptionPointerDown(cl._id, choice, isCustom)}
                                          >
                                            {/* Insertion line indicators for options */}
                                            {optionDragVisual.checklistId === cl._id && optionDragVisual.draggingChoice !== choice && optionDragVisual.overChoice === choice && !isCustom && optionDragVisual.axis === 'vertical' && optionDragVisual.position === 'before' && (
                                              <div style={{ position: 'absolute', top: '-2px', left: 0, right: 0, height: '3px', backgroundColor: '#10b981', borderRadius: '2px', boxShadow: '0 0 4px rgba(16,185,129,0.5)', pointerEvents: 'none' }} />
                                            )}
                                            {optionDragVisual.checklistId === cl._id && optionDragVisual.draggingChoice !== choice && optionDragVisual.overChoice === choice && !isCustom && optionDragVisual.axis === 'vertical' && optionDragVisual.position === 'after' && (
                                              <div style={{ position: 'absolute', bottom: '-2px', left: 0, right: 0, height: '3px', backgroundColor: '#10b981', borderRadius: '2px', boxShadow: '0 0 4px rgba(16,185,129,0.5)', pointerEvents: 'none' }} />
                                            )}
                                            {optionDragVisual.checklistId === cl._id && optionDragVisual.draggingChoice !== choice && optionDragVisual.overChoice === choice && !isCustom && optionDragVisual.axis === 'horizontal' && optionDragVisual.position === 'before' && (
                                              <div style={{ position: 'absolute', left: '-2px', top: 0, bottom: 0, width: '3px', backgroundColor: '#10b981', borderRadius: '2px', boxShadow: '0 0 4px rgba(16,185,129,0.5)', pointerEvents: 'none' }} />
                                            )}
                                            {optionDragVisual.checklistId === cl._id && optionDragVisual.draggingChoice !== choice && optionDragVisual.overChoice === choice && !isCustom && optionDragVisual.axis === 'horizontal' && optionDragVisual.position === 'after' && (
                                              <div style={{ position: 'absolute', right: '-2px', top: 0, bottom: 0, width: '3px', backgroundColor: '#10b981', borderRadius: '2px', boxShadow: '0 0 4px rgba(16,185,129,0.5)', pointerEvents: 'none' }} />
                                            )}
                                            <input
                                              type="checkbox"
                                              checked={isAnswerSelected}
                                              onChange={() => toggleAnswer(cl._id, choice)}
                                              style={{ cursor: 'pointer' }}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            <span style={{ color: isAnswerSelected ? '#111827' : '#374151', userSelect: 'none', flex: 1 }}>
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
                                            {!isCustom && (
                                              <span title="Drag to reorder" style={{ fontSize: '0.9rem', color: '#9ca3af', cursor: 'grab' }}>⋮⋮</span>
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

                          {/* Image upload section - show only when item is selected and expanded */}
                          {isSelected && isLimitExpanded(cl._id) && (
                            <div style={{ marginTop: '0.75rem', marginLeft: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                              <div style={{ marginBottom: '0.5rem' }}>
                                <FileUpload
                                  onFilesSelect={(files) => handleImagesSelect(cl._id, files)}
                                  id={`file-upload-${cl._id}`}
                                  labels={{ upload: 'Upload', photo: 'Photo', video: 'Video' }}
                                  layoutColumns={2}
                                  extraButtons={[
                                    (
                                      <button
                                        key={`btn-360-limit-${cl._id}`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setIsThreeSixtyMap(prev => ({ ...prev, [cl._id]: !prev[cl._id] }));
                                        }}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '0.5rem',
                                          padding: '0.55rem 0.75rem',
                                          backgroundColor: isThreeSixtyMap[cl._id] ? '#ef4444' : 'transparent',
                                          color: isThreeSixtyMap[cl._id] ? '#ffffff' : '#ef4444',
                                          borderRadius: '0.375rem',
                                          cursor: 'pointer',
                                          fontSize: '0.85rem',
                                          fontWeight: 700,
                                          border: `1px solid #ef4444`,
                                          transition: 'background-color 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s',
                                          whiteSpace: 'nowrap',
                                          width: '100%',
                                          minHeight: '42px',
                                          boxShadow: isThreeSixtyMap[cl._id] ? '0 1px 2px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)'
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isThreeSixtyMap[cl._id]) {
                                            e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)';
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = isThreeSixtyMap[cl._id] ? '#ef4444' : 'transparent';
                                        }}
                                        aria-pressed={isThreeSixtyMap[cl._id] ? 'true' : 'false'}
                                        title="Toggle 360° picture"
                                      >
                                        <span
                                          aria-hidden
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '9999px',
                                            border: isThreeSixtyMap[cl._id] ? '2px solid #ffffff' : '2px solid #ef4444',
                                            backgroundColor: isThreeSixtyMap[cl._id] ? '#ffffff' : 'transparent',
                                            color: '#ef4444',
                                            fontSize: '0.8rem',
                                            fontWeight: 900,
                                            lineHeight: 1
                                          }}
                                        >
                                          {isThreeSixtyMap[cl._id] ? '✓' : ''}
                                        </span>
                                        <span>360° Pic</span>
                                      </button>
                                    )
                                  ]}
                                />
                              </div>

                              {/* Display existing images */}
                              {checklistImages.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                                  {checklistImages.map((img, idx) => {
                                    // Generate preview URL - handle both string URLs and File objects
                                    const getPreviewUrl = (imgData: any) => {
                                      console.log('🖼️ Limitations Image data:', imgData);
                                      console.log('🔍 Limitations URL type:', typeof imgData.url);
                                      console.log('📦 Limitations URL value:', imgData.url);
                                      
                                      if (typeof imgData.url === 'string') {
                                        // String URL from database - use proxy
                                        const proxied = getProxiedSrc(imgData.url);
                                        console.log('✅ Limitations String URL proxied:', proxied);
                                        return proxied;
                                      } else if (imgData.url && typeof imgData.url === 'object' && imgData.url instanceof File) {
                                        // File object - create blob URL
                                        const blobUrl = URL.createObjectURL(imgData.url);
                                        console.log('✅ Limitations File object blob URL:', blobUrl);
                                        return blobUrl;
                                      }
                                      console.warn('⚠️ Limitations No valid URL found');
                                      return '';
                                    };
                                    
                                    const previewUrl = getPreviewUrl(img);
                                    console.log('🎨 Limitations Final preview URL:', previewUrl);
                                    
                                    return (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '180px' }}>
                                      <div style={{ position: 'relative', width: '180px', height: '180px', borderRadius: '0.375rem', overflow: 'hidden', border: '2px solid #10b981' }}>
                                        {previewUrl ? (
                                          <img
                                            src={previewUrl}
                                            alt={`Image ${idx + 1}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => {
                                              console.error('Image preview failed:', previewUrl);
                                              (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                          />
                                        ) : (
                                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', color: '#9ca3af' }}>
                                            No preview
                                          </div>
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

                                      {/* Location Smart Search */}
                                      <div style={{ position: 'relative', width: '180px' }}>
                                        <LocationSearch
                                          options={LOCATION_OPTIONS}
                                          value={locationInputs[`${cl._id}-${idx}`] ?? img.location ?? ''}
                                          onChangeAction={(newLocation) => {
                                            const inputKey = `${cl._id}-${idx}`;
                                            setLocationInputs(prev => ({ ...prev, [inputKey]: newLocation }));
                                            const checklistImages = formState.images.filter(i => i.checklist_id === cl._id);
                                            const imageToUpdate = checklistImages[idx];
                                            const updatedImages = formState.images.map(i => i === imageToUpdate ? { ...i, location: newLocation } : i);
                                            const updatedFormState = { ...formState, images: updatedImages };
                                            setFormState(updatedFormState);
                                            setTimeout(() => performAutoSaveWithState(updatedFormState), 100);
                                          }}
                                          placeholder="Select Location"
                                          width={180}
                                        />
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
                                          const imageUrl = typeof img.url === 'string' ? img.url : previewUrl;
                                          const editorUrl = `/image-editor?imageUrl=${encodeURIComponent(imageUrl)}&returnTo=${encodeURIComponent(window.location.pathname)}&checklistId=${cl._id}&inspectionId=${inspectionId}`;
                                          router.push(editorUrl);
                                        }}
                                        style={{
                                          padding: '0.5rem 0.75rem',
                                          fontSize: '0.75rem',
                                          borderRadius: '0.25rem',
                                          backgroundColor: '#a466da',
                                          color: 'white',
                                          border: 'none',
                                          cursor: 'pointer',
                                          width: '180px',
                                          fontWeight: 600
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#934ad3'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#a466da'}
                                        title="Annotate image with arrows, circles, and highlights"
                                      >
                                        🖊️ Annotate
                                      </button>
                                    </div>
                                  )})}
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
                  {/* Hidden manager for Limitations/Information removed: Limitations do not affect completion, so hiding UI is unnecessary */}
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
              {/* Left group: status + Done button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                    setDeleteMenuForId(null);
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
              {/* Manage hidden toggles when modal open */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowHiddenManagerStatus(v => !v)}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', borderRadius: '0.25rem', backgroundColor: '#e5e7eb', color: '#111827', border: 'none', cursor: 'pointer' }}
                  title="Manage hidden Status items for this inspection"
                >{showHiddenManagerStatus ? 'Hide Status Manager' : 'Manage Hidden Status'}</button>
              </div>
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
                  setChecklistFormData({ text: '', comment: '', type: 'status', tab: 'information', answer_choices: [], default_checked: false });
                  setNewAnswerChoice('');
                  setEditingAnswerIndex(null);
                  setEditingAnswerValue('');
                  setDeleteAnswerMenuForIndex(null);
                  // Clear any pending auto-save timers
                  if (textSaveTimeoutRef.current) {
                    clearTimeout(textSaveTimeoutRef.current);
                    textSaveTimeoutRef.current = null;
                  }
                  if (commentSaveTimeoutRef.current) {
                    clearTimeout(commentSaveTimeoutRef.current);
                    commentSaveTimeoutRef.current = null;
                  }
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
                  backgroundColor: checklistFormData.type === 'status' ? '#e8dff5' : '#d1fae5',
                  color: checklistFormData.type === 'status' ? '#5d228f' : '#065f46'
                }}>
                  {checklistFormData.type}
                </div>
              </div>

              {/* Default to checked? */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={!!checklistFormData.default_checked}
                    onChange={(e) => handleDefaultCheckedToggle(e.target.checked)}
                    style={{ width: '1rem', height: '1rem' }}
                  />
                  Default to checked?
                </label>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  When enabled and saved to the template, new inspections will start with this item pre-selected.
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
                  onChange={(e) => handleChecklistTextChange(e.target.value)}
                  placeholder="Enter checklist name..."
                  style={{
                    width: '100%',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#a466da'}
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
                  onChange={(e) => handleChecklistCommentChange(e.target.value)}
                  placeholder="Enter optional comment or description..."
                  style={{
                    width: '100%',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    padding: '0.6rem 0.8rem',
                    fontSize: isMobile ? '0.95rem' : '0.875rem',
                    minHeight: isMobile ? '200px' : '100px',
                    lineHeight: isMobile ? 1.6 : 1.5,
                    outline: 'none',
                    resize: 'vertical'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#a466da'}
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
                                border: '1px solid #a466da',
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
                            <div style={{ position: 'relative' }}>
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
                              {/* Delete options menu for answer choices */}
                              {deleteAnswerMenuForIndex === index && (
                                <div style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '0.375rem',
                                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                  padding: '0.5rem',
                                  zIndex: 10,
                                  width: '240px'
                                }}>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>Delete Options</div>
                                  <div style={{ fontSize: '0.75rem', color: '#374151', marginBottom: '0.5rem' }}>Choose how to remove this item:</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); hideAnswerChoiceForInspection(index); }}
                                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem', backgroundColor: '#f59e0b', color: 'white', border: 'none', cursor: 'pointer' }}
                                    >
                                      Hide in this inspection
                                    </button>
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteAnswerChoiceFromTemplate(index); }}
                                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem', backgroundColor: '#ef4444', color: 'white', border: 'none', cursor: 'pointer' }}
                                    >
                                      Delete from template (all)
                                    </button>
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteAnswerMenuForIndex(null); }}
                                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem', backgroundColor: '#6b7280', color: 'white', border: 'none', cursor: 'pointer' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
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
                  setChecklistFormData({ text: '', comment: '', type: 'status', tab: 'information', answer_choices: [], default_checked: false });
                  setNewAnswerChoice('');
                  setEditingAnswerIndex(null);
                  setEditingAnswerValue('');
                  setDeleteAnswerMenuForIndex(null);
                  // Clear any pending auto-save timers
                  if (textSaveTimeoutRef.current) {
                    clearTimeout(textSaveTimeoutRef.current);
                    textSaveTimeoutRef.current = null;
                  }
                  if (commentSaveTimeoutRef.current) {
                    clearTimeout(commentSaveTimeoutRef.current);
                    commentSaveTimeoutRef.current = null;
                  }
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
                      backgroundColor: '#a466da',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: savingChecklist ? 0.5 : 1,
                      fontWeight: 500,
                      whiteSpace: 'nowrap'
                    }}
                    disabled={savingChecklist}
                    onMouseOver={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#934ad3')}
                    onMouseOut={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#a466da')}
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
                    backgroundColor: '#8230c9',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: savingChecklist ? 0.5 : 1,
                    fontWeight: 500
                  }}
                  disabled={savingChecklist}
                  onMouseOver={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#6f29ac')}
                  onMouseOut={(e) => !savingChecklist && (e.currentTarget.style.backgroundColor = '#8230c9')}
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
