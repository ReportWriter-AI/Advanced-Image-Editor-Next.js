"use client";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import styles from "../../user-report/user-report.module.css";
import Button from "@/components/Button";
import PermanentReportLinks from "@/components/PermanentReportLinks";
import DefectPhotoGrid from "@/components/DefectPhotoGrid";
import dynamic from 'next/dynamic';
import { Button as UiButton } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Dynamic import of ThreeSixtyViewer to avoid SSR issues
const ThreeSixtyViewer = dynamic(() => import('@/components/ThreeSixtyViewer'), {
  ssr: false,
  loading: () => (
    <div style={{ 
      width: '100%', 
      height: '500px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#000',
      borderRadius: '8px'
    }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', color: 'white' }}></i>
    </div>
  )
});


type DefectTextParts = {
  title: string;
  body: string;
  paragraphs: string[];
};

// Local currency formatter for compact view
const formatCurrency = (amount: number) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  } catch {
    return `$${(amount || 0).toFixed(2)}`;
  }
};

const splitDefectText = (raw?: string): DefectTextParts => {
  const normalized = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { title: "", body: "", paragraphs: [] };
  }

  const paragraphBlocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (paragraphBlocks.length > 1) {
    const [title, ...rest] = paragraphBlocks;
    return {
      title,
      body: rest.join("\n\n").trim(),
      paragraphs: rest,
    };
  }

  const lineBlocks = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lineBlocks.length > 1) {
    const [title, ...restLines] = lineBlocks;
    const restCombined = restLines.join(" ").trim();
    return {
      title,
      body: restCombined,
      paragraphs: restCombined ? [restCombined] : [],
    };
  }

  const colonMatch = normalized.match(/^([^:]{3,120}):\s*([\s\S]+)$/);
  if (colonMatch) {
    const [, title, remainder] = colonMatch;
    const trimmedRemainder = remainder.trim();
    const paragraphs = trimmedRemainder
      ? trimmedRemainder.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      : [];
    return {
      title: title.trim(),
      body: trimmedRemainder,
      paragraphs: paragraphs.length ? paragraphs : trimmedRemainder ? [trimmedRemainder] : [],
    };
  }

  const dashMatch = normalized.match(/^([^–-]{3,120})[–-]\s*([\s\S]+)$/);
  if (dashMatch) {
    const [, title, remainder] = dashMatch;
    const trimmedRemainder = remainder.trim();
    const paragraphs = trimmedRemainder
      ? trimmedRemainder.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      : [];
    return {
      title: title.trim(),
      body: trimmedRemainder,
      paragraphs: paragraphs.length ? paragraphs : trimmedRemainder ? [trimmedRemainder] : [],
    };
  }

  const periodIndex = normalized.indexOf(".");
  if (periodIndex > 0 && periodIndex < normalized.length - 1) {
    const title = normalized.slice(0, periodIndex).trim();
    const remainder = normalized.slice(periodIndex + 1).trim();
    const paragraphs = remainder
      ? remainder.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      : [];
    return {
      title,
      body: remainder,
      paragraphs: paragraphs.length ? paragraphs : remainder ? [remainder] : [],
    };
  }

  return { title: normalized, body: "", paragraphs: [] };
};
export default function Page() {
  // Route param (App Router) for current inspection id
  const { id } = useParams() as { id: string };

  // Helper functions
  const normalizeCompanyId = (id: any): string | null => {
    if (!id) return null;
    return typeof id === 'object' ? id.toString() : String(id);
  };

  const extractInspectionCompanyId = (inspection: any): string | null => {
    if (!inspection) return null;
    const companyId = inspection.companyId || inspection.company_id || inspection.company;
    return normalizeCompanyId(companyId);
  };

  const resolvedInspectionId = id;

  // Core data sets
  const [defects, setDefects] = useState<any[]>([]);
  const [informationBlocks, setInformationBlocks] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]); // All sections with order_index
  const [loading, setLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState(null)
  const [currentNumber, setCurrentNumber] = useState(3)
  const [startingNumber, setStartingNumber] = useState(3) // Store initial number for PDF generation
  const [currentSubNumber, setCurrentSubNumber] = useState(1)
  const [inspection, setInspection] = useState<any>(null)
  const [profileData, setProfileData] = useState<{ user?: any; company?: any } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleName, setSampleName] = useState("");
  const [sampleDescription, setSampleDescription] = useState("");
  const [sampleSaving, setSampleSaving] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const profileCompanyId = useMemo(() => {
    if (!profileData?.company) return null;
    const company = profileData.company as Record<string, unknown>;
    return (
      normalizeCompanyId((company as any).id) ??
      normalizeCompanyId((company as any)._id) ??
      normalizeCompanyId(company)
    );
  }, [profileData]);

  const inspectionCompanyId = useMemo(
    () => extractInspectionCompanyId(inspection),
    [inspection]
  );

  const isAuthenticated = Boolean(profileData?.user?.id);
  const canShowMakeSampleButton = Boolean(
    profileLoaded &&
      isAuthenticated &&
      resolvedInspectionId &&
      inspectionCompanyId &&
      profileCompanyId &&
      inspectionCompanyId === profileCompanyId
  );

  const handleSampleModalChange = useCallback((open: boolean) => {
    setSampleModalOpen(open);
    if (!open) {
      setSampleError(null);
      setSampleSaving(false);
    }
  }, []);

  const handleOpenSampleModal = useCallback(() => {
    setSampleError(null);
    setSampleName(inspection?.name || "");
    setSampleDescription("");
    setSampleModalOpen(true);
  }, [inspection]);

  const handleSampleReportSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!sampleName.trim()) {
      setSampleError("Name is required.");
      return;
    }

    if (!resolvedInspectionId) {
      setSampleError("Invalid inspection identifier.");
      return;
    }

    const trimmedDescription = sampleDescription.trim();
    const payload: Record<string, any> = {
      title: sampleName.trim(),
      description: trimmedDescription ? trimmedDescription : undefined,
      inspectionId: resolvedInspectionId,
    };

    const preferredUrl =
      (typeof inspection?.htmlReportUrl === "string" && inspection.htmlReportUrl.trim()) ||
      (typeof window !== "undefined"
        ? `${window.location.origin}/inspection_report/${resolvedInspectionId}`
        : "");

    if (!preferredUrl) {
      setSampleError("Unable to determine report URL.");
      return;
    }

    payload.url = preferredUrl;

    try {
      setSampleSaving(true);
      setSampleError(null);

      const response = await fetch("/api/sample-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save sample report");
      }

      setSampleModalOpen(false);
      setSampleName("");
      setSampleDescription("");
      if (typeof window !== "undefined") {
        window.alert("Sample report saved successfully.");
      }
    } catch (error: any) {
      console.error("Error saving sample report:", error);
      setSampleError(error?.message || "Failed to save sample report");
    } finally {
      setSampleSaving(false);
    }
  };

  // Mobile detection hook
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadProfile = async () => {
      try {
        const response = await fetch('/api/profile', {
          credentials: 'include',
          signal: controller.signal,
        });

        if (response.status === 401) {
          if (isMounted) {
            setProfileData(null);
          }
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to load profile data');
        }

        const data = await response.json();
        if (isMounted) {
          setProfileData(data);
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
        console.error('Error fetching profile data:', error);
        if (isMounted) {
          setProfileData(null);
        }
      } finally {
        if (isMounted) {
          setProfileLoaded(true);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const reportRef = useRef<HTMLDivElement>(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const translateStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const baseSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  
  // Ensure all media goes through the hardened proxy for reliable loading
  const getProxiedSrc = useCallback((url: string | null | undefined) => {
    if (!url) return '';
    if (url.startsWith('/api/proxy-image?') || url.startsWith('data:')) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }, []);

  // Fallback handler: if direct URL fails, retry via proxy, else use placeholder
  const handleImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    const current = img.getAttribute('src') || '';
    console.log('🔴 Image load failed:', current);
    if (current && !current.startsWith('/api/proxy-image?') && !current.startsWith('data:')) {
      console.log('🔄 Retrying via proxy...');
      img.src = `/api/proxy-image?url=${encodeURIComponent(current)}`;
    } else {
      console.log('⚠️ Using placeholder...');
      img.src = '/placeholder-image.jpg';
    }
  }, []);

  // Toolbar dropdown menu (Report Viewing Options)
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  
  // PDF dropdown state
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);
  const pdfDropdownRef = useRef<HTMLDivElement | null>(null);
  
  // HTML dropdown state
  const [htmlDropdownOpen, setHtmlDropdownOpen] = useState(false);
  const htmlDropdownRef = useRef<HTMLDivElement | null>(null);

  // Navigation state
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'full' | 'summary' | 'hazard'>('full');

  // Smooth scroll to anchors from summary table
  const scrollToAnchor = useCallback((anchorId: string) => {
    const el = document.getElementById(anchorId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Optional: focus heading for accessibility
      const h = el.querySelector('h2, h3');
      if (h && (h as HTMLElement).focus) {
        (h as HTMLElement).setAttribute('tabindex', '-1');
        (h as HTMLElement).focus({ preventScroll: true });
      }
    }
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        setLightboxSrc(null);
        setZoomScale(1);
        setTranslate({ x: 0, y: 0 });
      }
    };
    document.addEventListener('keydown', onKey);
    // Prevent background scroll while lightbox is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen]);

  // Close toolbar menu on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuOpen) return;
      const n = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(n)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  // Close PDF dropdown on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!pdfDropdownOpen) return;
      const n = e.target as Node;
      if (pdfDropdownRef.current && !pdfDropdownRef.current.contains(n)) {
        setPdfDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pdfDropdownOpen]);

  // Close HTML dropdown on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!htmlDropdownOpen) return;
      const n = e.target as Node;
      if (htmlDropdownRef.current && !htmlDropdownRef.current.contains(n)) {
        setHtmlDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [htmlDropdownOpen]);

  // Close toolbar menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Close PDF dropdown on Escape
  useEffect(() => {
    if (!pdfDropdownOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPdfDropdownOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pdfDropdownOpen]);

  // Close HTML dropdown on Escape
  useEffect(() => {
    if (!htmlDropdownOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHtmlDropdownOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [htmlDropdownOpen]);

  // Handle panning while zoomed in
  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const next = { x: translateStart.current.x + dx, y: translateStart.current.y + dy };
      // Clamp within container bounds
      const container = overlayRef.current?.getBoundingClientRect();
      const baseW = baseSizeRef.current.w || imageRef.current?.getBoundingClientRect().width || 0;
      const baseH = baseSizeRef.current.h || imageRef.current?.getBoundingClientRect().height || 0;
      const scaledW = baseW * zoomScale;
      const scaledH = baseH * zoomScale;
      const containerW = container?.width || window.innerWidth;
      const containerH = container?.height || window.innerHeight;
      const maxX = Math.max(0, (scaledW - containerW) / 2);
      const maxY = Math.max(0, (scaledH - containerH) / 2);
      setTranslate({
        x: Math.min(Math.max(next.x, -maxX), maxX),
        y: Math.min(Math.max(next.y, -maxY), maxY),
      });
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning]);

  const openLightbox = (src: string) => {
    // Always use proxied src for lightbox as well
    setLightboxSrc(getProxiedSrc(src));
    setZoomScale(1);
    setTranslate({ x: 0, y: 0 });
    setLightboxOpen(true);
  };

  const toggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoomScale === 1) {
      setZoomScale(2.5);
      setTranslate({ x: 0, y: 0 });
    } else {
      setZoomScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  };

  const startPanHandler = (e: React.MouseEvent) => {
    if (zoomScale === 1) return;
    e.preventDefault();
    e.stopPropagation();
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translate };
  };


  // Escape HTML for safe export/rendering of dynamic information sections
  const escapeHtml = (s: any) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  // Reusable generator for Information Section HTML (used for export and on-screen rendering)
  const generateInformationSectionHTMLForExport = (block: any): string => {
    const allItems = block?.selected_checklist_ids || [];
    const itemsArray: any[] = Array.isArray(allItems) ? allItems : [];
    const sortedItems = itemsArray.some((i) => i && typeof i === 'object')
      ? [...itemsArray].sort((a, b) => {
          const ao = typeof a?.order_index === 'number' ? a.order_index : Number.POSITIVE_INFINITY;
          const bo = typeof b?.order_index === 'number' ? b.order_index : Number.POSITIVE_INFINITY;
          return ao - bo;
        })
      : itemsArray;
    const hasContent = (sortedItems?.length ?? 0) > 0 || !!block?.custom_text;
    if (!hasContent) return '';

    // Preprocess long paragraphs for better readability in HTML export/on-screen
    const formatTextForHTML = (text: string): string => {
      if (!text) return '';
      let preprocessed = text
        .replace(/(Purpose:)(\s*The home)/g, '$1\n\n$2')
        .replace(/(sections\.)(\s*No responsibility)/g, '$1\n\n$2')
        .replace(/(purpose\.)(\s*Scope:)/g, '$1\n\n$2')
        .replace(/(deadfront\.)(\s*Report Limitations)/g, '$1\n\n$2')
        .replace(/(Report Limitations & Exclusions:)(\s*The Report)/g, '$1\n\n$2')
        .replace(/(building\.)(\s*AGI accepts)/g, '$1\n\n$2')
        .replace(/(building:)(\s*1\.\s)/g, '$1\n\n$2')
        .replace(/(wiring\);)(\s*2\.\s)/g, '$1\n\n$2')
        .replace(/(possible\.)(\s*In addition)/g, '$1\n\n$2')
        .replace(/(them\.)(\s*Any area)/g, '$1\n\n$2')
        .replace(/(Report\.)(\s*Descriptions in the Report)/g, '$1\n\n$2')
        .replace(/(appliances\.)(\s*The Report:)/g, '$1\n\n$2')
        .replace(/(property\.)(\s*AGI has not undertaken)/g, '$1\n\n$2')
        .replace(/(property\.)(\s*No property survey)/g, '$1\n\n$2')
        .replace(/(search\.)(\s*Unit Title Properties:)/g, '$1\n\n$2')
        .replace(/(areas\.)(\s*AGI recommends)/g, '$1\n\n$2')
        .replace(/(Corporate\.)(\s*Responsibility to Third Parties:)/g, '$1\n\n$2')
        .replace(/(Report\.)(\s*AGI reserves)/g, '$1\n\n$2')
        .replace(/(party\.)(\s*Publication:)/g, '$1\n\n$2')
        .replace(/(inspector\.)(\s*Claims & Disputes:)/g, '$1\n\n$2')
        .replace(/(matter\.)(\s*Any claim relating)/g, '$1\n\n$2')
        .replace(/(Agreement\)\.)(\s*Except in the case)/g, '$1\n\n$2')
        .replace(/(matter\.)(\s*Limitation of Liability:)/g, '$1\n\n$2')
        .replace(/(client\.)(\s*AGI shall have no)/g, '$1\n\n$2')
        .replace(/(loss\.)(\s*Subject to any)/g, '$1\n\n$2')
        .replace(/(inspection\.)(\s*Consumer Guarantees Act:)/g, '$1\n\n$2')
        .replace(/(law\.)(\s*Partial Invalidity:)/g, '$1\n\n$2')
        .replace(/([a-z.,)])(\d+\.\s)/g, '$1\n$2');

      const paragraphs = preprocessed.split('\n\n').filter((p) => p.trim());
      return paragraphs
        .map((p) => {
          const trimmed = p.trim();
          if (/^\d+\.\s/.test(trimmed)) {
            return `<div style="margin-left: 1rem; margin-bottom: 0.5rem; font-size: 0.875rem; line-height: 1.6; color: #374151;">${escapeHtml(
              trimmed
            )}</div>`;
          }
          return `<p style="margin: 0 0 1rem 0; line-height: 1.6; font-size: 0.875rem; color: #374151;">${escapeHtml(
            trimmed
          )}</p>`;
        })
        .join('');
    };

    const statusItems = sortedItems.filter((item: any) => item.type === 'status');
    const informationItems = sortedItems.filter((item: any) => item.type === 'information');

    const selectedAnswersMap = new Map();
    if (block?.selected_answers && Array.isArray(block.selected_answers)) {
      block.selected_answers.forEach((entry: any) => {
        if (entry.checklist_id && Array.isArray(entry.selected_answers)) {
          selectedAnswersMap.set(entry.checklist_id, entry.selected_answers);
        }
      });
    }

    const statusItemsHtml = statusItems
      .map((item: any) => {
        const itemId = item._id || '';
        const itemImages = (block.images || []).filter((img: any) => img.checklist_id === itemId);
        const selectedAnswers = selectedAnswersMap.get(itemId) || [];
        const parts = (item.text || '').split(':');
        const label = parts[0]?.trim() || '';
        const value = parts.slice(1).join(':').trim() || '';
        const formattedComment = item.comment ? formatTextForHTML(item.comment) : '';
        return `
          <div class="rpt-info-grid-item">
            <div>
              <span style="font-weight: 700; color: #000000;">${escapeHtml(label)}:</span>${
                value
                  ? `
              <span style="margin-left: 0.25rem; font-weight: 400; color: #6b7280;">
                ${escapeHtml(value)}
              </span>`
                  : ''
              }
            </div>
            ${
              formattedComment
                ? `
            <div style="font-size: 0.875rem; color: #374151; line-height: 1.6; margin-top: 0.5rem;">
              ${formattedComment}
            </div>`
                : ''
            }
            ${
              selectedAnswers.length > 0
                ? `
            <div style="margin-left: 0.25rem; font-weight: 400; color: #6b7280; font-size: 0.875rem;">
              ${selectedAnswers.map((ans: string) => escapeHtml(ans)).join(', ')}
            </div>`
                : ''
            }
            ${
              itemImages.length > 0
                ? `
            <div class="rpt-info-images">
              ${itemImages
                .map(
                  (img: any) => `
              <div style="position: relative;">
                ${/\.(mp4|mov|webm|3gp|3gpp|m4v)(\?.*)?$/i.test(img.url)
                  ? `<video src="${escapeHtml(img.url)}" controls class="rpt-img rpt-info-image" style="background-color: #000;"></video>`
                  : `<img src="${escapeHtml(img.url)}" alt="Item image" class="rpt-img rpt-info-image" />`}
                ${img.location
                  ? `
                <div style="text-align: center; font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; font-weight: 500;">
                  ${escapeHtml(img.location)}
                </div>`
                  : ''}
              </div>`
                )
                .join('')}
            </div>`
                : ''
            }
          </div>`;
      })
      .join('');

    const informationItemsHtml = informationItems
      .map((item: any) => {
        const itemId = item._id || '';
        const itemImages = (block.images || []).filter((img: any) => img.checklist_id === itemId);
        const selectedAnswers = selectedAnswersMap.get(itemId) || [];
        const formattedComment = item.comment ? formatTextForHTML(item.comment) : '';
        return `
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <div style="font-weight: 700; color: #000000; font-size: 0.9375rem;">
              ${escapeHtml(item.text || '')}
            </div>
            ${
              formattedComment
                ? `
            <div style="font-size: 0.875rem; color: #374151; line-height: 1.6;">
              ${formattedComment}
            </div>`
                : ''
            }
            ${
              selectedAnswers.length > 0
                ? `
            <div style="margin-left: 0.75rem; font-size: 0.8125rem; color: #6b7280; line-height: 1.4;">
              ${selectedAnswers.map((ans: string) => escapeHtml(ans)).join(', ')}
            </div>`
                : ''
            }
            ${
              itemImages.length > 0
                ? `
            <div class="rpt-info-images" style="margin-left: 1rem; margin-top: 0.75rem;">
              ${itemImages
                .map(
                  (img: any) => `
              <div style="position: relative;">
                ${/\.(mp4|mov|webm|3gp|3gpp|m4v)(\?.*)?$/i.test(img.url)
                  ? `<video src="${escapeHtml(img.url)}" controls class="rpt-img rpt-info-image" style="background-color: #000;"></video>`
                  : `<img src="${escapeHtml(img.url)}" alt="Item image" class="rpt-img rpt-info-image" />`}
                ${img.location
                  ? `
                <div style="text-align: center; font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; font-weight: 500;">
                  ${escapeHtml(img.location)}
                </div>`
                  : ''}
              </div>`
                )
                .join('')}
            </div>`
                : ''
            }
          </div>`;
      })
      .join('');

    return `
    <div class="rpt-information-section">
      <div class="rpt-info-header">
        <h3 class="rpt-info-heading">INFORMATION</h3>
      </div>
      ${statusItems.length > 0 ? `
      <div class="rpt-info-grid" style="${(informationItems.length > 0 || block.custom_text) ? 'margin-bottom: 1.5rem;' : ''}">
        ${statusItemsHtml}
      </div>` : ''}
      ${informationItems.length > 0 ? `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;${block.custom_text ? ' margin-bottom: 1.5rem;' : ''}">
        ${informationItemsHtml}
      </div>` : ''}
      ${block.custom_text ? `
      <div class="rpt-info-custom-notes"${(statusItems.length > 0 || informationItems.length > 0) ? ' style="border-top: 1px solid #e2e8f0; padding-top: 1rem;"' : ''}>
        <div class="rpt-info-custom-label">Custom Notes</div>
        <div class="rpt-info-custom-text">${escapeHtml(block.custom_text).replace(/\n/g, '<br>')}</div>
      </div>` : ''}
    </div>`;
  };



  const onImageLoad = () => {
    // Capture the displayed size at scale=1 to compute bounds reliably
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      baseSizeRef.current = { w: rect.width, h: rect.height };
    }
  };

  // Get the selected arrow color for dynamic styling (for individual sections)
  const getSelectedColor = (section: any) => {
    console.log(section);
    const color = section?.color || '#d63636';
    console.log('Selected arrow color for section:', section?.heading, color);
    return color;
  };

  

  // Get a lighter shade of the selected color for gradients
  const getLightColor = (section: any) => {
    const color = getSelectedColor(section);
    // Convert hex to RGB and lighten it
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgb(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)})`;
  };

  // Header image and text state
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [headerText, setHeaderText] = useState<string | null>(null);
  
  // Function to select a defect image as header image
  const selectHeaderImage = (imageUrl: string) => {
    setHeaderImage(imageUrl);
  };
  
  // Fetch all sections to get order_index mapping
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await fetch('/api/information-sections/sections');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setSections(result.data);
          }
        }
      } catch (error) {
        console.error('Error fetching sections:', error);
      }
    };
    fetchSections();
  }, []);
  
  // Fetch inspection data including header image
  useEffect(() => {
    if (resolvedInspectionId) {
      const fetchInspection = async () => {
        try {
          const response = await fetch(`/api/inspections/${resolvedInspectionId}`);
          if (response.ok) {
            const data = await response.json();
            console.log('🔍 Fetched inspection data:', {
              hasHeaderImage: !!data.headerImage,
              headerImage: data.headerImage,
              hasHeaderText: !!data.headerText,
              headerText: data.headerText,
              hasHeaderName: !!data.headerName,
              headerName: data.headerName,
              hasHeaderAddress: !!data.headerAddress,
              headerAddress: data.headerAddress
            });
            setInspection(data);
            // If inspection has headerImage and headerText, use them
            if (data.headerImage) {
              console.log('✅ Setting header image:', data.headerImage);
              setHeaderImage(data.headerImage);
            } else {
              console.log('❌ No header image found in inspection data');
            }
            if (data.headerText) {
              setHeaderText(data.headerText);
            }
          } else {
            console.error('Failed to fetch inspection details');
          }
        } catch (error) {
          console.error('Error fetching inspection details:', error);
        }
      };
      
      fetchInspection();
    }
  }, [resolvedInspectionId]);

  // Load inspection-only checklists from localStorage and merge into informationBlocks
  useEffect(() => {
    if (!resolvedInspectionId || !informationBlocks || informationBlocks.length === 0) return;

    try {
      const storageKey = `inspection_checklists_${resolvedInspectionId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (!stored) return; // No inspection-only checklists
      
      const inspectionChecklistsMap = JSON.parse(stored);
      if (!inspectionChecklistsMap || typeof inspectionChecklistsMap !== 'object') return;
      
      // Merge inspection-only checklists into informationBlocks
      const updatedBlocks = informationBlocks.map(block => {
        const sectionId = block.section_id?._id || block.section_id;
        const inspectionChecklists = inspectionChecklistsMap[sectionId];
        
        if (!inspectionChecklists || !Array.isArray(inspectionChecklists) || inspectionChecklists.length === 0) {
          return block; // No inspection-only items for this section
        }
        
        // Merge inspection-only checklists with existing checklist IDs
        const existingIds = block.selected_checklist_ids || [];
        const mergedIds = [...existingIds, ...inspectionChecklists];
        
        return {
          ...block,
          selected_checklist_ids: mergedIds
        };
      });
      
      setInformationBlocks(updatedBlocks);
    } catch (error) {
      console.error('Error loading inspection-only checklists:', error);
    }
  }, [resolvedInspectionId, informationBlocks.length]); // Only re-run when id changes or informationBlocks initially loads

  const handleDownloadPDF = async (reportType: 'full' | 'summary' = 'full') => {
    try {
      // Filter sections based on report type
      const sectionsToExport = reportType === 'summary' 
        ? reportSections.filter(section => nearestCategory(section.color) !== 'blue') // Exclude blue maintenance items for summary
        : reportSections; // All sections for full report
      
      // Transform reportSections into defects payload compatible with API
      // ONLY include sections that have actual defects (not information sections)
      const defectsPayload = sectionsToExport
        .filter((r: any) => r.defect || r.defect_description)
        .map((r: any) => ({
        section: r.heading2?.split(' - ')[0] || '',
        subsection: r.heading2?.split(' - ')[1] || '',
  defect_description: r.defect_description || r.defect || '',
        image: r.image,
        location: r.location,
        material_total_cost: r.estimatedCosts?.materialsCost ?? 0,
        labor_type: r.estimatedCosts?.labor ?? '',
        labor_rate: r.estimatedCosts?.laborRate ?? 0,
        hours_required: r.estimatedCosts?.hoursRequired ?? 0,
        recommendation: r.estimatedCosts?.recommendation ?? '',
        color: r.color || '#d63636',
      }));

      // Use header image only if explicitly set (inspection data or manual selection)
      // Do NOT fallback to a defect image when none is set
      const headerImageUrl = headerImage || null;

      const meta = {
        title: 'Inspection Report',
        subtitle: 'Generated Inspection Report',
        company: 'AGI Property Inspections',
        headerImageUrl, // Add the header image URL
        headerText, // Add the header text
        reportType, // Pass the report type to control sections visibility
        startNumber: startingNumber, // Use the initial starting number (3) so defects start at 4.1
        informationBlocks, // Pass information blocks to PDF template
      };

      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          defects: defectsPayload, 
          meta,
          inspectionId: resolvedInspectionId, // Pass inspection ID
          reportMode: reportType // Pass report mode (full/summary)
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to generate PDF: ${res.status} ${errorData.error || errorData.details || 'Unknown error'}`);
      }
      
      // Response now contains JSON with downloadUrl, not the PDF file itself
      const data = await res.json();
      if (!data.success || !data.downloadUrl) {
        throw new Error('Invalid response from PDF generation API');
      }
      
      console.log(`✅ PDF generated. Download URL: ${data.downloadUrl}`);
      
      // Refresh inspection data to get the new permanent URL
      const inspectionRes = await fetch(`/api/inspections/${id}`);
      if (inspectionRes.ok) {
        const updatedInspection = await inspectionRes.json();
        setInspection(updatedInspection); // Update state with new URLs
        if (updatedInspection.pdfReportUrl) {
          console.log(`✅ Permanent PDF URL available: ${updatedInspection.pdfReportUrl}`);
        }
      }
      
      // Download the PDF via the proxy URL (this is now a small redirect, not a large data transfer from Vercel)
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = data.filename || `${meta.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error('PDF generation failed', e);
      alert('Failed to generate PDF. See console for details.');
    }
  };

  const handleDownloadHTML = async (reportType: 'full' | 'summary' = 'full') => {
    // Build a minimal standalone HTML using current reportSections
    try {
      const title = `inspection-${resolvedInspectionId}-${reportType}-report`;
      
      // Use header image only if explicitly set (inspection data or UI selection)
      // Do NOT fallback to a defect image when none is set
      const headerImageUrl = headerImage || null;

      // Filter sections based on report type
      const sectionsToExport = reportType === 'summary' 
        ? reportSections.filter(section => nearestCategory(section.color) !== 'blue') // Exclude blue maintenance items for summary
        : reportSections; // All sections for full report

      // Build summary table rows and totals - ONLY for sections with actual defects
      const defectSectionsForCost = sectionsToExport.filter(s => s.defect || s.defect_description);
      const summaryRows = defectSectionsForCost
        .map((s) => {
          const cost = s.estimatedCosts?.totalEstimatedCost ?? 0;
          const def = s.defectTitle || s.defect || (s.defect_description ? String(s.defect_description).split('.')[0] : '');
          return `
            <tr>
              <td>${escapeHtml(s.numbering ?? '')}</td>
              <td>${escapeHtml(s.sectionName ?? '')} - ${escapeHtml(s.heading2?.split(' - ')[1] ?? '')}</td>
              <td>${escapeHtml(def)}</td>
              <td style="text-align:right;">$${cost}</td>
            </tr>
          `;
        })
        .join('');
      const totalAll = defectSectionsForCost.reduce((sum: number, s: any) => sum + (s.estimatedCosts?.totalEstimatedCost ?? 0), 0);

      // Filter summaryTableRows to ONLY show sections with actual defects (not information sections)
      const defectSectionsForTable = sectionsToExport.filter(s => s.defect || s.defect_description);
      const summaryTableRows = defectSectionsForTable
        .map((s) => {
          const defectParts = splitDefectText(s.defect_description || s.defect || "");
          const summaryDefect = s.defectTitle || defectParts.title || (s.defect || "").trim() || (defectParts.paragraphs[0] || "");
          const cat = nearestCategory(s.color) || 'red';
          const catClass = {
            red: 'rpt-row-cat-red',
            orange: 'rpt-row-cat-orange',
            blue: 'rpt-row-cat-blue',
            purple: 'rpt-row-cat-purple'
          }[cat];
          return `
            <tr class="rpt-summary-row ${catClass}" data-target="${escapeHtml(s.anchorId || '')}" tabindex="0" role="link" aria-label="Jump to ${escapeHtml(s.numbering ?? '')}: ${escapeHtml(summaryDefect)}">
              <td>${escapeHtml(s.numbering ?? '')}</td>
              <td>${escapeHtml(s.heading2 ?? s.sectionName ?? '')}</td>
              <td>${escapeHtml(summaryDefect)}</td>
            </tr>
          `;
        })
        .join('');

      // Summary HTML export table rows (no separate defects summary column)
      const summaryInspectionTableRows = reportType === 'summary'
        ? sectionsToExport.map((s) => {
            const defectParts = splitDefectText(s.defect_description || s.defect || "");
            const defectTitle = (s.defectTitle || defectParts.title || (s.defect || "").trim() || '').trim();
            const cat = nearestCategory(s.color) || 'red';
            const catClass = {
              red: 'rpt-row-cat-red',
              orange: 'rpt-row-cat-orange',
              blue: 'rpt-row-cat-blue',
              purple: 'rpt-row-cat-purple'
            }[cat];
            return `
              <tr class="rpt-summary-row ${catClass}" data-target="${escapeHtml(s.anchorId || '')}" tabindex="0" role="link" aria-label="Jump to ${escapeHtml(s.numbering ?? '')}: ${escapeHtml(defectTitle)}">
                <td>${escapeHtml(s.numbering ?? '')}</td>
                <td>${escapeHtml(s.heading2 ?? s.sectionName ?? '')}</td>
                <td>${escapeHtml(defectTitle)}</td>
              </tr>
            `;
          }).join('')
        : '';


      // Track previous section to detect section changes
      let prevSectionName: string | null = null;

      const sectionHtml = sectionsToExport
        .map((s, idx) => {
          // Determine if this section has an actual defect
          const hasDefect = !!(s.defect || s.defect_description);
          
          const imgSrc = typeof s.image === 'string' ? s.image : '';
          const cost = s.estimatedCosts?.totalEstimatedCost ?? 0;
          const defectPartsExport = splitDefectText(s.defect_description || "");
          const exportTitle = s.defectTitle || defectPartsExport.title;
          const exportParagraphs = Array.isArray(s.defectParagraphs) && s.defectParagraphs.length
            ? s.defectParagraphs
            : defectPartsExport.paragraphs.length
              ? defectPartsExport.paragraphs
              : defectPartsExport.body && defectPartsExport.body !== exportTitle
                ? [defectPartsExport.body]
                : [];
          const defectBodyHtml = exportParagraphs.length
            ? exportParagraphs.map((p: string) => `<p class="rpt-defect-body">${escapeHtml(p)}</p>`).join("")
            : (s.defect_description ? `<p class="rpt-defect-body">${escapeHtml(s.defect_description)}</p>` : "");
          const selectedColor = s.color || '#dc2626';
          const selectedRgb = parseColorToRgb(selectedColor);
          const shadowColor = selectedRgb ? `rgba(${selectedRgb.r}, ${selectedRgb.g}, ${selectedRgb.b}, 0.18)` : 'rgba(214, 54, 54, 0.18)';
          const highlightBg = selectedRgb ? `rgba(${selectedRgb.r}, ${selectedRgb.g}, ${selectedRgb.b}, 0.12)` : 'rgba(214, 54, 54, 0.12)';
          const badgeLabel = escapeHtml(colorToImportance(selectedColor));
          const locationText = escapeHtml(s.location || 'Not specified');

          const category = nearestCategory(selectedColor) || 'red';
          const defectParts = splitDefectText(s.defect_description || s.defect || "");
          const summaryTitle = (s.defectTitle || defectParts.title || (s.defect || "").trim() || '').trim();
          const summaryBody = (defectParts.paragraphs && defectParts.paragraphs.length > 0
            ? defectParts.paragraphs[0]
            : (defectParts.body && defectParts.body !== summaryTitle ? defectParts.body : '')).trim();
          
          // Check if this is a new section (first item or section name changed)
          const currentSectionName = s.sectionName || '';
          const isNewSection = idx === 0 || prevSectionName !== currentSectionName;
          prevSectionName = currentSectionName;
          
          // Generate information section HTML if this is a new section (ONLY for full reports)
          let informationHtml = '';
          if (reportType === 'full' && isNewSection && informationBlocks && informationBlocks.length > 0) {
            // Find matching information block
            const matchingBlock = informationBlocks.find((block: any) => {
              const blockSection = typeof block.section_id === 'object' ? block.section_id?.name : null;
              if (!blockSection || !currentSectionName) return false;
              // Match by removing leading numbers like "9 - " from both
              const cleanSection = currentSectionName.replace(/^\d+\s*-\s*/, '');
              const cleanBlock = blockSection.replace(/^\d+\s*-\s*/, '');
              return cleanBlock === cleanSection;
            });
            
            if (matchingBlock) {
              informationHtml = generateInformationSectionHTMLForExport(matchingBlock);
            }
          }

          // Build the section HTML
          let html = '';
          
          // 1. Main Section Heading (Black, no badge) - Show ONCE when section changes
          if (isNewSection) {
            html += `
              <div class="rpt-section-heading" style="/* border-bottom removed to match main page */">
                <h2 class="rpt-section-heading-text" style="color: #111827;">
                  ${escapeHtml(s.sectionHeading || `Section - ${s.sectionName}`)}
                </h2>
              </div>
            `;
            
            // 2. Information Block (if exists) - Show after section heading
            if (informationHtml) {
              html += informationHtml;
            }
          }
          
          // 3. If this section has a defect, show the defect subsection
          if (hasDefect) {
            // Build a combined label "Section / Subsection" for the colored subsection heading.
            // Clean leading numbering like "9 - " from section names to avoid duplication with s.numbering.
            const cleanSectionNameLabel = String(s.sectionName || '').replace(/^\d+\s*-\s*/, '');
            const subsectionLabelRaw = (s as any).subsectionName || (s as any).subsection || (s as any).heading2 || '';
            const subsectionLabelStr = String(subsectionLabelRaw).trim();
            const lowerClean = cleanSectionNameLabel.toLowerCase();
            const lowerSub = subsectionLabelStr.toLowerCase();
            const startsWithSection = !!cleanSectionNameLabel && lowerSub.startsWith(lowerClean);
            let headingCombinedLabel: string;
            if (cleanSectionNameLabel && subsectionLabelStr) {
              if (startsWithSection) {
                const rest = subsectionLabelStr.slice(cleanSectionNameLabel.length).trim();
                // If there's no obvious separator, insert a hyphen between section and rest
                if (rest && !/^[\-\/•–—]/.test(rest)) {
                  headingCombinedLabel = `${cleanSectionNameLabel} - ${rest}`;
                } else {
                  headingCombinedLabel = `${cleanSectionNameLabel}${rest ? ` ${rest}` : ''}`;
                }
              } else {
                headingCombinedLabel = `${cleanSectionNameLabel} / ${subsectionLabelStr}`;
              }
            } else {
              headingCombinedLabel = subsectionLabelStr || cleanSectionNameLabel;
            }
            html += `
              <!-- Subsection Heading (Colored with badge) -->
              <div class="rpt-section-heading" id="${s.anchorId}-heading" data-cat="${category}" style="--selected-color:${selectedColor};--shadow-color:${shadowColor};margin-top:${isNewSection ? '1rem' : '0.5rem'};">
                <h2 class="rpt-section-heading-text">
                  ${escapeHtml(s.numbering)} - ${escapeHtml(headingCombinedLabel)}
                  <span class="rpt-badge">${badgeLabel}</span>
                </h2>
              </div>
              
              <!-- Defect Card -->
              <section id="${s.anchorId}" class="rpt-section" data-cat="${category}" data-numbering="${escapeHtml(s.numbering)}" data-section-label="${escapeHtml(s.heading2 || s.sectionName || '')}" data-defect-title="${escapeHtml(summaryTitle)}" data-defect-summary="${escapeHtml(summaryBody)}" style="--selected-color:${selectedColor};--shadow-color:${shadowColor};--highlight-bg:${highlightBg};">
                <div class="rpt-content-grid">
                  <div class="rpt-image-section">
                    <h3 class="rpt-section-title">Visual Evidence</h3>
                    ${(() => {
                      const additionalArr = Array.isArray((s as any).additionalPhotos)
                        ? (s as any).additionalPhotos
                        : (Array.isArray((s as any).additional_images)
                           ? (s as any).additional_images.map((img: any) => ({ url: img.url, location: img.location }))
                           : []);
                      
                      // Build allPhotos array: main photo + additional photos
                      const allPhotos = [
                        { url: imgSrc, location: locationText },
                        ...additionalArr
                      ];
                      // Per-defect gallery payload (encoded) so the lightbox shows only this defect's photos
                      const galleryData = encodeURIComponent(JSON.stringify(allPhotos));
                      const totalCount = allPhotos.length;
                      const visibleCount = Math.min(totalCount, 3);
                      const remainingCount = totalCount - visibleCount;
                      
                      // Render photo grid based on count (1, 2, or 3+ photos)
                      if (totalCount === 1) {
                        // Single photo - full width
                        return `
                          <div class="rpt-photo-gallery" data-gallery="${galleryData}">
                            <div class="rpt-photo-grid-single">
                              <div class="rpt-photo-wrapper" onclick="openGallery(this, 0);">
                                <img class="rpt-photo rpt-img" src="${escapeHtml(allPhotos[0].url)}" alt="${escapeHtml(allPhotos[0].location)}" />
                                <div class="rpt-photo-label">${escapeHtml(allPhotos[0].location)}</div>
                              </div>
                            </div>
                          </div>
                        `;
                      }
                      
                      // 2 photos total: show side by side
                      if (totalCount === 2) {
                        return `
                          <div class="rpt-photo-gallery" data-gallery="${galleryData}">
                            <div class="rpt-photo-grid-two">
                              ${allPhotos.map((photo, idx) => `
                                <div class="rpt-photo-wrapper" onclick="openGallery(this, ${idx});">
                                  <img class="rpt-photo rpt-img" src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.location)}" />
                                  <div class="rpt-photo-label">${escapeHtml(photo.location)}</div>
                                </div>
                              `).join('')}
                            </div>
                          </div>
                        `;
                      }
                      
                      // 3+ photos: 1 large on top, 2 smaller below side-by-side
                      return `
                        <div class="rpt-photo-gallery" data-gallery="${galleryData}">
                          <div class="rpt-photo-grid-multiple">
                            <!-- First photo large -->
                            <div class="rpt-photo-wrapper-large" onclick="openGallery(this, 0);">
                              <img class="rpt-photo rpt-img" src="${escapeHtml(allPhotos[0].url)}" alt="${escapeHtml(allPhotos[0].location)}" />
                              <div class="rpt-photo-label">${escapeHtml(allPhotos[0].location)}</div>
                            </div>
                            
                            <!-- Bottom row: 2 photos side by side -->
                            <div class="rpt-photo-column">
                              <div class="rpt-photo-wrapper" onclick="openGallery(this, 1);">
                                <img class="rpt-photo rpt-img" src="${escapeHtml(allPhotos[1].url)}" alt="${escapeHtml(allPhotos[1].location)}" />
                                <div class="rpt-photo-label">${escapeHtml(allPhotos[1].location)}</div>
                              </div>
                              
                              ${visibleCount > 2 ? `
                                <div class="rpt-photo-wrapper-overlay" onclick="openGallery(this, 2);">
                                  <img class="rpt-photo rpt-img" src="${escapeHtml(allPhotos[2].url)}" alt="${escapeHtml(allPhotos[2].location)}" />
                                  <div class="rpt-photo-label">${escapeHtml(allPhotos[2].location)}</div>
                                  ${remainingCount > 0 ? `
                                    <div class="rpt-photo-overlay" onclick="event.stopPropagation(); openGallery(this.parentNode, 2);">
                                      <span class="rpt-photo-overlay-text">+${remainingCount}</span>
                                    </div>
                                  ` : ''}
                                </div>
                              ` : ''}
                            </div>
                          </div>
                        </div>
                      `;
                    })()}
                    <div class="rpt-location-section">
                      <h4 class="rpt-subsection-title">Location</h4>
                      <p class="rpt-subsection-content">${locationText}</p>
                    </div>
                  </div>
                  <div class="rpt-description-section">
                    <h3 class="rpt-section-title">Analysis Details</h3>
                    <div class="rpt-detail-card">
                      <h4 class="rpt-subsection-title">Defect</h4>
                      <div class="rpt-subsection-content">
                        ${exportTitle ? `<p class="rpt-defect-title">${escapeHtml(exportTitle)}</p>` : ''}
                        ${defectBodyHtml}
                      </div>
                    </div>
                    <div class="rpt-detail-card">
                      ${inspection?.hidePricing
                        ? (
                          s.estimatedCosts?.recommendation
                            ? `
                              <h4 class="rpt-subsection-title">Recommendation</h4>
                              <div class="rpt-subsection-content">
                                <p>${escapeHtml(s.estimatedCosts?.recommendation)}</p>
                              </div>
                            `
                            : ''
                        )
                        : `
                          <h4 class="rpt-subsection-title">Estimated Costs</h4>
                          <div class="rpt-subsection-content">
                            <p>
                              <strong>Materials:</strong> ${escapeHtml(s.estimatedCosts?.materials)} ($${s.estimatedCosts?.materialsCost ?? 0})<br/>
                              <strong>Labor:</strong> ${escapeHtml(s.estimatedCosts?.labor)} at $${s.estimatedCosts?.laborRate ?? 0}/hr<br/>
                              <strong>Hours:</strong> ${s.estimatedCosts?.hoursRequired ?? 0}<br/>
                              <strong>Recommendation:</strong> ${escapeHtml(s.estimatedCosts?.recommendation)}
                            </p>
                          </div>
                        `}
                    </div>
                    ${!inspection?.hidePricing ? `
                      <div class="rpt-cost-highlight">
                        <div class="rpt-total-cost">
                          Total Estimated Cost: $${cost}
                        </div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              </section>
            `;
          }
          
          return html;
        })
        .join('\n');

      // Build dynamic information-only sections for export (sections with no defects)
      let infoOnlyExportHtml = '';
      if (reportType === 'full' && Array.isArray(informationBlocks) && informationBlocks.length > 0) {
        const defectSectionNames = new Set(
          sectionsToExport.map((s: any) => String(s.sectionName || '').replace(/^\d+\s*-\s*/, '').trim())
        );
        const seen = new Set<string>();
        const infoOnlyBlocks = informationBlocks
          .filter((block: any) => {
            const rawName = typeof block.section_id === 'object' ? block.section_id?.name : null;
            if (!rawName) return false;
            const clean = String(rawName).replace(/^\d+\s*-\s*/, '').trim();
            if (defectSectionNames.has(clean)) return false;
            if (seen.has(clean)) return false;
            seen.add(clean);
            return true;
          })
          .sort((a: any, b: any) => {
            const ai = typeof a.section_id === 'object' && typeof a.section_id?.order_index === 'number' ? a.section_id.order_index : Number.POSITIVE_INFINITY;
            const bi = typeof b.section_id === 'object' && typeof b.section_id?.order_index === 'number' ? b.section_id.order_index : Number.POSITIVE_INFINITY;
            return ai - bi;
          });

        infoOnlyExportHtml = infoOnlyBlocks
          .map((block: any) => {
            const rawName = typeof block.section_id === 'object' ? (block.section_id?.name || '') : '';
            const cleanName = String(rawName).replace(/^\d+\s*-\s*/, '');
            const secNum = typeof block.section_id === 'object' ? block.section_id?.order_index : null;
            const headingHtml = `
              <div class="rpt-section-heading" style="border-bottom: 2px solid #111827;">
                <h2 class="rpt-section-heading-text" style="color: #111827;">
                  ${secNum ? `Section ${escapeHtml(secNum)} - ${escapeHtml(cleanName)}` : `${escapeHtml(cleanName)}`}
                </h2>
              </div>`;
            const contentHtml = generateInformationSectionHTMLForExport(block);
            return `${headingHtml}\n${contentHtml}`;
          })
          .join('\n');
      }

      const doc = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#eef2f7;color:#0f172a;margin:0;padding:32px 24px 48px}
    .rpt-wrap{max-width:1200px;margin:0 auto}
    .rpt-h1{font-size:32px;font-weight:700;margin:0 0 24px 0;color:#111827}
  .rpt-summary-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 8px 24px rgba(15,23,42,0.12);margin:32px 0 0 0}
  .rpt-summary-header{padding:24px 28px 16px;border-bottom:1px solid #e2e8f0}
  .rpt-summary-subtitle{margin:6px 0 0;color:#64748b;font-size:0.95rem}
  .rpt-summary-table-wrap{overflow-x:auto;padding:0 28px 28px}
  .rpt-summary-table{width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08)}
  .rpt-summary-table thead th{text-transform:uppercase;font-size:0.75rem;letter-spacing:0.08em;color:#475569;background:#f8fafc;padding:12px 14px;text-align:left;border-bottom:1px solid #e2e8f0;border-right:1px solid #d9dee5}
  .rpt-summary-table thead th:last-child{border-right:none}
  .rpt-summary-table tbody td{padding:13px 14px;font-size:0.95rem;color:#1f2937;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0}
  .rpt-summary-table tbody td:last-child{border-right:none}
  .rpt-summary-table tbody tr:last-child td{border-bottom:none}
  /* Summary rows are always color-filled (no hover fade) */
  .rpt-summary-row{cursor:pointer}
  .rpt-summary-row:focus{outline:2px solid #3b82f6;outline-offset:-2px}
  .rpt-row-cat-red{border-left:6px solid #94a3b8;background:rgba(220,38,38,0.14)}
  .rpt-row-cat-orange{border-left:6px solid #94a3b8;background:rgba(245,158,11,0.16)}
  .rpt-row-cat-blue{border-left:6px solid #94a3b8;background:rgba(59,130,246,0.16)}
  .rpt-row-cat-purple{border-left:6px solid #94a3b8;background:rgba(124,58,237,0.16)}
    .rpt-section{background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 8px 32px rgba(15,23,42,0.12);padding:32px;margin:32px 0 0 0}
    .rpt-section:first-of-type{margin-top:0}
  .rpt-section-heading{margin:56px 0 24px 0;padding-bottom:16px;border-bottom:2px solid var(--selected-color,#dc2626)}
  .rpt-section-heading[data-intro-heading]{border-bottom:2px solid #000000}
  /* Remove border only from main section headings (the ones with comment about border removal) */
  .rpt-section-heading[style*="border-bottom removed"]{border-bottom:none !important}
  .rpt-section-heading:first-of-type{margin-top:0}
    .rpt-section-heading-text{font-size:1.75rem;color:var(--selected-color,#dc2626);font-weight:700;margin:0;letter-spacing:-0.025em}
    .rpt-badge{display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:9999px;font-weight:700;color:#fff;font-size:0.8rem;background:var(--selected-color,#dc2626);box-shadow:0 2px 6px rgba(15,23,42,0.2);margin-left:8px}
    .rpt-content-grid{display:grid;grid-template-columns:1fr 3fr;gap:32px;align-items:start}
    .rpt-image-section{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 4px 16px rgba(15,23,42,0.12);position:relative;overflow:hidden}
    .rpt-image-section::before{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,var(--selected-color,#dc2626),var(--shadow-color,rgba(214,54,54,0.16)),var(--selected-color,#dc2626))}
  .rpt-section-title{font-size:1.5rem;font-weight:700;color:#1f2937;margin-bottom:24px;letter-spacing:-0.025em}
  @media(max-width:640px){.rpt-section-title{text-align:center;}}
  .rpt-image-container{border-radius:16px;overflow:hidden;min-height:300px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(15,23,42,0.15);position:relative}
    .rpt-img{width:100%;height:auto;display:block;cursor:zoom-in;border-radius:12px;transition:transform .3s ease}
    .rpt-img:hover{transform:scale(1.02)}
    .rpt-image-placeholder{color:#64748b;border:2px dashed #cbd5e1;background:#fff;width:100%;height:300px;display:flex;align-items:center;justify-content:center;border-radius:16px;font-weight:500}
  .rpt-main-caption{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);background:rgba(255,255,255,0.95);color:#111827;border:1px solid #e5e7eb;border-radius:9999px;padding:6px 10px;font-weight:600;font-size:0.85rem;box-shadow:0 2px 8px rgba(0,0,0,0.12)}
    .rpt-location-section{margin-top:24px;padding:16px;background:#fff;border-radius:12px;border-left:3px solid var(--selected-color,#dc2626);box-shadow:0 4px 6px var(--shadow-color,rgba(214,54,54,0.15));transition:all .3s ease}
    .rpt-location-section:hover{background:#f8fafc;transform:translateX(2px)}
  /* Photo Grid Layouts - matching DefectPhotoGrid component exactly */
  .rpt-photo-grid-single{width:100%}
  .rpt-photo-grid-two{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}
  .rpt-photo-grid-multiple{display:grid;grid-template-columns:1fr;gap:8px;width:100%}
  .rpt-photo-column{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .rpt-photo-wrapper,.rpt-photo-wrapper-large,.rpt-photo-wrapper-overlay{position:relative;overflow:hidden;border-radius:8px;cursor:pointer;transition:transform 0.2s ease, box-shadow 0.2s ease;background:#f0f0f0}
  .rpt-photo-wrapper:hover,.rpt-photo-wrapper-large:hover,.rpt-photo-wrapper-overlay:hover{transform:scale(1.02);box-shadow:0 4px 12px rgba(0,0,0,0.15)}
  .rpt-photo{width:100%;height:100%;object-fit:cover;display:block;min-height:200px}
  .rpt-photo-grid-single .rpt-photo{min-height:300px;max-height:500px}
  .rpt-photo-grid-two .rpt-photo{min-height:250px;max-height:400px}
  .rpt-photo-grid-multiple .rpt-photo-wrapper-large .rpt-photo{min-height:300px;max-height:500px}
  .rpt-photo-grid-multiple .rpt-photo-column .rpt-photo{min-height:145px;max-height:245px}
  .rpt-photo-label{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top, rgba(0,0,0,0.8), transparent);color:white;padding:8px 12px;font-size:0.85rem;font-weight:500;text-align:center}
  .rpt-photo-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
  .rpt-photo-overlay-text{color:white;font-size:2.5rem;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,0.5)}
    .rpt-description-section{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 4px 16px rgba(15,23,42,0.12);position:relative;overflow:hidden}
    .rpt-detail-card{margin-bottom:16px;padding:16px;background:#fff;border-radius:12px;border-left:3px solid var(--selected-color,#dc2626);box-shadow:0 4px 6px var(--shadow-color,rgba(214,54,54,0.15));transition:all .3s ease}
    .rpt-detail-card:hover{background:#f8fafc;transform:translateX(2px)}
    .rpt-detail-card:last-child{margin-bottom:0}
    .rpt-subsection-title{font-size:1rem;font-weight:600;margin-bottom:8px;color:#1f2937;letter-spacing:-0.01em}
    .rpt-subsection-content{font-size:0.9rem;color:#374151;line-height:1.55;white-space:pre-line}
    .rpt-defect-title{font-weight:700;font-size:1rem;margin:0 0 8px 0;color:var(--selected-color,#dc2626)}
    .rpt-defect-body{font-size:0.9rem;color:#374151;line-height:1.6;margin:0 0 10px 0}
    .rpt-defect-body:last-child{margin-bottom:0}
    .rpt-cost-highlight{border:2px solid var(--selected-color,#dc2626);border-radius:12px;padding:20px;margin-top:24px;box-shadow:0 6px 18px rgba(15,23,42,0.12)}
    .rpt-total-cost{text-align:center;font-weight:700;color:var(--selected-color,#dc2626);font-size:1.25rem;letter-spacing:-0.02em}
  /* Lightbox overlay */
  .lb-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.9);display:none;align-items:center;justify-content:center;z-index:9999;padding:20px}
  .lb-overlay.open{display:flex}
  .lb-img{width:auto;height:auto;max-width:98vw;max-height:98vh;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.5);transition:transform 80ms linear;will-change:transform;cursor:zoom-in;image-rendering:auto;object-fit:contain;-webkit-backface-visibility:hidden;backface-visibility:hidden}
  .lb-close{position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:3rem;width:50px;height:50px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;transition:background 0.2s ease;z-index:10001}
  .lb-close:hover{background:rgba(255,255,255,0.3)}
  .navBtn{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);border:none;color:white;font-size:3rem;width:50px;height:50px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.2s ease;z-index:10001}
  .navBtn:hover{background:rgba(255,255,255,0.3)}
  .prevBtn{left:20px}
  .nextBtn{right:20px}
    .rpt-hr{border:none;border-top:1px solid #e5e7eb;margin:12px 0}
  .cat-red{color:#cc0000}
  .cat-orange{color:#e69500}
  .cat-blue{color:#2d6cdf}
  .cat-purple{color:#800080}
    .rpt-table{width:100%;border-collapse:collapse;margin-top:16px;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08)}
    .rpt-table th,.rpt-table td{border:1px solid #e5e7eb;padding:12px 14px;text-align:left;font-size:0.95rem;background:#fff}
    .rpt-table thead th{background:#f3f4f6;font-size:0.85rem;letter-spacing:0.02em;text-transform:uppercase;color:#475569}
    .rpt-table tfoot td{font-weight:700;background:#f1f5f9}
    .disclaimer{font-size:12px;color:#6b7280;font-style:italic;border-top:1px solid #e5e7eb;padding-top:8px}
    .rpt-h2{font-size:1.5rem;font-weight:700;color:#111827;margin:0 0 16px 0}
    @media(max-width:1024px){.rpt-content-grid{grid-template-columns:1fr;gap:24px}}
    @media(max-width:640px){body{padding:24px 16px 32px}.rpt-section{padding:24px}.rpt-section-heading-text{font-size:1.5rem}}
    /* Header with image and content below */
    .header-container {width: 100%; margin-bottom: 40px; text-align: center;}
    .image-container {width: 100%; height: auto; margin-bottom: 30px; max-height: 500px; overflow: hidden;}
    .header-image {width: 100%; max-height: 500px; object-fit: cover; object-position: center;}
    .report-header-content {text-align: center; padding: 20px 0;}
    .header-text {font-size: 36px; font-weight: bold; color: #333; margin-top: 0; margin-bottom: 20px;}
    .report-title {font-size: 28px; font-weight: 600; color: #444; margin: 0 0 10px 0; text-transform: uppercase;}
    .meta-info {font-size: 16px; color: #666; margin-bottom: 10px;}
    .logo {height: 60px; margin-bottom: 20px;}
    /* Mobile dropdown for export toolbar (only affects if elements present in full export) */
    .export-toolbar{position:relative}
    .export-toolbar-toggle{display:none}
    @media(max-width:640px){
      .export-toolbar{flex-wrap:wrap}
      .export-toolbar .mode-btn{display:none}
      .export-toolbar-toggle{display:block;width:100%;background:#333333;color:#FFFFFF;font-weight:700;padding:12px 14px;border:1px solid #222222;border-radius:6px;text-align:center;cursor:pointer;font-family:Inter,system-ui,sans-serif;font-size:0.95rem}
  .export-toolbar-dropdown{position:absolute;left:50%;top:calc(100% + 6px);transform:translateX(-50%);background:#333333;border:1px solid #222222;border-radius:6px;box-shadow:0 12px 28px rgba(0,0,0,0.14);padding:8px;min-width:220px;z-index:70;display:none}
      .export-toolbar-dropdown.open{display:block}
      .export-toolbar-dropdown .dropdown-item{display:block;width:100%;text-align:left;background:transparent;border:none;border-radius:6px;padding:10px 12px;font-weight:700;color:#FFFFFF;cursor:pointer;transition:all .15s ease;font-size:0.95rem}
      .export-toolbar-dropdown .dropdown-item:hover{background:#D00909;color:#FFFFFF}
      .export-toolbar-dropdown .dropdown-item.active{background:#D00909;color:#FFFFFF}
    }
    @media(min-width:641px){
      .export-toolbar-dropdown,.export-toolbar-toggle{display:none !important}
    }
    /* Information Section Styles */
    .rpt-information-section{margin:1.5rem 0 2rem;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:1.5rem;box-shadow:0 4px 16px rgba(15,23,42,0.08)}
    .rpt-info-header{display:flex;align-items:center;margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:2px solid #3b82f6}
    .rpt-info-heading{font-size:0.95rem;font-weight:700;letter-spacing:0.05em;color:#1e40af;margin:0;text-transform:uppercase}
    .rpt-info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}
    .rpt-info-grid-item{display:flex;flex-direction:column;gap:0.5rem}
    .rpt-info-images{display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem}
    .rpt-info-image{width:100%;max-width:200px;max-height:200px;height:auto;border-radius:6px;object-fit:cover;cursor:zoom-in;transition:transform .3s ease;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
    .rpt-info-image:hover{transform:scale(1.02);box-shadow:0 4px 12px rgba(0,0,0,0.15)}
    .rpt-info-custom-notes{margin-top:0}
    .rpt-info-custom-label{font-size:0.875rem;font-weight:600;color:#1f2937;margin-bottom:0.5rem}
    .rpt-info-custom-text{font-size:0.875rem;color:#4a5568;line-height:1.5}
    @media(max-width:1024px){.rpt-info-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:640px){.rpt-info-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="rpt-wrap">
    ${headerImageUrl ? `
    <!-- New header with image and text below -->
    <div class="header-container">
      <div class="image-container">
        <img src="${escapeHtml(headerImageUrl)}" alt="Property Image" class="header-image" />
      </div>
      <div class="report-header-content">
        ${(()=>{ 
          // prefer separate fields if available on client state (in closure via inspection) else split headerText
          const nameLine = inspection?.headerName || (headerText ? headerText.split('\n')[0] : '');
          const addressLine = inspection?.headerAddress || (headerText ? headerText.split('\n').slice(1).join(' ') : '');
          if (!nameLine && !addressLine) return '';
          const safeName = escapeHtml(nameLine);
          const safeAddress = escapeHtml(addressLine);
          return `<div style="line-height:1.15;margin-bottom:14px;">
            ${safeName ? `<div style=\"font-size:30px;font-weight:700;color:#111827;\">${safeName}</div>` : ''}
            ${safeAddress ? `<div style=\"font-size:30px;font-weight:700;color:#111827;margin-top:4px;\">${safeAddress}</div>` : ''}
          </div>`;
        })()}
        <h2 class="report-title">HOME INSPECTION REPORT</h2>
        <div class="meta-info">AGI Property Inspections • Generated ${new Date().toLocaleDateString()}</div>
      </div>
    </div>
    ` : `<h1 class="rpt-h1">Inspection Report</h1>`}
    ${reportType === 'full' ? `
    <div class="export-toolbar" style="max-width:1200px;margin:24px auto 0 auto;display:flex;gap:8px;align-items:center;background:#222;padding:10px;border-radius:6px;font-family:Inter,system-ui,sans-serif;">
      <button data-mode="full" class="mode-btn" style="background:#D00909;border:1px solid #D00909;color:#fff;font-weight:600;padding:8px 14px;border-radius:6px;cursor:pointer;">Full Report</button>
      <button data-mode="summary" class="mode-btn" style="background:#333;border:1px solid #333;color:#fff;font-weight:600;padding:8px 14px;border-radius:6px;cursor:pointer;">Summary</button>
      <button data-mode="hazard" class="mode-btn" style="background:#333;border:1px solid #333;color:#fff;font-weight:600;padding:8px 14px;border-radius:6px;cursor:pointer;">Immediate Attention</button>
      <button type="button" class="export-toolbar-toggle" aria-haspopup="true" aria-expanded="false">Report Viewing Options ▾</button>
      <div class="export-toolbar-dropdown" role="menu" aria-label="Report Viewing Options">
        <button class="dropdown-item active" data-mode="full" role="menuitem">Full Report</button>
        <button class="dropdown-item" data-mode="summary" role="menuitem">Summary</button>
        <button class="dropdown-item" data-mode="hazard" role="menuitem">Immediate Attention</button>
      </div>
    </div>
    <section class="rpt-summary-card">
      <div class="rpt-summary-header">
  <h2 class="rpt-h2">Inspection Defects <small style="font-weight:400;color:#6b7280;font-size:0.65em;margin-left:6px;">(clickable links)</small></h2>
      </div>
      <div class="rpt-summary-table-wrap">
        <table class="rpt-summary-table">
          <thead>
            <tr>
              <th scope="col">No.</th>
              <th scope="col">Section</th>
              <th scope="col">Defect</th>
            </tr>
          </thead>
          <tbody>
            ${summaryTableRows}
          </tbody>
        </table>
      </div>
    </section>
    ` : ''}
    ${reportType === 'summary' ? `
    <section class="rpt-summary-card">
      <div class="rpt-summary-header">
  <h2 class="rpt-h2">Inspection Defects <small style="font-weight:400;color:#6b7280;font-size:0.65em;margin-left:6px;">(clickable links)</small></h2>
      </div>
      <div class="rpt-summary-table-wrap">
        <table class="rpt-summary-table">
          <thead>
            <tr>
              <th scope="col">No.</th>
              <th scope="col">Section</th>
              <th scope="col">Defect</th>
            </tr>
          </thead>
          <tbody>
            ${summaryInspectionTableRows}
          </tbody>
        </table>
      </div>
    </section>
    ` : ''}
    
    ${sectionHtml}
    ${reportType === 'full' ? infoOnlyExportHtml : ''}
    ${reportType === 'summary' && !inspection?.hidePricing ? `
    <section class="rpt-section">
      <h2 class="rpt-h2">Total Estimated Cost</h2>
      <table class="rpt-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Section</th>
            <th>Defect</th>
            <th style="text-align:right;">Cost</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">Total</td>
            <td style="text-align:right;">$${totalAll}</td>
          </tr>
        </tfoot>
      </table>
    </section>
    ` : ''}
    ${reportType === 'full' && !inspection?.hidePricing ? `
    <section class="rpt-section">
      <h2 class="rpt-h2">Total Estimated Cost</h2>
      <table class="rpt-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Section</th>
            <th>Defect</th>
            <th style="text-align:right;">Cost</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">Total</td>
            <td style="text-align:right;">$${totalAll}</td>
          </tr>
        </tfoot>
      </table>
    </section>` : ''}
    <!-- Lightbox overlay for image zoom/pan with gallery support -->
    <div id="lb-overlay" class="lb-overlay" role="dialog" aria-modal="true" aria-label="Image gallery preview">
      <button type="button" id="lb-close" class="lb-close" aria-label="Close image">×</button>
      <button type="button" id="lb-prev" class="navBtn prevBtn" aria-label="Previous image">‹</button>
      <button type="button" id="lb-next" class="navBtn nextBtn" aria-label="Next image">›</button>
      <img id="lb-img" class="lb-img" alt="Zoomed defect" />
      <div id="lb-caption" class="lb-caption" style="position:absolute;left:50%;transform:translateX(-50%);bottom:12px;color:#fff;font-weight:600;"></div>
      <div id="lb-counter" class="lb-counter" style="position:absolute;left:50%;transform:translateX(-50%);bottom:40px;color:#fff;font-weight:600;"></div>
    </div>
    <script>
      (function(){
        var overlay = document.getElementById('lb-overlay');
        var img = document.getElementById('lb-img');
        var prevBtn = document.getElementById('lb-prev');
        var nextBtn = document.getElementById('lb-next');
        var closeBtn = document.getElementById('lb-close');
        var captionEl = document.getElementById('lb-caption');
        var counterEl = document.getElementById('lb-counter');
        var isPanning = false;
        var startX = 0, startY = 0;
        var tx = 0, ty = 0;
        var startTx = 0, startTy = 0;
        var scale = 1;
        var baseW = 0, baseH = 0;
        var gallery = [];
        var currentIndex = 0;

        function updateTransform(){
          img.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + scale + ')';
          if (scale > 1) {
            img.style.cursor = isPanning ? 'grabbing' : 'grab';
          } else {
            img.style.cursor = 'zoom-in';
          }
        }

        function loadImageEntry(idx){
          if (!gallery || !gallery.length) return;
          currentIndex = (idx + gallery.length) % gallery.length;
          var entry = gallery[currentIndex];
          var tempImg = new Image();
          tempImg.onload = function(){
            img.src = entry.src;
            captionEl.textContent = entry.caption || '';
            counterEl.textContent = (currentIndex + 1) + ' / ' + gallery.length;
            img.style.width = 'auto';
            img.style.height = 'auto';
            img.style.maxWidth = '98vw';
            img.style.maxHeight = '98vh';
            scale = 1; tx = 0; ty = 0; startTx = 0; startTy = 0;
            updateTransform();
            // measure base size after image loads
            setTimeout(function(){
              var rect = img.getBoundingClientRect(); baseW = rect.width; baseH = rect.height;
            },50);
          };
          tempImg.onerror = function(){
            console.error('Failed to load image:', entry.src);
            // Try to set src anyway, browser will show broken image icon
            img.src = entry.src;
            captionEl.textContent = entry.caption || '';
            counterEl.textContent = (currentIndex + 1) + ' / ' + gallery.length;
          };
          tempImg.src = entry.src;
        }

        function openLightbox(index){
          if (!gallery || !gallery.length) return;
          loadImageEntry(index || 0);
          overlay.classList.add('open');
          document.body.style.overflow = 'hidden';
        }

        // Open a lightbox gallery scoped to a specific defect/photo group
        function openGallery(el, index){
          try {
            var root = el && el.closest ? el.closest('.rpt-photo-gallery') : null;
            if(!root) return;
            var encoded = root.getAttribute('data-gallery');
            if(!encoded) return;
            var arr = JSON.parse(decodeURIComponent(encoded));
            gallery = (arr || []).map(function(p){ return { src: p.url, caption: p.location || '' }; });
            if(!gallery.length) return;
            openLightbox(index || 0);
          } catch(e) {
            // fail silently
          }
        }
        // Expose for inline onclick handlers in the exported HTML
        window.openGallery = openGallery;

        // Keep simple clicks for information images as single-image galleries
        Array.prototype.forEach.call(document.querySelectorAll('.rpt-info-image'), function(n){
          n.addEventListener('click', function(e){
            e.preventDefault(); e.stopPropagation();
            gallery = [{ src: n.getAttribute('src'), caption: n.getAttribute('alt') || '' }];
            openLightbox(0);
          });
        });

        function closeLightbox(){
          overlay.classList.remove('open');
          document.body.style.overflow = '';
        }

        function showNext(){ loadImageEntry(currentIndex + 1); }
        function showPrev(){ loadImageEntry(currentIndex - 1); }

        document.addEventListener('keydown', function(e){
          if (e.key === 'Escape') return closeLightbox();
          if (e.key === 'ArrowRight') return showNext();
          if (e.key === 'ArrowLeft') return showPrev();
        });

        overlay.addEventListener('click', function(){ closeLightbox(); });
        if(closeBtn){ closeBtn.addEventListener('click', function(e){ e.stopPropagation(); closeLightbox(); }); }
        if(nextBtn){ nextBtn.addEventListener('click', function(e){ e.stopPropagation(); showNext(); }); }
        if(prevBtn){ prevBtn.addEventListener('click', function(e){ e.stopPropagation(); showPrev(); }); }
        img.addEventListener('click', function(e){ e.stopPropagation(); });

        // Double-click to toggle zoom
        img.addEventListener('dblclick', function(e){
          e.preventDefault();
          if (scale === 1) { scale = 2.5; } else { scale = 1; tx = 0; ty = 0; }
          updateTransform();
        });

        // Pan when zoomed
        img.addEventListener('mousedown', function(e){
          if (scale === 1) return;
          isPanning = true;
          startX = e.clientX; startY = e.clientY;
          startTx = tx; startTy = ty;
          e.preventDefault();
        });
        document.addEventListener('mousemove', function(e){
          if (!isPanning) return;
          var dx = e.clientX - startX;
          var dy = e.clientY - startY;
          var nextX = startTx + dx;
          var nextY = startTy + dy;
          var container = overlay.getBoundingClientRect();
          var scaledW = baseW * scale;
          var scaledH = baseH * scale;
          var maxX = Math.max(0, (scaledW - container.width) / 2);
          var maxY = Math.max(0, (scaledH - container.height) / 2);
          tx = Math.min(Math.max(nextX, -maxX), maxX);
          ty = Math.min(Math.max(nextY, -maxY), maxY);
          updateTransform();
        });
        document.addEventListener('mouseup', function(){ isPanning = false; });

        // Note: Image clicks are wired inline via openGallery(...) so no global gallery is built here.

        // Make summary rows scroll to section anchors
        Array.prototype.forEach.call(document.querySelectorAll('.rpt-summary-row'), function(row){
          row.addEventListener('click', function(){
            var targetId = row.getAttribute('data-target');
            if (!targetId) return;
            var el = document.getElementById(targetId);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
          row.addEventListener('keydown', function(e){
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              row.click();
            }
          });
        });
        // ---- Mode Switching Logic ----
        var toolbar = document.querySelector('.export-toolbar');
        var summaryCard = document.querySelector('.rpt-summary-card');
        var summaryTable = summaryCard ? summaryCard.querySelector('table.rpt-summary-table') : null;
        var summaryHead = summaryTable ? summaryTable.querySelector('thead tr') : null;
        var summaryBody = summaryTable ? summaryTable.querySelector('tbody') : null;
        var introSections = document.querySelectorAll('.rpt-section.intro-section');
        var defectSections = Array.prototype.filter.call(document.querySelectorAll('.rpt-section'), function(sec){ return !sec.classList.contains('intro-section'); });
        var currentMode = 'full';

        function rebuildSummary(filterFn, includeSummary){
          if(!summaryHead || !summaryBody) return;
          summaryHead.innerHTML = '<th scope="col">No.</th><th scope="col">Section</th><th scope="col">Defect</th>';
          var rows = '';
          defectSections.forEach(function(sec){
            var cat = sec.getAttribute('data-cat');
            if(filterFn && !filterFn(cat)) return;
            var num = sec.getAttribute('data-numbering') || '';
            var label = sec.getAttribute('data-section-label') || '';
            var title = sec.getAttribute('data-defect-title') || '';
            var summary = sec.getAttribute('data-defect-summary') || '';
            var colorHex = {
              'red': '#d32f2f',
              'orange': '#f57c00',
              'blue': '#1976d2',
              'purple': '#6a1b9a'
            }[cat] || '#d32f2f';
            rows += '<tr class="rpt-summary-row" data-target="'+sec.id+'" tabindex="0" role="link" aria-label="Jump to '+num+': '+title+'" style="border-left:6px solid #94a3b8;">'+
              '<td>'+num+'</td><td>'+label+'</td><td>'+title+'</td>' + (includeSummary ? '<td>'+summary+'</td>' : '') + '</tr>';
          });
          summaryBody.innerHTML = rows || '<tr><td colspan="'+(includeSummary?4:3)+'">No defects match this view.</td></tr>';
          Array.prototype.forEach.call(summaryBody.querySelectorAll('.rpt-summary-row'), function(row){
            row.addEventListener('click', function(){
              var targetId = row.getAttribute('data-target');
              if(!targetId) return; var el = document.getElementById(targetId); if(el){ el.scrollIntoView({behavior:'smooth',block:'start'});} });
            row.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); row.click(); }});
          });
        }

        function setMode(mode){
          if(mode===currentMode) return; currentMode = mode;
          // Visual state for desktop buttons & dropdown items
          Array.prototype.forEach.call(toolbar.querySelectorAll('.mode-btn, .export-toolbar-dropdown .dropdown-item'), function(btn){
            if(btn.getAttribute('data-mode')===mode){
              btn.classList.add('active');
              btn.style.background='#D00909';
              btn.style.borderColor='#D00909';
              btn.style.cursor='default';
            } else {
              btn.classList.remove('active');
              btn.style.background='#333';
              btn.style.borderColor='#333';
              btn.style.cursor='pointer';
            }
          });
          // Intro sections
            introSections.forEach(function(sec){ sec.style.display = (mode==='full') ? '' : 'none'; });
          // Defect filtering
          defectSections.forEach(function(sec){
            var cat = sec.getAttribute('data-cat');
            if(mode==='summary'){ sec.style.display = (cat==='blue') ? 'none' : ''; }
            else if(mode==='hazard'){ sec.style.display = (cat==='red' || cat==='purple') ? '' : 'none'; }
            else { sec.style.display = ''; }
          });
          if(mode==='summary') rebuildSummary(function(cat){ return cat!=='blue'; }, true);
          else if(mode==='hazard') rebuildSummary(function(cat){ return cat==='red' || cat==='purple'; }, false);
          else rebuildSummary(null, false);
          window.scrollTo({ top:0, behavior:'smooth' });
        }
        Array.prototype.forEach.call(toolbar.querySelectorAll('.mode-btn'), function(btn){ btn.addEventListener('click', function(){ setMode(btn.getAttribute('data-mode')); }); });
        // Mobile dropdown toggle & items
        var toggleBtn = toolbar ? toolbar.querySelector('.export-toolbar-toggle') : null;
        var dropdown = toolbar ? toolbar.querySelector('.export-toolbar-dropdown') : null;
        if(toggleBtn && dropdown){
          toggleBtn.addEventListener('click', function(e){
            e.stopPropagation();
            var open = dropdown.classList.toggle('open');
            toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
          });
          document.addEventListener('click', function(e){
            if(!toolbar.contains(e.target)){
              dropdown.classList.remove('open');
              toggleBtn.setAttribute('aria-expanded','false');
            }
          });
          Array.prototype.forEach.call(dropdown.querySelectorAll('.dropdown-item'), function(item){
            item.addEventListener('click', function(){
              dropdown.classList.remove('open');
              toggleBtn.setAttribute('aria-expanded','false');
              setMode(item.getAttribute('data-mode'));
            });
          });
        }
      })();
    </script>
  </div>
</body>
</html>`;

      // Upload HTML to R2, receive processed HTML (with inlined images), then download that
      try {
        console.log(`📤 Uploading HTML to R2 (for rewrite + permanence)...`);
        const uploadRes = await fetch('/api/reports/upload-html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            htmlContent: doc,
            inspectionId: resolvedInspectionId,
            reportMode: reportType
          })
        });
        let downloadHtml = doc;
        if (uploadRes.ok) {
          const { url: permanentUrl, html: processedHtml } = await uploadRes.json();
          if (processedHtml && typeof processedHtml === 'string') {
            downloadHtml = processedHtml;
          }
          console.log(`✅ HTML uploaded to: ${permanentUrl}`);
          // Refresh inspection data to get the new permanent URL
        const inspectionRes = await fetch(`/api/inspections/${resolvedInspectionId}`);
          if (inspectionRes.ok) {
            const updatedInspection = await inspectionRes.json();
            setInspection(updatedInspection);
            if (updatedInspection.htmlReportUrl) {
              console.log(`✅ Permanent HTML URL available: ${updatedInspection.htmlReportUrl}`);
            }
          }
        } else {
          console.error('⚠️ Failed to upload HTML to R2; downloading original HTML');
        }
        // Trigger download using processed (or original) HTML
        const blob = new Blob([downloadHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (uploadError) {
        console.error('⚠️ HTML upload error; downloading original HTML:', uploadError);
        const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      
    } catch (e) {
      console.error('HTML export failed', e);
      alert('Failed to export HTML. See console for details.');
    }
  };

  useEffect(() => {
    async function fetchDefects() {
      try {
        setLoading(true);
        const res = await fetch(`/api/defects/${resolvedInspectionId}`);
        if (!res.ok) throw new Error("Failed to fetch defects");
        const data = await res.json();
        console.log(data);
        setDefects(data);
      } catch (err) {
        console.error("Error fetching defects:", err);
      } finally {
        setLoading(false);
      }
    }

    async function fetchInformationBlocks() {
      try {
        const res = await fetch(`/api/information-sections/${resolvedInspectionId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setInformationBlocks(json.data);
          }
        }
      } catch (err) {
        console.error("Error fetching information blocks:", err);
      }
    }

    if (resolvedInspectionId) {
      fetchDefects();
      fetchInformationBlocks();
    }
    
    // Refetch information blocks when window regains focus (e.g., returning from image editor)
    const handleFocus = () => {
      if (resolvedInspectionId) {
        console.log('🔄 Window regained focus, refetching information blocks...');
        fetchInformationBlocks();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [resolvedInspectionId]);

  const [reportSections, setReportSections] = useState<any[]>([]);

  useEffect(() => {
    if (defects?.length && sections?.length) {
      const normalizeSectionName = (value: string) =>
        (value || '')
          .replace(/^[0-9]+\s*-\s*/, '')
          .replace(/[&/]/g, ' and ')
          .replace(/[^a-z0-9]+/gi, ' ')
          .replace(/\band\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

      // Create a mapping from section name to order_index
      const sectionMetadataMap = new Map<string, { orderIndex?: number; actualName: string }>();
      
      // Store both exact matches and cleaned names
      sections.forEach((section: any) => {
        const actualName = (section.name || '').replace(/^\d+\s*-\s*/, '').trim() || section.name || '';
        const normalized = normalizeSectionName(section.name || actualName);
        sectionMetadataMap.set(normalized, {
          orderIndex:
            typeof section.order_index === 'number'
              ? section.order_index
              : Number(section.order_index) || undefined,
          actualName,
        });
      });
      
      // Helper function to get section number and actual section name from defect
      const getSectionInfo = (defect: any): { orderIndex: number; actualSectionName: string } => {
        const sectionName = defect.section || '';
        const normalized = normalizeSectionName(sectionName);
        const explicitNumberMatch = sectionName.match(/^(\d{1,3})/);
        const explicitSectionNumber = explicitNumberMatch ? Number(explicitNumberMatch[1]) : undefined;

        let matchedMeta = normalized ? sectionMetadataMap.get(normalized) : undefined;

        if (!matchedMeta && normalized) {
          sectionMetadataMap.forEach((value, key) => {
            if (matchedMeta) return;
            if (key.includes(normalized) || normalized.includes(key)) {
              matchedMeta = value;
            }
          });
        }

        let orderIndex = matchedMeta?.orderIndex ?? explicitSectionNumber;
        let actualSectionName =
          matchedMeta?.actualName || sectionName.replace(/^\d+\s*-\s*/, '').trim() || sectionName || 'General';

        if (!orderIndex) {
          orderIndex = 999;
        }
        
        return { orderIndex, actualSectionName };
      };

      // Sort defects by section order_index, then by subsection alphabetically
      const sortedDefects = [...defects].sort((a, b) => {
        // Primary sort: by section order_index
        const sectionOrderA = getSectionInfo(a).orderIndex;
        const sectionOrderB = getSectionInfo(b).orderIndex;
        if (sectionOrderA !== sectionOrderB) {
          return sectionOrderA - sectionOrderB;
        }
        
        // Secondary sort: alphabetically by subsection name
        const subsectionA = (a.subsection || '').toLowerCase();
        const subsectionB = (b.subsection || '').toLowerCase();
        if (subsectionA < subsectionB) return -1;
        if (subsectionA > subsectionB) return 1;
        
        return 0;
      });

      // Calculate defect numbering: use section's order_index as section number
      const subsectionNumbers = new Map<string, Map<string, number>>();
      const defectCounters = new Map<string, number>();

      const mapped = sortedDefects.map((defect) => {
        const sectionInfo = getSectionInfo(defect);
        const sectionNum = sectionInfo.orderIndex;
        const actualSectionName = sectionInfo.actualSectionName;
        const subsectionKey = defect.subsection;
        const fullKey = `${actualSectionName}|||${subsectionKey}`;
        
        // Initialize subsection map for this section if not exists
        if (!subsectionNumbers.has(actualSectionName)) {
          subsectionNumbers.set(actualSectionName, new Map());
        }
        
        const subsectionMap = subsectionNumbers.get(actualSectionName)!;
        
        // Assign subsection number if new subsection within this section
        if (!subsectionMap.has(subsectionKey)) {
          subsectionMap.set(subsectionKey, subsectionMap.size + 1);
        }
        
        const subsectionNum = subsectionMap.get(subsectionKey)!;
        
        // Increment defect counter for this subsection
        const currentCount = defectCounters.get(fullKey) || 0;
        const defectNum = currentCount + 1;
        defectCounters.set(fullKey, defectNum);
        
        // Create display number: Section.Subsection.Defect (e.g., "4.1.2")
        const numbering = `${sectionNum}.${subsectionNum}.${defectNum}`;
        
        console.log('DEFECTS', defect);

        const rawDescription = defect.defect_description || "";
        const defectParts = splitDefectText(rawDescription);
        const summaryTitle = (defect.defect && String(defect.defect).trim())
          || defectParts.title
          || rawDescription.split(/\n|\./)[0]?.trim()
          || "";
        const bodyParagraphs = defectParts.paragraphs.length
          ? defectParts.paragraphs
          : defectParts.body && defectParts.body !== summaryTitle
            ? [defectParts.body]
            : [];

        const anchorId = `defect-${defect._id || numbering.replace(/\./g, '-')}`;

        // Calculate total cost (materials + labor) and apply photo multiplier
        const toNumber = (value: unknown) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : 0;
        };

        const materialCost = toNumber(defect.base_cost ?? defect.material_total_cost);
        const laborRate = toNumber(defect.labor_rate);
        const hoursRequired = toNumber(defect.hours_required);
        const laborCost = laborRate * hoursRequired;
        const baseCost = materialCost + laborCost;
        const photoCount = 1 + (defect.additional_images?.length || 0);
        const totalEstimatedCost = baseCost * photoCount;

        return {
          id: defect._id,
          anchorId,
          numbering,
          sectionName: actualSectionName, // Use actual section name from database
          subsectionName: defect.subsection,
          sectionHeading: `Section ${sectionNum} - ${actualSectionName}`, // Use actual section name
          subsectionHeading: `${sectionNum}.${subsectionNum} - ${defect.subsection}`,
          heading2: `${actualSectionName} - ${defect.subsection}`, // Use actual section name
          heading: `${numbering} ${defect.subsection}`,
          image: defect.image,
          isThreeSixty: Boolean(defect.isThreeSixty),
          additional_images: defect.additional_images || [],
          base_cost: defect.base_cost,
          defect: summaryTitle,
          defectTitle: summaryTitle,
          defectParagraphs: bodyParagraphs,
          defectBody: defectParts.body,
          defect_description: rawDescription,
          location: defect.location,
          color: defect.color || defect.selectedArrowColor || '#d63636', // Add individual color for each section
          video: defect.video,
          type: defect.type,
          thumbnail: defect.thumbnail,
          estimatedCosts: {
            materials: "General materials",
            materialsCost: defect.material_total_cost,
            labor: defect.labor_type,
            laborRate: defect.labor_rate,
            hoursRequired: defect.hours_required,
            recommendation: defect.recommendation,
            totalEstimatedCost,
          },
        };
      });

      setReportSections(mapped);
    }
  }, [defects, sections]);

  // Robust color parsing helpers
  const parseColorToRgb = (input?: string): { r: number; g: number; b: number } | null => {
    if (!input) return null;
    const s = String(input).trim().toLowerCase();
    // #rgb or #rrggbb
    const hexMatch = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      let h = hexMatch[1];
      if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      return { r, g, b };
    }
    // rgb() or rgba()
    const rgbMatch = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
    if (rgbMatch) {
      const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)));
      const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)));
      const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)));
      return { r, g, b };
    }
    return null;
  };

  const baseColors: Record<'red' | 'orange' | 'blue' | 'purple', { r: number; g: number; b: number }> = {
    red: { r: 220, g: 38, b: 38 },      // #dc2626
    orange: { r: 245, g: 158, b: 11 },  // #f59e0b
    blue: { r: 59, g: 130, b: 246 },    // #3b82f6
    purple: { r: 124, g: 58, b: 237 },  // #7c3aed
  };

  const nearestCategory = (color?: string): 'red' | 'orange' | 'blue' | 'purple' | null => {
    const rgb = parseColorToRgb(color);
    if (!rgb) return null;
    let bestKey: 'red' | 'orange' | 'blue' | 'purple' | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const key of Object.keys(baseColors) as Array<'red' | 'orange' | 'blue' | 'purple'>) {
      const b = baseColors[key];
      const d = (rgb.r - b.r) ** 2 + (rgb.g - b.g) ** 2 + (rgb.b - b.b) ** 2;
      if (d < bestDist) { bestDist = d; bestKey = key; }
    }
    return bestKey;
  };

  const isHazardColor = (input?: string) => {
    const cat = nearestCategory(input);
    return cat === 'red' || cat === 'purple';
  };

  const visibleSections = useMemo(() => {
    let sections = reportSections;
    
    // Filter sections based on mode
    if (filterMode === 'hazard') {
      sections = reportSections.filter((r) => isHazardColor(r.color));
    } else if (filterMode === 'summary') {
      // For summary, exclude blue (maintenance items) defects
      sections = reportSections.filter((r) => nearestCategory(r.color) !== 'blue');
    }
    
    // Add sections that have information blocks but no defects
    if (informationBlocks && informationBlocks.length > 0) {
      informationBlocks.forEach((block: any) => {
        const blockSection = typeof block.section_id === 'object' ? block.section_id?.name : null;
        const blockOrderIndex = typeof block.section_id === 'object' ? block.section_id?.order_index : null;
        if (!blockSection) return;
        
        // Clean section name (remove leading numbers like "9 - ")
        const cleanBlockSection = blockSection.replace(/^\d+\s*-\s*/, '');
        
        // Check if this section already exists in the sections array
        const sectionExists = sections.some((section) => {
          const cleanSectionName = (section.sectionName || '').replace(/^\d+\s*-\s*/, '');
          return cleanSectionName === cleanBlockSection;
        });
        
        // If section doesn't exist, create a virtual section entry for it
        if (!sectionExists) {
          sections.push({
            id: `info-only-${block._id}`,
            anchorId: `section-${blockSection.replace(/\s+/g, '-').toLowerCase()}`,
            numbering: '', // Will be assigned after sorting
            sectionName: cleanBlockSection, // Use cleaned section name for proper sorting
            subsectionName: '',
            sectionHeading: cleanBlockSection,
            subsectionHeading: '',
            heading2: cleanBlockSection,
            heading: cleanBlockSection,
            image: null,
            sectionOrderIndex: blockOrderIndex, // Store order_index for proper sorting
            defect: '',
            defectTitle: '',
            defectParagraphs: [],
            defectBody: '',
            defect_description: '',
            location: '',
            color: '#3b82f6', // Blue color for info-only sections
            video: null,
            type: 'information-only',
            thumbnail: null,
            estimatedCosts: {
              materials: '',
              materialsCost: 0,
              labor: '',
              laborRate: 0,
              hoursRequired: 0,
              recommendation: '',
              totalEstimatedCost: 0,
            },
            isInformationOnly: true, // Flag to identify information-only sections
          });
        }
      });
    }
    
    // Assign section numbers to information-only sections BEFORE sorting
    // First, collect section numbers from defect sections
    const sectionNumberMap = new Map<string, number>();
    
    // Pass 1: Extract existing section numbers from defects
    sections.forEach((section) => {
      if (!section.isInformationOnly && section.numbering) {
        const sectionName = section.sectionName;
        // Extract section number from numbering like "4.1.1" -> 4
        const sectionNum = parseInt(section.numbering.split('.')[0]);
        if (!sectionNumberMap.has(sectionName)) {
          sectionNumberMap.set(sectionName, sectionNum);
        }
      }
    });
    
    // Special rule: If an information-only section named "Orientation / Shutoffs" exists,
    // reserve Section 3 for it, but do NOT renumber existing sections.
    // We only assign 3 if it's not already used by another section number and if the
    // map doesn't already have a number for this exact section title.
    const orientationInfoSection = sections.find(
      (s) => s.isInformationOnly && (s.sectionName || '').trim().toLowerCase() === 'orientation / shutoffs'
    );
    if (orientationInfoSection) {
      const orientationTitle = orientationInfoSection.sectionName;
      const usedNums = new Set(Array.from(sectionNumberMap.values()));
      if (orientationTitle && !sectionNumberMap.has(orientationTitle) && !usedNums.has(3)) {
        sectionNumberMap.set(orientationTitle, 3);
      }
    }

    // Pass 2: Assign numbers to information-only sections based on their order_index from database
    sections.forEach((section) => {
      const sectionName = section.sectionName;
      
      if (section.isInformationOnly) {
        // Use order_index from database if available
        if (!sectionNumberMap.has(sectionName) && (section as any).sectionOrderIndex) {
          sectionNumberMap.set(sectionName, (section as any).sectionOrderIndex);
        } else if (!sectionNumberMap.has(sectionName)) {
          // Fallback: Find the next available section number
          let nextSectionNum = currentNumber;
          nextSectionNum++;
          while (Array.from(sectionNumberMap.values()).includes(nextSectionNum)) {
            nextSectionNum++;
          }
          sectionNumberMap.set(sectionName, nextSectionNum);
        }
        
        const sectionNum = sectionNumberMap.get(sectionName)!;
        section.sectionHeading = `Section ${sectionNum} - ${sectionName}`;
        section.heading = `Section ${sectionNum} - ${sectionName}`;
        section.heading2 = sectionName;
      }
    });
    
    // IMPORTANT: Sort ALL sections by section number (numerically, not alphabetically)
    sections = sections.sort((a, b) => {
      // Extract section numbers for comparison
      let sectionNumA = 0;
      let sectionNumB = 0;
      
      if (a.numbering) {
        // For defect sections, extract from numbering like "4.1.1" -> 4
        sectionNumA = parseInt(a.numbering.split('.')[0]);
      } else if (a.isInformationOnly) {
        // For information-only sections, get from map
        sectionNumA = sectionNumberMap.get(a.sectionName) || 999;
      }
      
      if (b.numbering) {
        sectionNumB = parseInt(b.numbering.split('.')[0]);
      } else if (b.isInformationOnly) {
        sectionNumB = sectionNumberMap.get(b.sectionName) || 999;
      }
      
      // Primary sort: by section number
      if (sectionNumA !== sectionNumB) {
        return sectionNumA - sectionNumB;
      }
      
      // Secondary sort: within same section, sort by subsection number
      if (a.numbering && b.numbering) {
        const subsectionNumA = parseInt(a.numbering.split('.')[1] || '0');
        const subsectionNumB = parseInt(b.numbering.split('.')[1] || '0');
        
        if (subsectionNumA !== subsectionNumB) {
          return subsectionNumA - subsectionNumB;
        }
        
        // Tertiary sort: within same subsection, sort by defect number
        const defectNumA = parseInt(a.numbering.split('.')[2] || '0');
        const defectNumB = parseInt(b.numbering.split('.')[2] || '0');
        
        return defectNumA - defectNumB;
      }
      
      return 0;
    });
    
    return sections;
  }, [reportSections, filterMode, informationBlocks, currentNumber]);

  // Group by section for sidebar
  const groupedBySection = useMemo(() => {
    const groups: Record<string, { count: number; firstAnchor: string | null; items: Array<{ title: string; numbering: string; anchorId: string }> }> = {};
    // Only include actual defects, not information-only sections
    for (const r of reportSections) {
      const key = r.sectionName || 'Other';
      if (!groups[key]) {
        groups[key] = { count: 0, firstAnchor: null, items: [] };
      }
      groups[key].count += 1;
      if (!groups[key].firstAnchor) groups[key].firstAnchor = r.anchorId;
      groups[key].items.push({ title: r.heading2?.split(' - ')[1] || r.defect || '', numbering: r.numbering, anchorId: r.anchorId });
    }
    return groups;
  }, [reportSections]);

  // Scrollspy with IntersectionObserver
  useEffect(() => {
    if (!reportSections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveAnchor(visible.target.id);
        }
      },
      { root: null, rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    reportSections.forEach((r) => {
      const el = document.getElementById(r.anchorId);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [reportSections]);

  const colorToImportance = useCallback((input?: string) => {
    const cat = nearestCategory(input);
    switch (cat) {
      case 'red': return 'Immediate Attention';
      case 'orange': return 'Items for Repair';
      case 'blue': return 'Maintenance Items';
      case 'purple': return 'Further Evaluation';
      default: return 'Immediate Attention';
    }
  }, []);

  return (
    <div className={styles.userReportContainer}>
      
      <main className="py-8">
        {/* Removed top Download PDF button for clarity; use Export PDF in toolbar */}
        <div className={`${styles.reportLayout} ${styles.noSidebar}`}>
          <div ref={reportRef} className={styles.mainContent}>
            <div className={styles.reportSectionsContainer}>
              {/* Header Image Display - At the very top */}
              {(() => {
                console.log('🎨 Header Image Render Check:', {
                  hasHeaderImage: !!headerImage,
                  headerImageValue: headerImage,
                  renderCondition: !!headerImage
                });
                return headerImage && (
                  <div className={styles.headerImageDisplay}>
                    <img 
                      src={getProxiedSrc(headerImage)} 
                      alt="Report Header" 
                      className={styles.headerImage}
                      onError={handleImgError}
                      onLoad={() => {
                        console.log('✅ Header image loaded successfully:', headerImage);
                      }}
                    />
                    {/* Header Text - Below the image */}
                    <div className={styles.headerTextContainer}>
                      {(inspection?.headerName || inspection?.headerAddress || headerText) && (
                        <div style={{ textAlign:'center', marginBottom:'8px' }}>
                          { (inspection?.headerName || headerText?.split('\n')[0]) && (
                            <h1 className={styles.inspectionTitle} style={{ margin:'0 0 4px 0', fontSize:'1.75rem' }}>
                              {inspection?.headerName || headerText?.split('\n')[0]}
                            </h1>) }
                          { (inspection?.headerAddress || headerText?.split('\n').slice(1).join(' ')) && (
                            <div style={{fontSize:'1.75rem', fontWeight:700, color:'#1f2937', marginTop:'2px'}}>
                              {inspection?.headerAddress || headerText?.split('\n').slice(1).join(' ')}
                            </div>) }
                        </div>
                      )}
                      <h2 className={styles.reportTitle}>HOME INSPECTION REPORT</h2>
                    </div>
                  </div>
                );
              })()}
              
              {/* Permanent Report Links Section */}
              <PermanentReportLinks
                pdfReportUrl={inspection?.pdfReportUrl}
                htmlReportUrl={inspection?.htmlReportUrl}
                pdfGeneratedAt={inspection?.pdfReportGeneratedAt}
                htmlGeneratedAt={inspection?.htmlReportGeneratedAt}
              />
              
              <div className={styles.reportToolbar} role="tablist" aria-label="Report view">
                <div className={styles.toolbarGroup}>
                <button
                  role="tab"
                  aria-selected={filterMode === 'full'}
                  className={`${styles.toolbarBtn} ${filterMode === 'full' ? styles.toolbarBtnActive : ''}`}
                  onClick={() => { setFilterMode('full'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  Full Report
                </button>
                <button
                  role="tab"
                  aria-selected={filterMode === 'summary'}
                  className={`${styles.toolbarBtn} ${filterMode === 'summary' ? styles.toolbarBtnActive : ''}`}
                  onClick={() => { setFilterMode('summary'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  Summary
                </button>
                <button
                  role="tab"
                  aria-selected={filterMode === 'hazard'}
                  className={`${styles.toolbarBtn} ${styles.toolbarBtnDanger} ${filterMode === 'hazard' ? styles.toolbarBtnActive : ''}`}
                  onClick={() => { setFilterMode('hazard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  Immediate Attention
                </button>
                </div>
                {/* Report Viewing Options dropdown (contains view + export actions) */}
                <div ref={menuRef} className={styles.toolbarMenuContainer}>
                  <button
                    className={`${styles.toolbarBtn} ${styles.toolbarMenuBtn}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                    title="Report Viewing Options"
                  >
                    Report Viewing Options ▾
                  </button>
                  {menuOpen && (
                    <div className={styles.toolbarMenuDropdown} role="menu">
                      <button
                        role="menuitem"
                        className={styles.toolbarMenuItem}
                        onClick={() => { setMenuOpen(false); setFilterMode('full'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      >
                        Full Report
                      </button>
                      <button
                        role="menuitem"
                        className={styles.toolbarMenuItem}
                        onClick={() => { setMenuOpen(false); setFilterMode('summary'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      >
                        Summary
                      </button>
                      <button
                        role="menuitem"
                        className={`${styles.toolbarMenuItem} ${styles.toolbarBtnDanger}`}
                        onClick={() => { setMenuOpen(false); setFilterMode('hazard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      >
                        Immediate Attention
                      </button>
                      <div className={styles.toolbarMenuDivider} aria-hidden="true" />
                      <button
                        role="menuitem"
                        className={styles.toolbarMenuItem}
                        onClick={() => { setMenuOpen(false); handleDownloadHTML('summary'); }}
                      >
                        Export HTML Summary
                      </button>
                      <button
                        role="menuitem"
                        className={styles.toolbarMenuItem}
                        onClick={() => { setMenuOpen(false); handleDownloadHTML('full'); }}
                      >
                        Export HTML Full Report
                      </button>
                      <button
                        role="menuitem"
                        className={styles.toolbarMenuItem}
                        onClick={() => { setMenuOpen(false); handleDownloadPDF('summary'); }}
                      >
                        Export PDF Summary
                      </button>
                      <button
                        role="menuitem"
                        className={styles.toolbarMenuItem}
                        onClick={() => { setMenuOpen(false); handleDownloadPDF('full'); }}
                      >
                        Export PDF Full Report
                      </button>
                    </div>
                  )}
                </div>
                <div className={styles.toolbarRightGroup}>
                  {canShowMakeSampleButton && (
                    <button
                      type="button"
                      className={styles.toolbarBtn}
                      onClick={handleOpenSampleModal}
                      disabled={sampleSaving}
                      style={sampleSaving ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                    >
                      Make A Sample Report
                    </button>
                  )}
                  {/* HTML Dropdown */}
                  <div ref={htmlDropdownRef} className={styles.htmlDropdownContainer}>
                    <button 
                      className={styles.toolbarBtn} 
                      onClick={() => setHtmlDropdownOpen(!htmlDropdownOpen)} 
                      title="Export HTML"
                    >
                      Export HTML ▾
                    </button>
                    {htmlDropdownOpen && (
                      <div className={styles.htmlDropdown}>
                        <button
                          className={styles.htmlDropdownItem}
                          onClick={() => {
                            setHtmlDropdownOpen(false);
                            handleDownloadHTML('summary');
                          }}
                        >
                          Summary
                        </button>
                        <button
                          className={styles.htmlDropdownItem}
                          onClick={() => {
                            setHtmlDropdownOpen(false);
                            handleDownloadHTML('full');
                          }}
                        >
                          Full Report
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* PDF Dropdown */}
                  <div ref={pdfDropdownRef} className={styles.pdfDropdownContainer}>
                    <button 
                      className={styles.toolbarBtn} 
                      onClick={() => setPdfDropdownOpen(!pdfDropdownOpen)} 
                      title="Export PDF"
                    >
                      Export PDF ▾
                    </button>
                    {pdfDropdownOpen && (
                      <div className={styles.pdfDropdown}>
                        <button
                          className={styles.pdfDropdownItem}
                          onClick={() => {
                            setPdfDropdownOpen(false);
                            handleDownloadPDF('summary');
                          }}
                        >
                          Summary
                        </button>
                        <button
                          className={styles.pdfDropdownItem}
                          onClick={() => {
                            setPdfDropdownOpen(false);
                            handleDownloadPDF('full');
                          }}
                        >
                          Full Report
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Defects Summary Table */}
              <section className={styles.summaryCard} aria-label="Inspection Defects — clickable links">
                <div className={styles.summaryHeader}>
                  <h2 className={styles.summaryTitle}>
                    Inspection Defects
                    <span style={{ fontSize: '0.65em', fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
                      (clickable links)
                    </span>
                  </h2>
                  
                </div>
                <div className={styles.summaryTableWrapper}>
                  <table className={styles.summaryTable}>
                    <thead>
                      <tr>
                        <th scope="col">No.</th>
                        <th scope="col">Section</th>
                        <th scope="col">Defect</th>
                        {/* Removed Defects summary column */}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSections.filter(s => !s.isInformationOnly).map((section) => {
                        const defectParts = splitDefectText(section.defect_description || section.defect || "");
                        const sectionLabel = section.heading2 || section.sectionName || '';
                        // Title (short) for the Defect column
                        const defectTitle = section.defectTitle ||
                          defectParts.title ||
                          (section.defect || "").split(/\n|\./)[0].trim();
                        // Removed defects summary column cell
                        // Defects summary column removed; no need to compute bodyCandidate/defectSummary

                        const cat = nearestCategory(section.color) || 'red';
                        let catClass = '';
                        if(cat === 'red') catClass = styles.summaryRowCatRed;
                        else if(cat === 'orange') catClass = styles.summaryRowCatOrange;
                        else if(cat === 'blue') catClass = styles.summaryRowCatBlue;
                        else if(cat === 'purple') catClass = styles.summaryRowCatPurple;
                        return (
                          <tr
                            key={section.anchorId}
                            className={`${styles.summaryRow} ${catClass}`}
                            onClick={() => scrollToAnchor(section.anchorId)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                scrollToAnchor(section.anchorId);
                              }
                            }}
                            role="link"
                            tabIndex={0}
                            aria-label={`Jump to defect ${section.numbering}: ${defectTitle}`}
                          >
                            <td>{section.numbering}</td>
                            <td>{sectionLabel}</td>
                            <td>{defectTitle}</td>
                          </tr>
                        );
                      })}
                      {visibleSections.length === 0 && (
                        <tr>
                          <td colSpan={3} className={styles.summaryEmpty}>No defects match this view.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              
                {visibleSections.map((section, idx) => {
                  const defectPartsView = splitDefectText(section.defect_description || section.defect || "");
                  const defectTitle = section.defectTitle || defectPartsView.title;
                  const defectParagraphsRaw = Array.isArray(section.defectParagraphs) && section.defectParagraphs.length
                    ? section.defectParagraphs
                    : defectPartsView.paragraphs.length
                      ? defectPartsView.paragraphs
                      : defectPartsView.body && defectPartsView.body !== defectTitle
                        ? [defectPartsView.body]
                        : [];
                  const defectParagraphs = defectParagraphsRaw
                    .map((paragraph: string) => paragraph?.trim?.())
                    .filter((paragraph: string | undefined): paragraph is string => Boolean(paragraph));

                  // Check if this is the first defect in a new section
                  const isNewSection = idx === 0 || visibleSections[idx - 1].sectionName !== section.sectionName;

                  // Build compact header label for mobile/compact view: "Section / Subsection"
                  const _cleanSectionName = String(section.sectionName || '').replace(/^\d+\s*-\s*/, '');
                  const _subLabelRaw = String(section.subsectionName || '').trim();
                  const _lowerClean = _cleanSectionName.toLowerCase();
                  let combinedSectionLabel = '' as string;
                  if (_cleanSectionName && _subLabelRaw) {
                    if (_subLabelRaw.toLowerCase().startsWith(_lowerClean)) {
                      const rest = _subLabelRaw.slice(_cleanSectionName.length).trim();
                      combinedSectionLabel = rest && !/^[\-\/•–—]/.test(rest)
                        ? `${_cleanSectionName} - ${rest}`
                        : `${_cleanSectionName}${rest ? ` ${rest}` : ''}`;
                    } else {
                      combinedSectionLabel = `${_cleanSectionName} / ${_subLabelRaw}`;
                    }
                  } else {
                    combinedSectionLabel = _subLabelRaw || _cleanSectionName;
                  }
                  const hasCombinedSectionLabel = Boolean(combinedSectionLabel && combinedSectionLabel.trim().length > 0);

                  // Render all information sections dynamically; no special-case exclusions

                  return (
                <div key={section.id}>
                  {/* Information-Only Section (no defects) */}
                  {section.isInformationOnly && filterMode === 'full' && (
                    <>
                      <div 
                        className={styles.sectionHeading}
                        style={{
                          '--selected-color': '#111827',
                          '--text-color': '#111827',
                          // Ensure this heading spans full width even inside any grid container
                          gridColumn: '1 / -1',
                          width: '100%'
                        } as React.CSSProperties}
                      >
                        <h2 className={styles.sectionHeadingText} style={{ color: '#111827' }}>
                          {section.sectionHeading}
                        </h2>
                      </div>
                      
                      {(() => {
                        const sectionName = section.sectionName || section.sectionHeading || '';
                        const block = informationBlocks.find(b => {
                          const blockSection = typeof b.section_id === 'object' ? b.section_id?.name : null;
                          if (!blockSection || !sectionName) return false;
                          const cleanSection = sectionName.replace(/^\d+\s*-\s*/, '');
                          const cleanBlock = blockSection.replace(/^\d+\s*-\s*/, '');
                          return cleanBlock === cleanSection;
                        });
                        
                        if (!block) return null;
                        
                        const allItems = block.selected_checklist_ids || [];
                        const hasContent = allItems.length > 0 || block.custom_text;
                        
                        if (!hasContent) return null;
                        
                        // Create selectedAnswersMap for answer choices
                        const selectedAnswersMap = new Map();
                        if (block.selected_answers && Array.isArray(block.selected_answers)) {
                          block.selected_answers.forEach((answerEntry: any) => {
                            if (answerEntry.checklist_id && Array.isArray(answerEntry.selected_answers)) {
                              selectedAnswersMap.set(answerEntry.checklist_id, answerEntry.selected_answers);
                            }
                          });
                        }
                        
                        return (
                          <div style={{ 
                            marginTop: '1.25rem', 
                            marginBottom: '2rem', 
                            backgroundColor: '#f8fafc', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '0.5rem', 
                            padding: '1.5rem',
                            // Force info card to span full row in any parent grid
                            gridColumn: '1 / -1',
                            width: '100%'
                          }}>
                            <div style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '1.25rem',
                              paddingBottom: '0.75rem',
                              borderBottom: '2px solid #3b82f6'
                            }}>
                              <h3 style={{ 
                                fontSize: '1rem',
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                color: '#1e40af',
                                margin: 0,
                                textTransform: 'uppercase'
                              }}>INFORMATION</h3>
                            </div>
                            
                            {(() => {
                              const statusItems = allItems.filter((item: any) => item.type === 'status');
                              const informationItems = allItems.filter((item: any) => item.type === 'information');
                              // If there's a single STATUS item with a long comment, render it full-width (1 column)
                              const longStatusCommentLen = (() => {
                                if (statusItems.length !== 1) return 0;
                                const only = statusItems[0];
                                const c = (only && (only.comment || only.value || '')).toString();
                                return c.length;
                              })();
                              const useFullWidthStatusLayout = statusItems.length === 1 && longStatusCommentLen > 140;
                              
                              return (
                                <>
                                  {statusItems.length > 0 && (
                                    <div 
                                      className={styles.informationGrid}
                                      style={{ 
                                        marginBottom: (informationItems.length > 0 || block.custom_text) ? '1.5rem' : '0',
                                        gridTemplateColumns: useFullWidthStatusLayout ? '1fr' : undefined,
                                        width: '100%'
                                      }}>
                                      {statusItems.map((item: any) => {
                                        const itemId = item._id || item;
                                        const itemImages = (block.images || []).filter((img: any) => img.checklist_id === itemId);
                                        const selectedAnswers = selectedAnswersMap.get(itemId) || [];
                                        const parts = item.text?.split(':') || [];
                                        const label = parts[0]?.trim() || '';
                                        const value = parts.slice(1).join(':').trim() || '';
                                        
                                        return (
                                          <div key={itemId} className={styles.informationGridItem} style={{ width: '100%' }}>
                                            <div>
                                              <span style={{ fontWeight: 700, color: '#000000' }}>{label}:</span>
                                              {value && (
                                                <span style={{ marginLeft: '0.25rem', fontWeight: 400, color: '#6b7280' }}>
                                                  {value}
                                                </span>
                                              )}
                                              {item.comment && (
                                                <div style={{ 
                                                  fontSize: '0.875rem',
                                                  color: '#374151',
                                                  lineHeight: 1.6,
                                                  marginTop: '0.5rem',
                                                  whiteSpace: 'pre-wrap'
                                                }}>
                                                  {item.comment}
                                                </div>
                                              )}
                                              {selectedAnswers.length > 0 && (
                                                <div style={{ marginLeft: '0.25rem', fontWeight: 400, color: '#6b7280', fontSize: '0.875rem' }}>
                                                  {selectedAnswers.join(', ')}
                                                </div>
                                              )}
                                            </div>
                                            {itemImages.length > 0 && (
                                              <div className={styles.informationImages} style={{ marginLeft: '0.75rem', marginTop: '0.75rem' }}>
                                                {itemImages.map((img: any, imgIdx: number) => (
                                                  <div key={imgIdx} style={{ position: 'relative' }}>
                                                    {img.isThreeSixty ? (
                                                      <div style={{ 
                                                        width: '100%', 
                                                        minWidth: isMobile ? '300px' : '400px',
                                                        marginBottom: '1rem' 
                                                      }}>
                                                        <ThreeSixtyViewer
                                                          imageUrl={getProxiedSrc(img.url)}
                                                          alt={`360° view for information item`}
                                                          width="100%"
                                                          height={isMobile ? "300px" : "400px"}
                                                        />
                                                      </div>
                                                    ) : (
                                                      <img
                                                        src={getProxiedSrc(img.url)}
                                                        alt="Item image"
                                                        onClick={() => openLightbox(getProxiedSrc(img.url))}
                                                        className={styles.informationImage}
                                                        onError={handleImgError}
                                                        loading="eager"
                                                      />
                                                    )}
                                                    {img.location && (
                                                      <div style={{ 
                                                        textAlign: 'center', 
                                                        fontSize: '0.75rem', 
                                                        color: '#6b7280', 
                                                        marginTop: '0.25rem',
                                                        fontWeight: 500
                                                      }}>
                                                        {img.location}
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  
                                  {informationItems.length > 0 && (
                                    <div style={{ 
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '1.25rem',
                                      marginBottom: block.custom_text ? '1.5rem' : '0'
                                    }}>
                                      {informationItems.map((item: any) => {
                                        const itemId = item._id || item;
                                        const itemImages = (block.images || []).filter((img: any) => img.checklist_id === itemId);
                                        const selectedAnswers = selectedAnswersMap.get(itemId) || [];
                                        const itemText = item.text || item;
                                        const itemComment = item.comment || '';
                                        
                                        return (
                                          <div key={itemId} style={{ 
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.5rem'
                                          }}>
                                            <div style={{ 
                                              fontWeight: 700,
                                              color: '#000000',
                                              fontSize: '0.9375rem'
                                            }}>
                                              {itemText}
                                            </div>
                                            {itemComment && (
                                              <div style={{ 
                                                fontSize: '0.875rem',
                                                color: '#374151',
                                                lineHeight: '1.6',
                                                whiteSpace: 'pre-wrap'
                                              }}>
                                                {itemComment}
                                              </div>
                                            )}
                                            {selectedAnswers.length > 0 && (
                                              <div style={{ 
                                                marginLeft: '0.75rem',
                                                fontSize: '0.8125rem',
                                                color: '#6b7280',
                                                lineHeight: '1.4'
                                              }}>
                                                {selectedAnswers.join(', ')}
                                              </div>
                                            )}
                                            {itemImages.length > 0 && (
                                              <div className={styles.informationImages} style={{ marginLeft: '0.75rem', marginTop: '0.75rem' }}>
                                                {itemImages.map((img: any, imgIdx: number) => (
                                                  <div key={imgIdx} style={{ position: 'relative' }}>
                                                    {img.isThreeSixty ? (
                                                      <div style={{ 
                                                        width: '100%', 
                                                        minWidth: isMobile ? '300px' : '400px',
                                                        marginBottom: '1rem' 
                                                      }}>
                                                        <ThreeSixtyViewer
                                                          imageUrl={getProxiedSrc(img.url)}
                                                          alt={`360° view for information item`}
                                                          width="100%"
                                                          height={isMobile ? "300px" : "400px"}
                                                        />
                                                      </div>
                                                    ) : (
                                                      <img
                                                        src={getProxiedSrc(img.url)}
                                                        alt="Item image"
                                                        onClick={() => openLightbox(getProxiedSrc(img.url))}
                                                        className={styles.informationImage}
                                                        onError={handleImgError}
                                                        loading="eager"
                                                      />
                                                    )}
                                                    {img.location && (
                                                      <div style={{ 
                                                        textAlign: 'center', 
                                                        fontSize: '0.75rem', 
                                                        color: '#6b7280', 
                                                        marginTop: '0.25rem',
                                                        fontWeight: 500
                                                      }}>
                                                        {img.location}
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            
                            {block.custom_text && (
                              <div style={{ 
                                borderTop: allItems.length > 0 ? '1px solid #e2e8f0' : 'none',
                                paddingTop: allItems.length > 0 ? '1rem' : '0'
                              }}>
                                <div style={{ 
                                  fontSize: '0.875rem', 
                                  fontWeight: 600,
                                  color: '#475569',
                                  marginBottom: '0.5rem',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.025em'
                                }}>Custom Notes</div>
                                <div style={{ 
                                  fontSize: '0.875rem', 
                                  lineHeight: '1.6',
                                  color: '#1f2937',
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {block.custom_text}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                  
                  {/* Main Section Heading (Black) - Only show when section changes AND section has defects (not information-only) */}
                  {isNewSection && !section.isInformationOnly && (
                    <>
                    <div 
                      className={styles.sectionHeading}
                      style={{
                        '--selected-color': '#111827',
                        '--text-color': '#111827',
                      } as React.CSSProperties}
                    >
                      <h2 className={styles.sectionHeadingText} style={{ color: '#111827' }}>
                        {section.sectionHeading}
                      </h2>
                    </div>

                    {/* Information Block - appears at top of section BEFORE defects (ONLY in Full Report mode) */}
                    {(() => {
                      // Don't show information blocks in Summary or Hazard modes
                      if (filterMode !== 'full') return null;
                      
                      const sectionName = section.sectionName || section.sectionHeading || '';
                      const block = informationBlocks.find(b => {
                        const blockSection = typeof b.section_id === 'object' ? b.section_id?.name : null;
                        if (!blockSection || !sectionName) return false;
                        // Match by removing leading numbers like "9 - " from both
                        const cleanSection = sectionName.replace(/^\d+\s*-\s*/, '');
                        const cleanBlock = blockSection.replace(/^\d+\s*-\s*/, '');
                        return cleanBlock === cleanSection;
                      });
                      
                      if (!block) return null;
                      
                      console.log('📊 Information block for section:', sectionName, {
                        blockId: block._id,
                        totalImages: block.images?.length || 0,
                        images: block.images
                      });
                      
                      // Get all checklist items
                      const allItems = block.selected_checklist_ids || [];
                      
                      const hasContent = allItems.length > 0 || block.custom_text;
                      
                      if (!hasContent) return null;
                      
                      // Create selectedAnswersMap for answer choices
                      const selectedAnswersMap = new Map();
                      if (block.selected_answers && Array.isArray(block.selected_answers)) {
                        block.selected_answers.forEach((answerEntry: any) => {
                          if (answerEntry.checklist_id && Array.isArray(answerEntry.selected_answers)) {
                            selectedAnswersMap.set(answerEntry.checklist_id, answerEntry.selected_answers);
                          }
                        });
                      }
                      
                      return (
                        <>
                          {/* INFORMATION Section - Unified display for all items */}
                          <div style={{ 
                            marginTop: '1.25rem', 
                            marginBottom: '2rem', 
                            backgroundColor: '#f8fafc', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '0.5rem', 
                            padding: '1.5rem',
                            gridColumn: '1 / -1',
                            width: '100%'
                          }}>
                            {/* Header */}
                            <div style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '1.25rem',
                              paddingBottom: '0.75rem',
                              borderBottom: '2px solid #3b82f6'
                            }}>
                              <h3 style={{ 
                                fontSize: '1rem',
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                color: '#1e40af',
                                margin: 0,
                                textTransform: 'uppercase'
                              }}>INFORMATION</h3>
                            </div>
                            
                            {/* Separate rendering for status vs information items */}
                            {(() => {
                              const statusItems = allItems.filter((item: any) => item.type === 'status');
                              const informationItems = allItems.filter((item: any) => item.type === 'information');
                              
                              return (
                                <>
                                  {/* 3-Column Grid for STATUS items only */}
                                  {statusItems.length > 0 && (
                                    <div 
                                      className={styles.informationGrid}
                                      style={{ 
                                        marginBottom: (informationItems.length > 0 || block.custom_text) ? '1.5rem' : '0'
                                      }}>
                                      {statusItems.map((item: any) => {
                                        const itemId = item._id || item;
                                        const itemImages = (block.images || []).filter((img: any) => img.checklist_id === itemId);
                                        const selectedAnswers = selectedAnswersMap.get(itemId) || [];
                                        const parts = item.text?.split(':') || [];
                                        const label = parts[0]?.trim() || '';
                                        const value = parts.slice(1).join(':').trim() || '';
                                        
                                        return (
                                          <div key={itemId} className={styles.informationGridItem}>
                                            <div>
                                              <span style={{ fontWeight: 700, color: '#000000' }}>{label}:</span>
                                              {value && (
                                                <span style={{ 
                                                  marginLeft: '0.25rem',
                                                  fontWeight: 400,
                                                  color: '#6b7280'
                                                }}>
                                                  {value}
                                                </span>
                                              )}
                                              {item.comment && (
                                                <div style={{ 
                                                  fontSize: '0.875rem', 
                                                  color: '#374151', 
                                                  lineHeight: 1.6, 
                                                  marginTop: '0.5rem',
                                                  whiteSpace: 'pre-wrap'
                                                }}>
                                                  {item.comment}
                                                </div>
                                              )}
                                              {selectedAnswers.length > 0 && (
                                                <div style={{ marginLeft: '0.25rem', fontWeight: 400, color: '#6b7280', fontSize: '0.875rem' }}>
                                                  {selectedAnswers.join(', ')}
                                                </div>
                                              )}
                                            </div>
                                            {itemImages.length > 0 && (
                                              <div className={styles.informationImages}>
                                                {itemImages.map((img: any, imgIdx: number) => (
                                                  <div key={imgIdx} style={{ position: 'relative' }}>
                                                    {img.isThreeSixty ? (
                                                      <div style={{ 
                                                        width: '100%', 
                                                        minWidth: isMobile ? '300px' : '400px',
                                                        marginBottom: '1rem' 
                                                      }}>
                                                        <ThreeSixtyViewer
                                                          imageUrl={getProxiedSrc(img.url)}
                                                          alt={`360° view for information item`}
                                                          width="100%"
                                                          height={isMobile ? "300px" : "400px"}
                                                        />
                                                      </div>
                                                    ) : (
                                                      <img
                                                        src={getProxiedSrc(img.url)}
                                                        alt="Item image"
                                                        onClick={() => openLightbox(getProxiedSrc(img.url))}
                                                        className={styles.informationImage}
                                                        onError={handleImgError}
                                                        loading="eager"
                                                      />
                                                    )}
                                                    {img.location && (
                                                      <div style={{ 
                                                        textAlign: 'center', 
                                                        fontSize: '0.75rem', 
                                                        color: '#6b7280', 
                                                        marginTop: '0.25rem',
                                                        fontWeight: 500
                                                      }}>
                                                        {img.location}
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  
                                  {/* Vertical Stack for INFORMATION items (full-width) */}
                                  {informationItems.length > 0 && (
                                    <div style={{ 
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '1.75rem',
                                      marginBottom: block.custom_text ? '1.5rem' : '0'
                                    }}>
                                      {informationItems.map((item: any) => {
                                        const itemId = item._id || item;
                                        const itemImages = (block.images || []).filter((img: any) => img.checklist_id === itemId);
                                        const selectedAnswers = selectedAnswersMap.get(itemId) || [];
                                        const itemText = item.text || item;
                                        const itemComment = item.comment || '';
                                        
                                        // Helper function to format structured content
                                        const formatContent = (text: string) => {
                                          // First, intelligently split the text into logical sections
                                          // Add line breaks before major patterns
                                          let preprocessed = text
                                            // Special patterns for "Inspections Disclaimer"
                                            // Add break after "Purpose:" heading
                                            .replace(/(Purpose:)(\s*The home)/g, '$1\n\n$2')
                                            // Add break before "No responsibility"
                                            .replace(/(sections\.)(\s*No responsibility)/g, '$1\n\n$2')
                                            // Add break before "Scope:"
                                            .replace(/(purpose\.)(\s*Scope:)/g, '$1\n\n$2')
                                            // Add break after "Scope:" section before "Report Limitations"
                                            .replace(/(deadfront\.)(\s*Report Limitations)/g, '$1\n\n$2')
                                            // Add break after "Report Limitations & Exclusions:" before paragraph
                                            .replace(/(Report Limitations & Exclusions:)(\s*The Report)/g, '$1\n\n$2')
                                            // Add break before "AGI accepts"
                                            .replace(/(building\.)(\s*AGI accepts)/g, '$1\n\n$2')
                                            // Add break before numbered item "1. which are below"
                                            .replace(/(building:)(\s*1\.\s)/g, '$1\n\n$2')
                                            // Add break before numbered item "2. which required"
                                            .replace(/(wiring\);)(\s*2\.\s)/g, '$1\n\n$2')
                                            // Add break before "In addition"
                                            .replace(/(possible\.)(\s*In addition)/g, '$1\n\n$2')
                                            // Add break before "Any area, system"
                                            .replace(/(them\.)(\s*Any area)/g, '$1\n\n$2')
                                            // Add break before "Descriptions in the Report"
                                            .replace(/(Report\.)(\s*Descriptions in the Report)/g, '$1\n\n$2')
                                            // Add break before "The Report:" (with colon)
                                            .replace(/(appliances\.)(\s*The Report:)/g, '$1\n\n$2')
                                            // Add break before "AGI has not undertaken"
                                            .replace(/(property\.)(\s*AGI has not undertaken)/g, '$1\n\n$2')
                                            // Add break before "No property survey"
                                            .replace(/(property\.)(\s*No property survey)/g, '$1\n\n$2')
                                            // Add break before "Unit Title Properties:"
                                            .replace(/(search\.)(\s*Unit Title Properties:)/g, '$1\n\n$2')
                                            // Add break before "AGI recommends"
                                            .replace(/(areas\.)(\s*AGI recommends)/g, '$1\n\n$2')
                                            // Add break before "Responsibility to Third Parties:"
                                            .replace(/(Corporate\.)(\s*Responsibility to Third Parties:)/g, '$1\n\n$2')
                                            // Add break before "AGI reserves"
                                            .replace(/(Report\.)(\s*AGI reserves)/g, '$1\n\n$2')
                                            // Add break before "Publication:"
                                            .replace(/(party\.)(\s*Publication:)/g, '$1\n\n$2')
                                            // Add break before "Claims & Disputes:"
                                            .replace(/(inspector\.)(\s*Claims & Disputes:)/g, '$1\n\n$2')
                                            // Add break before "Any claim relating"
                                            .replace(/(matter\.)(\s*Any claim relating)/g, '$1\n\n$2')
                                            // Add break before "Except in the case"
                                            .replace(/(Agreement\)\.)(\s*Except in the case)/g, '$1\n\n$2')
                                            // Add break before "Limitation of Liability:"
                                            .replace(/(matter\.)(\s*Limitation of Liability:)/g, '$1\n\n$2')
                                            // Add break before "AGI shall have no liability"
                                            .replace(/(client\.)(\s*AGI shall have no)/g, '$1\n\n$2')
                                            // Add break before "Subject to any statutory"
                                            .replace(/(loss\.)(\s*Subject to any)/g, '$1\n\n$2')
                                            // Add break before "Consumer Guarantees Act:"
                                            .replace(/(inspection\.)(\s*Consumer Guarantees Act:)/g, '$1\n\n$2')
                                            // Add break before "Partial Invalidity:"
                                            .replace(/(law\.)(\s*Partial Invalidity:)/g, '$1\n\n$2')
                                            
                                            // Original patterns
                                            // Special case: Add break after "FINAL WALK-THROUGH" before the paragraph
                                            .replace(/(FINAL WALK-THROUGH)([A-Z][a-z])/g, '$1\n\n$2')
                                            // Add break after "Read sellers disclosure." before "The links below"
                                            .replace(/(Read sellers disclosure\.)(\s*The links below)/g, '$1\n\n$2')
                                            // Add break after "ENERGY SAVING WEBSITES/TIPS:" before "Perhaps"
                                            .replace(/(ENERGY SAVING WEBSITES\/TIPS:)(\s*Perhaps)/g, '$1\n\n$2')
                                            // Add break after "can be made." before "By checking out"
                                            .replace(/(can be made\.)(\s*By checking out)/g, '$1\n\n$2')
                                            // Add break before ALL CAPS headings (but not at start)
                                            .replace(/([a-z.,)])([A-Z][A-Z\s,/]+[-:])/g, '$1\n\n$2')
                                            // Separate concatenated URLs (energystar.gov/http://)
                                            .replace(/(\.gov\/)(https?:\/\/)/gi, '$1\n$2')
                                            .replace(/(\.org)(https?:\/\/)/gi, '$1\n$2')
                                            // Add break AFTER category headings and BEFORE their URLs
                                            .replace(/([A-Z\s,/]+-)(https?:\/\/)/g, '$1\n$2')
                                            // Add break before numbered items
                                            .replace(/([a-z.,)])(\d+\.\s)/g, '$1\n$2')
                                            // Add break before bullet items
                                            .replace(/([a-z.,)])(-\s[A-Z])/g, '$1\n$2')
                                            // Add break before URLs (but not at start)
                                            .replace(/([a-z)])(\s*https?:\/\/)/gi, '$1\n$2')
                                            // Add break after paragraph sentences before "The following"
                                            .replace(/(inspection\.)(\s*The following)/g, '$1\n\n$2')
                                            // Add break before "Perhaps you never"
                                            .replace(/([a-z.,)])(\s*Perhaps you never)/g, '$1\n\n$2')
                                            // Add break before "By checking out"
                                            .replace(/(contractor:)(\s*https?)/gi, '$1\n$2');
                                          
                                          const lines = preprocessed.split('\n');
                                          const elements: React.JSX.Element[] = [];
                                          let currentParagraph = '';
                                          
                                          lines.forEach((line, idx) => {
                                            const trimmed = line.trim();
                                            if (!trimmed) return; // Skip empty lines
                                            
                                            // Numbered list item (e.g., "1. Check the heating...")
                                            if (/^\d+\.\s/.test(trimmed)) {
                                              if (currentParagraph) {
                                                elements.push(
                                                  <p key={`p-${idx}`} style={{ 
                                                    margin: '0 0 1rem 0', 
                                                    lineHeight: '1.6',
                                                    fontSize: '0.875rem',
                                                    color: '#374151'
                                                  }}>
                                                    {currentParagraph}
                                                  </p>
                                                );
                                                currentParagraph = '';
                                              }
                                              elements.push(
                                                <div key={`num-${idx}`} style={{ 
                                                  marginLeft: '1rem', 
                                                  marginBottom: '0.5rem',
                                                  fontSize: '0.875rem',
                                                  lineHeight: '1.6',
                                                  color: '#374151'
                                                }}>
                                                  {trimmed}
                                                </div>
                                              );
                                            }
                                            // Bullet list item (e.g., "- All Interior...")
                                            else if (/^-\s/.test(trimmed)) {
                                              if (currentParagraph) {
                                                elements.push(
                                                  <p key={`p-${idx}`} style={{ 
                                                    margin: '0 0 1rem 0', 
                                                    lineHeight: '1.6',
                                                    fontSize: '0.875rem',
                                                    color: '#374151'
                                                  }}>
                                                    {currentParagraph}
                                                  </p>
                                                );
                                                currentParagraph = '';
                                              }
                                              elements.push(
                                                <div key={`bullet-${idx}`} style={{ 
                                                  marginLeft: '1.5rem', 
                                                  marginBottom: '0.375rem',
                                                  fontSize: '0.875rem',
                                                  lineHeight: '1.6',
                                                  paddingLeft: '0.5rem',
                                                  position: 'relative',
                                                  color: '#374151'
                                                }}>
                                                  <span style={{ position: 'absolute', left: '-1rem' }}>•</span>
                                                  {trimmed.substring(2)}
                                                </div>
                                              );
                                            }
                                            // Resource category heading (e.g., "ROOFING, FLASHINGS AND CHIMNEYS-")
                                            else if (/^[A-Z][A-Z\s,/]+-$/.test(trimmed)) {
                                              if (currentParagraph) {
                                                elements.push(
                                                  <p key={`p-${idx}`} style={{ 
                                                    margin: '0 0 1rem 0', 
                                                    lineHeight: '1.6',
                                                    fontSize: '0.875rem',
                                                    color: '#374151'
                                                  }}>
                                                    {currentParagraph}
                                                  </p>
                                                );
                                                currentParagraph = '';
                                              }
                                              elements.push(
                                                <div key={`cat-${idx}`} style={{ 
                                                  fontWeight: 700,
                                                  marginTop: '0.75rem',
                                                  marginBottom: '0.25rem',
                                                  fontSize: '0.8125rem', // Slightly smaller
                                                  color: '#111827'
                                                }}>
                                                  {trimmed}
                                                </div>
                                              );
                                            }
                                            // Section heading (ALL CAPS with : like "ENERGY SAVING WEBSITES/TIPS:")
                                            else if (/^[A-Z][A-Z\s,/]+:/.test(trimmed)) {
                                              if (currentParagraph) {
                                                elements.push(
                                                  <p key={`p-${idx}`} style={{ 
                                                    margin: '0 0 1rem 0', 
                                                    lineHeight: '1.6',
                                                    fontSize: '0.875rem',
                                                    color: '#374151'
                                                  }}>
                                                    {currentParagraph}
                                                  </p>
                                                );
                                                currentParagraph = '';
                                              }
                                              elements.push(
                                                <div key={`heading-${idx}`} style={{ 
                                                  fontWeight: 700,
                                                  marginTop: idx === 0 ? '0' : '1.5rem',
                                                  marginBottom: '0.75rem',
                                                  fontSize: '0.9375rem',
                                                  color: '#111827'
                                                }}>
                                                  {trimmed}
                                                </div>
                                              );
                                            }
                                            // URL links
                                            else if (/^https?:\/\//i.test(trimmed)) {
                                              if (currentParagraph) {
                                                elements.push(
                                                  <p key={`p-${idx}`} style={{ 
                                                    margin: '0 0 1rem 0', 
                                                    lineHeight: '1.6',
                                                    fontSize: '0.875rem',
                                                    color: '#374151'
                                                  }}>
                                                    {currentParagraph}
                                                  </p>
                                                );
                                                currentParagraph = '';
                                              }
                                              elements.push(
                                                <div key={`link-${idx}`} style={{ 
                                                  marginBottom: '0.375rem',
                                                  marginLeft: '0.5rem'
                                                }}>
                                                  <a 
                                                    href={trimmed} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    style={{ 
                                                      color: '#8230c9',
                                                      fontSize: '0.8125rem',
                                                      wordBreak: 'break-all',
                                                      textDecoration: 'none'
                                                    }}
                                                  >
                                                    {trimmed}
                                                  </a>
                                                </div>
                                              );
                                            }
                                            // Regular paragraph text
                                            else {
                                              if (currentParagraph && !currentParagraph.endsWith('.') && !currentParagraph.endsWith(':')) {
                                                currentParagraph += ' ' + trimmed;
                                              } else if (currentParagraph) {
                                                // Flush previous paragraph and start new one
                                                elements.push(
                                                  <p key={`p-${idx}-prev`} style={{ 
                                                    margin: '0 0 1rem 0', 
                                                    lineHeight: '1.6',
                                                    fontSize: '0.875rem',
                                                    color: '#374151'
                                                  }}>
                                                    {currentParagraph}
                                                  </p>
                                                );
                                                currentParagraph = trimmed;
                                              } else {
                                                currentParagraph = trimmed;
                                              }
                                            }
                                          });
                                          
                                          // Flush remaining paragraph
                                          if (currentParagraph) {
                                            elements.push(
                                              <p key={`p-final`} style={{ 
                                                margin: '0 0 1rem 0', 
                                                lineHeight: '1.6',
                                                fontSize: '0.875rem',
                                                color: '#374151'
                                              }}>
                                                {currentParagraph}
                                              </p>
                                            );
                                          }
                                          
                                          return elements.length > 0 ? elements : text;
                                        };
                                        
                                        return (
                                          <div key={itemId} style={{ 
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.75rem'
                                          }}>
                                            {/* Title */}
                                            <div style={{ 
                                              fontWeight: 700,
                                              color: '#000000',
                                              fontSize: '1rem',
                                              marginBottom: '0.5rem'
                                            }}>
                                              {itemText}
                                            </div>
                                            
                                            {/* Formatted Content */}
                                            {itemComment && (
                                              <div style={{ 
                                                fontSize: '0.875rem',
                                                color: '#374151',
                                                lineHeight: '1.6'
                                              }}>
                                                {formatContent(itemComment)}
                                              </div>
                                            )}
                                            
                                            {/* Answer Choices */}
                                            {selectedAnswers.length > 0 && (
                                              <div style={{ 
                                                marginLeft: '0.75rem',
                                                fontSize: '0.8125rem',
                                                color: '#6b7280',
                                                lineHeight: '1.4'
                                              }}>
                                                {selectedAnswers.join(', ')}
                                              </div>
                                            )}
                                            
                                            {/* Images */}
                                            {itemImages.length > 0 && (
                                              <div className={styles.informationImages} style={{ marginTop: '0.75rem' }}>
                                                {itemImages.map((img: any, imgIdx: number) => (
                                                  <div key={imgIdx} style={{ position: 'relative' }}>
                                                    {img.isThreeSixty ? (
                                                      <div style={{ 
                                                        width: '100%', 
                                                        minWidth: isMobile ? '300px' : '400px',
                                                        marginBottom: '1rem' 
                                                      }}>
                                                        <ThreeSixtyViewer
                                                          imageUrl={getProxiedSrc(img.url)}
                                                          alt={`360° view for information item`}
                                                          width="100%"
                                                          height={isMobile ? "300px" : "400px"}
                                                        />
                                                      </div>
                                                    ) : (
                                                      <img
                                                        src={getProxiedSrc(img.url)}
                                                        alt="Item image"
                                                        onClick={() => openLightbox(getProxiedSrc(img.url))}
                                                        className={styles.informationImage}
                                                        onError={handleImgError}
                                                        loading="eager"
                                                      />
                                                    )}
                                                    {img.location && (
                                                      <div style={{ 
                                                        textAlign: 'center', 
                                                        fontSize: '0.75rem', 
                                                        color: '#6b7280', 
                                                        marginTop: '0.25rem',
                                                        fontWeight: 500
                                                      }}>
                                                        {img.location}
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          
                            {/* Custom Notes */}
                            {block.custom_text && (
                              <div style={{ 
                                borderTop: allItems.length > 0 ? '1px solid #e2e8f0' : 'none',
                                paddingTop: allItems.length > 0 ? '1rem' : '0'
                              }}>
                                <div style={{ 
                                  fontSize: '0.875rem', 
                                  fontWeight: 600,
                                  color: '#475569',
                                  marginBottom: '0.5rem',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.025em'
                                }}>Custom Notes</div>
                                <div style={{ 
                                  fontSize: '0.875rem', 
                                  lineHeight: '1.6',
                                  color: '#1f2937',
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {block.custom_text}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                    </>
                  )}
                  
                  {/* Only render defect details if this is NOT an information-only section */}
                  {!section.isInformationOnly && (
                    <>
                  {/* Compact defect card */}
                  <div
                    id={section.anchorId}
                    className={styles.defectCompactCard}
                    style={{
                      '--selected-color': getSelectedColor(section),
                    } as React.CSSProperties}
                  >
                    <div className={styles.defectCompactBody}>
                      <div className={styles.defectCompactMedia}>
                        {section.isThreeSixty && section.image ? (
                          <div className={styles.compactPanoramaWrapper}>
                            <ThreeSixtyViewer
                              imageUrl={
                                typeof section.image === 'string'
                                  ? getProxiedSrc(section.image)
                                  : URL.createObjectURL(section.image)
                              }
                              alt={`360° view for ${section.subsectionName || 'defect'}`}
                              width="100%"
                              height="100%"
                            />
                            <span className={styles.mediaBadge}>360°</span>
                          </div>
                        ) : section.type === 'video' && section.video ? (
                          <div className={styles.compactVideoWrapper}>
                            <video
                              src={
                                typeof section.video === 'string'
                                  ? getProxiedSrc(section.video)
                                  : URL.createObjectURL(section.video)
                              }
                              poster={
                                typeof section.thumbnail === 'string'
                                  ? getProxiedSrc(section.thumbnail)
                                  : (section.thumbnail || '/placeholder-image.jpg')
                              }
                              className={styles.compactVideo}
                              onClick={(e) => {
                                const videoEl = e.currentTarget;
                                videoEl.setAttribute('controls', 'true');
                                videoEl.play();
                              }}
                            />
                            <span className={styles.mediaBadge}>Video</span>
                          </div>
                        ) : section.image ? (
                          <img
                            src={
                              typeof section.image === 'string'
                                ? getProxiedSrc(section.image)
                                : URL.createObjectURL(section.image)
                            }
                            alt="Defect thumbnail"
                            className={styles.defectThumb}
                            onClick={() => {
                              openLightbox(
                                typeof section.image === 'string'
                                  ? getProxiedSrc(section.image)
                                  : URL.createObjectURL(section.image)
                              );
                            }}
                            onError={handleImgError}
                            loading="eager"
                          />
                        ) : (
                          <div className={styles.defectThumbPlaceholder}>No media</div>
                        )}
                      </div>
                      <div className={styles.defectCompactInfo}>
                        {/* Header line moved to right column (number • section • defect), then divider */}
                        <div className={styles.defectInlineHeader}>
                          <span className={styles.defectHeaderText}>
                            <span className={styles.defectNumberPrefix}>{section.numbering} - </span>
                            {hasCombinedSectionLabel && (
                              <span className={styles.defectSectionPart}>
                                {combinedSectionLabel} - 
                              </span>
                            )}
                            {defectTitle && (
                              <span className={styles.defectTitlePart}>{defectTitle}</span>
                            )}
                          </span>
                          <span className={styles.importanceBadgeSmall} style={{ background: getSelectedColor(section) }}>
                            {colorToImportance(section.color)}
                          </span>
                        </div>
                        <div className={styles.defectDivider} />

                        {/* Meta line under header: heading2 • location */}
                        <div className={styles.defectCompactSummary}>
                          {[
                            section.heading2 || '',
                            section.location || ''
                          ].filter(Boolean).join(' • ')}
                        </div>

                        {/* Body paragraph */}
                        {(defectParagraphs[0] || section.defect_description) && (
                          <div className={styles.defectParagraph}>
                            {defectParagraphs[0] || section.defect_description}
                          </div>
                        )}

                        {/* Costs and recommendation */}
                        {!inspection?.hidePricing ? (
                          <>
                            <div className={styles.defectCostLine}>
                              Materials: {formatCurrency(section.estimatedCosts?.materialsCost || 0)} • Labor: {formatCurrency(section.estimatedCosts?.laborRate || 0)}/hr • Hours: {section.estimatedCosts?.hoursRequired || 0}
                            </div>
                            <div className={`${styles.defectCostLine} ${styles.defectTotalLine}`}>
                              Total: {formatCurrency(section.estimatedCosts?.totalEstimatedCost || 0)}
                            </div>
                            {section.estimatedCosts?.recommendation && (
                              <div className={styles.defectRecommendation}>
                                Recommended: {section.estimatedCosts.recommendation}
                              </div>
                            )}
                          </>
                        ) : (
                          section.estimatedCosts?.recommendation ? (
                            <div className={styles.defectRecommendation}>
                              Recommended: {section.estimatedCosts.recommendation}
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  </div>
                  </>
                  )}
                </div>
                  );
                })}

            {/* Removed hardcoded Section 18. Information-only sections are now rendered dynamically above via informationBlocks. */}

            {/* Defects Summary Table - Only show in Full Report mode */}
            {filterMode === 'full' && (() => {
              // Filter to ONLY include sections that have actual defects (not information sections)
              const defectSections = reportSections.filter(section => 
                section.defect || section.defect_description
              );
              
              return defectSections.length > 0 && (
                <div className={styles.reportSection} style={{ marginTop: '2rem' }}>
                  <div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid #e5e7eb' }}>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1f2937', margin: '0', letterSpacing: '-0.025em' }}>
                      Total Estimated Cost
                    </h2>
                  </div>
                  <div>
                    <table className={styles.defectsTable}>
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Section</th>
                          <th>Defect</th>
                          <th style={{ textAlign: 'right' }}>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {defectSections.map((section, index) => (
                          <tr key={section.id || index}>
                            <td>{section.numbering || `${index + 1}`}</td>
                            <td>{section.sectionName || section.heading?.split(' - ')[0] || ''}</td>
                            <td>{section.defect || section.defect_description || ''}</td>
                            <td style={{ textAlign: 'right' }}>
                              ${section.estimatedCosts?.totalEstimatedCost || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2} className={styles.totalLabel}>Total</td>
                          <td className={styles.hiddenOnMobile}></td>
                          <td style={{ textAlign: 'right' }}>
                            ${defectSections.reduce((total, section) => total + (section.estimatedCosts?.totalEstimatedCost || 0), 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}

            {filterMode === 'hazard' && visibleSections.length === 0 && (
              <div className={styles.descriptionSectionStart} style={{ marginTop: '1rem' }}>
                <p><strong>No safety hazards found.</strong></p>
              </div>
            )}
              {/* Lightbox Overlay */}
              {lightboxOpen && lightboxSrc && (
                <div
                  ref={overlayRef}
                  className={styles.lightboxOverlay}
                  onClick={() => { setLightboxOpen(false); setLightboxSrc(null); setZoomScale(1); setTranslate({ x: 0, y: 0 }); }}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Image preview"
                >
                  <button
                    type="button"
                    className={styles.lightboxClose}
                    aria-label="Close image"
                    onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); setLightboxSrc(null); setZoomScale(1); setTranslate({ x:0, y:0 }); }}
                  >
                    ×
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imageRef}
                    src={lightboxSrc}
                    alt="Zoomed defect"
                    className={styles.lightboxImage}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={toggleZoom}
                    onMouseDown={startPanHandler}
                    onLoad={onImageLoad}
                    style={{
                      transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${zoomScale})`,
                      cursor: zoomScale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in',
                      transition: isPanning ? 'none' : 'transform 80ms linear',
                      willChange: 'transform',
                    }}
                  />
                </div>
              )}
            </div>
            </div>
        </div>
      </main>
      <Dialog open={sampleModalOpen} onOpenChange={handleSampleModalChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Make A Sample Report</DialogTitle>
            <DialogDescription>
              Give this report a name and description to feature it on your Sample Reports page.
            </DialogDescription>
          </DialogHeader>
          <form
            id="make-sample-report-form"
            className="space-y-4"
            onSubmit={handleSampleReportSubmit}
          >
            <div className="space-y-2">
              <Label htmlFor="sample-report-name">Name</Label>
              <Input
                id="sample-report-name"
                value={sampleName}
                onChange={(event) => setSampleName(event.target.value)}
                placeholder="e.g. Premium Home Inspection"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sample-report-description">Description</Label>
              <Textarea
                id="sample-report-description"
                value={sampleDescription}
                onChange={(event) => setSampleDescription(event.target.value)}
                rows={4}
                placeholder="Add context that highlights what this sample showcases."
              />
              <p className="text-xs text-muted-foreground">
                This description appears alongside the sample on your Sample Reports page.
              </p>
            </div>
            {sampleError && <p className="text-sm text-red-600">{sampleError}</p>}
          </form>
          <DialogFooter>
            <UiButton
              type="button"
              variant="outline"
              onClick={() => handleSampleModalChange(false)}
              disabled={sampleSaving}
            >
              Cancel
            </UiButton>
            <UiButton
              type="submit"
              form="make-sample-report-form"
              disabled={sampleSaving}
            >
              {sampleSaving ? "Saving..." : "Save Sample Report"}
            </UiButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>

  );
}

