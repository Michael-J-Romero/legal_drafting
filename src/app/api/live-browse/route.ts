import type { NextRequest } from 'next/server';

// Use Node.js runtime
export const runtime = 'nodejs';

// Simple fetch-based page retrieval (no Browserless/Playwright)
export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url');
  const selector = req.nextUrl.searchParams.get('selector') || '';
  if (!urlParam) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const res = await fetch(urlParam, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      return new Response(`Failed to fetch URL (${res.status} ${res.statusText})`, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || '';
    const body = await res.text();

    // If caller provided a selector and content-type is HTML, extract text using a lightweight parser
    let content: string = body;
    if (selector && selector.trim() !== '' && (contentType.includes('text/html') || contentType.includes('application/xhtml+xml'))) {
      try {
        const { load } = await import('cheerio');
        const $ = load(body);
        const sel = $(selector);
        content = sel.length ? sel.text().replace(/\s+/g, ' ').trim() : '';
      } catch {
        // Fallback: return raw HTML if cheerio is unavailable
        content = body;
      }
    }

    return new Response(
      JSON.stringify({ url: urlParam, contentType, content }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('live-browse fetch error:', e);
    return new Response(e?.message || 'Fetch failed', { status: 500 });
  }
}
