import type { Source } from "./sources.ts";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) grokimarkdown/0.1";

export type FetchedPage = {
  title: string;
  html: string;
  sourceUrl: string;
};

async function get(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en;q=0.9",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return await res.text();
}

export async function fetchPage(source: Source): Promise<FetchedPage> {
  if (source.kind === "wikipedia") {
    const lang = source.lang ?? "en";
    const slug = encodeURIComponent(source.title.replace(/ /g, "_"));
    const apiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/html/${slug}`;
    const html = await get(apiUrl);
    return {
      title: source.title.replace(/_/g, " "),
      html,
      sourceUrl: source.canonicalUrl,
    };
  }

  const slug = encodeURIComponent(source.title.replace(/ /g, "_"));
  const url = `https://grokipedia.com/page/${slug}`;
  const html = await get(url);
  return {
    title: source.title.replace(/_/g, " "),
    html,
    sourceUrl: url,
  };
}
