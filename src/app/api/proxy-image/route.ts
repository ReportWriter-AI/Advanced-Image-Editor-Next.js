// src/app/api/proxy-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import http from 'http';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Ensure Node.js runtime so we can use http/https agents and AWS SDK
export const runtime = 'nodejs';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const publicUrlBase = (process.env.CLOUDFLARE_PUBLIC_URL || '').replace(/\/$/, '');

// Lazily create S3 client when needed
let s3Client: S3Client | null = null;
function getS3() {
  if (!s3Client) {
    if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials are not fully configured');
    }
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return s3Client;
}

function isLikelyR2Host(host: string) {
  const h = host.toLowerCase();
  return (
    h.includes('r2.cloudflarestorage.com') ||
    h.endsWith('.r2.dev') ||
    h.includes('cloudflare') ||
    h.includes('r2')
  );
}

function safeDecodePath(p: string): string {
  // Decode percent-encoded characters (e.g., %20 -> space, %28 -> () )
  // Keep forward slashes as path separators (decodeURIComponent preserves '/')
  try {
    return decodeURIComponent(p);
  } catch {
    // Fallback: decode only common encodings we see
    return p
      .replace(/%20/g, ' ')
      .replace(/%28/g, '(')
      .replace(/%29/g, ')');
  }
}

function extractR2KeyFromAnyUrl(urlStr: string): string | null {
  try {
    // Try public base first
    if (publicUrlBase && urlStr.startsWith(publicUrlBase + '/')) {
      return safeDecodePath(urlStr.substring((publicUrlBase + '/').length));
    }

    const u = new URL(urlStr);
    const path = safeDecodePath(u.pathname.replace(/^\//, ''));
    const host = u.hostname.toLowerCase();

    // Special-case public r2.dev domains issued by Cloudflare (pub-*.r2.dev)
    // These do not include the bucket in the hostname or path; we must use our configured bucket
    if (host.endsWith('.r2.dev') && path) {
      return path; // already decoded; treat the path as the key, bucket comes from env
    }

    // Virtual-hosted style: <bucket>.<account>.r2.cloudflarestorage.com/<key> or <bucket>.<something>.r2.dev/<key>
    if (bucketName && (host.startsWith(bucketName.toLowerCase() + '.') && isLikelyR2Host(host))) {
      return path || null;
    }

    // Path-style: r2 host with /<bucket>/<key>
    if (bucketName && isLikelyR2Host(host) && path.toLowerCase().startsWith(bucketName.toLowerCase() + '/')) {
      return path.substring(bucketName.length + 1) || null;
    }

    // Some setups serve as https://host/<bucket>/<key>
    if (bucketName && path.toLowerCase().startsWith(bucketName.toLowerCase() + '/')) {
      return path.substring(bucketName.length + 1) || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
  }

  try {
    const normalizeUrl = (raw: string): string => {
      try {
        const u = new URL(raw);
        const host = u.hostname.toLowerCase();
        const isR2 = isLikelyR2Host(host);
        if (isR2 && u.protocol === 'http:') u.protocol = 'https:';
        if (u.protocol === 'https:' && u.port === '80') u.port = '';
        if (u.protocol === 'http:' && u.port === '443') u.port = '';
        return u.toString();
      } catch {
        return raw;
      }
    };

    const targetUrl = normalizeUrl(imageUrl);

    // For R2 URLs, try SDK fallback first to avoid connection issues
    const r2Key = extractR2KeyFromAnyUrl(targetUrl);
    if (r2Key) {
      console.log('🔑 Detected R2 URL, attempting direct SDK fetch for key:', r2Key);
      try {
        const { Body, ContentType } = await getS3().send(new GetObjectCommand({ Bucket: bucketName!, Key: r2Key }));
        const arrayBuffer = await (Body as any).transformToByteArray();
        console.log('✅ R2 SDK fetch successful for key:', r2Key);
        return new NextResponse(Buffer.from(arrayBuffer), {
          status: 200,
          headers: {
            'Content-Type': ContentType || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD',
            'Access-Control-Allow-Headers': '*',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (sdkErr) {
        console.error('⚠️ R2 SDK fetch failed, falling back to HTTP fetch:', sdkErr);
        // Continue to HTTP fetch fallback below
      }
    }

    // Fetch image from target via HTTP
    let response: Response;
    try {
      // First attempt: default fetch with absolute URL
      // Ensure URL is absolute by prepending origin if relative
      const absoluteUrl = targetUrl.startsWith('http') ? targetUrl : new URL(targetUrl, request.url).toString();
      response = await fetch(absoluteUrl, { cache: 'no-store', redirect: 'follow' });
    } catch (err: any) {
      const code = err?.cause?.code || err?.code;
      if (code === 'ECONNRESET' || code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
        console.error('⚠️ Connection error for URL (attempt 1):', targetUrl, 'Code:', code);
        // Retry with explicit TLS settings via Node https agent
        try {
          const absoluteUrl = targetUrl.startsWith('http') ? targetUrl : new URL(targetUrl, request.url).toString();
          const agent = absoluteUrl.startsWith('https:')
            ? new https.Agent({ keepAlive: true, maxSockets: 16, minVersion: 'TLSv1.2' })
            : new http.Agent({ keepAlive: true, maxSockets: 16 });
          response = await fetch(absoluteUrl, { cache: 'no-store', redirect: 'follow', // @ts-ignore agent is supported in Node runtime
            agent });
        } catch (err2: any) {
          console.error('⚠️ TLS retry also failed for URL:', targetUrl, err2);
          // If this is an R2 URL and we can derive a key, fall back to server-side R2 GetObject
          const key = extractR2KeyFromAnyUrl(targetUrl);
          if (key) {
            try {
              const { Body, ContentType } = await getS3().send(new GetObjectCommand({ Bucket: bucketName!, Key: key }));
              const arrayBuffer = await (Body as any).transformToByteArray();
              return new NextResponse(Buffer.from(arrayBuffer), {
                status: 200,
                headers: {
                  'Content-Type': ContentType || 'application/octet-stream',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'GET, HEAD',
                  'Access-Control-Allow-Headers': '*',
                  'Cache-Control': 'public, max-age=3600',
                },
              });
            } catch (sdkErr) {
              console.error('❌ R2 SDK fallback failed for key:', key, sdkErr);
              return NextResponse.json({ error: 'Upstream SSL handshake failed and R2 fallback also failed.' }, { status: 502 });
            }
          }
          return NextResponse.json({ error: 'Upstream SSL handshake failed for the provided URL.' }, { status: 502 });
        }
      }
      throw err;
    }
    
    if (!response.ok) {
      // If direct fetch fails but URL maps to R2, try SDK fallback before erroring out
      const key = extractR2KeyFromAnyUrl(targetUrl);
      if (key) {
        try {
          const { Body, ContentType } = await getS3().send(new GetObjectCommand({ Bucket: bucketName!, Key: key }));
          const arrayBuffer = await (Body as any).transformToByteArray();
          return new NextResponse(Buffer.from(arrayBuffer), {
            status: 200,
            headers: {
              'Content-Type': ContentType || 'application/octet-stream',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, HEAD',
              'Access-Control-Allow-Headers': '*',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        } catch (sdkErr) {
          console.error('❌ R2 SDK fallback failed (non-OK response path) for key:', key, sdkErr);
        }
      }
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return image with CORS headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Failed to proxy image' }, { status: 500 });
  }
}