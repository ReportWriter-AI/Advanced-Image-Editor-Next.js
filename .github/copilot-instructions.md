## Copilot Instructions – Advanced Image Editor / Inspection Reports

Big picture

- Next.js 13 App Router (React 18 + TS). UI lives in `components/*` and `src/app/*` pages; server code is `src/app/api/**/route.ts`.
- Data: MongoDB (via `lib/mongodb.ts` + helpers in `lib/inspection.ts`, `lib/defect.ts`). Media and reports in Cloudflare R2 via `lib/r2.ts`.
- Principle: never stream large files from APIs. Generate, upload to R2, then return a small JSON with a proxied URL (`/api/reports/file?key=...`).

Key codepaths

- Report builder: `src/app/inspection_report/[id]/page.tsx`. Info checklists UI: `components/InformationSections.tsx`.
- Exports: HTML `src/app/api/reports/upload-html/route.ts`; PDF `src/app/api/reports/generate/route.ts` (Puppeteer).
- R2 helpers: `uploadToR2`, `uploadReportToR2`, `getR2ObjectAsDataURI`, `copyInR2`, `extractR2KeyFromUrl`, `resolveR2KeyFromUrl` in `lib/r2.ts`.
- AI analysis: `src/app/api/process-analysis/route.ts` (OpenAI Assistants Vision). Secured with Upstash QStash signature wrapper.

API route conventions

```ts
export const runtime = "nodejs"; // needed for Puppeteer, R2 SDK, Mongo
export const dynamic = "force-dynamic"; // disable caching for APIs
export const maxDuration = 60; // heavy routes (PDF, uploads)
```

Storage layout (R2 keys)

- `inspections/<id>/...` for captured media; `reports/inspection-<id>/...` for HTML/PDF and copied assets.
- Access via app proxies: `/api/reports/file?key=<r2-key>` and `/api/proxy-image?url=<url>`.

Report flows (essentials)

- HTML: rewrite/inline `<img|source|srcset|background-image>`; copy non-inlined to `reports/*`; upload to R2; save `htmlReportUrl`.
- PDF: inline eligible R2 images with `getR2ObjectAsDataURI`; render with Puppeteer-core + `@sparticuz/chromium(-min)`; upload; save `pdfReportUrl`.

Data and costs

- Defects persisted with computed `base_cost = materials_total_cost + labor_rate * hours_required`.
- Tune price realism in the Assistant’s system instructions; optionally cap values in code.

Dev workflow and versions

- Scripts: `npm run dev | build | start | lint` (+ optional `test:360`, `test:360:full`).
- Target Node 22.x (see `engines`), Next.js 13.4.19 (see `package.json`). Set `PUPPETEER_EXECUTABLE_PATH` locally if Chrome isn’t auto-detected.

Styling and conventions

- Tailwind + some CSS modules + inline styles. Client components require "use client". Use `dynamic(() => import(...), { ssr: false })` for browser-only widgets.

Start here

- UI behavior: `components/InformationSections.tsx`.
- Exports and storage: `lib/r2.ts`, `src/app/api/reports/*`.
- End-to-end overview: `docs/Project-Guide.md` and root `README.md`.
