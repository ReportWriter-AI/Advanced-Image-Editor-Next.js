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
  const allItems = block.selected_checklist_ids || [];
  const hasContent = allItems.length > 0 || block.custom_text;
  
  if (!hasContent) return '';
  
  // Generate grid items HTML
  const gridItemsHtml = allItems.map((item: InformationBlockItem) => {
    const isStatus = item.type === 'status';
    const itemId = item._id || '';
    // Get images associated with this checklist item
    const itemImages = (block.images || []).filter(img => img.checklist_id === itemId);
    
    if (isStatus) {
      // Status items: ONLY "Label: Value" format - NO comments
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
  } = meta;

  // Sort by section then subsection for stable ordering
  const sorted = [...defects].sort((a, b) => {
    if (a.section < b.section) return -1;
    if (a.section > b.section) return 1;
    if (a.subsection < b.subsection) return -1;
    if (a.subsection > b.subsection) return 1;
    return 0;
  });

  let currentMain = startNumber; // will increment on first new section to match web logic
  let lastSection: string | null = null;
  let subCounter = 0;

  const sectionsHtml = sorted
    .map((d, index) => {
      const isNewSection = d.section !== lastSection;
      
      if (isNewSection) {
        currentMain += 1;
        subCounter = 1;
        lastSection = d.section;
      } else {
        subCounter += 1;
      }

      const number = `${currentMain}.${subCounter}`;
      const totalCost = (d.material_total_cost || 0) + (d.labor_rate || 0) * (d.hours_required || 0);
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
      const sectionHeading = `Section ${currentMain} - ${escapeHtml(d.section)}`;
      const subsectionHeading = `${number} - ${escapeHtml(d.subsection)}`;
      
      // Find matching information block for this section (only when section changes)
      let informationHtml = '';
      if (isNewSection && informationBlocks.length > 0) {
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
          <div class="section-heading" style="--selected-color: #111827;">
            <h2 class="section-heading-text" style="color: #111827;">
              ${sectionHeading}
            </h2>
          </div>` : '';

      return `
        ${sectionHeadingHtml}
        ${informationHtml}
        <section class="report-section" style="--selected-color: ${selectedColor};">
          <div class="section-heading" style="--selected-color: ${selectedColor}; margin-top: ${isNewSection && !informationHtml ? '0.75rem' : (isNewSection ? '0.5rem' : '0.5rem')};">
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
            </div>
          </div>
        </section>
        ${pageBreak}
      `;
    })
    .join("\n");

  // Build cost summary rows with numbering matching detail sections
  const costSummaryRows = sorted.reduce<{
    html: string;
    current: number;
    last: string | null;
    sub: number;
  }>((acc, d) => {
    if (d.section !== acc.last) {
      acc.current += 1;
      acc.sub = 1;
      acc.last = d.section;
    } else {
      acc.sub += 1;
    }
    const numbering = `${acc.current}.${acc.sub}`;
  const parts = splitDefectText(d.defect_description || "");
  const defFirstSentence = parts.title || (d.defect_description || "").split(".")[0];
    const costValue = (d.material_total_cost || 0) + (d.labor_rate || 0) * (d.hours_required || 0);
    acc.html += `
      <tr>
        <td>${escapeHtml(numbering)}</td>
        <td>${escapeHtml(defFirstSentence)}</td>
        <td style="text-align:right;">${currency(costValue)}</td>
      </tr>
    `;
    return acc;
  }, { html: "", current: startNumber, last: null, sub: 0 }).html; // match web logic

  const totalAll = sorted.reduce((sum, d) => sum + (d.material_total_cost || 0) + (d.labor_rate || 0) * (d.hours_required || 0), 0);

  // Build non-priced summary rows (No., Section, Defect) to place after Section 2
  // Reset counters to match the logic used in sectionsHtml
  let summaryCurrentMain = startNumber; // match web logic - will increment on first section
  let summaryLastSection: string | null = null;
  let summarySubCounter = 0;
  
  const summaryRowsSimple = sorted.map((d) => {
    const isNewSection = d.section !== summaryLastSection;
    
    if (isNewSection) {
      summaryCurrentMain += 1;
      summarySubCounter = 1;
      summaryLastSection = d.section;
    } else {
      summarySubCounter += 1;
    }
    
    const numbering = `${summaryCurrentMain}.${summarySubCounter}`;
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
      max-height: 250px;
      height: auto;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
      object-fit: cover;
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

  ${reportType === 'full' ? `<section class="cover cover--section1 keep-together">
    <h2>Section 1 - Inspection Overview & Client Responsibilities</h2>
    <hr style="margin: 8px 0 16px 0; border: none; height: 1px; background-color: #000000;">
    <p>This is a visual inspection only. The scope of this inspection is to verify the proper performance of the home's major systems. We do not verify proper design.</p>
    <p>The following items reflect the condition of the home and its systems <strong>at the time and date the inspection was performed</strong>. Conditions of an occupied home can change after the inspection (e.g., leaks may occur beneath sinks, water may run at toilets, walls or flooring may be damaged during moving, appliances may fail, etc.).</p>
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
  </section>

  <div class="page-break"></div>

  <section class="cover cover--section2 keep-together">
    <h2>Section 2 - Inspection Scope &amp; Limitations</h2>
    <hr style="margin: 8px 0 16px 0; border: none; height: 1px; background-color: #000000;">
    <h3>Inspection Categories &amp; Summary</h3>
    <h4 class="category-immediate">Immediate Attention</h4>
    <p class="category-immediate"><strong>Major Defects:</strong> Issues that compromise the home’s structural integrity, may result in additional damage if not repaired, or are considered a safety hazard. These items are color-coded red in the report and should be corrected as soon as possible.</p>
    <h4 class="category-repair">Items for Repair</h4>
    <p class="category-repair"><strong>Defects:</strong> Items in need of repair or correction, such as plumbing or electrical concerns, damaged or improperly installed components, etc. These are color-coded orange in the report and have no strict repair timeline.</p>
    <h4 class="category-maintenance">Maintenance Items</h4>
    <p class="category-maintenance">Small DIY-type repairs and maintenance recommendations provided to increase knowledge of long-term care. While not urgent, addressing these will reduce future repair needs and costs.</p>
  <h4 class="category-evaluation">Further Evaluation</h4>
  <p class="category-evaluation">In some cases, a defect falls outside the scope of a general home inspection or requires a more extensive level of knowledge to determine the full extent of the issue. These items should be further evaluated by a specialist.</p>
    <hr />
    <h3>Important Information &amp; Limitations</h3>
    <p>AGI Property Inspections performs all inspections in compliance with the Louisiana Standards of Practice. We inspect readily accessible, visually observable, permanently installed systems and components of the home. This inspection is not technically exhaustive or quantitative.</p>
    <p>Some comments may go beyond the minimum Standards as a courtesy to provide additional detail. Any item noted for repair, replacement, maintenance, or further evaluation should be reviewed by qualified, licensed tradespeople.</p>
    <p>This inspection cannot predict future conditions or reveal hidden or latent defects. The report reflects the home’s condition only at the time of inspection. Weather, occupancy, or use may reveal issues not present at the time.</p>
    <p>This report should be considered alongside the seller’s disclosure, pest inspection report, and contractor evaluations for a complete picture of the home’s condition.</p>
    <hr />
    <h3>Repair Estimates Disclaimer</h3>
    <p>This report may include repair recommendations and estimated costs. These are based on typical labor and material rates in our region, generated from AI image review. They are approximate and not formal quotes.</p>
    <ul>
      <li>Estimates are not formal quotes.</li>
      <li>They do not account for unique site conditions and may vary depending on contractor, materials, and methods.</li>
      <li>Final pricing must always be obtained through qualified, licensed contractors with on-site evaluation.</li>
      <li>AGI Property Inspections does not guarantee the accuracy of estimates or assume responsibility for work performed by outside contractors.</li>
    </ul>
    <hr />
    <h3>Recommendations</h3>
    <ul>
      <li>Contractors / Further Evaluation: Repairs noted should be performed by licensed professionals. Keep receipts for warranty and documentation purposes.</li>
      <li>Causes of Damage / Methods of Repair: Suggested repair methods are based on inspector experience and opinion. Final determination should always be made by licensed contractors.</li>
    </ul>
    <hr />
    <h3>Excluded Items</h3>
    <p>The following are not included in this inspection: septic systems, security systems, irrigation systems, pools, hot tubs, wells, sheds, playgrounds, saunas, outdoor lighting, central vacuums, water filters, water softeners, sound or intercom systems, generators, sport courts, sea walls, outbuildings, operating skylights, awnings, exterior BBQ grills, and firepits.</p>
    <hr />
    <h3>Occupied Home Disclaimer</h3>
    <p>If the home was occupied at the time of inspection, some areas may not have been accessible (furniture, personal belongings, etc.). Every effort was made to inspect all accessible areas; however, some issues may not have been visible.</p>
    <p>We recommend using your final walkthrough to verify that no issues were missed and that the property remains in the same condition as at the time of inspection.</p>
  </section>` : ''}

  ${reportType === 'full' ? `<!-- Non-priced defects summary placed after Section 2 -->
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

  <div class="page-break"></div>

  ${reportType === 'full' ? `<section class="cover">
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

  ${reportType === 'summary' ? `<section class="cover">
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
