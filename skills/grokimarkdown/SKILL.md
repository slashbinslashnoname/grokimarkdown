---
name: grokimarkdown
description: Fetch a Wikipedia or Grokipedia article and return clean Markdown. Use this skill whenever the user asks for the content of a wiki page, wants to summarize / cite / quote a Wikipedia or Grokipedia article, or pastes a wikipedia.org or grokipedia.com URL. Input can be either a full URL or a bare search term.
---

# grokimarkdown

A small CLI that downloads a Wikipedia or Grokipedia article and emits clean, readable Markdown — infoboxes, navboxes, `[edit]` links, References / See also / External links sections are stripped; internal wiki links are rewritten to absolute URLs.

## When to use

Use this skill when the user:

- Pastes a `wikipedia.org` or `grokipedia.com` URL and asks you to read, summarize, or quote it.
- Asks about the content of a concept/person/topic and wants it grounded in a wiki source instead of your training data.
- Needs a citeable, offline copy of an article (save to file).
- Is writing something that needs a clean Markdown quote block from a wiki source.

Do **not** use this skill for:

- Non-wiki URLs (news articles, blog posts, arbitrary HTML).
- Questions answerable from the current conversation or codebase.
- Bulk scraping (the tool processes one page per invocation by design).

## Invocation

The binary is `grokimarkdown`. It is non-interactive, prints Markdown to stdout, and prints diagnostics to stderr prefixed with `error:`. Exit code is `0` on success, `1` on runtime/network failure, `2` on usage error.

### Shape

```
grokimarkdown <url|query> [-w] [--lang <code>] [-o <file>] [--quiet]
```

### Resolving input

1. **Full URL** (`https://...`): fetched as-is. Must be either:
   - `https://<lang>.wikipedia.org/wiki/<Title>` — any Wikipedia subdomain works.
   - `https://grokipedia.com/page/<Title>`
2. **Bare query** (one or more words, no URL scheme):
   - Default: resolves to `https://grokipedia.com/page/<Title_With_Underscores>`.
   - With `-w` / `--wikipedia`: runs Wikipedia's `opensearch` API and fetches the **first** matching article. Use `--lang` to pick a subdomain (default `en`).

Wrap multi-word queries and URLs containing parentheses or other shell metacharacters in quotes.

### Examples

```bash
# Bare word, Grokipedia (default)
grokimarkdown "Elon Musk"

# Bare word, Wikipedia (first search result)
grokimarkdown -w markdown

# Non-English Wikipedia
grokimarkdown -w --lang=fr "Pain au chocolat"

# Full URL still works
grokimarkdown 'https://en.wikipedia.org/wiki/Bun_(software)'

# Save instead of printing
grokimarkdown -w "John von Neumann" -o jvn.md --quiet
```

## Output contract

```markdown
# <Page Title>

_Source: <canonical URL>_

<body...>
```

- ATX-style headings (`#`, `##`, `###`).
- Internal wiki links are absolute URLs on the source site.
- Wikipedia: infoboxes, navboxes, `[edit]` links, and the References / Notes / External links / See also / Further reading / Bibliography sections are stripped.
- Grokipedia: navigation chrome, scripts, and the duplicated H1 are stripped; in-text reference markers like `[[1]](#ref-1)` are kept.
- stdout contains **only** Markdown; diagnostics go to stderr.

## Workflow guidance for LLMs

1. **Prefer bare queries.** If the user names a topic, just call `grokimarkdown "<topic>"` (or `-w "<topic>"` for Wikipedia). Don't construct URLs by hand unless you already have the exact canonical URL.
2. **One page per call.** If the user asks about multiple topics, invoke the tool once per topic in a loop — don't try to batch.
3. **Read, then answer.** After fetching, read the Markdown and answer from it. Cite the `_Source:_` line when quoting.
4. **Network required.** The tool performs HTTP requests to `wikipedia.org` / `grokipedia.com`. Don't call it in an offline or egress-restricted sandbox.
5. **Stable output.** For the same input and same upstream HTML the output is deterministic — safe to cache.
6. **Check exit codes.**
   - `0`: success, consume stdout.
   - `1`: runtime failure — inspect stderr, usually means the page doesn't exist or the site is unreachable. Offer to search with different wording or fall back to `-w` vs default.
   - `2`: usage error — you passed a bad flag or no argument.

## Installation check

If you're unsure whether the binary is available, run:

```bash
command -v grokimarkdown && grokimarkdown --version
```

If not installed, the quick installer is:

```bash
curl -fsSL https://raw.githubusercontent.com/slashbinslashnoname/grokimarkdown/main/install.sh | bash
```
