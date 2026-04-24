import * as cheerio from "cheerio";
import TurndownService from "turndown";
import type { FetchedPage } from "./fetch.ts";
import type { Source } from "./sources.ts";

const WIKIPEDIA_DROP = [
  "table.infobox",
  "table.navbox",
  "table.sidebar",
  "table.metadata",
  "table.ambox",
  "table.vertical-navbox",
  "div.hatnote",
  "div.thumb",
  "div.thumbcaption",
  "div.refbegin",
  "div.reflist",
  "ol.references",
  "div.navbox",
  "div.sistersitebox",
  "div#toc",
  "div.toc",
  "div.mw-editsection",
  "span.mw-editsection",
  "sup.reference",
  "sup.noprint",
  "style",
  "script",
  "link",
  "noscript",
  "div.mw-references-wrap",
  "section[data-mw-section-id='-1']",
];

const DROP_SECTION_IDS =
  /^(References?|Notes?|External[_ ]links?|Further[_ ]reading|See[_ ]also|Bibliography|Citations|Sources|Footnotes)$/i;

function dropSectionsByHeading($: cheerio.CheerioAPI) {
  // Wikipedia REST puts content inside <section data-mw-section-id="N"> wrappers.
  // The cleanest path is: if a heading sits inside a section, remove the whole section.
  $("h2, h3").each((_, el) => {
    const headingEl = $(el);
    const id =
      headingEl.attr("id") ??
      headingEl.find(".mw-headline").attr("id") ??
      headingEl.text().trim().replace(/\s+/g, "_");
    if (!DROP_SECTION_IDS.test(id)) return;

    const section = headingEl.closest("section");
    if (section.length) {
      section.remove();
      return;
    }

    // Fallback: walk forward until the next same-or-higher heading.
    const tag = (el as any).tagName.toLowerCase();
    const stopAt = tag === "h2" ? ["h1", "h2"] : ["h1", "h2", "h3"];
    let node = headingEl as cheerio.Cheerio<any>;
    while (node.length) {
      const next = node.next();
      node.remove();
      if (!next.length) break;
      const t = (next.prop("tagName") ?? "").toLowerCase();
      if (stopAt.includes(t)) break;
      node = next;
    }
  });
}

function cleanWikipedia($: cheerio.CheerioAPI, lang: string) {
  for (const sel of WIKIPEDIA_DROP) $(sel).remove();
  $("a.mw-editsection-visualeditor").remove();

  dropSectionsByHeading($);

  const base = `https://${lang}.wikipedia.org`;
  // Resolve relative links → absolute Wikipedia URLs.
  $("a[href^='./']").each((_, el) => {
    const href = $(el).attr("href")!;
    $(el).attr("href", `${base}/wiki/${href.slice(2)}`);
  });
  $("a[href^='/wiki/']").each((_, el) => {
    $(el).attr("href", `${base}${$(el).attr("href")}`);
  });
  $("img[src^='//']").each((_, el) => {
    $(el).attr("src", `https:${$(el).attr("src")}`);
  });
}

function cleanGrokipedia($: cheerio.CheerioAPI) {
  $("script, style, noscript, link").remove();
  $("nav, header, footer").remove();
  $("[aria-hidden='true']").remove();
  $("button").remove();
  // Resolve in-site relative links.
  $("a[href^='/']").each((_, el) => {
    $(el).attr("href", `https://grokipedia.com${$(el).attr("href")}`);
  });
  // Drop a top-level <h1> matching the page title — we add our own header.
  $("h1").first().remove();
}

function pickGrokipediaContent($: cheerio.CheerioAPI): string {
  const candidates = [
    "article",
    "main",
    "[role='main']",
    "div#__next main",
    "div#root",
  ];
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) return $.html(el);
  }
  return $.html($("body"));
}

function makeTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    hr: "---",
  });

  // Drop empty links (common in MediaWiki output)
  td.addRule("dropEmptyLinks", {
    filter: (node) =>
      node.nodeName === "A" && (node.textContent ?? "").trim() === "",
    replacement: () => "",
  });

  // Render figures with captions
  td.addRule("figure", {
    filter: "figure",
    replacement: (_content, node) => {
      const el = node as unknown as Element;
      const img = el.querySelector?.("img");
      const cap = el.querySelector?.("figcaption");
      if (!img) return "";
      const src = img.getAttribute("src") ?? "";
      const alt = img.getAttribute("alt") ?? "";
      const caption = cap?.textContent?.trim() ?? "";
      const md = `![${alt || caption}](${src})`;
      return caption ? `\n\n${md}\n\n*${caption}*\n\n` : `\n\n${md}\n\n`;
    },
  });

  // Strip MediaWiki citation superscripts entirely
  td.addRule("stripRefSup", {
    filter: (node) => {
      if (node.nodeName !== "SUP") return false;
      const cls = (node as Element).getAttribute?.("class") ?? "";
      return /reference|cite_ref/.test(cls);
    },
    replacement: () => "",
  });

  return td;
}

export function convertToMarkdown(page: FetchedPage, source: Source): string {
  const $ = cheerio.load(page.html);
  let bodyHtml: string;

  if (source.kind === "wikipedia") {
    cleanWikipedia($, source.lang ?? "en");
    bodyHtml = $.html($("body").length ? $("body") : $.root());
  } else {
    cleanGrokipedia($);
    bodyHtml = pickGrokipediaContent($);
  }

  const td = makeTurndown();
  let md = td.turndown(bodyHtml).trim();

  // Collapse runs of blank lines
  md = md.replace(/\n{3,}/g, "\n\n");
  // Remove "[edit]" leftovers
  md = md.replace(/\s*\[edit\]\s*/g, "");

  const header = `# ${page.title}\n\n_Source: ${page.sourceUrl}_\n\n`;
  return header + md + "\n";
}
