import { NextRequest, NextResponse } from "next/server";
import { getR2Object } from "../../../../../lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function inferMimeFromKey(key: string): string {
  const ext = (key.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'html': return 'text/html; charset=utf-8';
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const keyParam = searchParams.get('key');
    if (!keyParam) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }
    const key = decodeURIComponent(keyParam).replace(/^\/+/, '');
    // Basic safety: only allow access under reports/
    if (!key.startsWith('reports/')) {
      return NextResponse.json({ error: 'Invalid key path' }, { status: 400 });
    }
    if (key.includes('..')) {
      return NextResponse.json({ error: 'Path traversal detected' }, { status: 400 });
    }

    // Prefer redirecting to public R2 URL to avoid streaming bytes through Vercel
    const publicBase = process.env.CLOUDFLARE_PUBLIC_URL?.replace(/\/$/, '');
    if (publicBase) {
      const target = `${publicBase}/${key}`;
      // 307 preserves method; suitable for GET and avoids caching surprises
      return NextResponse.redirect(target, 307);
    }

    const { buffer, contentType } = await getR2Object(key);
    const ct = contentType || inferMimeFromKey(key);
    const headers: Record<string, string> = {
      'Content-Type': ct,
      'Cache-Control': 'public, max-age=31536000, immutable',
    };
    // For PDFs/HTML prefer inline display
    const filename = key.split('/').pop() || 'file';
    headers['Content-Disposition'] = `inline; filename="${filename}"`;

  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (err: any) {
    console.error('❌ R2 file proxy failed:', err);
    const status = err?.$metadata?.httpStatusCode || 500;
    return NextResponse.json({ error: 'Failed to fetch file' }, { status });
  }
}
