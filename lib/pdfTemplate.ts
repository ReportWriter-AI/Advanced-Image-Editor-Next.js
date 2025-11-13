export type DefectItem = {
  section: string;
  subsection: string;
  defect_description: string;
  image?: string; // URL or data URI
  location?: string;
  material_total_cost?: number;
  labor_type?: string;
  labor_rate?: number;
  hours_required?: number;
  recommendation?: string;
  color?: string;
  display_number?: string; // Dynamic numbering like "3.1.2"
  additional_images?: Array<{ url: string; location: string }>; // Multiple location photos
  base_cost?: number; // Base cost (AI-calculated from first image)
};

export type InformationBlockImage = {
  url: string;
  annotations?: string;
  checklist_id?: string;
  location?: string;
};

export type InformationBlockItem = {
  _id?: string;
  text: string;
  comment?: string;
  type: 'status' | 'information';
  order_index?: number;
  selected_answers?: string[]; // Selected answer choices for this item
};

export type InformationBlock = {
  _id: string;
  inspection_id: string;
  section_id: {
    _id: string;
    name: string;
    order_index: number;
  } | string;
  selected_checklist_ids: InformationBlockItem[];
  selected_answers?: Array<{ checklist_id: string; selected_answers: string[] }>; // Answer choices selections
  custom_text?: string;
  images: InformationBlockImage[];
};

export type ReportMeta = {
  title?: string;
  subtitle?: string;
  company?: string;
  logoUrl?: string;
  headerImageUrl?: string; // URL for the large header background image
  headerText?: string; // Text to display on the header image
  date?: string;
  startNumber?: number; // base section number, defaults to 1
  reportType?: 'full' | 'summary';
  informationBlocks?: InformationBlock[]; // Information sections to display before defects
  hidePricing?: boolean; // Hide all cost/pricing information
};

function escapeHtml(str: string = ""): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function currency(n?: number): string {
  if (typeof n !== "number" || isNaN(n)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// Color utilities: parse CSS color strings and classify by nearest base color
function parseColorToRgb(input?: string): { r: number; g: number; b: number } | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  const hexMatch = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return { r, g, b };
  }
  const rgbMatch = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (rgbMatch) {
    const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)));
    return { r, g, b };
  }
  return null;
}

const baseColors: Record<'red' | 'orange' | 'blue' | 'purple', { r: number; g: number; b: number }> = {
  red: { r: 220, g: 38, b: 38 },      // #dc2626
  orange: { r: 245, g: 158, b: 11 },  // #f59e0b
  blue: { r: 59, g: 130, b: 246 },    // #3b82f6
  purple: { r: 124, g: 58, b: 237 },  // #7c3aed
};

function nearestCategory(color?: string): 'red' | 'orange' | 'blue' | 'purple' | null {
  const rgb = parseColorToRgb(color);
  if (!rgb) return null;
  let bestKey: 'red' | 'orange' | 'blue' | 'purple' | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  (Object.keys(baseColors) as Array<'red' | 'orange' | 'blue' | 'purple'>).forEach((key) => {
    const b = baseColors[key];
    const d = (rgb.r - b.r) ** 2 + (rgb.g - b.g) ** 2 + (rgb.b - b.b) ** 2;
    if (d < bestDist) { bestDist = d; bestKey = key; }
  });
  return bestKey;
}

function colorToImportance(input?: string): 'Immediate Attention' | 'Items for Repair' | 'Maintenance Items' | 'Further Evaluation' {
  const cat = nearestCategory(input);
  switch (cat) {
    case 'red': return 'Immediate Attention';
    case 'orange': return 'Items for Repair';
    case 'blue': return 'Maintenance Items';
    case 'purple': return 'Further Evaluation';
    default: return 'Immediate Attention';
  }
}

type DefectTextParts = {
  title: string;
  body: string;
  paragraphs: string[];
};

function splitDefectText(raw?: string): DefectTextParts {
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
}

// Generate HTML for information section block
function generateInformationSectionHTML(block: InformationBlock): string {
  const allItemsRaw = block.selected_checklist_ids || [];
  const allItems = Array.isArray(allItemsRaw)
    ? [...allItemsRaw].sort((a, b) => {
        const ao = typeof a?.order_index === 'number' ? a.order_index : Number.POSITIVE_INFINITY;
        const bo = typeof b?.order_index === 'number' ? b.order_index : Number.POSITIVE_INFINITY;
        return ao - bo;
      })
    : allItemsRaw;
  const hasContent = allItems.length > 0 || block.custom_text;
  
  if (!hasContent) return '';
  
  // Create a map for quick lookup of selected answers by checklist_id
  const selectedAnswersMap = new Map<string, string[]>();
  if (block.selected_answers) {
    block.selected_answers.forEach(item => {
      selectedAnswersMap.set(item.checklist_id, item.selected_answers);
    });
  }
  
  // Generate grid items HTML
  const gridItemsHtml = allItems.map((item: InformationBlockItem) => {
    const isStatus = item.type === 'status';
    const itemId = item._id || '';
    // Get images associated with this checklist item
    const itemImages = (block.images || []).filter(img => img.checklist_id === itemId);
    // Get selected answers for this item
    const selectedAnswers = selectedAnswersMap.get(itemId) || [];
    
    if (isStatus) {
      // Status items: "Label: Value" format with optional comment
      const parts = (item.text || '').split(':');
      const label = parts[0]?.trim() || '';
      const value = parts.slice(1).join(':').trim() || '';
      
      return `
        <div class="info-grid-item">
          <div>
            <span style="font-weight: 700; color: #000000;">${escapeHtml(label)}:</span>${value ? `
            <span style="margin-left: 0.25rem; font-weight: 400; color: #6b7280;">
              ${escapeHtml(value)}\n            </span>` : ''}
          </div>
          ${item.comment ? `
          <div style="font-size: 0.875rem; color: #374151; line-height: 1.6; margin-top: 0.375rem;">
            ${escapeHtml(item.comment)}
          </div>` : ''}
          ${selectedAnswers.length > 0 ? `
          <div style="margin-left: 0.25rem; font-weight: 400; color: #6b7280; font-size: 0.875rem;">
            ${selectedAnswers.map(ans => escapeHtml(ans)).join(', ')}
          </div>` : ''}
          ${itemImages.length > 0 ? `
          <div class="info-images">
            ${itemImages.map(img => `
            <div style="position: relative;">
              <img src="${escapeHtml(img.url)}" alt="Item image" class="info-image" />
              ${img.location ? `
              <div style="text-align: center; font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; font-weight: 500;">
                ${escapeHtml(img.location)}
              </div>` : ''}
            </div>`).join('')}
          </div>` : ''}
        </div>`;
    } else {
      // Information items: Bold title + indented explanation
      return `
        <div class="info-grid-item">
          <div style="font-weight: 700; color: #000000; ${item.comment ? 'margin-bottom: 0.375rem;' : ''}">
            ${escapeHtml(item.text || '')}
          </div>
          ${item.comment ? `
          <div style="margin-left: 0.75rem; font-size: 0.8125rem; color: #4a5568; line-height: 1.4;">
            ${escapeHtml(item.comment)}
          </div>` : ''}
          ${selectedAnswers.length > 0 ? `
          <div style="margin-left: 0.75rem; font-size: 0.8125rem; color: #6b7280; line-height: 1.4;">
            ${selectedAnswers.map(ans => escapeHtml(ans)).join(', ')}
          </div>` : ''}
          ${itemImages.length > 0 ? `
          <div class="info-images">
            ${itemImages.map(img => `
            <div style="position: relative;">
              <img src="${escapeHtml(img.url)}" alt="Item image" class="info-image" />
              ${img.location ? `
              <div style="text-align: center; font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; font-weight: 500;">
                ${escapeHtml(img.location)}
              </div>` : ''}
            </div>`).join('')}
          </div>` : ''}
        </div>`;
    }
  }).join('');
  
  return `
  <div class="information-section">
    <!-- Header -->
    <div class="info-header">
      <h3 class="info-heading">INFORMATION</h3>
    </div>
    
    ${allItems.length > 0 ? `
    <!-- 3-Column Grid -->\n    <div class="info-grid"${block.custom_text ? ' style="margin-bottom: 1.5rem;"' : ''}>
      ${gridItemsHtml}
    </div>` : ''}
    
    ${block.custom_text ? `
    <!-- Custom Notes -->
    <div class="info-custom-notes"${allItems.length > 0 ? ' style="border-top: 1px solid #e2e8f0; padding-top: 1rem;"' : ''}>\n      <div class="info-custom-label">Custom Notes</div>
      <div class="info-custom-text">${escapeHtml(block.custom_text).replace(/\n/g, '<br>')}</div>
    </div>` : ''}
  </div>`;
}

/**
 * Calculate display numbers for defects in the format [Section].[Subsection].[Defect]
 * Groups defects by section and subsection, assigns sequential numbers within each subsection
 * @param defects - Array of defect items
 * @param startNumber - Starting section number (default: 1)
 * @returns Array of defects with display_number field added
 */
function calculateDefectNumbers(defects: DefectItem[], startNumber: number = 1): DefectItem[] {
  // Sort by section then subsection for stable ordering
  const sorted = [...defects].sort((a, b) => {
    if (a.section < b.section) return -1;
    if (a.section > b.section) return 1;
    if (a.subsection < b.subsection) return -1;
    if (a.subsection > b.subsection) return 1;
    return 0;
  });

  // Track section numbering
  const sectionNumbers = new Map<string, number>();
  const subsectionNumbers = new Map<string, Map<string, number>>();
  const defectCounters = new Map<string, number>();
  
  let currentSectionNum = startNumber - 1; // Will increment on first section
  
  return sorted.map((defect) => {
    const sectionKey = defect.section;
    const subsectionKey = defect.subsection;
    const fullKey = `${sectionKey}|||${subsectionKey}`;
    
    // Assign section number if new section
    if (!sectionNumbers.has(sectionKey)) {
      currentSectionNum++;
      sectionNumbers.set(sectionKey, currentSectionNum);
      subsectionNumbers.set(sectionKey, new Map());
    }
    
    const sectionNum = sectionNumbers.get(sectionKey)!;
    const subsectionMap = subsectionNumbers.get(sectionKey)!;
    
    // Assign subsection number if new subsection within this section
    if (!subsectionMap.has(subsectionKey)) {
      subsectionMap.set(subsectionKey, subsectionMap.size + 1);
    }
    
    const subsectionNum = subsectionMap.get(subsectionKey)!;
    
    // Increment defect counter for this subsection
    const currentCount = defectCounters.get(fullKey) || 0;
    const defectNum = currentCount + 1;
    defectCounters.set(fullKey, defectNum);
    
    // Create display number: Section.Subsection.Defect (e.g., "3.1.2")
    const display_number = `${sectionNum}.${subsectionNum}.${defectNum}`;
    
    return {
      ...defect,
      display_number
    };
  });
}

export function generateInspectionReportHTML(defects: DefectItem[], meta: ReportMeta = {}): string {
  const {
    title = "Inspection Report",
    subtitle = "Defect Summary and Details",
    company = "",
    logoUrl,
    date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    startNumber = 1,
    reportType = 'full',
    informationBlocks = [],
    hidePricing = false,
  } = meta;

  // Detect if an Orientation / Shutoffs information block exists
  const orientationBlock = Array.isArray(informationBlocks) ? informationBlocks.find(block => {
    const blockSection = typeof block.section_id === 'object' ? block.section_id?.name : null;
    if (!blockSection) return false;
    const clean = String(blockSection).replace(/^\d+\s*-\s*/, '').trim().toLowerCase();
    return clean === 'orientation / shutoffs';
  }) : null;

  // If Orientation exists, defects should start at Section 4 (reserving Section 3)
  const startNumberAdjusted = orientationBlock ? Math.max(startNumber, 4) : startNumber;

  // Calculate display numbers for all defects
  const numberedDefects = calculateDefectNumbers(defects, startNumberAdjusted);
  
  // Sort by section then subsection for stable ordering
  const sorted = [...numberedDefects].sort((a, b) => {
    if (a.section < b.section) return -1;
    if (a.section > b.section) return 1;
    if (a.subsection < b.subsection) return -1;
    if (a.subsection > b.subsection) return 1;
    return 0;
  });

  let currentMain = startNumberAdjusted; // will increment on first new section to match web logic
  let lastSection: string | null = null;
  let subCounter = 0;

  // Create a set of all sections that have defects
  const sectionsWithDefects = new Set(sorted.map(d => d.section.replace(/^\d+\s*-\s*/, '')));
  
  // Find information blocks that don't have defects
  const informationOnlySections: string[] = [];
  if (reportType === 'full' && informationBlocks.length > 0) {
    informationBlocks.forEach(block => {
      const blockSection = typeof block.section_id === 'object' ? block.section_id?.name : null;
      if (blockSection) {
        const cleanBlock = blockSection.replace(/^\d+\s*-\s*/, '');
        const cleanLower = cleanBlock.trim().toLowerCase();
        if (!sectionsWithDefects.has(cleanBlock)
            && cleanLower !== 'orientation / shutoffs') {
          informationOnlySections.push(blockSection);
        }
      }
    });
  }

  const sectionsHtml = sorted
    .map((d, index) => {
      const isNewSection = d.section !== lastSection;
      
      // Use the pre-calculated display_number
      const displayNum = d.display_number || `${currentMain}.${subCounter}`;
      const [sectionNum, subsectionNum] = displayNum.split('.').map(n => parseInt(n, 10));
      
      if (isNewSection) {
        currentMain = sectionNum;
        subCounter = subsectionNum;
        lastSection = d.section;
      } else {
        subCounter = subsectionNum;
      }

      // Calculate total cost with photo multiplier
      // Fallback: if base_cost doesn't exist (legacy defects), calculate it from material + labor
      const baseCost = d.base_cost || ((d.material_total_cost || 0) + (d.labor_rate || 0) * (d.hours_required || 0));
      const photoCount = 1 + (d.additional_images?.length || 0);
      const totalCost = baseCost * photoCount;
      
      const selectedColor = d.color || "#d63636";
      const defectParts = splitDefectText(d.defect_description || "");
      const defectTitle = defectParts.title;
      const defectParagraphs = defectParts.paragraphs.length
        ? defectParts.paragraphs
        : defectParts.body && defectParts.body !== defectTitle
          ? [defectParts.body]
          : [];
      const defectBodyHtml = defectParagraphs.length
        ? defectParagraphs.map((p) => `<p class="defect-body">${escapeHtml(p)}</p>`).join("")
        : (d.defect_description ? `<p class="defect-body">${escapeHtml(d.defect_description)}</p>` : "");
      
      // Determine the importance label based on nearest color category
      const importanceLabel = colorToImportance(selectedColor);

      // Add page break after every 2 sections (except the last one)
      const pageBreak = (index + 1) % 2 === 0 && index < sorted.length - 1 ? '<div class="page-break"></div>' : '';

      // Two-tier heading structure: Section in black (only when section changes), then subsection with color
      const sectionHeading = `Section ${sectionNum} - ${escapeHtml(d.section)}`;
      const subsectionHeading = `${displayNum} - ${escapeHtml(d.subsection)}`;
      
      // Find matching information block for this section (only when section changes and ONLY for full reports)
      let informationHtml = '';
      if (reportType === 'full' && isNewSection && informationBlocks.length > 0) {
        const matchingBlock = informationBlocks.find(block => {
          const blockSection = typeof block.section_id === 'object' ? block.section_id?.name : null;
          if (!blockSection || !d.section) return false;
          // Match by removing leading numbers like "9 - " from both
          const cleanSection = d.section.replace(/^\d+\s*-\s*/, '');
          const cleanBlock = blockSection.replace(/^\d+\s*-\s*/, '');
          return cleanBlock === cleanSection;
        });
        
        if (matchingBlock) {
          informationHtml = generateInformationSectionHTML(matchingBlock);
        }
      }
      
      // Only show section heading when section changes
      const sectionHeadingHtml = isNewSection ? `
          <div class="section-heading" style="--selected-color: #111827; border-bottom: none;">
            <h2 class="section-heading-text" style="color: #111827;">
              ${sectionHeading}
            </h2>
          </div>` : '';

      return `
        ${sectionHeadingHtml}
        ${informationHtml}
        <section class="report-section" style="--selected-color: ${selectedColor};">
          <div class="section-heading" style="--selected-color: ${selectedColor}; margin-top: ${isNewSection && !informationHtml ? '0.75rem' : (isNewSection ? '0.5rem' : '0.5rem')}; border-bottom: 2px solid ${selectedColor};">
            <h2 class="section-heading-text">
              ${subsectionHeading}
              <span class="importance-badge" style="background-color: ${selectedColor};">${importanceLabel}</span>
            </h2>
          </div>

          <div class="content-grid">
            <div class="image-section">
              <h3 class="image-title">Visual Evidence</h3>
              <div class="image-container">
                ${d.image
                  ? `<img src="${escapeHtml(d.image)}" alt="Defect image" class="property-image" />`
                  : `<div class="image-placeholder"><p>No image available</p></div>`}
              </div>
              <div class="location-section">
                <h4 class="section-title">Location</h4>
                <p class="section-content">${escapeHtml(d.location || "Not specified")}</p>
              </div>
              ${d.additional_images && d.additional_images.length > 0 ? `
              <div class="additional-photos">
                <h4 class="section-title">Additional Location Photos (${1 + d.additional_images.length}/10)</h4>
                <div class="additional-grid">
                  ${d.additional_images.map(img => `
                  <div class="additional-item">
                    <img src="${escapeHtml(img.url)}" alt="Additional photo" class="additional-image" />
                    ${img.location ? `<div class="additional-caption">${escapeHtml(img.location)}</div>` : ''}
                  </div>`).join('')}
                </div>
              </div>` : ''}
            </div>

            <div class="description-section">
              <h3 class="description-title">Analysis Details</h3>
              <div class="section">
                <h4 class="section-title">Defect</h4>
                <div class="section-content">
                  ${defectTitle ? `<p class="defect-title" style="color:${selectedColor};">${escapeHtml(defectTitle)}</p>` : ""}
                  ${defectBodyHtml}
                </div>
              </div>
              ${!hidePricing ? `
              <div class="section">
                <h4 class="section-title">Estimated Costs</h4>
                <div class="section-content">
                  <p>
                    <strong>Materials:</strong> ${currency(d.material_total_cost)}<br/>
                    <strong>Labor:</strong> ${escapeHtml(d.labor_type || "N/A")} at ${currency(d.labor_rate || 0)}/hr<br/>
                    <strong>Hours:</strong> ${Number(d.hours_required || 0)}<br/>
                    <strong>Recommendation:</strong> ${escapeHtml(d.recommendation || "N/A")}<br/>
                    <strong>Total Estimated Cost:</strong> ${currency(totalCost)}
                  </p>
                </div>
              </div>
              <div class="cost-highlight">
                <div class="total-cost">Total Estimated Cost: ${currency(totalCost)}</div>
              </div>
              ` : `
              <div class="section">
                <h4 class="section-title">Recommendation</h4>
                <div class="section-content">
                  <p>${escapeHtml(d.recommendation || "N/A")}</p>
                </div>
              </div>
              `}
            </div>
          </div>
        </section>
        ${pageBreak}
      `;
    })
    .join("\n");
  
  // Generate HTML for information-only sections (sections with no defects)
  const informationOnlySectionsHtml = informationOnlySections.map(sectionName => {
    const matchingBlock = informationBlocks.find(block => {
      const blockSection = typeof block.section_id === 'object' ? block.section_id?.name : null;
      return blockSection === sectionName;
    });
    
    if (!matchingBlock) return '';
    
    currentMain += 1;
    const cleanSectionName = sectionName.replace(/^\d+\s*-\s*/, '');
    
    return `
      <div class="section-heading" style="--selected-color: #111827; border-bottom: none;">
        <h2 class="section-heading-text" style="color: #111827;">
          Section ${currentMain} - ${escapeHtml(cleanSectionName)}
        </h2>
      </div>
      ${generateInformationSectionHTML(matchingBlock)}
    `;
  }).join("\n");

  // Build Orientation / Shutoffs section as Section 3 (placed after Section 2 content, before defects)
  const orientationSectionHtml = (() => {
    if (!orientationBlock || reportType !== 'full') return '';
    // Clean title
    const rawName = typeof orientationBlock.section_id === 'object' ? orientationBlock.section_id?.name || '' : '';
    const cleanName = rawName.replace(/^\d+\s*-\s*/, '') || 'Orientation / Shutoffs';
    return `
      <div class="section-heading" style="--selected-color: #111827; border-bottom: none;">
        <h2 class="section-heading-text" style="color: #111827;">
          Section 3 - ${escapeHtml(cleanName)}
        </h2>
      </div>
      ${generateInformationSectionHTML(orientationBlock)}
    `;
  })();

  // Build cost summary rows with numbering matching detail sections
  const costSummaryRows = sorted.map((d) => {
    const numbering = d.display_number || ''; // Use pre-calculated display number
    const parts = splitDefectText(d.defect_description || "");
    const defFirstSentence = parts.title || (d.defect_description || "").split(".")[0];
    const costValue = (d.material_total_cost || 0) + (d.labor_rate || 0) * (d.hours_required || 0);
    
    return `
      <tr>
        <td>${escapeHtml(numbering)}</td>
        <td>${escapeHtml(defFirstSentence)}</td>
        <td style="text-align:right;">${currency(costValue)}</td>
      </tr>
    `;
  }).join('');

  const totalAll = sorted.reduce((sum, d) => sum + (d.material_total_cost || 0) + (d.labor_rate || 0) * (d.hours_required || 0), 0);

  // Build non-priced summary rows (No., Section, Defect) to place after Section 2
  const summaryRowsSimple = sorted.map((d) => {
    const numbering = d.display_number || ''; // Use pre-calculated display number
    const parts = splitDefectText(d.defect_description || "");
    const defFirstSentence = parts.title || (d.defect_description || "").split(".")[0];
    
    return `
      <tr>
        <td>${escapeHtml(numbering)}</td>
        <td>${escapeHtml(d.section)} - ${escapeHtml(d.subsection)}</td>
        <td>${escapeHtml(defFirstSentence)}</td>
      </tr>`;
  }).join("");

  // Ensure a default logo if not provided
  const effectiveLogo = logoUrl || '/AGI_Logo.png';
  // Attempt to inline the logo if it's a local/public asset so Puppeteer can load it without an HTTP request
  let inlineLogo = effectiveLogo;
  try {
    if (!/^https?:/i.test(effectiveLogo) && !effectiveLogo.startsWith('data:')) {
      // Build absolute path relative to project root's public folder when leading slash
      const path = effectiveLogo.startsWith('/')
        ? `${process.cwd()}/public${effectiveLogo}`
        : `${process.cwd()}/${effectiveLogo}`;
      // Lazy import fs to avoid bundling issues
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      if (fs.existsSync(path)) {
        const ext = path.split('.').pop() || '';
        const mimeExt = ext.toLowerCase();
        const mime = mimeExt === 'svg' ? 'image/svg+xml' : mimeExt === 'png' ? 'image/png' : 'image/jpeg';
        const b64 = fs.readFileSync(path).toString('base64');
        inlineLogo = `data:${mime};base64,${b64}`;
      }
    }
  } catch (e) {
    // Fallback silently; if inlining fails we'll leave the original path
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #111827; background: #ffffff; }
    h1, h2, h3, h4 { margin: 0 0 8px 0; }
    p { margin: 0 0 8px 0; }
    
    /* Header with image and added branding band */
    .header-container { 
      width: 100%;
      margin: 0 0 40px 0;
      text-align: center;
    }
    .branding-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 28px 48px 12px 0px; /* reduced left padding to shift logo left */
      position: relative;
      min-height: 80px;
    }
    .branding-bar .logo { height: 70px; }
    .contact-block {
      text-align: right;
      font-size: 14px;
      line-height: 1.4;
      font-weight: 400;
      color: #333;
    }
    .contact-block .company { font-size:16px; font-weight:600; letter-spacing:.5px; }
    .contact-block a { color:#333; text-decoration:none; }
    .contact-block a:hover { text-decoration:underline; }
    
    .image-container {
      width: 100%;
      height: auto;
      margin: 12px auto 30px auto; /* pushed down below branding */
      max-width: 750px;
      max-height: 500px;
      overflow: hidden;
      border-radius: 6px;
    }
    
    .header-image {
      width: 100%;
      max-height: 500px;
      object-fit: cover;
      object-position: center;
    }
    
    .report-header-content {
      text-align: center;
      padding: 20px 0;
    }
    
    .header-text {
      font-size: 36px;
      font-weight: bold;
      color: #333;
      margin-top: 0;
      margin-bottom: 20px;
    }
    
    .report-title {
      font-size: 28px;
      font-weight: 600;
      color: #444;
      margin: 0 0 10px 0;
      text-transform: uppercase;
    }
    
    .meta-info {
      font-size: 16px;
      color: #666;
      margin-bottom: 10px;
    }
    
    /* Traditional header fallback */
    .header-traditional { 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      margin: 24px;
      margin-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 12px; 
    }
    
    .header-traditional .title { 
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      text-shadow: none;
    }
    
    .header-traditional .meta { 
      color: #6b7280;
      font-size: 12px;
      text-shadow: none;
    }
    
    .header-traditional .logo {
      position: static;
      height: 40px;
      filter: none;
    }
    
    /* Content padding */
    .content-wrapper {
      padding: 0 24px;
    }

    .cover { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 20px; background: #f8fafc; }
    .cover h2 { font-size: 18px; color: #1f2937; page-break-after: avoid; break-after: avoid; }
    .cover p { color: #374151; }
  .cover h3 { font-size: 16px; color: #111827; margin: 12px 0 8px; }
  .cover h4 { font-size: 14px; color: #111827; margin: 10px 0 6px; }
  .cover ul { margin: 8px 0 12px 18px; padding: 0; }
  .cover li { margin: 4px 0; }
  .cover hr { border: 0; border-top: 1px solid #e5e7eb; margin: 12px 0; }

  /* Utility to keep a block together on one page */
  .keep-together { page-break-inside: avoid; break-inside: avoid; }

  /* Slight offset for the non-priced summary after Section 2 */
  .cover--summary { margin-top: 24px; }

  /* Section 2: consistent formatting with tight spacing */
  .cover--section2 { padding: 20px; margin: 0; }
  .cover--section2 h2 { font-size: 18px; margin: 0 0 12px 0; }
  .cover--section2 h3 { font-size: 16px; margin: 16px 0 8px; }
  .cover--section2 h4 { font-size: 14px; margin: 12px 0 6px; }
  .cover--section2 p, .cover--section2 li { font-size: 13px; line-height: 1.5; margin: 0 0 10px 0; hyphens: manual; -webkit-hyphens: manual; }
  .cover--section2 .category-immediate { color: #c00; }
  .cover--section2 .category-repair { color: #e69500; }
  .cover--section2 .category-maintenance { color: #2d6cdf; }
  .cover--section2 .category-evaluation { color: #800080; }
  
  /* Importance badge styling */
  .importance-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #ffffff;
    margin-left: 8px;
  }
  .cover--section2 ul { margin: 10px 0 14px 18px; }
  .cover--section2 hr { margin: 14px 0; }

  /* Section 1: consistent formatting with tight spacing */
  .cover--section1 { padding: 20px; margin: 0; }
  .cover--section1 h2 { font-size: 18px; margin: 0 0 12px 0; }
  .cover--section1 h3 { font-size: 16px; margin: 16px 0 8px; }
  .cover--section1 h4 { font-size: 14px; margin: 12px 0 6px; }
  .cover--section1 p, .cover--section1 li { font-size: 13px; line-height: 1.5; margin: 0 0 10px 0; hyphens: manual; -webkit-hyphens: manual; }
  .cover--section1 ul { margin: 10px 0 14px 18px; }
  .cover--section1 hr { margin: 14px 0; }

    .section-heading { 
      margin: 16px 0 8px; 
      padding-bottom: 6px; 
      border-bottom: 2px solid var(--selected-color, #d63636); 
      page-break-after: avoid; 
      break-after: avoid;
    }
    .section-heading-text { font-size: 16px; color: var(--selected-color, #d63636); font-weight: 700; }

    .content-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; }
    .image-section, .description-section { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .image-title, .description-title { font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 8px; }
    .image-container { border-radius: 6px; overflow: hidden; min-height: 160px; background: #fff; display: flex; align-items: center; justify-content: center; }
    .property-image { width: 100%; height: auto; display: block; }
    .image-placeholder { color: #6b7280; border: 2px dashed #cbd5e1; background: #fff; width: 100%; height: 220px; display: flex; align-items: center; justify-content: center; }

    .location-section { margin-top: 8px; background: #fff; border-left: 3px solid var(--selected-color, #d63636); padding: 8px; border-radius: 4px; }
    .section { background: #fff; border-left: 3px solid var(--selected-color, #d63636); padding: 8px; border-radius: 4px; margin-bottom: 8px; }
    .section-title { font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #1f2937; }
    .section-content { font-size: 13px; color: #374151; line-height: 1.5; }
  .defect-title { font-weight: 700; font-size: 14px; margin: 0 0 6px 0; color: var(--selected-color, #d63636); }
  .defect-body { font-size: 13px; color: #374151; line-height: 1.6; margin: 0 0 8px 0; }

    /* Additional location photos */
    .additional-photos { margin-top: 8px; background: #fff; border-left: 3px solid var(--selected-color, #d63636); padding: 8px; border-radius: 4px; }
    .additional-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .additional-item { width: calc(50% - 4px); max-width: 220px; page-break-inside: avoid; break-inside: avoid; }
    .additional-image { width: 100%; height: auto; border-radius: 6px; object-fit: cover; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .additional-caption { text-align: center; font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; font-weight: 500; }

    .cost-highlight { background: #f8fafc; border: 1px solid var(--selected-color, #d63636); padding: 8px; border-radius: 6px; margin-top: 8px; }
    .total-cost { text-align: center; font-weight: 700; color: var(--selected-color, #d63636); }

    /* Information Section Styles */
    .information-section {
      margin: 0.75rem 0 1.5rem;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 1.25rem;
      /* Allow page breaks inside if content is too large */
      page-break-inside: auto;
      break-inside: auto;
      /* But try to keep with previous heading */
      page-break-before: avoid;
      break-before: avoid;
    }
    
    .info-header {
      display: flex;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.625rem;
      border-bottom: 2px solid #3b82f6;
      /* Keep header with content below */
      page-break-after: avoid;
      break-after: avoid;
    }
    
    .info-heading {
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #1e40af;
      margin: 0;
      text-transform: uppercase;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      /* Allow grid to break across pages if needed */
      page-break-inside: auto;
      break-inside: auto;
    }
    
    .info-grid-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      /* Try to keep individual items together */
      page-break-inside: avoid;
      break-inside: avoid;
      /* Prevent orphan items at bottom of page */
      orphans: 2;
      widows: 2;
    }
    
    .info-images {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.5rem;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .info-image {
      width: 100%;
      max-width: 200px;
      max-height: 200px;
      height: auto;
      border-radius: 6px;
      object-fit: cover;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      /* Keep images together */
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .info-custom-notes {
      margin-top: 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .info-custom-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      page-break-after: avoid;
      break-after: avoid;
    }
    
    .info-custom-text {
      font-size: 0.875rem;
      line-height: 1.6;
      color: #1f2937;
      white-space: pre-wrap;
    }

    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
    .table thead th { background: #f3f4f6; }

    .footer { margin-top: 16px; font-size: 11px; color: #6b7280; }

    /* Prevent splitting a single defect across pages */
    .report-section {   
      /* Further increased space between defects for optimal separation while keeping 2 per page */
      margin: 24px 0;
      page-break-inside: avoid; 
      break-inside: avoid; 
      -webkit-region-break-inside: avoid;
    }
    .content-grid,
    .image-section,
    .description-section,
    .section,
    .location-section,
    .image-container,
    .property-image { 
      page-break-inside: avoid; 
      break-inside: avoid; 
    }
    /* Keep table rows together */
    .table tr,
    .table thead,
    .table tbody,
    .table th,
    .table td { 
      page-break-inside: avoid; 
      break-inside: avoid; 
    }
    /* Keep headings attached to the content that follows */
    .section-heading { page-break-after: avoid; break-after: avoid; }

    .page-break { 
      page-break-before: always; 
      break-before: page; 
      margin: 0; 
      padding: 0; 
      height: 0; 
    }
    @media print { 
      .page-break { page-break-before: always; } 
    }

    /* Mobile responsive styles for tables */
    @media (max-width: 640px) {
      /* Reduce content wrapper padding to prevent table shift */
      .content-wrapper {
        padding: 0 8px;
      }
      
      /* Center Total Estimated Cost heading */
      .cover h2 {
        text-align: center !important;
      }
      
      /* Ensure cover section has balanced padding */
      .cover {
        padding: 12px 8px;
        margin-left: 0;
        margin-right: 0;
      }
      
      /* Center and fix table alignment */
      .table { 
        font-size: 10px;
        margin-left: auto;
        margin-right: auto;
        width: 100%;
        display: table;
      }
      
      .table th, .table td { 
        padding: 6px 5px; 
        font-size: 10px;
        line-height: 1.3;
      }
      
      /* Cost summary table column widths */
      .table th:nth-child(1),
      .table td:nth-child(1) { 
        width: 12%; 
        text-align: center;
      }
      
      .table th:nth-child(2),
      .table td:nth-child(2) { 
        width: 58%; 
        word-break: break-word;
      }
      
      .table th:nth-child(3),
      .table td:nth-child(3) { 
        width: 30%; 
        text-align: right;
      }
      
      /* Summary table with 3 columns (No., Section, Defect) */
      .table thead tr th:nth-child(3):not([style*="text-align"]),
      .table tbody tr td:nth-child(3):not([style*="text-align"]) {
        text-align: left;
      }
    }
  </style>
</head>
<body>
  ${meta.headerImageUrl ? `
  <!-- Branded header with logo + contact info and image -->
  <div class="header-container">
    <div class="branding-bar">
  <div class="logo-wrap"><img src="${escapeHtml(inlineLogo)}" alt="Logo" class="logo" /></div>
      <div class="contact-block">
        <div class="company">AGI: PROPERTY INSPECTIONS</div>
        <div>3379051428</div>
        <div><a href="mailto:info@agi-swla.com">info@agi-swla.com</a></div>
        <div><a href="https://www.agi-swla.com" target="_blank">https://www.agi-swla.com</a></div>
      </div>
    </div>
    <div class="image-container">
      <img src="${escapeHtml(meta.headerImageUrl)}" alt="Property Image" class="header-image" />
    </div>
    <div class="report-header-content">
      ${meta.headerText ? `<h1 class="header-text">${escapeHtml(meta.headerText)}</h1>` : ''}
      <h2 class="report-title">HOME INSPECTION REPORT</h2>
      <div class="meta-info">${escapeHtml(company)} • ${escapeHtml(date)}</div>
    </div>
  </div>
  ` : `
  <!-- Traditional header as fallback -->
  <header class="header-traditional">
    <div>
      <div class="title">${escapeHtml(title)}</div>
      <div class="meta">${escapeHtml(subtitle)}${company ? " • " + escapeHtml(company) : ""} • ${escapeHtml(date)}</div>
    </div>
    ${logoUrl ? `<img src="${escapeHtml(inlineLogo)}" alt="Logo" class="logo" />` : ""}
  </header>
  `}
  
  <div class="content-wrapper">

  ${reportType === 'summary' ? `
  <!-- Summary report: include Inspection Sections table beneath header -->
  <section class="cover cover--summary keep-together" style="margin-top:16px;">
    <h2 style="margin:0 0 12px 0;">Inspection Sections</h2>
    <table class="table" style="font-size:12px;">
      <thead>
        <tr>
          <th style="width:8%;">No.</th>
          <th style="width:32%;">Section</th>
          <th style="width:30%;">Defect</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.reduce((acc, d) => {
          if (d.section !== acc.last) { acc.current += 1; acc.sub = 1; acc.last = d.section; } else { acc.sub += 1; }
          const numbering = `${acc.current}.${acc.sub}`;
          const raw = d.defect_description || '';
          const parts = splitDefectText(raw);
          const defectTitle = parts.title || raw.split('.').shift() || '';
          acc.rows.push(`<tr><td>${escapeHtml(numbering)}</td><td>${escapeHtml(d.section)} - ${escapeHtml(d.subsection)}</td><td>${escapeHtml(defectTitle)}</td></tr>`);
          return acc;
        }, { rows: [] as string[], current: startNumber, last: null as string | null, sub: 0 }).rows.join('\n')} <!-- match web logic -->
      </tbody>
    </table>
  </section>
  <div class="page-break"></div>
  ` : ''}
  

  ${orientationSectionHtml}

  ${reportType === 'full' ? `<!-- Non-priced defects summary placed after Section 2 (and Orientation, if present) -->
  <section class="cover cover--summary keep-together">
    <h2>Defects Summary</h2>
    <table class="table">
      <thead>
        <tr>
          <th>No.</th>
          <th>Section</th>
          <th>Defect</th>
        </tr>
      </thead>
      <tbody>
        ${summaryRowsSimple}
      </tbody>
    </table>
  </section>` : ''}

  ${reportType === 'full' ? '<div class="page-break"></div>' : ''}

  ${sectionsHtml}
  
  ${informationOnlySectionsHtml}

  <div class="page-break"></div>

  ${reportType === 'full' && !hidePricing ? `<section class="cover">
    <h2>Total Estimated Cost</h2>
    <table class="table">
      <thead>
        <tr>
          <th>No.</th>
          <th>Defect</th>
          <th style="text-align:right;">Cost ($)</th>
        </tr>
      </thead>
      <tbody>
        ${costSummaryRows}
        <tr>
          <td colspan="2" style="font-weight:700;background:#f3f4f6;">Total Estimated Cost</td>
          <td style="font-weight:700;background:#f3f4f6; text-align:right;">${currency(totalAll)}</td>
        </tr>
      </tbody>
    </table>
  </section>` : ''}

  ${reportType === 'summary' && !hidePricing ? `<section class="cover">
    <h2>Total Estimated Cost</h2>
    <table class="table">
      <thead>
        <tr>
          <th>No.</th>
          <th>Defect</th>
          <th style="text-align:right;">Cost ($)</th>
        </tr>
      </thead>
      <tbody>
        ${costSummaryRows}
        <tr>
          <td colspan="2" style="font-weight:700;background:#f3f4f6;">Total Estimated Cost</td>
          <td style="font-weight:700;background:#f3f4f6; text-align:right;">${currency(totalAll)}</td>
        </tr>
      </tbody>
    </table>
  </section>` : ''}

  </div><!-- End of content-wrapper -->
  
  <footer class="footer">
    Generated by Advanced Image Editor • ${escapeHtml(company || "")}
  </footer>
</body>
</html>
  `;
}
