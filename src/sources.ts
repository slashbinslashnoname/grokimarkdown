export type Source = {
  kind: "wikipedia" | "grokipedia";
  lang?: string;
  title: string;
  canonicalUrl: string;
};

export function detectSource(input: string): Source {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Not a valid URL: ${input}`);
  }

  const host = url.hostname.toLowerCase();

  if (host.endsWith("wikipedia.org")) {
    const lang = host.split(".")[0] ?? "en";
    const m = url.pathname.match(/^\/wiki\/(.+)$/);
    if (!m) throw new Error(`Could not parse Wikipedia URL: ${input}`);
    const title = decodeURIComponent(m[1]!);
    return { kind: "wikipedia", lang, title, canonicalUrl: url.toString() };
  }

  if (host === "grokipedia.com" || host.endsWith(".grokipedia.com")) {
    const m = url.pathname.match(/^\/page\/(.+)$/);
    if (!m) throw new Error(`Could not parse Grokipedia URL: ${input}`);
    const title = decodeURIComponent(m[1]!);
    return { kind: "grokipedia", title, canonicalUrl: url.toString() };
  }

  throw new Error(
    `Unsupported host: ${host}. Expected a wikipedia.org or grokipedia.com URL.`,
  );
}
