# Copilot Instructions for AGI Property Inspections Platform

## Project Overview

A Next.js 13 property inspection platform with AI-powered defect analysis, rich image editing, and PDF report generation. Built for field inspectors to capture defects, annotate images, and generate professional reports.

## Architecture

### Core Structure
- **Next.js 13 App Router** with TypeScript; routes in `src/app`, reusable UI in `components`, business logic in `lib`
- **Database**: MongoDB via `lib/mongodb.ts` to fixed `agi_inspections_db` database
- **Storage**: Cloudflare R2 (S3-compatible) for images/videos/reports via `lib/r2.ts`
- **AI**: OpenAI + Upstash QStash for async defect analysis
- **PDF**: Puppeteer + `@sparticuz/chromium` for server-side rendering

### Key Components
- `components/ImageEditor.tsx` (2800+ lines): Canvas-based editor with draw/arrow/crop/rotate tools, manages complex undo/redo history
- `components/InformationSections.tsx` (4000+ lines): Inspection checklist manager with localStorage persistence, drag-and-drop reordering
- `components/ThreeSixtyViewer.tsx`: Photo Sphere Viewer integration for 360° photos (dynamic import)
- `lib/pdfTemplate.ts`: HTML template generator for inspection reports with color-coded defects

## Critical Patterns

### Event-Driven Image Editor
`ImageEditor` uses **DOM CustomEvents** for toolbar actions to avoid prop drilling:
```typescript
// Dispatch from toolbar buttons:
window.dispatchEvent(new CustomEvent('undoAction'));
window.dispatchEvent(new CustomEvent('rotateImage'));
window.dispatchEvent(new CustomEvent('applyCrop'));

// Listen inside ImageEditor:
window.addEventListener('undoAction', handleUndoAction);
```
**When adding toolbar features**: Dispatch custom events, don't reach into ImageEditor internals.

### localStorage Inspection State
`InformationSections.tsx` persists inspection-specific data in browser storage:
- `inspection_checklists_{sectionId}_{inspectionId}`: Custom checklist items per inspection
- `hidden_checklists_{inspectionId}`: Template items hidden for this inspection
- `pendingAnnotation`: Image annotation waiting to be attached to checklist
- `returnToSection`: Navigate back to correct section after image editing

**When mutating checklists**: Sync both component state and localStorage with same keys.

### R2 Media Proxying
All remote media goes through `/api/proxy-image?url=` to handle CORS and normalize R2 URLs:
```typescript
const getProxiedSrc = (url?: string) => {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};
```
**When displaying external images**: Always proxy through this endpoint (see `InformationSections.tsx` line 130).

**R2 Eventual Consistency**: The proxy includes retry logic with exponential backoff (500ms, 1s, 2s) to handle R2's eventual consistency after uploads. Files may not be immediately available after `uploadToR2` returns.

### R2 URL Cleanup
`lib/r2.ts` provides helpers to extract R2 keys from various URL formats:
- `extractR2KeyFromUrl(url)`: Parse public R2 URLs to get object key
- `resolveR2KeyFromUrl(url)`: Fallback key resolution for non-standard hosts
- `uploadToR2(buffer, key, contentType)`: Returns public URL at `${CLOUDFLARE_PUBLIC_URL}/${key}`

**When deleting resources**: Always extract key from URL before calling `DeleteObjectCommand`.

### Async AI Analysis Queue
Image analysis is two-phase via Upstash QStash:
1. `POST /api/llm/analyze-image`: Uploads image to R2, publishes job to QStash → `/api/process-analysis`
2. `POST /api/process-analysis`: Worker endpoint (signature-verified) runs OpenAI analysis, creates defect record

**When modifying analysis**: Preserve `verifySignatureAppRouter` wrapper in process endpoint.

## Data Flow Patterns

### Inspection Lifecycle
1. Create inspection → `POST /api/inspections` → MongoDB `inspections` collection
2. Add defects → `POST /api/llm/analyze-image` → QStash queue → `POST /api/process-analysis` → MongoDB `defects` collection
3. Add information sections → `POST /api/information-sections/{inspectionId}` → MongoDB `inspection_information_blocks` collection
4. Generate report → `POST /api/reports/generate` → Puppeteer renders HTML → R2 PDF storage → Update inspection with `pdfReportUrl`

### Image Upload Flow
```
File/Camera → ImageEditor (canvas annotations) → 
  Base64 data URI → Zustand store (lib/store.ts) →
  FormData POST → /api/llm/analyze-image →
  decodeBase64Image → uploadToR2 → 
  Final R2 URL stored in defect/block
```

### Report Generation
`lib/pdfTemplate.ts` generates HTML with:
- Inline CSS (no external stylesheets)
- Data URIs for images (via `maybeInline` in `api/reports/generate/route.ts`)
- Color-coded defect sections (red/orange/blue/purple classification)
- Dynamic numbering (`display_number` like "3.1.2")

**When changing report layout**: Update `generateInspectionReportHTML` and test PDF output, not just browser HTML.

## Environment & Deployment

### Required Environment Variables
```bash
# MongoDB
MONGODB_URI=mongodb+srv://...

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_R2_BUCKET=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_PUBLIC_URL=https://pub-xxxxx.r2.dev

# AI
OPENAI_API_KEY=sk-...
OPENAI_ASSISTANT_ID=asst_...
QSTASH_TOKEN=...  # Upstash QStash for async workers

# Deployment
NEXT_PUBLIC_BASE_URL=https://yourdomain.com  # For QStash callbacks
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome  # Local dev only
CHROMIUM_PACK_URL=...  # Serverless chromium binary URL
```

### Development Commands
```bash
npm install              # Install dependencies
npm run dev             # Start dev server (localhost:3000)
npm run build           # Production build
npm run lint            # ESLint check
npm run test:360        # Quick 360° photo test
npm run test:360:full   # Full E2E 360° test
```

### Puppeteer Setup
- **Local dev**: Set `PUPPETEER_EXECUTABLE_PATH` or install Chrome
- **Vercel/serverless**: Requires `@sparticuz/chromium-min` with remote binary via `CHROMIUM_PACK_URL`
- **API routes using Puppeteer**: Must set `export const runtime = "nodejs"` (see `api/reports/generate/route.ts`)

### Webpack Externals
`next.config.mjs` externalizes:
- `puppeteer-core`, `@sparticuz/chromium*` (prevent SWC parse errors)
- `exifr` (avoid UMD dynamic require warnings)

## Common Tasks

### Adding a New Image Annotation Tool
1. Add toolbar button in parent component (e.g., `image-editor/page.tsx`)
2. Dispatch CustomEvent: `window.dispatchEvent(new CustomEvent('yourAction'))`
3. Add listener in `ImageEditor.tsx` `useEffect` hooks (around line 350)
4. Implement handler, update `actionHistory` for undo/redo

### Adding a New Checklist Field Type
1. Update `ISectionChecklist` interface in `InformationSections.tsx`
2. Add UI in modal (status/limitations tabs around line 2500)
3. Handle in `saveInformationBlock` (line 1100)
4. Update backend schema in `models/SectionChecklist.ts`
5. Migrate existing records if needed

### Modifying PDF Report Layout
1. Edit HTML template in `lib/pdfTemplate.ts` → `generateInspectionReportHTML`
2. Inline all CSS (Puppeteer doesn't load external stylesheets reliably)
3. Test with `POST /api/reports/generate` endpoint
4. Verify data URI inlining for images (check `maybeInline` helper)

### Adding Support for New Media Type
1. Update `FileUpload.tsx` accept attribute
2. Add MIME type handling in `api/llm/analyze-image/route.ts`
3. Update proxy logic in `api/proxy-image/route.ts` if special headers needed
4. Add viewer component if not standard `<img>` (see `ThreeSixtyViewer.tsx` pattern)

## Debugging

### Common Issues
- **PDF images missing**: Check R2 URLs are being inlined via `maybeInline` (data URI embedding required)
- **Stale API responses**: Add `export const dynamic = "force-dynamic"` to route (16 routes currently use this)
- **localStorage sync issues**: Check key format matches `inspection_checklists_{sectionId}_{inspectionId}` pattern
- **QStash job failures**: Verify `NEXT_PUBLIC_BASE_URL` is publicly accessible and signature verification passes
- **Puppeteer crashes**: Ensure Node runtime (`export const runtime = "nodejs"`), check memory limits, verify Chrome binary path
- **R2 images fail to load immediately after upload**: This is R2's eventual consistency. The proxy has retry logic (3 attempts with exponential backoff), but you may see `ECONNRESET` or `404` errors in logs before it succeeds. Images typically become available within 1-3 seconds.

### Debug Helpers
- Enable R2 logging: Add console logs in `lib/r2.ts` upload/download methods
- Trace analysis queue: Check QStash dashboard for job status
- Inspect localStorage: DevTools → Application → Local Storage → look for `inspection_*` keys
- Test PDF generation locally: `curl -X POST http://localhost:3000/api/reports/generate -H "Content-Type: application/json" -d @test-payload.json`

## Architecture Decisions

### Why CustomEvents for ImageEditor?
Avoids re-rendering 2800-line component on every toolbar state change. Events decouple toolbar UI from canvas logic.

### Why localStorage for Checklists?
Template items live in MongoDB, but inspection-specific overrides (hidden items, custom answers) are session-scoped and don't warrant DB persistence.

### Why Proxy Images?
Cloudflare R2 URLs can change (virtual-hosted vs path-style), and external sources have CORS restrictions. Proxying normalizes all sources.

### Why Async Analysis Queue?
OpenAI API calls take 5-15 seconds. QStash enables fire-and-forget requests, avoids Vercel function timeouts, and handles retries.
