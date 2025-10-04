"use client";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import styles from "../../user-report/user-report.module.css";
import { useRef } from "react";
import Button from "@/components/Button";


type DefectTextParts = {
  title: string;
  body: string;
  paragraphs: string[];
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


export default function InspectionReportPage() {
  const params = useParams();
  const { id } = params; // this is inspection_id
  const [defects, setDefects] = useState<any[]>([]);
  const [informationBlocks, setInformationBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState(null)
  const [currentNumber, setCurrentNumber] = useState(3)
  const [currentSubNumber, setCurrentSubNumber] = useState(1)
  const [inspection, setInspection] = useState<any>(null)

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
    setLightboxSrc(src);
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
  
  // Fetch inspection data including header image
  useEffect(() => {
    if (id) {
      const fetchInspection = async () => {
        try {
          const response = await fetch(`/api/inspections/${id}`);
          if (response.ok) {
            const data = await response.json();
            setInspection(data);
            // If inspection has headerImage and headerText, use them
            if (data.headerImage) {
              setHeaderImage(data.headerImage);
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
  }, [id]);

  const handleDownloadPDF = async (reportType: 'full' | 'summary' = 'full') => {
    try {
      // Filter sections based on report type
      const sectionsToExport = reportType === 'summary' 
        ? reportSections.filter(section => nearestCategory(section.color) !== 'blue') // Exclude blue maintenance items for summary
        : reportSections; // All sections for full report
      
      // Transform reportSections into defects payload compatible with API
      const defectsPayload = sectionsToExport.map((r: any) => ({
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

      // Use header image from inspection data (which was loaded at component mount)
      // Or use manually selected header image from the UI
      // Or find a suitable one from defects as a fallback
      let headerImageUrl = headerImage;
      
      // If no image was manually selected or from inspection data, use the first defect with an image
      if (!headerImageUrl) {
        const defectWithImage = defectsPayload.find(d => d.image);
        headerImageUrl = defectWithImage ? defectWithImage.image : null;
      }

      const meta = {
        title: 'Inspection Report',
        subtitle: 'Generated Inspection Report',
        company: 'AGI Property Inspections',
        headerImageUrl, // Add the header image URL
        headerText, // Add the header text
        reportType, // Pass the report type to control sections visibility
      };

      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defects: defectsPayload, meta }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to generate PDF: ${res.status} ${text}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meta.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF generation failed', e);
      alert('Failed to generate PDF. See console for details.');
    }
  };

  const handleDownloadHTML = async (reportType: 'full' | 'summary' = 'full') => {
    // Build a minimal standalone HTML using current reportSections
    try {
      const title = `inspection-${id}-${reportType}-report`;
      
      // Use header image from inspection data or UI selection
      // This is the same logic as in handleDownloadPDF
      let headerImageUrl = headerImage;
      
      // If no image was manually selected or from inspection, use the first defect with an image
      if (!headerImageUrl) {
        const defectWithImage = reportSections.find(d => d.image);
        headerImageUrl = defectWithImage ? defectWithImage.image : null;
      }
      
      const escapeHtml = (s: any) =>
        String(s ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

      // Filter sections based on report type
      const sectionsToExport = reportType === 'summary' 
        ? reportSections.filter(section => nearestCategory(section.color) !== 'blue') // Exclude blue maintenance items for summary
        : reportSections; // All sections for full report

      // Build summary table rows and totals
      const summaryRows = sectionsToExport
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
      const totalAll = sectionsToExport.reduce((sum: number, s: any) => sum + (s.estimatedCosts?.totalEstimatedCost ?? 0), 0);

      const summaryTableRows = sectionsToExport
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

      // Intro sections (Section 1 & 2) content (tagged with data-intro for mode filtering in exported HTML)
      const introHtml = `
        <div class="rpt-section-heading" data-intro-heading="1">
          <h2 class="rpt-section-heading-text" style="color:#111827">Section 1 - Inspection Overview & Client Responsibilities</h2>
        </div>
        <section class="rpt-section intro-section" data-intro="1">
          <div class="rpt-card">
            <p>This is a visual inspection only. The scope of this inspection is to verify the proper performance of the home's major systems. We do not verify proper design.</p>
            <p>The following items reflect the condition of the home and its systems at the time and date the inspection was performed. Conditions of an occupied home can change after the inspection (e.g., leaks may occur beneath sinks, water may run at toilets, walls or flooring may be damaged during moving, appliances may fail, etc.).</p>
            <p>Furnishings, personal items, and/or systems of the home are not dismantled or moved. A 3–4 hour inspection is not equal to "live-in exposure" and will not discover all concerns. Unless otherwise stated, we will only inspect/comment on the following systems: <em>Electrical, Heating/Cooling, Appliances, Plumbing, Roof and Attic, Exterior, Grounds, and the Foundation</em>.</p>
            <p>This inspection is not a warranty or insurance policy. The limit of liability of AGI Property Inspections and its employees does not extend beyond the day the inspection was performed.</p>
            <p>Cosmetic items (e.g., peeling wallpaper, wall scuffs, nail holes, normal wear and tear, etc.) are not part of this inspection. We also do not inspect for fungi, rodents, or insects. If such issues are noted, it is only to bring them to your attention so you can have the proper contractor evaluate further.</p>
            <p>Although every effort is made to inspect all systems, not every defect can be identified. Some areas may be inaccessible or hazardous. The home should be carefully reviewed during your final walk-through to ensure no new concerns have occurred and that requested repairs have been completed.</p>
            <p>Please contact our office immediately at <a href="tel:3379051428">337-905-1428</a> if you suspect or discover any concerns during the final walk-through.</p>
            <p>Repair recommendations and cost estimates included in this report are approximate, generated from typical labor and material rates in our region. They are not formal quotes and must always be verified by licensed contractors. AGI Property Inspections does not guarantee their accuracy.</p>
            <p>We do not provide guaranteed repair methods. Any corrections should be performed by qualified, licensed contractors. Consult your Real Estate Professional, Attorney, or Contractor for further advice regarding responsibility for these repairs.</p>
            <p>While this report may identify products involved in recalls or lawsuits, it is not comprehensive. Identifying all recalled products is not a requirement for Louisiana licensed Home Inspectors.</p>
            <p>This inspection complies with the standards of practice of the State of Louisiana Home Inspectors Licensing Board. Home inspectors are generalists and recommend further review by licensed specialists when needed.</p>
            <p>This inspection report and all information contained within is the sole property of AGI Property Inspections and is leased to the clients named in this report. It may not be shared or passed on without AGI’s consent. Doing so may result in legal action.</p>
          </div>
        </section>
        <div class="rpt-section-heading" data-intro-heading="2">
          <h2 class="rpt-section-heading-text" style="color:#111827">Section 2 - Inspection Scope & Limitations</h2>
        </div>
        <section class="rpt-section intro-section" data-intro="1">
          <div class="rpt-card">
            <h3>Inspection Categories & Summary</h3>
            <h4 class="cat-red">Immediate Attention</h4>
            <p class="cat-red">Major Defects: Issues that compromise the home’s structural integrity, may result in additional damage if not repaired, or are considered a safety hazard. These items are color-coded red in the report and should be corrected as soon as possible.</p>

            <h4 class="cat-orange">Items for Repair</h4>
            <p class="cat-orange">Defects: Items in need of repair or correction, such as plumbing or electrical concerns, damaged or improperly installed components, etc. These are color-coded orange in the report and have no strict repair timeline.</p>

            <h4 class="cat-blue">Maintenance Items</h4>
            <p class="cat-blue">Small DIY-type repairs and maintenance recommendations provided to increase knowledge of long-term care. While not urgent, addressing these will reduce future repair needs and costs.</p>

            <h4 class="cat-purple">Further Evaluation</h4>
            <p class="cat-purple">In some cases, a defect falls outside the scope of a general home inspection or requires a more extensive level of knowledge to determine the full extent of the issue. These items should be further evaluated by a specialist.</p>

            <hr class="rpt-hr" />
            <h3>Important Information & Limitations</h3>
            <p>AGI Property Inspections performs all inspections in compliance with the Louisiana Standards of Practice. We inspect readily accessible, visually observable, permanently installed systems and components of the home. This inspection is not technically exhaustive or quantitative.</p>
            <p>Some comments may go beyond the minimum Standards as a courtesy to provide additional detail. Any item noted for repair, replacement, maintenance, or further evaluation should be reviewed by qualified, licensed tradespeople.</p>
            <p>This inspection cannot predict future conditions or reveal hidden or latent defects. The report reflects the home’s condition only at the time of inspection. Weather, occupancy, or use may reveal issues not present at the time.</p>
            <p>This report should be considered alongside the seller’s disclosure, pest inspection report, and contractor evaluations for a complete picture of the home’s condition.</p>

            <hr class="rpt-hr" />
            <h3>Repair Estimates Disclaimer</h3>
            <ul>
              <li>Estimates are not formal quotes.</li>
              <li>They do not account for unique site conditions and may vary depending on contractor, materials, and methods.</li>
              <li>Final pricing must always be obtained through qualified, licensed contractors with on-site evaluation.</li>
              <li>AGI Property Inspections does not guarantee the accuracy of estimates or assume responsibility for work performed by outside contractors.</li>
            </ul>

            <hr class="rpt-hr" />
            <h3>Excluded Items</h3>
            <p>The following are not included in this inspection: septic systems, security systems, irrigation systems, pools, hot tubs, wells, sheds, playgrounds, saunas, outdoor lighting, central vacuums, water filters, water softeners, sound or intercom systems, generators, sport courts, sea walls, outbuildings, operating skylights, awnings, exterior BBQ grills, and firepits.</p>

            <hr class="rpt-hr" />
            <h3>Occupied Home Disclaimer</h3>
            <p>If the home was occupied at the time of inspection, some areas may not have been accessible (furniture, personal belongings, etc.). Every effort was made to inspect all accessible areas; however, some issues may not have been visible.</p>
            <p>We recommend using your final walkthrough to verify that no issues were missed and that the property remains in the same condition as at the time of inspection.</p>
          </div>
        </section>
      `;

      const sectionHtml = sectionsToExport
        .map((s) => {
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
          return `
            <div class="rpt-section-heading" id="${s.anchorId}-heading" data-cat="${category}" style="--selected-color:${selectedColor};--shadow-color:${shadowColor};">
              <h2 class="rpt-section-heading-text">
                Section - ${escapeHtml(s.heading)}
                <span class="rpt-badge">${badgeLabel}</span>
              </h2>
            </div>
            <section id="${s.anchorId}" class="rpt-section" data-cat="${category}" data-numbering="${escapeHtml(s.numbering)}" data-section-label="${escapeHtml(s.heading2 || s.sectionName || '')}" data-defect-title="${escapeHtml(summaryTitle)}" data-defect-summary="${escapeHtml(summaryBody)}" style="--selected-color:${selectedColor};--shadow-color:${shadowColor};--highlight-bg:${highlightBg};">
              <div class="rpt-content-grid">
                <div class="rpt-image-section">
                  <h3 class="rpt-section-title">Visual Evidence</h3>
                  <div class="rpt-image-container">
                    ${imgSrc ? `<img class="rpt-img" src="${imgSrc}" alt="Defect image"/>` : `<div class="rpt-image-placeholder"><p>No image available</p></div>`}
                  </div>
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
                    <h4 class="rpt-subsection-title">Estimated Costs</h4>
                    <div class="rpt-subsection-content">
                      <p>
                        <strong>Materials:</strong> ${escapeHtml(s.estimatedCosts?.materials)} ($${s.estimatedCosts?.materialsCost ?? 0})<br/>
                        <strong>Labor:</strong> ${escapeHtml(s.estimatedCosts?.labor)} at $${s.estimatedCosts?.laborRate ?? 0}/hr<br/>
                        <strong>Hours:</strong> ${s.estimatedCosts?.hoursRequired ?? 0}<br/>
                        <strong>Recommendation:</strong> ${escapeHtml(s.estimatedCosts?.recommendation)}
                      </p>
                    </div>
                  </div>
                  <div class="rpt-cost-highlight">
                    <div class="rpt-total-cost">
                      Total Estimated Cost: $${cost}
                    </div>
                  </div>
                </div>
              </div>
            </section>`;
        })
        .join('\n');

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
  .rpt-summary-row{cursor:pointer;transition:background 0.2s ease,transform 0.2s ease}
  .rpt-summary-row:hover{background:#f8fafc}
  .rpt-summary-row:focus{outline:2px solid #3b82f6;outline-offset:-2px}
  .rpt-row-cat-red{border-left:6px solid #dc2626}
  .rpt-row-cat-orange{border-left:6px solid #f59e0b}
  .rpt-row-cat-blue{border-left:6px solid #3b82f6}
  .rpt-row-cat-purple{border-left:6px solid #7c3aed}
  .rpt-row-cat-red:hover{background:rgba(220,38,38,0.06)}
  .rpt-row-cat-orange:hover{background:rgba(245,158,11,0.08)}
  .rpt-row-cat-blue:hover{background:rgba(59,130,246,0.08)}
  .rpt-row-cat-purple:hover{background:rgba(124,58,237,0.08)}
    .rpt-section{background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 8px 32px rgba(15,23,42,0.12);padding:32px;margin:32px 0 0 0}
    .rpt-section:first-of-type{margin-top:0}
  .rpt-section-heading{margin:56px 0 24px 0;padding-bottom:16px;border-bottom:2px solid var(--selected-color,#dc2626)}
  .rpt-section-heading[data-intro-heading]{border-bottom:2px solid #000000}
  .rpt-section-heading:first-of-type{margin-top:0}
    .rpt-section-heading-text{font-size:1.75rem;color:var(--selected-color,#dc2626);font-weight:700;margin:0;letter-spacing:-0.025em}
    .rpt-badge{display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:9999px;font-weight:700;color:#fff;font-size:0.8rem;background:var(--selected-color,#dc2626);box-shadow:0 2px 6px rgba(15,23,42,0.2);margin-left:8px}
    .rpt-content-grid{display:grid;grid-template-columns:1fr 3fr;gap:32px;align-items:start}
    .rpt-image-section{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 4px 16px rgba(15,23,42,0.12);position:relative;overflow:hidden}
    .rpt-image-section::before{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,var(--selected-color,#dc2626),var(--shadow-color,rgba(214,54,54,0.16)),var(--selected-color,#dc2626))}
  .rpt-section-title{font-size:1.5rem;font-weight:700;color:#1f2937;margin-bottom:24px;letter-spacing:-0.025em}
  @media(max-width:640px){.rpt-section-title{text-align:center;}}
    .rpt-image-container{border-radius:16px;overflow:hidden;min-height:300px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(15,23,42,0.15)}
    .rpt-img{width:100%;height:auto;display:block;cursor:zoom-in;border-radius:12px;transition:transform .3s ease}
    .rpt-img:hover{transform:scale(1.02)}
    .rpt-image-placeholder{color:#64748b;border:2px dashed #cbd5e1;background:#fff;width:100%;height:300px;display:flex;align-items:center;justify-content:center;border-radius:16px;font-weight:500}
    .rpt-location-section{margin-top:24px;padding:16px;background:#fff;border-radius:12px;border-left:3px solid var(--selected-color,#dc2626);box-shadow:0 4px 6px var(--shadow-color,rgba(214,54,54,0.15));transition:all .3s ease}
    .rpt-location-section:hover{background:#f8fafc;transform:translateX(2px)}
    .rpt-description-section{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 4px 16px rgba(15,23,42,0.12);position:relative;overflow:hidden}
    .rpt-detail-card{margin-bottom:16px;padding:16px;background:#fff;border-radius:12px;border-left:3px solid var(--selected-color,#dc2626);box-shadow:0 4px 6px var(--shadow-color,rgba(214,54,54,0.15));transition:all .3s ease}
    .rpt-detail-card:hover{background:#f8fafc;transform:translateX(2px)}
    .rpt-detail-card:last-child{margin-bottom:0}
    .rpt-subsection-title{font-size:1rem;font-weight:600;margin-bottom:8px;color:#1f2937;letter-spacing:-0.01em}
    .rpt-subsection-content{font-size:0.9rem;color:#374151;line-height:1.55}
    .rpt-defect-title{font-weight:700;font-size:1rem;margin:0 0 8px 0;color:var(--selected-color,#dc2626)}
    .rpt-defect-body{font-size:0.9rem;color:#374151;line-height:1.6;margin:0 0 10px 0}
    .rpt-defect-body:last-child{margin-bottom:0}
    .rpt-cost-highlight{border:2px solid var(--selected-color,#dc2626);border-radius:12px;padding:20px;margin-top:24px;box-shadow:0 6px 18px rgba(15,23,42,0.12)}
    .rpt-total-cost{text-align:center;font-weight:700;color:var(--selected-color,#dc2626);font-size:1.25rem;letter-spacing:-0.02em}
  /* Lightbox overlay */
  .lb-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);display:none;align-items:center;justify-content:center;z-index:9999}
  .lb-overlay.open{display:flex}
  .lb-img{max-width:95vw;max-height:92vh;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.5);transition:transform 80ms linear;will-change:transform;cursor: zoom-in}
  .lb-close{position:absolute;top:12px;right:16px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:20px;line-height:1;font-weight:600;padding:6px 10px;border-radius:6px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.3);transition:background .15s ease}
  .lb-close:hover{background:rgba(0,0,0,0.75)}
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
        <h2 class="rpt-h2">Inspection Sections</h2>
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
        <h2 class="rpt-h2">Inspection Sections</h2>
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
    ${reportType === 'full' ? introHtml : ''}
    ${sectionHtml}
    ${reportType === 'summary' ? `
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
    ${reportType === 'full' ? `
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
    <!-- Lightbox overlay for image zoom/pan -->
    <div id="lb-overlay" class="lb-overlay" role="dialog" aria-modal="true" aria-label="Image preview">
      <button type="button" id="lb-close" class="lb-close" aria-label="Close image">×</button>
      <img id="lb-img" class="lb-img" alt="Zoomed defect" />
    </div>
    <script>
      (function(){
        var overlay = document.getElementById('lb-overlay');
        var img = document.getElementById('lb-img');
        var isPanning = false;
        var startX = 0, startY = 0;
        var tx = 0, ty = 0;
        var startTx = 0, startTy = 0;
        var scale = 1;
        var baseW = 0, baseH = 0;

        function updateTransform(){
          img.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + scale + ')';
          if (scale > 1) {
            img.style.cursor = isPanning ? 'grabbing' : 'grab';
          } else {
            img.style.cursor = 'zoom-in';
          }
        }

        function openLightbox(src){
          img.src = src;
          scale = 1; tx = 0; ty = 0;
          updateTransform();
          overlay.classList.add('open');
          document.body.style.overflow = 'hidden';
          // measure base size after next frame
          setTimeout(function(){
            var rect = img.getBoundingClientRect();
            baseW = rect.width; baseH = rect.height;
          }, 0);
        }

        function closeLightbox(){
          overlay.classList.remove('open');
          document.body.style.overflow = '';
        }

        document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeLightbox(); });
  overlay.addEventListener('click', function(){ closeLightbox(); });
  var closeBtn = document.getElementById('lb-close');
  if(closeBtn){ closeBtn.addEventListener('click', function(e){ e.stopPropagation(); closeLightbox(); }); }
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
          // Clamp within overlay bounds
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

        // Attach click handlers to exported images
        Array.prototype.forEach.call(document.querySelectorAll('.rpt-img'), function(el){
          el.addEventListener('click', function(){ openLightbox(el.getAttribute('src')); });
        });

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
            rows += '<tr class="rpt-summary-row" data-target="'+sec.id+'" tabindex="0" role="link" aria-label="Jump to '+num+': '+title+'" style="border-left:6px solid '+colorHex+';">'+
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

      const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('HTML export failed', e);
      alert('Failed to export HTML. See console for details.');
    }
  };

  useEffect(() => {
    async function fetchDefects() {
      try {
        setLoading(true);
        const res = await fetch(`/api/defects/${id}`);
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
        const res = await fetch(`/api/information-sections/${id}`);
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

    if (id) {
      fetchDefects();
      fetchInformationBlocks();
    }
  }, [id]);

  const [reportSections, setReportSections] = useState<any[]>([]);

  useEffect(() => {
    if (defects?.length) {
      const sortedDefects = [...defects].sort((a, b) => {
      if (a.section < b.section) return -1;
      if (a.section > b.section) return 1;
      // Optional: also sort by subsection if section is the same
      if (a.subsection < b.subsection) return -1;
      if (a.subsection > b.subsection) return 1;
      return 0;
    });

    let currentMain = currentNumber; // start from your state (e.g., 3)
    let lastSection = null;
    let subCounter = 0;

  const mapped = sortedDefects.map((defect) => {
      // If we hit a new section, increment main number and reset subCounter
      if (defect.section !== lastSection!) {
        currentMain++;
        subCounter = 1;
        lastSection = defect.section;
      } else {
        subCounter++;
      }
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


  const numbering = `${currentMain}.${subCounter}`;
  const anchorId = `defect-${defect._id || numbering.replace(/\./g, '-')}`;

      const totalEstimatedCost =
        defect.material_total_cost +
        defect.labor_rate * defect.hours_required;

      return {
        id: defect._id,
        anchorId,
        numbering,
        sectionName: defect.section,
        subsectionName: defect.subsection,
        sectionHeading: `Section ${currentMain} - ${defect.section}`,
        subsectionHeading: `${numbering} - ${defect.subsection}`,
        heading2: `${defect.section} - ${defect.subsection}`,
        heading: `${numbering} ${defect.subsection}`,
        image: defect.image,
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
    setCurrentNumber(currentMain);
    }
  }, [defects]);

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
    if (filterMode === 'hazard') {
      return reportSections.filter((r) => isHazardColor(r.color));
    }
    if (filterMode === 'summary') {
      // For summary, exclude blue (maintenance items) defects
      return reportSections.filter((r) => nearestCategory(r.color) !== 'blue');
    }
    // For 'full', show all defects
    return reportSections;
  }, [reportSections, filterMode]);

  // Group by section for sidebar
  const groupedBySection = useMemo(() => {
    const groups: Record<string, { count: number; firstAnchor: string | null; items: Array<{ title: string; numbering: string; anchorId: string }> }> = {};
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
              {headerImage && (
                <div className={styles.headerImageDisplay}>
                  <img 
                    src={headerImage} 
                    alt="Report Header" 
                    className={styles.headerImage}
                    onError={(e) => {
                      console.error('Failed to load header image:', headerImage);
                      // Hide the header image section if image fails to load
                      (e.target as HTMLImageElement).style.display = 'none';
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
              )}
              
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
              <section className={styles.summaryCard} aria-label="Inspection Sections">
                <div className={styles.summaryHeader}>
                  <h2 className={styles.summaryTitle}>Inspection Sections</h2>
                  
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
                      {visibleSections.map((section) => {
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
              <br></br><br></br>
              {filterMode === 'full' && <>
              <div className={styles.sectionHeadingStart}>
                    <h2 className={styles.sectionHeadingTextStart}>Section 1 - Inspection Overview & Client Responsibilities</h2>
                  </div>
                      <div className={styles.descriptionSectionStart}>
                        <p>
                          This is a visual inspection only. The scope of this
                          inspection is to verify the proper performance of the home's major
                          systems. We do not verify proper design.
                        </p>

                        <p>
                          The following items reflect the condition of the home and its systems
                           at the time and date the inspection was performed.
                          Conditions of an occupied home can change after the inspection (e.g.,
                          leaks may occur beneath sinks, water may run at toilets, walls or flooring
                          may be damaged during moving, appliances may fail, etc.).
                        </p>
                          
                        <p>
                          Furnishings, personal items, and/or systems of the home are not dismantled
                          or moved. A 3–4 hour inspection is not equal to "live-in exposure" and
                          will not discover all concerns. Unless otherwise stated, we will only
                          inspect/comment on the following systems:
                          
                            Electrical, Heating/Cooling, Appliances, Plumbing, Roof and Attic,
                            Exterior, Grounds, and the Foundation
                          
                          .
                        </p>
                          
                        <p>
                          This inspection is not a warranty or insurance policy. The limit of
                          liability of AGI Property Inspections and its employees does not extend
                          beyond the day the inspection was performed.
                        </p>
                          
                        <p>
                          Cosmetic items (e.g., peeling wallpaper, wall scuffs, nail holes, normal
                          wear and tear, etc.) are not part of this inspection. We also do not
                          inspect for fungi, rodents, or insects. If such issues are noted, it is
                          only to bring them to your attention so you can have the proper contractor
                          evaluate further.
                        </p>
                          
                        <p>
                          Although every effort is made to inspect all systems, not every defect can
                          be identified. Some areas may be inaccessible or hazardous. The home
                          should be carefully reviewed during your final walk-through to ensure no
                          new concerns have occurred and that requested repairs have been completed.
                        </p>
                          
                        <p>
                          Please contact our office immediately at{" "}
                          <a href="tel:3379051428">337-905-1428</a> if you suspect or discover any
                          concerns during the final walk-through.
                        </p>
                          
                        <p>
                          Repair recommendations and cost estimates included in this report are
                          approximate, generated from typical labor and material
                          rates in our region. They are not formal quotes and must always be
                          verified by licensed contractors. AGI Property Inspections does not
                          guarantee their accuracy.
                        </p>
                          
                        <p>
                          We do not provide guaranteed repair methods. Any corrections should be
                          performed by qualified, licensed contractors. Consult your Real Estate
                          Professional, Attorney, or Contractor for further advice regarding
                          responsibility for these repairs.
                        </p>
                          
                        <p>
                          While this report may identify products involved in recalls or lawsuits,
                          it is not comprehensive. Identifying all recalled products is not a
                          requirement for Louisiana licensed Home Inspectors.
                        </p>
                          
                        <p>
                          This inspection complies with the standards of practice of the{" "}
                          
                            State of Louisiana Home Inspectors Licensing Board
                          
                          . Home inspectors are generalists and recommend further review by licensed
                          specialists when needed.
                        </p>
                          
                        <p>
                          This inspection report and all information contained within is the sole
                          property of AGI Property Inspections and is leased to the clients named in
                          this report. It may not be shared or passed on without AGI’s consent. Doing so may result in legal action.
                        </p>
                      </div>

                  <br></br><br></br>

                <div className={styles.sectionHeadingStart}>
                    <h2 className={styles.sectionHeadingTextStart}>Section 2 - Inspection Scope & Limitations</h2>
                  </div>
                  <div className={styles.contentGridStart}>
                    <div className={styles.descriptionSectionStart}>
                      {/* Categories */}
                      <h3>Inspection Categories & Summary</h3>

                      <h4 className={styles.immediateAttention}>Immediate Attention</h4>
                      <div className={styles.immediateAttention}>
                      {/* <p> */}
                        Major Defects: Issues that compromise the home’s structural
                        integrity, may result in additional damage if not repaired, or are
                        considered a safety hazard. These items are color-coded{" "}
                        red in the report and should be corrected
                        as soon as possible.
                      {/* </p> */}
                      </div>

                      <h4 className={styles.itemsForRepair}>Items for Repair</h4>
                      <div className={styles.itemsForRepair}>
                      {/* <p className={styles.orange}> */}
                        Defects: Items in need of repair or correction, such as
                        plumbing or electrical concerns, damaged or improperly installed components,
                        etc. These are color-coded orange in
                        the report and have no strict repair timeline.
                      {/* </p> */}
                      </div>

                      <h4 className={styles.maintenanceItems}>Maintenance Items</h4>
                      <div className={styles.maintenanceItems}>
                      {/* <p> */}
                        Small DIY-type repairs and maintenance recommendations provided to increase
                        knowledge of long-term care. While not urgent, addressing these will reduce
                        future repair needs and costs.
                      {/* </p> */}
                      </div>

                      <h4 className={styles.recomended}>Further Evaluation</h4>
                      <div className={styles.recomended}>
                      {/* <p> */}
                        In some cases, a defect falls outside the scope of a general home inspection or requires 
                        a more extensive level of knowledge to determine the full extent of the issue. 
                        These items should be further evaluated by a specialist.
                      {/* </p> */}
                      </div>
                      <br></br>

                      <hr />

                      {/* Limitations */}
                      <h3>Important Information & Limitations</h3>
                      <p>
                        AGI Property Inspections performs all inspections in compliance with the{" "}
                        Louisiana Standards of Practice. We inspect readily
                        accessible, visually observable, permanently installed systems and
                        components of the home. This inspection is not technically exhaustive or
                        quantitative.
                      </p>
                      <p>
                        Some comments may go beyond the minimum Standards as a courtesy to provide
                        additional detail. Any item noted for repair, replacement, maintenance, or
                        further evaluation should be reviewed by qualified, licensed tradespeople.
                      </p>
                      <p>
                        This inspection cannot predict future conditions or reveal hidden or latent
                        defects. The report reflects the home’s condition only at the time of
                        inspection. Weather, occupancy, or use may reveal issues not present at the
                        time.
                      </p>
                      <p>
                        This report should be considered alongside the{" "}
                        seller’s disclosure, pest inspection report, and contractor
                        evaluations for a complete picture of the home’s condition.
                      </p>

                      <hr />

                      {/* Repair Disclaimer */}
                      <h3>Repair Estimates Disclaimer</h3>
                      <p>
                        This report may include repair recommendations and estimated costs. These
                        are based on typical labor and material rates in our region, generated from
                        AI image review. They are approximate and not formal quotes.
                      </p>
                      <ul>
                        <li>Estimates are not formal quotes.</li>
                        <li>
                          They do not account for unique site conditions and may vary depending on
                          contractor, materials, and methods.
                        </li>
                        <li>
                          Final pricing must always be obtained through qualified, licensed
                          contractors with on-site evaluation.
                        </li>
                        <li>
                          AGI Property Inspections does not guarantee the accuracy of estimates or
                          assume responsibility for work performed by outside contractors.
                        </li>
                      </ul>

                      <hr />

                      {/* Recommendations */}
                      <h3>Recommendations</h3>
                      <ul>
                        <li>
                          Contractors / Further Evaluation: Repairs noted should be
                          performed by licensed professionals. Keep receipts for warranty and
                          documentation purposes.
                        </li>
                        <li>
                          Causes of Damage / Methods of Repair: Suggested repair
                          methods are based on inspector experience and opinion. Final determination
                          should always be made by licensed contractors.
                        </li>
                      </ul>

                      <hr />

                      {/* Exclusions */}
                      <h3>Excluded Items</h3>
                      <p>
                        The following are not included in this inspection: septic systems, security
                        systems, irrigation systems, pools, hot tubs, wells, sheds, playgrounds,
                        saunas, outdoor lighting, central vacuums, water filters, water softeners,
                        sound or intercom systems, generators, sport courts, sea walls, outbuildings,
                        operating skylights, awnings, exterior BBQ grills, and firepits.
                      </p>

                      <hr />

                      {/* Occupied Home Disclaimer */}
                      <h3>Occupied Home Disclaimer</h3>
                      <p>
                        If the home was occupied at the time of inspection, some areas may not have
                        been accessible (furniture, personal belongings, etc.). Every effort was
                        made to inspect all accessible areas; however, some issues may not have been
                        visible.
                      </p>
                      <p>
                        We recommend using your final walkthrough to verify that no issues were
                        missed and that the property remains in the same condition as at the time of
                        inspection.
                      </p>
                    </div>


                  </div>

                  <br></br><br></br>
              </>}
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

                  return (
                <div key={section.id}>
                  {/* Main Section Heading (Black) - Only show when section changes */}
                  {isNewSection && (
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

                    {/* Information Block - appears at top of section BEFORE defects */}
                    {(() => {
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
                      
                      const hasContent = (block.selected_checklist_ids?.length > 0) || 
                                       (block.selected_comment_ids?.length > 0) || 
                                       block.custom_text;
                      
                      if (!hasContent) return null;
                      
                      return (
                        <div style={{ 
                          marginTop: '1.25rem', 
                          marginBottom: '2rem', 
                          backgroundColor: '#f0f9ff', 
                          border: '3px solid #2563eb', 
                          borderRadius: '0.625rem', 
                          padding: '1.5rem',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                        }}>
                          {/* Header */}
                          <div style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '1.25rem',
                            paddingBottom: '0.75rem',
                            borderBottom: '2px solid #2563eb'
                          }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#2563eb',
                              marginRight: '0.75rem'
                            }} />
                            <h3 style={{ 
                              fontSize: '1rem',
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                              color: '#1e40af',
                              margin: 0,
                              textTransform: 'uppercase'
                            }}>INFORMATION</h3>
                          </div>
                          
                          {/* Selected Checklists */}
                          {block.selected_checklist_ids?.length > 0 && (
                            <div style={{ marginBottom: block.selected_comment_ids?.length > 0 || block.custom_text ? '1.5rem' : '0' }}>
                              <div style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: 600,
                                color: '#1e40af',
                                marginBottom: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.025em'
                              }}>Selected Checklists</div>
                              <ul style={{ 
                                marginLeft: '1.25rem', 
                                fontSize: '0.9375rem', 
                                lineHeight: '1.75',
                                color: '#1e3a8a',
                                paddingLeft: '0.5rem'
                              }}>
                                {block.selected_checklist_ids.map((cl: any, idx: number) => (
                                  <li key={cl._id || cl} style={{ 
                                    marginBottom: '0.5rem',
                                    paddingLeft: '0.25rem'
                                  }}>
                                    {cl.text || cl}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Comments */}
                          {block.selected_comment_ids?.length > 0 && (
                            <div style={{ marginBottom: block.custom_text ? '1.5rem' : '0' }}>
                              <div style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: 600,
                                color: '#1e40af',
                                marginBottom: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.025em'
                              }}>Comments</div>
                              <div style={{ 
                                fontSize: '0.9375rem', 
                                lineHeight: '1.75',
                                color: '#1e3a8a'
                              }}>
                                {block.selected_comment_ids.map((cm: any, idx: number) => (
                                  <p key={cm._id || idx} style={{ 
                                    marginBottom: idx < block.selected_comment_ids.length - 1 ? '1rem' : '0',
                                    paddingLeft: '0.25rem'
                                  }}>
                                    {cm.text || cm}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Custom Notes */}
                          {block.custom_text && (
                            <div>
                              <div style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: 600,
                                color: '#1e40af',
                                marginBottom: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.025em'
                              }}>Custom Notes</div>
                              <div style={{ 
                                fontSize: '0.9375rem', 
                                lineHeight: '1.75',
                                color: '#1e3a8a',
                                whiteSpace: 'pre-wrap',
                                paddingLeft: '0.25rem'
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
                  
                  {/* Subsection Heading (Colored with badge) - Always show */}
                  <div 
                    className={styles.sectionHeading}
                    id={section.anchorId}
                    style={{
                      '--selected-color': getSelectedColor(section),
                      '--light-color': getLightColor(section),
                      marginTop: isNewSection ? '1rem' : '0.5rem',
                    } as React.CSSProperties}
                  >
                    <h2 className={styles.sectionHeadingText}>
                      {section.subsectionHeading}
                      <span className={styles.importanceBadge} style={{ background: getSelectedColor(section) }}>
                        {colorToImportance(section.color)}
                      </span>
                    </h2>
                  </div>

                  <div 
                    className={styles.reportSection}
                    style={{
                      '--selected-color': getSelectedColor(section),
                      '--light-color': getLightColor(section),
                    } as React.CSSProperties}
                  >
                    <div className={styles.contentGrid}>
                    {/* Image */}
                    <div className={styles.imageSection}>
                      <h3 className={styles.imageTitle}>Visual Evidence</h3>
                    <div className={styles.imageContainer}>
{section.type === "video" && section.video ? (
  <video
    src={
      typeof section.video === "string"
        ? section.video
        : URL.createObjectURL(section.video)
    }
    poster={section.thumbnail || "/placeholder-image.jpg"}
    style={{ maxWidth: "100%", maxHeight: "200px", cursor: "pointer" }}
    onClick={(e) => {
      const videoEl = e.currentTarget;
      videoEl.setAttribute("controls", "true"); // show controls
      videoEl.play(); // start playing
    }}
  />
) : section.image ? (
  <img
    src={
      typeof section.image === "string"
        ? section.image
        : URL.createObjectURL(section.image)
    }
    alt="Inspection media"
    className={styles.propertyImage}
    role="button"
    onClick={() => {
      openLightbox(
        typeof section.image === "string"
          ? section.image
          : URL.createObjectURL(section.image)
      );
    }}
    style={{ cursor: "zoom-in" }}
  />
) : (
  <div className={styles.imagePlaceholder}>
    <p>No media available</p>
  </div>
)}


</div>


                      
                      {/* Location moved here */}
                      <div className={styles.locationSection} style={{
                          // boxShadow: getSelectedColor(section),
                          "--shadow-color": getLightColor(section),
                          // '--light-color': getLightColor(section)
                        } as React.CSSProperties }>
                        <h4 className={styles.sectionTitle}>Location</h4>
                        <p className={styles.sectionContent}>{section.location}</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className={styles.descriptionSection}>
                      <h3 className={styles.descriptionTitle}>Analysis Details</h3>
                      <div className="space-y-6">
                        {/* Defect */}
                        <div className={styles.section} style={{
                          // boxShadow: getSelectedColor(section),
                          "--shadow-color": getLightColor(section),
                          // '--light-color': getLightColor(section)
                        } as React.CSSProperties }>
                          <h4 className={styles.sectionTitle}>Defect</h4>
                            <div>
                              {defectTitle ? (
                                <p
                                  className={styles.defectHeadline}
                                  style={{ color: getSelectedColor(section) }}
                                >
                                  {defectTitle}
                                </p>
                              ) : null}
                              {defectParagraphs.length > 0 ? (
                                defectParagraphs.map((paragraph: string, idx: number) => (
                                  <p key={idx} className={styles.defectBody}>
                                    {paragraph}
                                  </p>
                                ))
                              ) : !defectTitle && section.defect_description ? (
                                <p className={styles.defectBody}>{section.defect_description}</p>
                              ) : null}
                            </div>
                        </div>

                        {/* Estimated Costs */}
                        <div className={styles.section} style={{
                          // boxShadow: getSelectedColor(section),
                          "--shadow-color": getLightColor(section),
                          // '--light-color': getLightColor(section)
                        } as React.CSSProperties }>
                          <h4 className={styles.sectionTitle}>Estimated Costs</h4>
                          <div className={styles.sectionContent}>
                              <p>
                                <strong>Materials:</strong> {section.estimatedCosts.materials} ($
                                {section.estimatedCosts.materialsCost})<br/>
                                <strong>Labor:</strong> {section.estimatedCosts.labor} at $
                                {section.estimatedCosts.laborRate}/hr<br/>
                                <strong>Hours:</strong> {section.estimatedCosts.hoursRequired}<br/>
                                <strong>Recommendation:</strong> {section.estimatedCosts.recommendation}
                              </p>
                          </div>
                        </div>
                        
                        {/* Cost Highlight */}
                        <div className={styles.costHighlight} style={{
                          "--selected-color": getSelectedColor(section),
                        } as React.CSSProperties }>
                          <div className={styles.totalCost}>
                            Total Estimated Cost: ${section.estimatedCosts.totalEstimatedCost}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
                  );
                })}

            {/* Defects Summary Table - Only show in Full Report mode */}
            {filterMode === 'full' && (
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
                      {reportSections.map((section, index) => (
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
                        <td colSpan={3}>Total</td>
                        <td style={{ textAlign: 'right' }}>
                          ${reportSections.reduce((total, section) => total + (section.estimatedCosts?.totalEstimatedCost || 0), 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

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
      </div>

  );
}
