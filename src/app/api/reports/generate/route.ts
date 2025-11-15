import { NextRequest } from "next/server";
import { generateInspectionReportHTML, type DefectItem, type ReportMeta } from "../../../../../lib/pdfTemplate";
import { extractR2KeyFromUrl, getR2ObjectAsDataURI, resolveR2KeyFromUrl } from "../../../../../lib/r2";
import { uploadReportToR2 } from "../../../../../lib/r2";
import { updateInspection } from "../../../../../lib/inspection";

export const runtime = "nodejs"; // ensure Node runtime for puppeteer
export const dynamic = "force-dynamic"; // avoid caching
export const maxDuration = 60; // allow enough time on Vercel

type Payload = {
  defects: DefectItem[];
  meta?: ReportMeta;
  inspectionId?: string; // Add inspection ID to payload
  reportMode?: 'full' | 'summary'; // Add report mode
};

// Hoisted helper to inline R2-hosted images as data URIs
async function maybeInline(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('data:')) return url; // already inlined
  const key = extractR2KeyFromUrl(url) || resolveR2KeyFromUrl(url) || undefined;
  if (!key) return url;
  // Only inline images; skip videos to keep PDF size controlled
  if (!/(\.(png|jpe?g|gif|webp|svg))(\?.*)?$/i.test(key)) return url;
  try {
    return await getR2ObjectAsDataURI(key);
  } catch {
    return url;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { defects, meta, inspectionId, reportMode = 'full' } = (await req.json()) as Payload;

    if (!Array.isArray(defects) || defects.length === 0) {
      return new Response(JSON.stringify({ error: "defects array is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Pre-process image URLs in defects and information blocks to inline data URIs when they point to R2

    const enrichedDefects: DefectItem[] = await Promise.all(
      defects.map(async (d) => ({
        ...d,
        image: await maybeInline(d.image),
      }))
    );

    const enrichedMeta: ReportMeta | undefined = meta
      ? {
          ...meta,
          headerImageUrl: await maybeInline(meta.headerImageUrl),
          informationBlocks: await (async () => {
            const blocks = meta.informationBlocks || [];
            return Promise.all(
              blocks.map(async (b) => ({
                ...b,
                images: await Promise.all(
                  (b.images || []).map(async (img) => ({
                    ...img,
                    url: await maybeInline(img.url) || img.url,
                  }))
                ),
              }))
            );
          })(),
        }
      : undefined;

    const html = generateInspectionReportHTML(enrichedDefects, enrichedMeta);

    // Launch headless browser using puppeteer-core + @sparticuz/chromium (serverless-compatible)
    // Prefer chromium-min with remote pack in serverless to avoid lib dependencies
    let chromium;
    try {
      chromium = (await import("@sparticuz/chromium-min")).default;
    } catch (error) {
      // Fallback to full package if min isn't installed
      chromium = (await import("@sparticuz/chromium")).default;
    }
    const puppeteer = (await import("puppeteer-core")).default;

  const isServerless = !!process.env.AWS_REGION || !!process.env.VERCEL;

    // Resolve executable path differently for serverless vs local
    let executablePath: string | undefined = undefined;
    if (isServerless) {
      const packUrl = process.env.CHROMIUM_PACK_URL;
      executablePath = (await (chromium as any).executablePath(packUrl)) || undefined;
    } else {
      // For local dev, prefer env variable or common install paths
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || undefined;
    }

    // Validate existence and try known OS-specific fallbacks when local
    const { existsSync } = await import("fs");
    const pathExists = (p?: string) => (p ? existsSync(p) : false);
    if (!isServerless) {
      const isWin = process.platform === "win32";
      const isMac = process.platform === "darwin";
      const candidates: string[] = [];
      if (isWin) {
        candidates.push(
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          `${process.env.LOCALAPPDATA?.replace(/\\$/,'')}\\Google\\Chrome\\Application\\chrome.exe`
        );
      } else if (isMac) {
        candidates.push(
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium"
        );
      } else {
        candidates.push(
          "/usr/bin/google-chrome",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser"
        );
      }

      // If the provided path doesn't exist, try candidates
      if (!pathExists(executablePath)) {
        executablePath = candidates.find((p) => pathExists(p));
      }

      // Final guard with guidance for developers
      if (!executablePath) {
        throw new Error(
          "Chrome executable not found on this machine. Set PUPPETEER_EXECUTABLE_PATH to your Chrome/Chromium binary or install Chrome."
        );
      }
    }

    // On serverless providers (e.g., Vercel/AWS), prefer the special "shell" headless mode
    const headlessType: any = isServerless ? "shell" : (chromium.headless ?? true);

    // Optional: disable WebGL/graphics to avoid additional lib requirements in serverless
    if (isServerless) {
      // @ts-ignore - type shim may not include this property
      (chromium as any).setGraphicsMode = false;
    }

    const browser = await puppeteer.launch({
      // Merge puppeteer's default args with chromium's recommended serverless args
      // For local: keep sandbox flags minimal; for serverless: rely on chromium.args
      args: isServerless
        ? (puppeteer as any).defaultArgs({ args: chromium.args, headless: headlessType })
        : ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: headlessType,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Ensure images are loaded
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve(true);
          return new Promise((resolve) => {
            img.addEventListener("load", () => resolve(true));
            img.addEventListener("error", () => resolve(true));
          });
        })
      );
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "10mm", bottom: "12mm", left: "10mm" },
    });

    await browser.close();

    const filename = (meta?.title || "inspection-report").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf";

    // Upload to R2 and return only the proxy URL (NOT the PDF file itself)
    // This prevents "Fast Origin Transfer" quota consumption on Vercel
    if (inspectionId) {
      try {
        console.log(`📤 Uploading PDF to R2 for inspection ${inspectionId}...`);
        const { url: publicUrl, key } = await uploadReportToR2(Buffer.from(pdfBuffer), inspectionId, 'pdf', reportMode);
        
        // Build a proxy URL hosted under our own domain (absolute using request origin)
        const origin = new URL(req.url).origin;
        const downloadUrl = `${origin}/api/reports/file?key=${encodeURIComponent(key)}`;
        
        // Save the permanent URL to MongoDB
        await updateInspection(inspectionId, {
          pdfReportUrl: downloadUrl,
          pdfReportGeneratedAt: new Date()
        });
        
        console.log(`✅ PDF uploaded to R2. Proxy URL: ${downloadUrl}`);
        
        // Return JSON response with download URL instead of the PDF itself
        return new Response(JSON.stringify({ 
          success: true,
          downloadUrl,
          filename,
          message: 'PDF generated and uploaded successfully'
        }), {
          status: 200,
          headers: { 
            "content-type": "application/json",
            "cache-control": "no-store"
          },
        });
      } catch (uploadError) {
        console.error('⚠️ Failed to upload PDF to R2:', uploadError);
        return new Response(JSON.stringify({ 
          error: 'Failed to upload PDF to storage',
          details: uploadError instanceof Error ? uploadError.message : String(uploadError)
        }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // If no inspectionId provided, return error (we always need R2 upload)
    return new Response(JSON.stringify({ 
      error: "inspectionId is required for PDF generation" 
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("PDF generation error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Failed to generate PDF" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
