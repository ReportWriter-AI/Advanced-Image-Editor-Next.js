## Copilot guide for this repo (concise and specific)

What this is

- Next.js 13.4 App Router app for property inspections: image editing, AI defect analysis, and PDF/HTML report generation.
- Tech: TypeScript, MongoDB, Cloudflare R2 (S3-compatible), OpenAI Assistants, Upstash QStash, puppeteer-core + @sparticuz/chromium-min, Zustand, Tailwind.

Run locally

- Node 22.x. Install: npm install. Dev: npm run dev. Build: npm run build. Lint: npm run lint.
- PDF routes use Chromium. On Windows set PUPPETEER_EXECUTABLE_PATH (e.g., C:\Program Files\Google\Chrome\Application\chrome.exe). In serverless, set CHROMIUM_PACK_URL.

Architecture (where things live)

- UI: components/ (e.g., ImageEditor.tsx, InformationSections.tsx). App routes: src/app/**/route.ts. Domain logic: lib/*.ts. Types/models: types/*, models/*.
- MongoDB: lib/mongodb.ts caches a global client; DB is "agi_inspections_db". lib/inspection.ts and lib/defect.ts handle ObjectId storage and updates.
- Cloudflare R2: lib/r2.ts wraps S3Client. Public base URL via CLOUDFLARE_PUBLIC_URL. Key spaces: uploads/*, inspections/{inspectionId}/*, reports/inspection-{id}/*.

Media rules (critical)

- Always render remote media via the hardened proxy: /api/proxy-image?url=... It normalizes TLS/ports and falls back to R2 SDK GetObject. Example: const src = url?.startsWith('data:') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`.
- Uploads: prefer presigned browser uploads via GET /api/r2api?action=presigned&fileName=...&contentType=... then PUT; the app should send only the resulting public URL to APIs.
- Server upload endpoint /api/r2api (POST) accepts images and videos up to 200MB and converts HEIC/HEIF to JPEG.

AI analysis (async pipeline)

- POST /api/llm/analyze-image accepts JSON or multipart; uploads media to R2; enqueues QStash to call /api/process-analysis.
- /api/process-analysis is wrapped with verifySignatureAppRouter; runs an OpenAI Assistant; persists a defect via lib/defect.createDefect.

Reports (PDF/HTML)

- POST /api/reports/generate builds HTML with lib/pdfTemplate.generateInspectionReportHTML, inlines R2 images via getR2ObjectAsDataURI, renders with puppeteer-core, uploads to R2 via lib/r2.uploadReportToR2, and returns a PDF. The permanent link is proxied through /api/reports/file?key=... (also returned in x-permanent-url header when saved).
- POST /api/reports/upload-html rewrites <img>/<source>/srcset/background-image URLs to data URIs when possible, or copies assets into reports/* via copyInR2, then saves and proxies via /api/reports/file.
- Numbering and costs: pdfTemplate computes display_number as Section.Subsection.Defect; total cost is base_cost multiplied by (1 + additional_images.length). Maintain base_cost when adding photos.

Image editor contract

- src/app/image-editor/page.tsx dispatches DOM CustomEvents: undoAction, redoAction, rotateImage, applyCrop, setArrowColor (plus circle/square). components/ImageEditor.tsx listens and records actions in actionHistory; use renderMetricsRef.current.{offsetX,offsetY,drawWidth,drawHeight} for coordinate transforms.

Information sections (persistence)

- components/InformationSections.tsx persists per-inspection UI state to localStorage with keys: inspection_checklists_${inspectionId}, inspection_hidden_checklists_${inspectionId}, pendingAnnotation, returnToSection. Reordering templates uses reorder mode stored in-memory.

Conventions and gotchas

- Heavy routes (puppeteer, AWS SDK) must export: export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; optionally export const maxDuration.
- next.config.mjs externalizes puppeteer-core/@sparticuz/* and exifr for server; client chunkLoadTimeout is increased to reduce ChunkLoadError; InformationSections is split into its own chunk.
- R2 helpers: use extractR2KeyFromUrl/resolveR2KeyFromUrl to derive keys; use getR2ObjectAsDataURI for inlining; use copyInR2 for server-side copies.
- 360° photos: components/ThreeSixtyViewer.tsx is dynamically loaded (SSR off) and always feeds images through /api/proxy-image.

Environment (min set)

- MONGODB_URI, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_PUBLIC_URL, OPENAI_API_KEY, OPENAI_ASSISTANT_ID, QSTASH_TOKEN, NEXT_PUBLIC_BASE_URL.

Quick jump points

- lib/r2.ts (R2 helpers), lib/pdfTemplate.ts (report HTML), src/app/api/proxy-image/route.ts (robust proxy), src/app/api/llm/analyze-image/route.ts and src/app/api/process-analysis/route.ts (AI flow), src/app/api/reports/* (report generation/storage).
