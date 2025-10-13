# AI Coding Agent Instructions

## Quick Start Guide for AI Agents

**First-time setup**: Run `npm install` then `npm run dev`. Requires Node.js 22.x.

**Common Tasks**:

- **Add new defect field**: Update `types/mongo.ts` interface → Update `/api/defects` routes → Update `DefectEditModal.tsx` UI
- **Modify AI prompt**: Edit `src/app/api/llm/analyze-image/route.ts` system prompt (~line 80)
- **Change PDF layout**: Modify `public/report-template/index.html` + `lib/pdfTemplate.ts` data injection
- **Add canvas tool**: Reference arrow/circle implementations in `components/ImageEditor.tsx`
- **Debug localStorage flow**: Check `pendingAnnotation` lifecycle in `DefectEditModal.tsx` (lines 81-122) and `InformationSections.tsx` (~line 252)

**Key File Locations**:

- API routes: `src/app/api/[resource]/route.ts`
- Components: `components/*.tsx` (no src prefix)
- MongoDB models: `types/mongo.ts` (TypeScript interfaces, not Mongoose schemas)
- State management: `lib/store.ts` (Zustand)
- Utilities: `lib/*.ts` (defect, inspection, mongodb, pdfTemplate, r2)

---

## Project Overview

This is a **Next.js 13 App Router** property inspection application for professional home inspectors. Users annotate images with defects, organize inspection data into structured sections, and generate professional PDF/DOCX reports with cost estimates. The app combines canvas-based image editing, AI-powered defect analysis (OpenAI Vision), and server-side PDF generation.

**Tech Stack**: Next.js 13.4.19, TypeScript, React 18, MongoDB (Mongoose), Cloudflare R2 (object storage), OpenAI API, Puppeteer + Chromium, Zustand (state), Node.js 22

**Key Capabilities**: Image annotation with canvas tools (arrows, circles, crop), voice-to-text descriptions, AI cost estimation, template-based information sections with checklists, automated defect numbering, multi-format report export (PDF/DOCX)

## Architecture & Data Flow

### Three Main User Workflows

1. **Defect Capture Flow**:

   - User uploads image in `/image-editor` → annotates with arrows/circles/text → fills location/description
   - Submits to `/api/llm/analyze-image` which uploads to R2, analyzes with OpenAI Vision, extracts cost data
   - Creates defect record in MongoDB with AI analysis (materials, labor, cost estimate)

2. **Information Sections Flow**:

   - User opens inspection in modal → navigates to "Information Sections" tab
   - Selects checklist items from template sections (Exterior, Electrical, etc.)
   - Attaches annotated images via `pendingAnnotation` localStorage handoff
   - Saves as "information blocks" linked to inspection via `/api/information-sections/[inspectionId]`

3. **Report Generation**:
   - `/inspection_report/[id]` fetches defects + information blocks from MongoDB
   - Injects data into HTML template (`public/report-template/index.html`)
   - Puppeteer renders HTML to PDF with proper page breaks and styling
   - Downloads PDF or generates DOCX (experimental)

### Cross-Component Communication via localStorage

**Critical Pattern**: The app uses `localStorage` as a message bus to pass data between disconnected page routes:

**Key `localStorage` Items:**

- **`pendingAnnotation`**: Bridges image-editor → inspection modal (image URL, inspectionId, checklistId, location tag)
- **`returnToSection`**: Signals which checklist item to attach image to in Information Sections
- **`inspection-checklists-${inspectionId}`**: Caches custom checklist items added during inspection (not saved to template)

**Lifecycle Example**:

```tsx
// 1. User clicks "Add Image" in InformationSections → navigates to /image-editor
router.push(`/image-editor?inspectionId=${inspectionId}&checklistId=${itemId}`);

// 2. User annotates + submits in /image-editor/page.tsx (line ~396)
localStorage.setItem(
  "pendingAnnotation",
  JSON.stringify({
    imageUrl: annotatedUrl,
    inspectionId: selectedInspectionId,
    checklistId: checklistId,
    location: locationTag,
  })
);
router.push("/"); // Returns to inspection list

// 3. User reopens inspection → DefectEditModal.tsx polls for pendingAnnotation (lines 81-122)
//    Switches to "Information Sections" tab, shows success alert

// 4. InformationSections.tsx detects pendingAnnotation (line ~252)
//    Attaches image to correct checklist block, removes localStorage item
localStorage.removeItem("pendingAnnotation");
```

**Why Polling?**: 3-second polling interval handles race condition where image-editor saves annotation after modal opens (common when user navigates quickly).

## MongoDB Data Models & Patterns

### Collections Structure

**Core Collections:**

- **`inspections`**: Root entity (`_id`, `name`, `headerImage`, `headerName`, `headerAddress`)
- **`defects`**: Child records with `inspection_id: ObjectId` — annotated images + AI cost analysis
- **`information_blocks`**: Child records with `inspection_id` — checklist selections + images + custom text
- **`sections`**: Global templates (Exterior, Electrical, Roof, etc.) with embedded `checklists[]` array

**Checklist Schema (embedded in sections):**

```ts
{
  _id: string,
  text: string,
  type: 'status' | 'information',
  tab: 'information' | 'limitations',
  answer_choices?: string[], // Predefined options (e.g., ["Good", "Fair", "Poor"])
  order_index: number
}
```

### ObjectId Conversion Pattern

**CRITICAL**: MongoDB stores `_id` and foreign keys as `ObjectId` type, but Next.js API routes receive/send strings. Always convert:

```ts
import { ObjectId } from "mongodb";

// Creating defect with inspection link
const defectData = {
  ...data,
  inspection_id: new ObjectId(inspectionId), // String → ObjectId
};

// Querying by ID
const defect = await db.collection("defects").findOne({
  _id: new ObjectId(defectId),
});

// Updating with $set operator
await db
  .collection("defects")
  .updateOne(
    { _id: new ObjectId(defectId) },
    { $set: { defect_description: newText } }
  );
```

**Common Error**: `"Argument passed in must be a string of 12 bytes or 24 hex characters"` → forgot to convert string to ObjectId

### Connection Caching for Hot Reload

`lib/mongodb.ts` uses global variable to prevent connection spam during Next.js dev mode:

```ts
if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;
```

**Why**: Each hot reload would create new connections without this pattern, exhausting MongoDB connection pool.

## API Route Patterns (Next.js 13 App Router)

### RESTful Structure in `src/app/api/`

**Defect Management:**

- `POST /api/defects` → Create defect (returns `{ id: string }`)
- `GET /api/defects/[inspectionId]` → List all defects for inspection
- `PATCH /api/defects/[defectId]` → Update defect fields (auto-save uses this)
- `DELETE /api/defects/[defectId]` → Delete defect

**Inspection Management:**

- `POST /api/inspections` → Create inspection (returns `{ id, name }`)
- `GET /api/inspections` → List all inspections
- `GET /api/inspections/[inspectionId]` → Get single inspection details
- `PUT /api/inspections/[inspectionId]` → Update header image/name/address

**Information Sections:**

- `GET /api/information-sections/sections` → Fetch global section templates
- `GET /api/information-sections/[inspectionId]` → Fetch inspection's information blocks
- `POST /api/information-sections/[inspectionId]` → Create new block
- `PUT /api/information-sections/[inspectionId]` → Update existing block
- `DELETE /api/information-sections/[inspectionId]?blockId=xxx` → Delete block

**AI & Media:**

- `POST /api/llm/analyze-image` → Upload image, run OpenAI Vision, create defect (multipart/form-data or JSON)
- `POST /api/r2api` → Direct R2 upload endpoint for header images

**Report Generation:**

- `POST /api/reports/generate` → Generate PDF from defects array (Puppeteer)

### Standard Error Handling Pattern

```ts
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Validate required fields
    if (!body.inspection_id) {
      return NextResponse.json(
        { error: "inspection_id is required" },
        { status: 400 }
      );
    }

    const result = await createDefect(body);
    return NextResponse.json({ id: result.insertedId }, { status: 201 });
  } catch (error: any) {
    console.error("❌ Error creating defect:", error);
    return NextResponse.json(
      { error: error.message, details: error.stack },
      { status: 500 }
    );
  }
}
```

**Always return**: JSON with `{ error: string }` + appropriate status code (400 validation, 404 not found, 500 server error).

## Image Storage with Cloudflare R2

### Upload Flow (`lib/r2.ts`)

1. Client submits `File` or base64 string via FormData or JSON body
2. API route converts to `Buffer`, calls `uploadToR2(buffer, key, contentType)`
3. Uses AWS S3 SDK (`@aws-sdk/client-s3`) with Cloudflare R2 endpoint
4. Returns public URL: `${CLOUDFLARE_PUBLIC_URL}/${key}`

**Environment Variables (Required):**

```bash
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_R2_BUCKET=your-bucket-name
CLOUDFLARE_R2_ACCESS_KEY_ID=xxx
CLOUDFLARE_R2_SECRET_ACCESS_KEY=xxx
CLOUDFLARE_PUBLIC_URL=https://pub-xxx.r2.dev
```

**Upload Example:**

```ts
import { uploadToR2 } from "@/lib/r2";

const buffer = Buffer.from(await file.arrayBuffer());
const key = `defects/${Date.now()}-${file.name}`;
const url = await uploadToR2(buffer, key, file.type);
// Returns: https://pub-xxx.r2.dev/defects/1234567890-image.jpg
```

### HEIC Image Conversion

**Problem**: iOS photos are often HEIC format, unsupported by browsers/canvas  
**Solution**: Client-side conversion using `heic-convert` or `heic2any`

```ts
// Convert HEIC to JPEG before canvas rendering
if (file.type === "image/heic" || file.name.endsWith(".heic")) {
  const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg" });
  file = new File([convertedBlob], file.name.replace(".heic", ".jpg"), {
    type: "image/jpeg",
  });
}
```

**Webpack Config**: Suppress `libheif-js` critical dependency warning in `next.config.mjs`:

```js
config.ignoreWarnings = [
  {
    module: /libheif-bundle\.js/,
    message: /Critical dependency: require function is used in a way/,
  },
];
```

## Component Architecture

### `ImageEditor.tsx` (Canvas-Based Editing, 2663 lines)

**Core Features:**

- Freehand drawing, arrows, circles, squares with color picker
- Crop with draggable/resizable frame
- Undo/redo via `actionHistory` and `redoHistory` arrays
- Image rotation, zoom controls
- Export to base64 or File object

**Key Props:**

- `preloadedImage: string` → URL to edit existing image (vs. upload new)
- `preloadedFile: File` → File object for existing image
- `onImageChange: (img: HTMLImageElement) => void` → Callback when canvas updates
- `onFileChange: (file: File) => void` → Callback when exportable file ready

**Canvas Rendering Pattern:**

```ts
const redrawCanvas = () => {
  if (!ctx || !currentImage) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply transformations (rotation, zoom)
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(zoom, zoom);

  // Draw base image
  ctx.drawImage(
    currentImage,
    -currentImage.width / 2,
    -currentImage.height / 2
  );

  // Replay action history (arrows, circles, etc.)
  actionHistory.forEach((action) => drawAction(action));

  ctx.restore();
};
```

**Undo/Redo Implementation**: Each drawing action is an object `{ type: 'arrow'|'circle'|'line', points: [], color: string }`. Undo pops from `actionHistory` → `redoHistory`, then redraws canvas.

### `DefectEditModal.tsx` (Inspection Management Modal)

**Dual-Tab Interface:**

- **Defects Tab**: List/edit/delete defects with inline editing + auto-save
- **Information Sections Tab**: Embed `InformationSections` component (dynamic import)

**Auto-Save Pattern (Defects):**

```ts
const handleFieldChange = (field: keyof Defect, value: string) => {
  setEditedValues((prev) => ({ ...prev, [field]: value }));
  triggerAutoSave(); // Debounced 1 second
};

const performAutoSave = async () => {
  const response = await fetch(`/api/defects/${editingId}`, {
    method: "PATCH",
    body: JSON.stringify(editedValues),
  });
  setLastSaved(new Date().toLocaleTimeString());
};
```

**Polling for `pendingAnnotation`** (lines 81-122):

```ts
useEffect(() => {
  if (!isOpen) return;

  let hasAlerted = false;
  const checkPending = () => {
    const pending = localStorage.getItem("pendingAnnotation");
    if (pending && !hasAlerted) {
      setActiveTab("information");
      alert("✅ Image saved successfully!");
      hasAlerted = true;
    }
  };

  checkPending(); // Immediate check
  const interval = setInterval(checkPending, 500); // Poll for 3 seconds
  return () => clearInterval(interval);
}, [isOpen]);
```

### `InformationSections.tsx` (Checklist Management, 2938 lines)

**Complexity Sources:**

- Template sections (global) + inspection-specific custom checklists
- Predefined `answer_choices` per item with custom answer inputs
- Multi-image attachment with location tagging
- Auto-save for block edits (debounced 1s)

**Data Structure:**

```ts
interface IInformationBlock {
  inspection_id: string;
  section_id: ISection | string; // Populated or ObjectId
  selected_checklist_ids: ISectionChecklist[] | string[];
  selected_answers: Array<{ checklist_id: string; selected_answers: string[] }>;
  custom_text?: string;
  images: IBlockImage[]; // { url, annotations, checklist_id, location }
}
```

**Inspection-Specific Checklists** (not saved to template):

```ts
const [inspectionChecklists, setInspectionChecklists] = useState<
  Map<string, ISectionChecklist[]>
>(new Map());

// Persisted in localStorage as `inspection-checklists-${inspectionId}`
useEffect(() => {
  const stored = localStorage.getItem(`inspection-checklists-${inspectionId}`);
  if (stored) setInspectionChecklists(new Map(JSON.parse(stored)));
}, [inspectionId]);
```

**Image Attachment Flow:**

1. User clicks "Add Image" next to checklist item → stores `returnToSection` in localStorage
2. Navigates to `/image-editor?inspectionId=xxx&checklistId=yyy`
3. User annotates → saves `pendingAnnotation` to localStorage
4. Returns to modal → `checkPendingAnnotation()` detects data → attaches to block

## AI Integration (OpenAI Vision API)

### Defect Analysis Pipeline (`/api/llm/analyze-image/route.ts`)

**Flow:**

1. Client uploads annotated image (multipart/form-data or JSON with base64)
2. API route uploads image to R2 for permanent storage
3. Sends R2 URL + user description to OpenAI Vision API with structured prompt
4. Extracts structured data: `materials_names`, `materials_total_cost`, `labor_type`, `labor_rate`, `hours_required`, `recommendation`
5. Creates defect record in MongoDB with AI analysis + original image URL

**System Prompt Engineering** (customize in route.ts ~line 80-120):

```ts
const systemPrompt = `You are an expert home inspector analyzing defect images.
Extract the following from the image and description:
- materials_names: List of materials needed for repair
- materials_total_cost: Estimated material cost in USD (number)
- labor_type: Type of contractor needed (e.g., "Electrician", "Roofer")
- labor_rate: Hourly rate for labor in USD (number)
- hours_required: Estimated hours for repair (number)
- recommendation: Professional recommendation for addressing the defect

Return JSON only, no markdown.`;
```

**Cost Calculation Pattern:**

```ts
const totalCost =
  defect.material_total_cost + defect.labor_rate * defect.hours_required;
```

**Async Processing** (Optional): Uses `@upstash/qstash` for long-running AI analysis to avoid API timeouts on slow requests.

## PDF Generation with Puppeteer

### Architecture (`/api/reports/generate/route.ts`)

### Template System (`public/report-template/`)

**Standalone HTML template**: `public/report-template/index.html` (includes inline CSS/JS)

**Template Structure**:

- **Header Section**: Company logo, report title, property address (injected from meta)
- **Summary Table**: Overview of all defects with display numbers and total costs
- **Defect Details**: Full-page sections for each defect with images, descriptions, cost breakdowns
- **Information Sections**: Checklist items grouped by category (Exterior, Electrical, etc.)
- **Page Breaks**: CSS `page-break-after: always` for proper PDF pagination

**Data Injection**:

- Function: `generateInspectionReportHTML(defects, meta)` in `lib/pdfTemplate.ts`
- Process: Loads HTML template → replaces placeholders → injects dynamic content → returns HTML string
- Template placeholders: `{{COMPANY_NAME}}`, `{{REPORT_TITLE}}`, `{{DEFECTS_HTML}}`, `{{INFORMATION_SECTIONS_HTML}}`

**Styling**: All CSS must be inline or in `<style>` tag — external stylesheets don't work in Puppeteer PDF generation

**Custom Template Modifications**:

1. Edit `public/report-template/index.html` for layout changes
2. Update `lib/pdfTemplate.ts` functions for data injection logic
3. Test with `POST /api/reports/generate` endpoint
4. Verify page breaks and image sizing in generated PDF

**Defect Numbering System:**

Defects are automatically numbered in the format `[Section].[Subsection].[Defect]`:

- Example: `3.1.2` = Section 3, Subsection 1, 2nd defect in that subsection
- Calculated dynamically by `calculateDefectNumbers()` function in `lib/pdfTemplate.ts`
- Groups defects by section → subsection → sequential number
- Numbers are NOT stored in database — generated at report time
- Display numbers appear in summary tables and next to each defect heading

**Implementation:**

```ts
// In lib/pdfTemplate.ts
function calculateDefectNumbers(
  defects: DefectItem[],
  startNumber: number = 1
): DefectItem[] {
  // 1. Sorts defects by section → subsection
  // 2. Assigns section numbers sequentially (4, 5, 6...)
  // 3. Assigns subsection numbers within each section (1, 2, 3...)
  // 4. Assigns defect numbers within each subsection (1, 2, 3...)
  // 5. Returns defects with display_number field added (e.g., "4.2.3")
}

// Used in generateInspectionReportHTML:
const numberedDefects = calculateDefectNumbers(defects, startNumber);
// Each defect now has defect.display_number = "3.1.2"
```

**Request Payload:**

```ts
POST /api/reports/generate
{
  "defects": [
    {
      "section": "Exterior",
      "subsection": "Siding, Flashing, & Trim",
      "defect_description": "Cracked siding at rear wall.",
      "image": "https://r2.dev/image.jpg",
      "material_total_cost": 250,
      "labor_rate": 85,
      "hours_required": 3,
      "color": "#d63636"
    }
  ],
  "meta": {
    "title": "Inspection Report #123",
    "company": "AGI Property Inspections",
    "logoUrl": "https://r2.dev/logo.png"
  }
}
```

### Puppeteer Configuration (Serverless vs Local)

**Serverless (Vercel/AWS Lambda):**

```ts
import chromium from "@sparticuz/chromium-min";
const executablePath = await chromium.executablePath(
  process.env.CHROMIUM_PACK_URL
);
const browser = await puppeteer.launch({
  executablePath,
  args: chromium.args,
  headless: chromium.headless,
});
```

**Local Development:**

```ts
// Auto-detects Chrome installation
const isWin = process.platform === "win32";
const candidates = isWin
  ? [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ]
  : [
      "/usr/bin/google-chrome",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ];
const executablePath = candidates.find((p) => existsSync(p));
```

**Fallback**: Set `PUPPETEER_EXECUTABLE_PATH` or `CHROME_PATH` env variable to Chrome binary location.

### Next.js Configuration for Puppeteer

**`next.config.mjs` (CRITICAL):**

```js
experimental: {
  serverComponentsExternalPackages: [
    "puppeteer-core",
    "@sparticuz/chromium",
    "@sparticuz/chromium-min"
  ]
},
webpack: (config, { isServer }) => {
  if (isServer) {
    config.externals.push("puppeteer-core", "@sparticuz/chromium-min");
  }
  return config;
}
```

**Why**: Prevents Next.js from bundling Chromium binaries (causes build errors) and allows Puppeteer to run in Node.js runtime.

**Runtime Config**: API route must specify `export const runtime = "nodejs";` to enable Puppeteer (Edge runtime doesn't support it).

## Development Workflow

### Running Locally

```bash
npm install
npm run dev  # Starts Next.js dev server on http://localhost:3000
```

**Required Environment Variables** (`.env.local`):

```bash
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Cloudflare R2 Storage
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_R2_BUCKET=your-bucket-name
CLOUDFLARE_R2_ACCESS_KEY_ID=xxx
CLOUDFLARE_R2_SECRET_ACCESS_KEY=xxx
CLOUDFLARE_PUBLIC_URL=https://pub-xxx.r2.dev

# OpenAI
OPENAI_API_KEY=sk-xxx

# Optional
QSTASH_TOKEN=xxx  # For async job processing
NEXT_PUBLIC_BASE_URL=http://localhost:3000
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome  # For local PDF generation
CHROMIUM_PACK_URL=https://github.com/Sparticuz/chromium/releases/download/v138.0.0/chromium-v138.0.0-pack.tar  # For serverless
```

### Voice Input Feature

**Speech-to-Text**: Defect descriptions can be filled via microphone using Web Speech API (WebKit)

- Browser compatibility: Chrome/Edge (full support), Firefox/Safari (limited)
- Location: Microphone button between location selector and submit button in `/image-editor`
- Implementation: `src/app/image-editor/page.tsx` uses `webkitSpeechRecognition` API
- Auto-fills description field, shows transcript, handles errors gracefully

### Testing Workflows

**Test Defect Creation:**

1. Navigate to `/` → Create inspection
2. Click inspection → "Add Defect" button
3. Redirects to `/image-editor?inspectionId=xxx`
4. Upload/annotate image → Fill location/description → Submit
5. Check MongoDB `defects` collection for new record with AI analysis

**Test Information Sections:**

1. Open inspection → "Information Sections" tab
2. Click section (e.g., "Exterior") → Select checklist items
3. Click "Add Image" icon → Annotates `pendingAnnotation` localStorage
4. Returns to modal → Should show success alert and attach image

**Test PDF Generation:**

1. Navigate to `/inspection_report/[inspectionId]`
2. Click "Download PDF" button
3. Should generate PDF with defects and information blocks

### Debugging Common Issues

**Image won't upload**: Check R2 env vars, verify bucket CORS settings allow `PUT` from localhost  
**AI analysis fails**: Check `OPENAI_API_KEY`, review OpenAI API quota/errors in route logs  
**PDF generation fails locally**: Install Google Chrome, set `PUPPETEER_EXECUTABLE_PATH` env var  
**PDF generation fails serverless**: Set `CHROMIUM_PACK_URL` env var, verify `@sparticuz/chromium-min` is installed  
**MongoDB connection errors**: Verify IP whitelist in MongoDB Atlas, check connection string format  
**`pendingAnnotation` not detected**: Check browser console for localStorage errors, verify polling interval in `DefectEditModal`  
**HEIC images won't load**: Check `heic-convert` or `heic2any` library, verify webpack config suppresses warnings  
**Voice input not working**: Check browser permissions, verify WebKit Speech API support (Chrome/Edge only)

### PowerShell Development Tips

**Running scripts**: Use `;` to chain commands: `cd .\Advanced-Image-Editor-Next.js\; npm run dev`  
**Environment variables**: Set with `$env:VARIABLE_NAME="value"` before running commands  
**File paths**: Use backslashes or forward slashes: `c:\path\to\file` or `c:/path/to/file`

## Common Gotchas & Solutions

### 1. ObjectId Conversion Errors

**Error**: `"Argument passed in must be a string of 12 bytes or 24 hex characters"`  
**Cause**: Forgot to convert string ID to `ObjectId` when querying MongoDB  
**Fix**: `new ObjectId(stringId)` in all MongoDB queries

### 2. localStorage Race Conditions

**Problem**: Annotation data saved in `/image-editor` not immediately available when modal reopens  
**Solution**: 3-second polling interval in `DefectEditModal` (lines 81-122) handles async timing  
**Key Code**: `setInterval(() => checkPending(), 500)` for 6 iterations

### 3. Canvas Scaling Issues in ImageEditor

**Problem**: Annotations appear offset or clipped  
**Cause**: Canvas dimensions don't match image aspect ratio  
**Fix**: Check `redrawCanvas()` function — must maintain aspect ratio and apply transformations in correct order (translate → rotate → scale → draw)

### 4. Puppeteer `Protocol error` in Production

**Error**: `Protocol error (Target.setDiscoverTargets): Target closed`  
**Cause**: Chromium binary not found or incompatible with serverless environment  
**Fix**: Ensure `@sparticuz/chromium-min` is installed and `CHROMIUM_PACK_URL` env var points to remote pack (Vercel) or use local Chrome path

### 5. Auto-Save Timer Memory Leaks

**Problem**: Auto-save continues firing after component unmounts  
**Solution**: Clear timers in cleanup function:

```ts
useEffect(() => {
  return () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  };
}, []);
```

### 6. HEIC Upload Warnings in Webpack

**Warning**: `Critical dependency: require function is used in a way in which dependencies cannot be statically extracted`  
**Cause**: `libheif-js` uses dynamic `require()` for WASM loading  
**Fix**: Already suppressed in `next.config.mjs` via `config.ignoreWarnings` — safe to ignore

### 7. Dynamic Import SSR Hydration Mismatch

**Error**: `Text content does not match server-rendered HTML`  
**Cause**: `InformationSections` component uses browser APIs (localStorage) during render  
**Fix**: Already using `dynamic(() => import(...), { ssr: false })` in `DefectEditModal` to disable SSR for this component

### 8. File Upload Size Limits

**Problem**: Large images (>4MB) fail to upload  
**Solution**: Increase Next.js body size limit in API route or convert to multipart/form-data streaming (already implemented in `/api/llm/analyze-image`)

### 9. Next.js 13 App Router Route Configuration

**Issue**: API routes need specific runtime/caching configuration
**Pattern**: Export route segment config at top of file:

```ts
export const runtime = "nodejs"; // Required for Puppeteer (not Edge)
export const dynamic = "force-dynamic"; // Prevent caching
export const maxDuration = 60; // Extend timeout for long operations
```

**Used in**: `/api/reports/generate`, `/api/information-sections/[inspectionId]`

### 10. Windows PowerShell Path Issues

**Problem**: Scripts fail with path-related errors on Windows
**Solution**: Use `path.resolve()` or `path.join()` for cross-platform paths, not string concatenation
**Example**: `path.join(process.cwd(), 'public', 'report-template', 'index.html')` instead of `'./public/report-template/index.html'`

## Code Style & Conventions

### TypeScript Patterns

- **Strict mode enabled**: All types must be explicit, no implicit `any`
- **Interface naming**: Prefix with `I` for data models (`ISection`, `IInformationBlock`)
- **Null safety**: Use optional chaining (`defect?.image`) and nullish coalescing (`value ?? default`)
- **Type imports**: Import types separately when needed: `import type { NextRequest } from 'next/server'`

### Component Organization

- **Large components OK**: Files >2000 lines are acceptable if logically cohesive (e.g., `InformationSections.tsx`, `ImageEditor.tsx`)
- **Section comments**: Use `// ===== SECTION NAME =====` dividers for long files
- **Client components**: Always mark with `"use client"` directive at top if using hooks/browser APIs
- **Dynamic imports**: Use for heavy components to reduce bundle size: `dynamic(() => import(...), { ssr: false })`

### State Management

- **Zustand for global state**: `lib/store.ts` uses Zustand with persist middleware for analysis data
- **localStorage for cross-route messaging**: `pendingAnnotation`, `returnToSection`, `inspection-checklists-${id}`
- **Component state**: Use `useState` for local UI state, lift up only when needed
- **No Redux/Context API**: Zustand handles all global state needs

### Component Organization

- **Large components OK**: Files >2000 lines are acceptable if logically cohesive (e.g., `InformationSections.tsx`)
- **Section comments**: Use `// ===== SECTION NAME =====` dividers for long files
- **Client components**: Always mark with `"use client"` directive at top if using hooks/browser APIs

### API Response Patterns

```ts
// Success with data
return NextResponse.json(
  { id: "123", message: "Created successfully" },
  { status: 201 }
);

// Validation error
return NextResponse.json(
  { error: "Missing required field: inspection_id" },
  { status: 400 }
);

// Server error with details
return NextResponse.json(
  { error: error.message, details: error.stack },
  { status: 500 }
);
```

### Console Logging with Emoji Prefixes

Use emojis for visual clarity in server logs:

- `🔄` — Processing/loading state
- `✅` — Success operations
- `❌` — Errors/failures
- `📂` — File operations (upload, delete)
- `💾` — Database operations (save, update)
- `📡` — API calls/network requests
- `🔍` — Debug/inspection logs

**Example**:

```ts
console.log("📂 Uploading image to R2:", key);
console.log("✅ Defect created successfully:", defectId);
console.error("❌ MongoDB connection failed:", error);
```

### Form State Management

- **Controlled components**: Always use `value` + `onChange` for inputs
- **Debounced updates**: Use `setTimeout` with cleanup for auto-save (1000ms standard)
- **Local input state**: Separate `useState` for inputs that update on every keystroke (prevents cursor jumping)

**Example** (from `InformationSections.tsx`):

```ts
// Local state for location input to prevent cursor jump
const [locationInputs, setLocationInputs] = useState<Record<string, string>>(
  {}
);

<input
  value={locationInputs[image.url] ?? image.location ?? ""}
  onChange={(e) => {
    setLocationInputs((prev) => ({ ...prev, [image.url]: e.target.value }));
    debouncedSaveLocation(image.url, e.target.value);
  }}
/>;
```

### Error Boundaries

- No global error boundary implemented yet
- API routes handle errors individually with try/catch
- Client errors logged to console (consider adding error tracking service like Sentry)

### Performance Optimizations

- **Lazy loading**: Use `dynamic()` for heavy components (`InformationSections`)
- **Image optimization**: Next.js `<Image>` not used (R2 URLs are already optimized)
- **Memo usage**: Minimal — prefer React's default reconciliation
- **Virtualization**: Not implemented (inspection lists typically <100 items)

## Deployment Considerations

### Vercel Deployment (Recommended)

**Node.js Runtime**: Requires Node.js 22 runtime (specified in `package.json` engines)

**Environment Variables**: Set all vars from `.env.local` in Vercel dashboard

**Chromium Pack**: Add env var for serverless PDF generation:

```bash
CHROMIUM_PACK_URL=https://github.com/Sparticuz/chromium/releases/download/v138.0.0/chromium-v138.0.0-pack.tar
```

**Function Timeout**: Increase timeout for `/api/reports/generate` route to 60s (already set with `export const maxDuration = 60`)

**MongoDB IP Whitelist**: Add `0.0.0.0/0` (all IPs) in MongoDB Atlas for Vercel's dynamic IPs

### Build Process

```bash
npm run build  # Creates production build in .next/
npm run start  # Runs production server
```

**Build Warnings to Ignore:**

- HEIC libheif-js critical dependency warning (suppressed in config)
- Puppeteer externalization warnings (intentional for serverless compatibility)

### Database Migrations

**No ORM/migration system** — MongoDB is schemaless. To add new fields:

1. Update TypeScript interfaces in component files
2. Update API routes to accept new fields
3. Existing documents continue to work (missing fields default to `undefined`)

**Example**: Adding `priority` field to defects:

```ts
// 1. Update interface in DefectEditModal.tsx
interface Defect {
  // ... existing fields
  priority?: "high" | "medium" | "low";
}

// 2. Update API route to accept it
const defectData = {
  ...body,
  priority: body.priority ?? "medium",
};

// 3. Old defects still work (priority will be undefined)
```

### Database Management Scripts (scripts_yedek/scripts/)

**Purpose**: Node.js scripts for MongoDB maintenance and data migration between environments

**Key Scripts**:

- **`export-local-database.js`**: Exports entire local MongoDB to JSON files
- **`seed-production.js` / `seed-vercel-production.js`**: Seeds production database with template data
- **`copy-local-to-production.js`**: Syncs local data to production (use with caution)
- **`smart-copy-to-production.js`**: Intelligent sync that preserves production-only data
- **`fix-section-ids.js`**: Repairs malformed section IDs in database
- **`clean-production-comments.js`**: Removes debug comments from production data
- **`verify-production-fix.js`**: Validates data integrity after migrations

**Usage Pattern**:

```bash
cd scripts_yedek/scripts
node export-local-database.js  # Creates local-database-export.json
node seed-production.js  # Populates production with templates
```

**⚠️ CAUTION**: Scripts modify production databases directly. Always backup first and test queries in `test-production-api.js` before destructive operations.

## Quick Reference

### Key Files for Common Tasks

**Add new API endpoint**: `src/app/api/[your-route]/route.ts`  
**Modify defect analysis prompt**: `src/app/api/llm/analyze-image/route.ts` (line ~80)  
**Change PDF layout**: `public/report-template/index.html` + `lib/pdfTemplate.ts`  
**Add canvas drawing tool**: `components/ImageEditor.tsx` (search for "arrow" or "circle" examples)  
**Modify checklist templates**: Update MongoDB `sections` collection directly  
**Change inspection table columns**: `components/InspectionsTable.tsx`

### Important Line References

- **`pendingAnnotation` save**: `src/app/image-editor/page.tsx` line ~396
- **`pendingAnnotation` polling**: `components/DefectEditModal.tsx` lines 81-122
- **`pendingAnnotation` processing**: `components/InformationSections.tsx` line ~252
- **Auto-save defect edits**: `components/DefectEditModal.tsx` lines 281-335
- **Puppeteer Chrome paths**: `src/app/api/reports/generate/route.ts` lines 40-85
- **Canvas redraw logic**: `components/ImageEditor.tsx` (search `redrawCanvas`)

### Testing Checklist

- [ ] Create inspection → verify MongoDB `inspections` collection
- [ ] Upload image in editor → verify R2 bucket has file
- [ ] Submit defect → check OpenAI API call logs + MongoDB `defects`
- [ ] Add checklist image → verify `pendingAnnotation` flow works
- [ ] Generate PDF → verify Puppeteer finds Chrome executable
- [ ] Test auto-save → edit defect field, wait 1s, reload page (should persist)
- [ ] Test HEIC upload → upload iPhone photo, verify conversion to JPEG
- [ ] Test voice input → click microphone, speak, verify transcript appears
- [ ] Test DOCX export → generate report, verify Word document downloads
- [ ] Test defect numbering → create multiple defects in different sections, verify sequential numbering (e.g., 3.1.2)

### External Dependencies

**MongoDB Atlas**: Database (free tier sufficient for <100 inspections)  
**Cloudflare R2**: Object storage (~$0.015/GB, much cheaper than S3)  
**OpenAI API**: GPT-4 Vision for defect analysis (~$0.01-0.03 per image)  
**Vercel**: Hosting (free tier covers most use cases)  
**Upstash QStash** (optional): Async job queue for slow AI requests

### Key Libraries & Their Purposes

- **Puppeteer + Chromium**: Headless browser for PDF generation from HTML templates
- **heic-convert/heic2any**: Convert iOS HEIC images to JPEG for browser compatibility
- **Zustand**: Lightweight state management with localStorage persistence
- **@aws-sdk/client-s3**: S3-compatible SDK for Cloudflare R2 uploads
- **exifr**: Extract EXIF metadata from images (orientation, GPS, etc.)
- **html2canvas**: Fallback for client-side canvas-to-image conversion
- **docx/docxtemplater**: Generate Word documents from templates (experimental)

---

**Last Updated**: 2025-10-10 | **Project Version**: 0.1.0 | **Next.js**: 13.4.19
