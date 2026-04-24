#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import { convertToMarkdown } from "./convert.ts";
import { fetchPage } from "./fetch.ts";
import { detectSource } from "./sources.ts";
import { resolveQuery, looksLikeUrl } from "./resolve.ts";
import logoArt from "./logo.txt" with { type: "text" };

const VERSION = "0.1.0";

const LOGO = `\n${logoArt.trimEnd()}\n\n  Wikipedia & Grokipedia → clean Markdown.  v${VERSION}\n`;

const HELP = `grokimarkdown ${VERSION} — fetch a Wikipedia or Grokipedia page and emit Markdown

USAGE
  grokimarkdown <url|query> [-w] [--lang <code>] [-o <file>] [--quiet]
  grokimarkdown logo
  grokimarkdown -h | --help
  grokimarkdown --version

ARGUMENTS
  <url|query>  Required. Either:
                 - A full URL:
                     https://<lang>.wikipedia.org/wiki/<Title>
                     https://grokipedia.com/page/<Title>
                 - A bare search term (one or more words). The tool
                   will resolve it to an article URL:
                     * Grokipedia (default): the word is normalized
                       to a Title_With_Underscores slug.
                     * Wikipedia (with -w/--wikipedia): the first
                       matching article from Wikipedia's search is
                       fetched.
               Wrap multi-word queries or URLs containing shell
               metacharacters in quotes.

OPTIONS
  -w, --wikipedia       Resolve bare queries against Wikipedia
                        instead of Grokipedia. Ignored when a full
                        URL is supplied.
      --lang <code>     Wikipedia language subdomain for -w queries
                        (default: en). Ignored when a URL is supplied.
  -o, --output <file>   Write Markdown to <file> (UTF-8, overwrites).
                        When omitted, Markdown is written to stdout.
  -q, --quiet           Suppress the "wrote <file>" notice on stderr
                        when using --output. No effect otherwise.
  -h, --help            Print this help to stdout and exit 0.
  --version             Print the version to stdout and exit 0.

OUTPUT
  Markdown document with this structure:
    # <Page Title>

    _Source: <canonical URL>_

    <body...>
  - Headings use ATX style (#, ##, ###).
  - Internal links are rewritten to absolute URLs on the source site.
  - Wikipedia: infoboxes, navboxes, edit links, and the
    References / Notes / External links / See also / Further reading /
    Bibliography sections are stripped.
  - Grokipedia: navigation chrome, scripts, and the duplicated H1 are
    stripped; in-text reference markers like [\\[1\\]](#ref-1) are kept.
  - Stdout contains ONLY the Markdown. Diagnostics go to stderr.

EXIT CODES
  0  Success.
  1  Runtime failure (network error, non-2xx HTTP, write failure,
     unparseable HTML).
  2  Usage error (missing URL, unknown flag, unsupported host,
     malformed URL path).

ERRORS
  Diagnostics are printed to stderr in the form:
    error: <message>
  Match on the "error: " prefix to detect failures.

EXAMPLES
  # Bare word → Grokipedia by default
  grokimarkdown 'Elon Musk'

  # Bare word → Wikipedia (first search result)
  grokimarkdown -w markdown

  # Wikipedia in a different language
  grokimarkdown -w --lang=fr 'Pain au chocolat'

  # Full URL still works
  grokimarkdown 'https://en.wikipedia.org/wiki/Bun_(software)'

  # Save to a file (note: parentheses require quoting in most shells)
  grokimarkdown 'https://grokipedia.com/page/Elon_Musk' -o musk.md

  # Pipe into another tool
  grokimarkdown markdown -w | wc -l

LLM USAGE NOTES
  - This command is non-interactive and never prompts.
  - It performs network I/O; do not call from sandboxes without
    egress to wikipedia.org / grokipedia.com.
  - Output is deterministic given the same URL and upstream HTML.
  - Do not pass multiple URLs; loop in the caller and invoke once
    per URL.
`;

async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        output: { type: "string", short: "o" },
        quiet: { type: "boolean", short: "q" },
        wikipedia: { type: "boolean", short: "w" },
        lang: { type: "string" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean" },
      },
    });
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n\n${HELP}`);
    return 2;
  }

  if (parsed.values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (parsed.values.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  if (parsed.positionals[0] === "logo" && parsed.positionals.length === 1) {
    process.stdout.write(`${LOGO}\n`);
    return 0;
  }

  const input = parsed.positionals.join(" ").trim();
  if (!input) {
    process.stderr.write(`error: missing URL or query\n\n${HELP}`);
    return 2;
  }

  let markdown: string;
  try {
    const url = looksLikeUrl(input)
      ? input
      : await resolveQuery(input, {
          wikipedia: parsed.values.wikipedia ?? false,
          lang: parsed.values.lang ?? "en",
        });
    const source = detectSource(url);
    const page = await fetchPage(source);
    markdown = convertToMarkdown(page, source);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

  if (parsed.values.output) {
    await writeFile(parsed.values.output, markdown, "utf8");
    if (!parsed.values.quiet) {
      process.stderr.write(`wrote ${parsed.values.output}\n`);
    }
  } else {
    process.stdout.write(markdown);
  }
  return 0;
}

const code = await main(process.argv.slice(2));
process.exit(code);
