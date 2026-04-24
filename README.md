<div align="center">

```
░█▀▀░█▀▄░█▀█░█░█░▀█▀░█▄█░█▀█░█▀▄░█░█░█▀▄░█▀█░█░█░█▀█
░█░█░█▀▄░█░█░█▀▄░░█░░█░█░█▀█░█▀▄░█▀▄░█░█░█░█░█▄█░█░█
░▀▀▀░▀░▀░▀▀▀░▀░▀░▀▀▀░▀░▀░▀░▀░▀░▀░▀░▀░▀▀░░▀▀▀░▀░▀░▀░▀
```

**Wikipedia & Grokipedia → clean Markdown, in one command.**

[![Release](https://img.shields.io/github/v/release/slashbinslashnoname/grokimarkdown?style=flat-square)](https://github.com/slashbinslashnoname/grokimarkdown/releases)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#license)
[![Built with Bun](https://img.shields.io/badge/built%20with-Bun-fbf0df?style=flat-square)](https://bun.com)

</div>

---

`grokimarkdown` is a tiny command-line tool that fetches a **Wikipedia** or **Grokipedia** article and spits out a clean, readable Markdown document — no infoboxes, no navigation cruft, no `[edit]` links. Just the article.

It ships as a **single static binary** (thanks to Bun's `--compile`), so there's nothing to install on the target machine except the binary itself.

## Features

- **Type a word, get an article.** `grokimarkdown "Elon Musk"` resolves to Grokipedia. Add `-w` to hit Wikipedia's search and grab the first hit. Full URLs still work.
- **Two sources, one tool.** Wikipedia (any language) and Grokipedia.
- **Clean output.** Strips infoboxes, navboxes, edit links, and the References / See also / External links tail.
- **Absolute links.** Internal wiki links are rewritten to the canonical URL on the source site, so the output still works out of context.
- **Non-interactive.** Deterministic, script-friendly, stdout-by-default.
- **Zero runtime deps.** Compiled binary — no Node.js, no Bun, no `npm install`.

## Install

### Quick install (macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/slashbinslashnoname/grokimarkdown/main/install.sh | bash
```

The installer auto-detects your OS and architecture, downloads the right binary from the latest [GitHub release](https://github.com/slashbinslashnoname/grokimarkdown/releases), verifies its SHA-256 checksum, and drops it in `/usr/local/bin` (or `$HOME/.local/bin` if that isn't writable).

Tune it with env vars:

```bash
# Pin a specific version
curl -fsSL https://raw.githubusercontent.com/slashbinslashnoname/grokimarkdown/main/install.sh \
  | GROKIMARKDOWN_VERSION=v0.1.0 bash

# Install to a custom prefix (no sudo)
curl -fsSL https://raw.githubusercontent.com/slashbinslashnoname/grokimarkdown/main/install.sh \
  | GROKIMARKDOWN_PREFIX="$HOME/.local" GROKIMARKDOWN_NO_SUDO=1 bash
```

### Manual install

Grab the binary for your platform from the [releases page](https://github.com/slashbinslashnoname/grokimarkdown/releases/latest):

| Platform        | Asset                               |
| --------------- | ----------------------------------- |
| macOS (Apple)   | `grokimarkdown-darwin-arm64`        |
| macOS (Intel)   | `grokimarkdown-darwin-x64`          |
| Linux (x86_64)  | `grokimarkdown-linux-x64`           |
| Linux (arm64)   | `grokimarkdown-linux-arm64`         |
| Windows (x64)   | `grokimarkdown-windows-x64.exe`     |

```bash
chmod +x grokimarkdown-darwin-arm64
sudo mv grokimarkdown-darwin-arm64 /usr/local/bin/grokimarkdown
```

### From source

Requires [Bun](https://bun.com) ≥ 1.3.

```bash
git clone https://github.com/slashbinslashnoname/grokimarkdown.git
cd grokimarkdown
bun install
bun run build          # produces ./grokimarkdown
```

## Usage

```
grokimarkdown <url|query> [-w] [--lang <code>] [-o <file>] [--quiet]
grokimarkdown logo
grokimarkdown --help
grokimarkdown --version
```

### Examples

**Just type a word.** Defaults to Grokipedia:

```bash
grokimarkdown "Elon Musk"
```

Add `-w` to use Wikipedia's search and grab the first result:

```bash
grokimarkdown -w markdown
grokimarkdown -w "john von neumann" -o jvn.md
```

Different Wikipedia language:

```bash
grokimarkdown -w --lang=fr "Pain au chocolat"
```

Full URLs still work:

```bash
grokimarkdown 'https://en.wikipedia.org/wiki/Bun_(software)'
grokimarkdown 'https://grokipedia.com/page/Elon_Musk' -o musk.md
```

Pipe it into anything:

```bash
grokimarkdown -w markdown | glow -
grokimarkdown -w markdown | wc -w
```

Show the logo, because you can:

```bash
grokimarkdown logo
```

## Output format

```markdown
# <Page Title>

_Source: <canonical URL>_

<body...>
```

- ATX-style headings (`#`, `##`, `###`).
- Internal wiki links → absolute URLs on the source site.
- Wikipedia: infoboxes, navboxes, edit links, and the References / Notes / External links / See also / Further reading / Bibliography sections are stripped.
- Grokipedia: navigation chrome, scripts, and the duplicated H1 are stripped; in-text reference markers like `[[1]](#ref-1)` are kept.
- Stdout contains **only** Markdown. Diagnostics go to stderr.

## Exit codes

| Code | Meaning                                                            |
| ---- | ------------------------------------------------------------------ |
| `0`  | Success                                                            |
| `1`  | Runtime failure (network, non-2xx HTTP, write failure, bad HTML)   |
| `2`  | Usage error (missing URL, unknown flag, unsupported host)          |

## Use it from Claude / other LLMs

There's a ready-made **skill** at [`skills/grokimarkdown/SKILL.md`](skills/grokimarkdown/SKILL.md) that teaches Claude (and any agent framework that understands the skill format) when to reach for `grokimarkdown` and how to call it — bare-word queries, `-w` for Wikipedia, exit codes, and the output contract. Drop it into your agent's skills directory and the model will start using the CLI whenever the user asks about a wiki topic.

## Releases

Tag a commit with `vX.Y.Z` and push the tag — GitHub Actions will cross-compile binaries for macOS (x64, arm64), Linux (x64, arm64), and Windows (x64), generate SHA-256 checksums, and publish them to a GitHub Release with auto-generated notes.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Contributing

PRs and issues welcome. The codebase is small on purpose:

```
src/
├── index.ts      # CLI entrypoint, arg parsing, help text
├── sources.ts    # URL → source descriptor
├── fetch.ts      # HTTP fetching (Wikipedia REST + Grokipedia HTML)
└── convert.ts    # DOM cleanup + HTML → Markdown
```

## License

MIT © slashbinslashnoname
