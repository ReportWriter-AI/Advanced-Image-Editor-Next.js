# Copilot Instructions
## Architecture
- Next.js 13 App Router with TypeScript; routing lives under `src/app`, UI primitives in `components`, cross-cutting helpers in `lib`.
- Client-heavy editors such as `components/ImageEditor.tsx` and `components/InformationSections.tsx` manage hundreds of lines of local state; prefer targeted edits and keep derived state in sync with their custom events/localStorage usage.
- State persistence uses `lib/store.ts` (Zustand + persist) for analysis context; reuse this store when moving data between pages instead of new context logic.
- PDF/HTML output flows rely on `lib/pdfTemplate.ts` and `components/PermanentReportLinks.tsx`; keep numbering logic in `generateInspectionReportHTML` when adding new display fields.
## Data & Integrations
- Mongo access goes through `lib/inspection.ts`, `lib/defect.ts`, etc.; these assume `MONGODB_URI` and a fixed `agi_inspections_db`, so do not call the driver directly from pages.
- Cloudflare R2 uploads use `lib/r2.ts`; always call `uploadToR2`/`uploadReportToR2` so cleanup helpers (`extractR2KeyFromUrl`, `resolveR2KeyFromUrl`) keep working with DELETE cascades.
- Async AI analysis queues are published in `src/app/api/llm/analyze-image/route.ts` and fulfilled by `src/app/api/process-analysis/route.ts` via Upstash QStash; preserve the signature verification wrapper when touching `POST`.
- Report generation (`src/app/api/reports/generate/route.ts`) inlines R2 images via `maybeInline`; mirror that helper if new endpoints must embed assets.
## Frontend Patterns
- Image editing features fire DOM CustomEvents (`undoAction`, `rotateImage`, etc.); new toolbar actions should dispatch events rather than reaching into `ImageEditor` internals.
- `components/InformationSections.tsx` keeps inspection-specific checklist mutations in localStorage (`inspection_checklists_*` keys) and syncs with `/api/information-sections`; reuse `hideChecklistForInspection`/`unhideChecklistForInspection` when mutating items.
- Remote media almost always proxied with `/api/proxy-image`; follow the `getProxiedSrc` helper pattern in `InformationSections.tsx` and `inspection_report/[id]/page.tsx` for new viewers.
- ThreeSixty assets load through `components/ThreeSixtyViewer.tsx` (dynamic import, Photo Sphere Viewer); ensure 360 uploads set `isThreeSixty` so downstream renderers switch viewers.
## Workflows & Env
- Install with `npm install`; primary commands: `npm run dev`, `npm run build`, `npm run lint`, plus `npm run test:360` or `npm run test:360:full` (requires local `tests/*.js` fixtures for 360 validation).
- For Puppeteer, local dev needs `PUPPETEER_EXECUTABLE_PATH` (or Chrome installed); serverless deployments require `CHROMIUM_PACK_URL`, `AWS_REGION`/`VERCEL`, and Next runtime set to Node (`export const runtime = "nodejs"`).
- Required secrets: `MONGODB_URI`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_*`, `CLOUDFLARE_PUBLIC_URL`, `ENABLE_R2_CASCADE_CLEANUP`, `OPENAI_API_KEY`, `OPENAI_ASSISTANT_ID`, `QSTASH_TOKEN`, `NEXT_PUBLIC_BASE_URL`.
- Wrangler config (`wrangler.toml`) sets up Cloudflare KV; mirror bindings there if new Workers are introduced.
## Debug Tips
- API routes are marked `dynamic = "force-dynamic"` when they depend on live data; match that to avoid stale caches on Vercel.
- If uploads fail, enable logging in `lib/r2.ts` and check that public URLs follow the configured base so `extractR2KeyFromUrl` can clean up.
- Report viewer numbering depends on `startingNumber` state in `inspection_report/[id]/page.tsx`; update both the React state and `generateInspectionReportHTML` when changing numbering schemes.
