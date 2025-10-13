// Simple data shape to render the report. Replace with your own payload.
const reportData = {
  cover: {
    address: '405 6th St',
    cityState: 'Iowa, LA 70647',
    time: '09/19/2025 11:00 pm',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1600&auto=format&fit=crop',
    inspector: { name: 'Aaron Gott', meta: 'LA license #11034', avatar: 'https://i.pravatar.cc/80?img=12' }
  },
  sections: [
    {
      id: 'exterior',
      title: 'Exterior',
      defects: [
        {
          title: '6.3.1 - Flashings & Seals',
          description: 'Sealant deterioration noted at exterior penetrations. Recommend cleaning and re-sealing to prevent water intrusion.',
          location: 'Front of House',
          image: 'https://images.unsplash.com/photo-1613977257593-5dc59437c8a6?q=80&w=1400&auto=format&fit=crop',
          severity: 'warning' // orange
        },
        {
          title: 'Window Trim Wear',
          description: 'Paint chipping on window trim. Prep and repaint to protect wood.',
          location: 'Left Side',
          image: 'https://images.unsplash.com/photo-1613977257579-e1bff7b30de2?q=80&w=1400&auto=format&fit=crop',
          severity: 'warning'
        }
      ]
    },
    {
      id: 'roof',
      title: 'Roof',
      defects: [
        {
          title: '6.3.2 - Flashings & Seals',
          description: 'Exposed nail heads and cracked sealant observed at roof penetrations. Seal/cover to reduce leakage risk.',
          location: 'Rear of House',
          image: 'https://images.unsplash.com/photo-1617093727343-374698b1b08a?q=80&w=1400&auto=format&fit=crop',
          severity: 'danger' // red
        }
      ]
    },
    {
      id: 'electrical',
      title: 'Electrical',
      defects: []
    }
  ]
};

// Build cover
function buildCover(cover) {
  document.getElementById('address').textContent = cover.address;
  document.getElementById('cityState').textContent = cover.cityState;
  document.getElementById('inspectionTime').textContent = cover.time;
  const coverImage = document.getElementById('coverImage');
  coverImage.style.backgroundImage = `url(${cover.image})`;
  const avatar = document.getElementById('inspectorAvatar');
  avatar.src = cover.inspector.avatar;
  document.getElementById('inspectorName').textContent = cover.inspector.name;
  document.getElementById('inspectorMeta').textContent = cover.inspector.meta;
}

// Build left nav with counts
function buildNav(sections) {
  const nav = document.getElementById('sectionNav');
  nav.innerHTML = '';
  const linkNodes = [];
  // Add static info sections at the top of the nav
  const staticItems = [
    { id: 'section-1', title: 'Inspection Scope, Client Responsibilities, and Repair Estimates' },
    { id: 'section-2', title: 'Inspection Scope & Limitations' }
  ];
  staticItems.forEach((item) => {
    const a = document.createElement('a');
    a.href = `#${item.id}`;
    a.className = 'nav-item nav-static';
    const icon = `<span class="nav-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
    </span>`;
    // keep layout by adding an invisible badge placeholder
    const badge = `<span class="badge" style="visibility:hidden">0</span>`;
    a.innerHTML = `${icon}<span class="title">${item.title}</span>${badge}`;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nav.appendChild(a);
  });

  sections.forEach((sec, idx) => {
    const a = document.createElement('a');
    a.href = `#${sec.id}`;
    a.className = 'nav-item';
    // Optional icon container (can be swapped per section if desired)
    const icon = `<span class="nav-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
    </span>`;
    a.innerHTML = `${icon}<span class="title">${sec.title}</span><span class="badge">${sec.defects.length}</span>`;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nav.appendChild(a);
    linkNodes.push(a);
  });
  return linkNodes;
}

// Build right content sections and summary rows
function buildSections(sections, { filterSeverity = null } = {}) {
  const container = document.getElementById('sectionsContainer');
  container.innerHTML = '';
  const summaryBody = document.getElementById('summaryBody');
  summaryBody.innerHTML = '';

  // Numbering: [Section].[Subsection].[Defect] - matches main page logic exactly
  // Use the same numbering logic as the main page 
  const sectionNumbers = new Map();
  const subsectionNumbers = new Map();
  const defectCounters = new Map();
  
  let currentSectionNum = 2; // Start from 3 (after info sections 1&2)

  sections.forEach((sec, sidx) => {
    // Section wrapper
    const secWrap = document.createElement('section');
    secWrap.className = 'section';
    secWrap.id = sec.id;
    secWrap.dataset.count = String(sec.defects.length || 0);
    // Heading
    const h2 = document.createElement('h2');
    h2.className = 'section-heading';
    h2.textContent = `${sidx + 1} - ${sec.title}`;
    secWrap.appendChild(h2);

    // Optional filtering by severity
    const defects = Array.isArray(sec.defects) ? sec.defects : [];
    const visibleDefects = filterSeverity
      ? defects.filter((d) => (d.severity || '').toLowerCase() === filterSeverity)
      : defects;

    // Cards
    const card = document.createElement('div');
    card.className = 'card';
    const body = document.createElement('div');
    body.className = 'card-body';
    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    visibleDefects.forEach((d, didx) => {
      const sectionKey = sec.title;
      const subsectionKey = d.title; // Each defect is its own subsection in this template
      const fullKey = `${sectionKey}|||${subsectionKey}`;
      
      // Assign section number if new section
      if (!sectionNumbers.has(sectionKey)) {
        currentSectionNum++;
        sectionNumbers.set(sectionKey, currentSectionNum);
        subsectionNumbers.set(sectionKey, new Map());
      }
      
      const sectionNum = sectionNumbers.get(sectionKey);
      const subsectionMap = subsectionNumbers.get(sectionKey);
      
      // Assign subsection number if new subsection within this section
      if (!subsectionMap.has(subsectionKey)) {
        subsectionMap.set(subsectionKey, subsectionMap.size + 1);
      }
      
      const subsectionNum = subsectionMap.get(subsectionKey);
      
      // Increment defect counter for this subsection
      const currentCount = defectCounters.get(fullKey) || 0;
      const defectNum = currentCount + 1;
      defectCounters.set(fullKey, defectNum);
      
      // Create display number: Section.Subsection.Defect (e.g., "4.1.2")
      const display = `${sectionNum}.${subsectionNum}.${defectNum}`;

      // Summary row
      const row = document.createElement('tr');
  row.innerHTML = `<td>${display}</td><td>${sec.title}</td><td>${d.title}</td>`;
      summaryBody.appendChild(row);

      // Defect section
      const sev = (d.severity || '').toLowerCase();
      const defectSection = document.createElement('section');
      defectSection.className = 'report-section';
      defectSection.style.setProperty('--selected-color', sev === 'danger' ? '#ef4444' : sev === 'warning' ? '#f59e0b' : '#3b82f6');
      
      // Section heading
      const sectionHeading = document.createElement('div');
      sectionHeading.className = 'section-heading';
      const headingText = document.createElement('h2');
      headingText.className = 'section-heading-text';
  headingText.textContent = `${display} ${sec.title} - ${d.title}`;
      
      // Add badge with importance label
      let importanceLabel = 'Maintenance Items'; // default blue
      if (sev === 'danger') importanceLabel = 'Immediate Attention';
      else if (sev === 'warning') importanceLabel = 'Items for Repair';
      else if (sev === 'info') importanceLabel = 'Further Evaluation';
      
      const badge = document.createElement('span');
      badge.className = 'importance-badge';
      badge.textContent = importanceLabel;
      headingText.appendChild(badge);
      sectionHeading.appendChild(headingText);
      
      // Content grid
      const contentGrid = document.createElement('div');
      contentGrid.className = 'content-grid';
      
      // Image section
      const imageSection = document.createElement('div');
      imageSection.className = 'image-section';
      
      const imageTitle = document.createElement('h3');
      imageTitle.className = 'image-title';
      imageTitle.textContent = 'Visual Evidence';
      
      const imageContainer = document.createElement('div');
      imageContainer.className = 'image-container';
      
      if (d.image) {
        const img = document.createElement('img');
        img.className = 'property-image';
        img.src = d.image;
        img.alt = d.title;
        img.loading = 'lazy';
        img.addEventListener('click', () => openZoom(d.image, d.title));
        imageContainer.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder';
        placeholder.innerHTML = '<p>No image available</p>';
        imageContainer.appendChild(placeholder);
      }
      
      const locationSection = document.createElement('div');
      locationSection.className = 'location-section';
      const locationTitle = document.createElement('h4');
      locationTitle.className = 'section-title';
      locationTitle.textContent = 'Location';
      const locationContent = document.createElement('p');
      locationContent.className = 'section-content';
      locationContent.textContent = d.location || 'Not specified';
      locationSection.append(locationTitle, locationContent);
      
      imageSection.append(imageTitle, imageContainer, locationSection);
      
      // Description section
      const descriptionSection = document.createElement('div');
      descriptionSection.className = 'description-section';
      
      const descriptionTitle = document.createElement('h3');
      descriptionTitle.className = 'description-title';
      descriptionTitle.textContent = 'Analysis Details';
      
      const defectDiv = document.createElement('div');
      defectDiv.className = 'section';
      const defectTitle = document.createElement('h4');
      defectTitle.className = 'section-title';
      defectTitle.textContent = 'Defect';
      const defectContent = document.createElement('p');
      defectContent.className = 'section-content';
      defectContent.textContent = d.description;
      defectDiv.append(defectTitle, defectContent);
      
      // Mock estimated costs (since original data doesn't have these)
      const costsDiv = document.createElement('div');
      costsDiv.className = 'section';
      const costsTitle = document.createElement('h4');
      costsTitle.className = 'section-title';
      costsTitle.textContent = 'Estimated Costs';
      const costsContent = document.createElement('div');
      costsContent.className = 'section-content';
      costsContent.innerHTML = `
        <p>
          <strong>Materials:</strong> General materials ($85)<br/>
          <strong>Labor:</strong> Contractor at $100/hr<br/>
          <strong>Hours:</strong> 2<br/>
          <strong>Recommendation:</strong> Repair as needed<br/>
          <strong>Total Estimated Cost:</strong> $285
        </p>
      `;
      costsDiv.append(costsTitle, costsContent);
      
      // Cost highlight
      const costHighlight = document.createElement('div');
      costHighlight.className = 'cost-highlight';
      const totalCost = document.createElement('div');
      totalCost.className = 'total-cost';
      totalCost.textContent = 'Total Estimated Cost: $285';
      costHighlight.appendChild(totalCost);
      
      descriptionSection.append(descriptionTitle, defectDiv, costsDiv, costHighlight);
      
      contentGrid.append(imageSection, descriptionSection);
      defectSection.append(sectionHeading, contentGrid);
      grid.appendChild(defectSection);
    });

    // Only render section if at least one visible defect
    if (visibleDefects.length > 0) {
      body.appendChild(grid);
      card.appendChild(body);
      secWrap.appendChild(card);
      container.appendChild(secWrap);
    }
  });
}

// ScrollSpy for active nav item
function setupScrollSpy(links) {
  const sections = links.map((a) => document.querySelector(a.getAttribute('href')));
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const id = entry.target.id;
      const link = links.find((l) => l.getAttribute('href') === `#${id}`);
      if (entry.isIntersecting) {
        links.forEach((l) => l.classList.remove('active'));
        link?.classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0.01 });

  sections.forEach((sec) => sec && obs.observe(sec));
}

// Image Zoom Modal
const modal = document.getElementById('zoomModal');
const zoomImg = document.getElementById('zoomImage');
const zoomCaption = document.getElementById('zoomCaption');

function openZoom(src, caption) {
  zoomImg.src = src;
  zoomCaption.textContent = caption || '';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeZoom() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  zoomImg.src = '';
}

modal.addEventListener('click', (e) => {
  if (e.target.dataset.close) closeZoom();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeZoom();
});

// View toggle (Full vs Summary) with dimming and filtering behavior
function setupViewToggle(sectionMeta) {
  // Support toolbar primary buttons
  const buttons = document.querySelectorAll('[data-view]');
  const summary = document.getElementById('summarySection');
  const sectionsContainer = document.getElementById('sectionsContainer');
  const intro = document.getElementById('intro');
  const info1 = document.getElementById('section-1');
  const info2 = document.getElementById('section-2');

  function setSelected(btn) {
    document.querySelectorAll('[data-view]')
      .forEach((x) => x.setAttribute('aria-selected', 'false'));
    if (btn) btn.setAttribute('aria-selected', 'true');
  }

  function enterSummaryMode() {
    // Only defects remain: hide info sections and empty sections
    summary.hidden = true; // focus on filtered defect sections
    sectionsContainer.hidden = false;
    [intro, info1, info2].forEach((el) => el && (el.hidden = true));
    // Rebuild sections so only sections with visible defects remain
    buildSections(sectionMeta.sections);
    // Dim nav items that have zero defects (only dynamic section links)
    sectionMeta.links.forEach((lnk, i) => {
      const count = sectionMeta.sections[i].defects.length;
      lnk.classList.toggle('dim', count === 0);
    });
    // Scroll to first visible defect section
    const first = sectionsContainer.querySelector('.section:not([hidden])');
    (first || sectionsContainer).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function enterFullMode() {
    summary.hidden = true;
    sectionsContainer.hidden = false;
    [intro, info1, info2].forEach((el) => el && (el.hidden = false));
    buildSections(sectionMeta.sections);
    // Restore nav dimming
    sectionMeta.links.forEach((lnk) => lnk.classList.remove('dim'));
    document.getElementById('cover').scrollIntoView({ behavior: 'smooth' });
  }

  buttons.forEach((b) => {
    b.addEventListener('click', () => {
      const v = b.dataset.view;
      setSelected(b);
      if (v === 'summary') return enterSummaryMode();
      if (v === 'hazard') return enterHazardMode();
      return enterFullMode();
    });
  });

  // Expose functions for hazard button to reuse Summary behavior
  function enterHazardMode() {
    summary.hidden = true;
    sectionsContainer.hidden = false;
    [intro, info1, info2].forEach((el) => el && (el.hidden = true));
    // Build only red-severity defects
    buildSections(sectionMeta.sections, { filterSeverity: 'danger' });
    // Dim sidebar for sections that have no red defects (only dynamic section links)
    sectionMeta.links.forEach((lnk, i) => {
      const countRed = (sectionMeta.sections[i].defects || []).filter(d => (d.severity||'').toLowerCase()==='danger').length;
      lnk.classList.toggle('dim', countRed === 0);
    });
    const first = sectionsContainer.querySelector('.section');
    (first || sectionsContainer).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  window.__reportView = { enterSummaryMode, enterFullMode, enterHazardMode, setSelected };
}

// Dropdown
function setupDropdowns() {
  document.querySelectorAll('.dropdown > .btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const dd = btn.parentElement;
      dd.classList.toggle('open');
    });
  });
  document.addEventListener('click', (e) => {
    const target = e.target;
    document.querySelectorAll('.dropdown').forEach((dd) => {
      if (!dd.contains(target)) dd.classList.remove('open');
    });
  });
}

// Share and PDF actions
function setupActions() {
  // Share: copy current URL
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const url = window.location.href;
      try {
        if (navigator.share) {
          await navigator.share({ title: document.title, url });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          const original = shareBtn.innerHTML;
          shareBtn.innerHTML = 'Copied!';
          setTimeout(() => (shareBtn.innerHTML = original), 1200);
        }
      } catch (_) {}
    });
  }

  // PDF: print the page with print-optimized CSS
  document.querySelectorAll('[data-action="download-pdf"]').forEach((el) => {
    el.addEventListener('click', () => {
      // Ensure Full mode (all sections visible and ordered) before printing
      const fullBtn = document.querySelector('[data-view="full"]');
      if (fullBtn && window.__reportView) {
        window.__reportView.setSelected(fullBtn);
        window.__reportView.enterFullMode();
      }
      // Close any open dropdowns
      document.querySelectorAll('.dropdown').forEach((dd) => dd.classList.remove('open'));
      // Small timeout to allow layout to stabilize
      setTimeout(() => {
        window.focus();
        window.print();
      }, 50);
    });
  });
}

// Initialize
buildCover(reportData.cover);
const navLinks = buildNav(reportData.sections);
const staticNavLinks = Array.from(document.querySelectorAll('.nav-item.nav-static'));
buildSections(reportData.sections);
setupScrollSpy([...staticNavLinks, ...navLinks]);
setupViewToggle({ links: navLinks, sections: reportData.sections });
setupDropdowns();
setupActions();

// Wire the hazard button to jump to summary view like reference
const hazardBtn = document.getElementById('hazardBtn');
if (hazardBtn) {
  hazardBtn.addEventListener('click', () => {
    window.__reportView?.setSelected(hazardBtn);
    window.__reportView?.enterHazardMode();
  });
}
