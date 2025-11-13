import { NextRequest, NextResponse } from "next/server";
import { uploadReportToR2, extractR2KeyFromUrl, copyInR2, getR2ObjectAsDataURI } from "../../../../../lib/r2";
import { updateInspection } from "../../../../../lib/inspection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { htmlContent, inspectionId, reportMode = 'full' } = await req.json();

    if (!htmlContent || !inspectionId) {
      return NextResponse.json(
        { error: "HTML content and inspection ID are required" },
        { status: 400 }
      );
    }

    console.log(`📤 Preparing HTML for R2 (inspection ${inspectionId})...`);

  // Step 1: rewrite image sources pointing at uploads/* or inspections/* into reports/* and copy files in R2
  const publicBase = process.env.CLOUDFLARE_PUBLIC_URL?.replace(/\/$/, '') || '';
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET || '';
    const destPrefix = `reports/inspection-${inspectionId}/images`;

  // Pragmatic HTML rewrite: prefer inlining images as data URIs to ensure static rendering
  // We still copy into reports/* for non-inlined assets (e.g., videos) and as a fallback
  const srcRegex = /(<img[^>]+src=["'])([^"']+)(["'][^>]*>)/gi;
  const sourceSrcRegex = /(<source[^>]+src=["'])([^"']+)(["'][^>]*>)/gi;
  const videoSrcRegex = /(<video[^>]+src=["'])([^"']+)(["'][^>]*>)/gi;
  const srcsetRegex = /(<(?:img|source)[^>]+srcset=["'])([^"']+)(["'][^>]*>)/gi;
  const styleBgRegex = /(style=["'][^"']*background-image\s*:\s*url\(([^\)]+)\)[^"']*["'])/gi;
  const galleryAttrRegex = /(data-gallery=["'])([^"']+)(["'])/gi; // payload is encodeURIComponent(JSON.stringify([{url,location}]))
  const rewrittenHtml = await (async () => {
      const replacements: Array<Promise<void>> = [];
      const copiedMap = new Map<string, string>(); // key -> destKey cache
      let updated = htmlContent;

      function getEligibleR2Key(src: string): string | null {
        // 1) Try strict extraction using configured public base
        let strict = extractR2KeyFromUrl(src);
        if (strict) {
          strict = strict.split(/[?#]/)[0]; // strip query/hash from strict
        }
        if (strict) return strict; // any key under our public bucket
        // 1b) Try extraction when URL contains /<bucket>/<key>
        if (bucketName) {
          const m = src.match(new RegExp(`^https?:\/\/[^/]+\/${bucketName}\/([^?#"'>\s]+)`, 'i'));
          if (m && m[1]) {
            return m[1].replace(/^[\/]+/, '');
          }
        }
        // 2) Generic match for any origin containing /(uploads|inspections)/...
        const match = src.match(/^(?:https?:\/\/[^/]+)?\/(?:((uploads|inspections)\/[^\?"'>\s#]+))/i);
        if (match && match[1]) return match[1];
        // 3) Root-relative paths
        if (src.startsWith('/uploads/') || src.startsWith('/inspections/')) return src.replace(/^\//, '');
        // 4) Non-root-relative keys (e.g., "inspections/..." without leading slash)
        if (src.startsWith('uploads/') || src.startsWith('inspections/')) return src;
        return null;
      }

      // Helper: should inline? we inline only images (not videos) up to ~3MB to keep HTML size reasonable
      function shouldInline(key: string): boolean {
        return /(\.(png|jpe?g|gif|webp|svg))(\?.*)?$/i.test(key);
      }

      // Rewrite <img src="..."> with data URIs when possible
      updated = updated.replace(srcRegex, (full: string, p1: string, src: string, p3: string) => {
        try {
          const key = getEligibleR2Key(src);
          if (key) {
            // Inline if image; otherwise copy+rewrite
            if (shouldInline(key)) {
              replacements.push(
                (async () => {
                  try {
                    const dataUri = await getR2ObjectAsDataURI(key);
                    // Replace this exact occurrence only once by using a unique token
                    updated = updated.replace(full, `${p1}${dataUri}${p3}`);
                  } catch {
                    // Fallback to copy+rewrite
                    let destKey = copiedMap.get(key);
                    if (!destKey) {
                      const rawFilename = (key.split('/').pop() || 'image').split('?')[0];
                      destKey = `${destPrefix}/${Date.now()}-${rawFilename}`;
                      copiedMap.set(key, destKey);
                      await copyInR2(key, destKey);
                    }
                    const newUrl = publicBase ? `${publicBase}/${destKey}` : `/${destKey}`;
                    updated = updated.replace(full, `${p1}${newUrl}${p3}`);
                  }
                })()
              );
              return full; // will be replaced asynchronously
            } else if (!key.startsWith('reports/')) {
              let destKey = copiedMap.get(key);
              if (!destKey) {
                const rawFilename = (key.split('/').pop() || 'asset').split('?')[0];
                destKey = `${destPrefix}/${Date.now()}-${rawFilename}`;
                copiedMap.set(key, destKey);
                replacements.push(copyInR2(key, destKey));
              }
              const newUrl = publicBase ? `${publicBase}/${destKey}` : `/${destKey}`;
              return `${p1}${newUrl}${p3}`;
            }
          }
        } catch {}
        return full; // unchanged if not uploads/*
      });

      // Rewrite <source src="..."> (leave as URLs, copy to reports/*)
      updated = updated.replace(sourceSrcRegex, (full: string, p1: string, src: string, p3: string) => {
        try {
          const key = getEligibleR2Key(src);
          if (key && !key.startsWith('reports/')) {
            if (key.startsWith('reports/')) return full;
            let destKey = copiedMap.get(key);
            if (!destKey) {
              const rawFilename = (key.split('/').pop() || 'image').split('?')[0];
              destKey = `${destPrefix}/${Date.now()}-${rawFilename}`;
              copiedMap.set(key, destKey);
              replacements.push(copyInR2(key, destKey));
            }
            const newUrl = publicBase ? `${publicBase}/${destKey}` : `/${destKey}`;
            return `${p1}${newUrl}${p3}`;
          }
        } catch {}
        return full;
      });

      // Rewrite <video src="..."> (leave as URLs, copy to reports/*)
      updated = updated.replace(videoSrcRegex, (full: string, p1: string, src: string, p3: string) => {
        try {
          const key = getEligibleR2Key(src);
          if (key && !key.startsWith('reports/')) {
            if (key.startsWith('reports/')) return full;
            let destKey = copiedMap.get(key);
            if (!destKey) {
              const rawFilename = (key.split('/').pop() || 'video').split('?')[0];
              destKey = `${destPrefix}/${Date.now()}-${rawFilename}`;
              copiedMap.set(key, destKey);
              replacements.push(copyInR2(key, destKey));
            }
            const newUrl = publicBase ? `${publicBase}/${destKey}` : `/${destKey}`;
            return `${p1}${newUrl}${p3}`;
          }
        } catch {}
        return full;
      });

      // Rewrite srcset attributes (multiple URLs separated by commas); inline where possible
      updated = updated.replace(srcsetRegex, (full: string, p1: string, srcset: string, p3: string) => {
        try {
          const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
          const asyncOps: Array<Promise<void>> = [];
          const newParts: string[] = [];
          parts.forEach((entry, idx) => {
            // entry like: "url 1x" or "url 320w"
            const [urlPart, ...rest] = entry.split(/\s+/);
            const key = getEligibleR2Key(urlPart);
            if (key) {
              if (shouldInline(key)) {
                asyncOps.push(
                  (async () => {
                    try {
                      const dataUri = await getR2ObjectAsDataURI(key);
                      newParts[idx] = [dataUri, ...rest].join(' ').trim();
                    } catch {
                      let destKey = copiedMap.get(key);
                      if (!destKey) {
                        const rawFilename = (key.split('/').pop() || 'image').split('?')[0];
                        destKey = `${destPrefix}/${Date.now()}-${rawFilename}`;
                        copiedMap.set(key, destKey);
                        await copyInR2(key, destKey);
                      }
                      const newUrl = publicBase ? `${publicBase}/${destKey}` : `/${destKey}`;
                      newParts[idx] = [newUrl, ...rest].join(' ').trim();
                    }
                  })()
                );
              } else if (!key.startsWith('reports/')) {
                let destKey = copiedMap.get(key);
                if (!destKey) {
                  const rawFilename = (key.split('/').pop() || 'image').split('?')[0];
                  destKey = `${destPrefix}/${Date.now()}-${rawFilename}`;
                  copiedMap.set(key, destKey);
                  replacements.push(copyInR2(key, destKey));
                }
                const newUrl = publicBase ? `${publicBase}/${destKey}` : `/${destKey}`;
                newParts[idx] = [newUrl, ...rest].join(' ').trim();
              } else {
                newParts[idx] = entry;
              }
            } else {
              newParts[idx] = entry;
            }
          });
          // Defer replacement until async ops complete
          replacements.push(
            (async () => {
              await Promise.all(asyncOps);
              const newSrcset = newParts.join(', ');
              updated = updated.replace(full, `${p1}${newSrcset}${p3}`);
            })()
          );
          return full;
        } catch {}
        return full;
      });

      // Rewrite inline background-image: url(...) inside style="..."; inline where possible
      updated = updated.replace(styleBgRegex, (full: string, styleAttr: string, urlRaw: string) => {
        try {
          let urlClean = urlRaw.trim().replace(/^[\'"]|[\'"]$/g, '');
          const key = getEligibleR2Key(urlClean);
          if (key) {
            if (shouldInline(key)) {
              replacements.push(
                (async () => {
                  try {
                    const dataUri = await getR2ObjectAsDataURI(key);
                    const wrapped = /['"]/i.test((urlRaw || '')[0] || '') ? `'${dataUri}'` : dataUri;
                    const newStyle = styleAttr.replace(urlRaw, wrapped);
                    updated = updated.replace(full, full.replace(styleAttr, newStyle));
                  } catch {
                    let destKey = copiedMap.get(key);
                    if (!destKey) {
                      const rawFilename = (key.split('/').pop() || 'image').split('?')[0];
                      destKey = `${destPrefix}/${Date.now()}-${rawFilename}`;
                      copiedMap.set(key, destKey);
                      await copyInR2(key, destKey);
                    }
                    const newUrl = publicBase ? `${publicBase}/${destKey}` : `/${destKey}`;
                    const wrapped = /['"]/i.test((urlRaw || '')[0] || '') ? `'${newUrl}'` : newUrl;
                    const newStyle = styleAttr.replace(urlRaw, wrapped);
                    updated = updated.replace(full, full.replace(styleAttr, newStyle));
                  }
                })()
              );
              return full;
            } else if (!key.startsWith('reports/')) {
              let destKey = copiedMap.get(key);
              if (!destKey) {
                const rawFilename = (key.split('/').pop() || 'image').split('?')[0];
                destKey = `${destPrefix}/${Date.now()}-${rawFilename}`;
                copiedMap.set(key, destKey);
                replacements.push(copyInR2(key, destKey));
              }
              const newUrl = publicBase ? `${publicBase}/${destKey}` : `/${destKey}`;
              const wrapped = /['"]/i.test((urlRaw || '')[0] || '') ? `'${newUrl}'` : newUrl;
              const newStyle = styleAttr.replace(urlRaw, wrapped);
              return full.replace(styleAttr, newStyle);
            }
          }
        } catch {}
        return full;
      });

      // perform copies
      // Also rewrite lightbox gallery payloads so offline HTML opens images correctly
      updated = updated.replace(galleryAttrRegex, (full: string, p1: string, payload: string, p3: string) => {
        try {
          const decoded = decodeURIComponent(payload);
          const arr = JSON.parse(decoded) as Array<{ url: string; location?: string }>;
          if (!Array.isArray(arr) || arr.length === 0) return full;
          const newArr: Array<{ url: string; location?: string }> = [...arr];
          const ops = newArr.map(async (entry, idx) => {
            const key = entry.url ? getEligibleR2Key(entry.url) : null;
            if (!key) return; // keep as-is (could already be data:)
            if (shouldInline(key)) {
              try {
                const dataUri = await getR2ObjectAsDataURI(key);
                newArr[idx] = { ...entry, url: dataUri };
              } catch {
                let destKey = copiedMap.get(key);
                if (!destKey) {
                  const rawFilename = (key.split('/').pop() || 'image').split('?')[0];
                  destKey = `${destPrefix}/${Date.now()}-${rawFilename}`;
                  copiedMap.set(key, destKey);
                  await copyInR2(key, destKey);
                }
                const newUrl = publicBase ? `${publicBase}/${destKey}` : `/${destKey}`;
                newArr[idx] = { ...entry, url: newUrl };
              }
            } else if (!key.startsWith('reports/')) {
              let destKey = copiedMap.get(key);
              if (!destKey) {
                const rawFilename = (key.split('/').pop() || 'asset').split('?')[0];
                destKey = `${destPrefix}/${Date.now()}-${rawFilename}`;
                copiedMap.set(key, destKey);
                replacements.push(copyInR2(key, destKey));
              }
              const newUrl = publicBase ? `${publicBase}/${destKey}` : `/${destKey}`;
              newArr[idx] = { ...entry, url: newUrl };
            }
          });
          replacements.push(
            (async () => {
              await Promise.all(ops);
              const encoded = encodeURIComponent(JSON.stringify(newArr));
              updated = updated.replace(full, `${p1}${encoded}${p3}`);
            })()
          );
          return full; // replaced asynchronously
        } catch {}
        return full;
      });

      // perform copies and inlines
      await Promise.all(replacements);
      return updated;
    })();

    console.log(`📤 Uploading HTML to R2 for inspection ${inspectionId}...`);

  // Convert updated HTML string to Buffer
  const htmlBuffer = Buffer.from(rewrittenHtml, 'utf-8');

    // Upload to R2
    const { url: publicUrl, key } = await uploadReportToR2(
      htmlBuffer,
      inspectionId,
      'html',
      reportMode
    );
    // Build a proxy URL under our domain to avoid direct r2.dev SSL issues
    const origin = new URL(req.url).origin;
    const proxiedUrl = `${origin}/api/reports/file?key=${encodeURIComponent(key)}`;

    // Save the permanent URL to MongoDB
    await updateInspection(inspectionId, {
      htmlReportUrl: proxiedUrl,
      htmlReportGeneratedAt: new Date()
    });

  console.log(`✅ HTML permanent URL saved: ${proxiedUrl}`);

    return NextResponse.json({
      success: true,
      url: proxiedUrl,
      publicUrl,
      key,
      html: rewrittenHtml,
    });

  } catch (error: any) {
    console.error('❌ Failed to upload HTML report:', error);
    return NextResponse.json(
      { error: error.message || "Failed to upload HTML report" },
      { status: 500 }
    );
  }
}
