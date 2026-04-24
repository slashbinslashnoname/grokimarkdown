#!/usr/bin/env bash
# grokimarkdown installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/slashbinslashnoname/grokimarkdown/main/install.sh | bash
#
# Environment variables:
#   GROKIMARKDOWN_VERSION  Release tag to install (default: latest)
#   GROKIMARKDOWN_PREFIX   Install prefix (default: /usr/local, falls back to $HOME/.local)
#   GROKIMARKDOWN_NO_SUDO  Set to 1 to disable sudo escalation

set -euo pipefail

REPO="slashbinslashnoname/grokimarkdown"
BIN_NAME="grokimarkdown"

c_reset=$(printf '\033[0m')
c_bold=$(printf '\033[1m')
c_dim=$(printf '\033[2m')
c_red=$(printf '\033[31m')
c_green=$(printf '\033[32m')
c_yellow=$(printf '\033[33m')
c_blue=$(printf '\033[34m')

info()  { printf '%s==>%s %s\n' "$c_blue"  "$c_reset" "$*"; }
warn()  { printf '%s!!%s %s\n'  "$c_yellow" "$c_reset" "$*" >&2; }
die()   { printf '%serror:%s %s\n' "$c_red" "$c_reset" "$*" >&2; exit 1; }
ok()    { printf '%s✓%s %s\n'   "$c_green" "$c_reset" "$*"; }

need() { command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"; }

detect_os() {
  case "$(uname -s)" in
    Linux*)   echo linux ;;
    Darwin*)  echo darwin ;;
    MINGW*|MSYS*|CYGWIN*) echo windows ;;
    *) die "unsupported OS: $(uname -s)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo x64 ;;
    arm64|aarch64) echo arm64 ;;
    *) die "unsupported architecture: $(uname -m)" ;;
  esac
}

resolve_version() {
  local v="${GROKIMARKDOWN_VERSION:-latest}"
  if [ "$v" = "latest" ]; then
    v=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
        | grep -oE '"tag_name"[[:space:]]*:[[:space:]]*"[^"]+"' \
        | head -n1 | sed -E 's/.*"([^"]+)"$/\1/')
    [ -n "$v" ] || die "could not resolve latest release; set GROKIMARKDOWN_VERSION manually"
  fi
  echo "$v"
}

pick_prefix() {
  if [ -n "${GROKIMARKDOWN_PREFIX:-}" ]; then
    echo "$GROKIMARKDOWN_PREFIX"
    return
  fi
  if [ -w /usr/local/bin ] 2>/dev/null; then
    echo /usr/local
  elif [ "${GROKIMARKDOWN_NO_SUDO:-0}" != "1" ] && command -v sudo >/dev/null 2>&1; then
    echo /usr/local
  else
    echo "$HOME/.local"
  fi
}

install_file() {
  local src="$1" dest="$2"
  local dest_dir
  dest_dir=$(dirname "$dest")
  if [ -w "$dest_dir" ] || ! mkdir -p "$dest_dir" 2>/dev/null; then :; fi
  if mkdir -p "$dest_dir" 2>/dev/null && [ -w "$dest_dir" ]; then
    install -m 0755 "$src" "$dest"
  elif [ "${GROKIMARKDOWN_NO_SUDO:-0}" != "1" ] && command -v sudo >/dev/null 2>&1; then
    info "elevating with sudo to write $dest"
    sudo mkdir -p "$dest_dir"
    sudo install -m 0755 "$src" "$dest"
  else
    die "cannot write to $dest_dir (set GROKIMARKDOWN_PREFIX to a writable directory)"
  fi
}

main() {
  need curl
  need uname
  need mkdir
  need install

  local os arch version prefix asset url tmpdir bin_path
  os=$(detect_os)
  arch=$(detect_arch)

  case "$os-$arch" in
    linux-x64|linux-arm64|darwin-x64|darwin-arm64|windows-x64) ;;
    *) die "no published binary for $os-$arch" ;;
  esac

  version=$(resolve_version)
  prefix=$(pick_prefix)

  asset="${BIN_NAME}-${os}-${arch}"
  [ "$os" = "windows" ] && asset="${asset}.exe"

  url="https://github.com/${REPO}/releases/download/${version}/${asset}"
  sum_url="${url}.sha256"

  info "installing ${c_bold}${BIN_NAME}${c_reset} ${version} (${os}-${arch})"
  printf '    %sasset:%s %s\n' "$c_dim" "$c_reset" "$asset"
  printf '    %sprefix:%s %s\n' "$c_dim" "$c_reset" "$prefix"

  tmpdir=$(mktemp -d)
  trap "rm -rf '$tmpdir'" EXIT

  info "downloading $url"
  curl -fsSL --retry 3 -o "$tmpdir/$asset" "$url" \
    || die "download failed: $url"

  if curl -fsSL --retry 3 -o "$tmpdir/$asset.sha256" "$sum_url" 2>/dev/null; then
    info "verifying checksum"
    ( cd "$tmpdir" && \
      ( command -v sha256sum >/dev/null && sha256sum -c "$asset.sha256" >/dev/null \
        || shasum -a 256 -c "$asset.sha256" >/dev/null ) ) \
      || die "checksum verification failed"
    ok "checksum ok"
  else
    warn "no checksum published for this asset; skipping verification"
  fi

  bin_path="$prefix/bin/$BIN_NAME"
  [ "$os" = "windows" ] && bin_path="${bin_path}.exe"

  install_file "$tmpdir/$asset" "$bin_path"
  ok "installed $bin_path"

  case ":$PATH:" in
    *":$prefix/bin:"*)
      ;;
    *)
      persist_path "$prefix"
      ;;
  esac

  printf '\n%sdone.%s try: %s%s --help%s\n' \
    "$c_green" "$c_reset" "$c_bold" "$BIN_NAME" "$c_reset"
}

pick_rc_file() {
  local shell_name
  shell_name=$(basename "${SHELL:-}")
  case "$shell_name" in
    zsh)   echo "$HOME/.zshrc" ;;
    bash)
      if [ -f "$HOME/.bashrc" ]; then echo "$HOME/.bashrc"
      elif [ -f "$HOME/.bash_profile" ]; then echo "$HOME/.bash_profile"
      else echo "$HOME/.bashrc"
      fi
      ;;
    fish)  echo "$HOME/.config/fish/config.fish" ;;
    *)     echo "" ;;
  esac
}

persist_path() {
  local prefix="$1" rc export_line
  rc=$(pick_rc_file)

  if [ -z "$rc" ]; then
    warn "$prefix/bin is not on your PATH"
    printf '    add this to your shell profile:\n'
    printf '        export PATH="%s/bin:$PATH"\n' "$prefix"
    return
  fi

  case "$rc" in
    *.fish) export_line="set -gx PATH $prefix/bin \$PATH" ;;
    *)      export_line="export PATH=\"$prefix/bin:\$PATH\"" ;;
  esac

  mkdir -p "$(dirname "$rc")"
  touch "$rc"

  if grep -Fq "$prefix/bin" "$rc" 2>/dev/null; then
    info "$prefix/bin already referenced in $rc"
  else
    {
      printf '\n# Added by grokimarkdown installer\n'
      printf '%s\n' "$export_line"
    } >> "$rc"
    ok "appended PATH export to $rc"
  fi

  printf '    to use %s%s%s in this shell, run:\n' "$c_bold" "$BIN_NAME" "$c_reset"
  printf '        %ssource %s%s\n' "$c_bold" "$rc" "$c_reset"
}

main "$@"
