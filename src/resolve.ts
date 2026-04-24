const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) grokimarkdown/0.1";

export type ResolveOptions = {
  wikipedia: boolean;
  lang: string;
};

export function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

function toTitleSlug(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join("_");
}

async function resolveWikipedia(query: string, lang: string): Promise<string> {
  const api = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  api.searchParams.set("action", "opensearch");
  api.searchParams.set("limit", "1");
  api.searchParams.set("namespace", "0");
  api.searchParams.set("format", "json");
  api.searchParams.set("search", query);

  const res = await fetch(api, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `Wikipedia search failed: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as [string, string[], string[], string[]];
  const urls = data[3];
  if (!urls || urls.length === 0 || !urls[0]) {
    throw new Error(`No Wikipedia article found for: ${query}`);
  }
  return urls[0];
}

function resolveGrokipedia(query: string): string {
  const slug = toTitleSlug(query);
  return `https://grokipedia.com/page/${encodeURIComponent(slug)}`;
}

export async function resolveQuery(
  query: string,
  opts: ResolveOptions,
): Promise<string> {
  if (opts.wikipedia) {
    return resolveWikipedia(query, opts.lang || "en");
  }
  return resolveGrokipedia(query);
}
