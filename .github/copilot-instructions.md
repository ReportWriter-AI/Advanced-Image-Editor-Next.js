## Copilot Instructions – Advanced Image Editor / Inspection Reports

Big picture

- Next.js App Router (Next 13.4.19) with React 18 + TypeScript. UI lives in `components/*` and `src/app/*`; server code is `src/app/api/**/route.ts`.
- Data: MongoDB via `lib/mongodb.ts` with helpers in `lib/inspection.ts` and `lib/defect.ts`. Binary assets (images, HTML, PDF) in Cloudflare R2 via `lib/r2.ts`.
- Principle: do not stream large files from APIs. Generate, upload to R2, then return a small JSON that includes a proxied URL (`/api/reports/file?key=...` or `/api/proxy-image?url=...`).

Key codepaths

- Report builder page: `src/app/inspection_report/[id]/page.tsx`. Information Sections UI: `components/InformationSections.tsx`. Image editor: `components/ImageEditor.tsx` and `src/app/image-editor/page.tsx`.
- Exports: HTML → `src/app/api/reports/upload-html/route.ts`; PDF → `src/app/api/reports/generate/route.ts` (Puppeteer-core + `@sparticuz/chromium(-min)`).
- AI analysis (backgrounded): `src/app/api/llm/analyze-image/route.ts` enqueues a job via Upstash QStash → `src/app/api/process-analysis/route.ts` (OpenAI Assistants Vision, secured with `verifySignatureAppRouter`).
- R2 helpers in `lib/r2.ts`: `uploadToR2`, `uploadReportToR2`, `getR2ObjectAsDataURI`, `getR2Object`, `copyInR2`, `extractR2KeyFromUrl`, `resolveR2KeyFromUrl`, and `generatePresignedUploadUrl`.

API route conventions

```ts
export const runtime = "nodejs";      // needed for Puppeteer, R2 SDK, Mongo
export const dynamic = "force-dynamic"; // disable caching for APIs
export const maxDuration = 60;          // heavy routes (PDF, uploads)
```

Storage and proxying

- R2 key layout: `inspections/<id>/...` (captured media), `reports/inspection-<id>/...` (export artifacts).
- File access via proxies: `/api/reports/file?key=<r2-key>` (redirects to `CLOUDFLARE_PUBLIC_URL` when set, else streams) and `/api/proxy-image?url=<url>` for resilient image loading.

Report flows (essentials)

- HTML export: rewrite/inline `<img|source|srcset|background-image>`; copy non-inlined assets to `reports/*`; upload to R2 via `uploadReportToR2`; persist `htmlReportUrl`.
- PDF export: inline eligible R2 images with `getR2ObjectAsDataURI`; render using Puppeteer-core + serverless Chromium; upload via `uploadReportToR2`; persist `pdfReportUrl`.

Data and costs

- Defects persisted with computed `base_cost = materials_total_cost + labor_rate * hours_required`.
- Pricing realism is driven by the Assistant’s system instructions; optional hard caps can be applied in code if needed.

Dev workflow and versions

- Scripts: `npm run dev | build | start | lint` (+ optional `test:360`, `test:360:full`). Node `22.x` (see `engines`), Next `13.4.19` (see `package.json`).
- Local PDF: set `PUPPETEER_EXECUTABLE_PATH` (or `CHROME_PATH`) if Chrome isn’t auto-detected. Serverless uses `@sparticuz/chromium(-min)`; `runtime = "nodejs"` is required.
- Queueing: set `QSTASH_TOKEN` and `NEXT_PUBLIC_BASE_URL` for the `/api/llm/analyze-image` → `/api/process-analysis` flow.

Styling and conventions

- Tailwind + CSS modules + inline styles. Client components require "use client". Use `dynamic(() => import(...), { ssr: false })` for browser-only widgets (see `ThreeSixtyViewer`).

Start here

- UI behavior: `components/InformationSections.tsx`.
- Exports and storage: `lib/r2.ts`, `src/app/api/reports/*`.
- AI flow: `src/app/api/llm/analyze-image/route.ts` and `src/app/api/process-analysis/route.ts`.
- End-to-end overview: `docs/Project-Guide.md` and root `README.md`.
