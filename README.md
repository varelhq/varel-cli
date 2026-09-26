# Varel CLI

Public CLI for initializing the private Varel core and installing Varel Hyperdrive for guided setup.

```bash
npm install -g @varel/cli
varel login
varel init my-app
cd my-app
varel hyperdrive install
```

The CLI authenticates the user, checks core and Hyperdrive access, creates a fresh app from the private core, and connects Hyperdrive to supported local agent clients.

After installing Hyperdrive, restart Codex or Cursor, and restart Claude Code
or run `/reload-plugins`. Open the project in that app and ask Hyperdrive to
prepare provider sign-in, MFA, and email verification before setup work.
Hyperdrive will then guide scoped provider setup, domain work, launch checks,
and production readiness from inside the project.

## Commands

```bash
varel login                    # Authenticate this machine with Varel
varel logout                   # Remove local CLI auth
varel whoami                   # Show account and entitlement status
varel doctor                   # Inspect auth, project, and Hyperdrive config
varel init [targetDir]         # Create a fresh app from the private core
varel hyperdrive install   # Connect Hyperdrive to Codex, Cursor, and Claude Code
varel hyperdrive status    # Show Hyperdrive subscription and connection status
```

Configuration is stored at `~/.varel/config.json`. The default production API is `https://www.varel.dev`; override it with `VAREL_API_URL` or `--api-url` when dogfooding against a local internal app.

Hyperdrive defaults to `https://hyperdrive.varel.dev/mcp`; override it with
`VAREL_HYPERDRIVE_MCP_URL` or `--hyperdrive-url` when support asks you to test
another endpoint. `varel hyperdrive install` writes authenticated user-local
Codex and Cursor MCP configuration, installs or refreshes the Claude Code
`~/.claude/skills/varel-hyperdrive` plugin with a dynamic `headersHelper`, and
removes stale project Codex overrides that could shadow user-local auth. The
Claude Code plugin does not store a static token in Claude config; it asks the
local Varel CLI for the current token when Claude connects. If Claude Code
cannot be configured automatically, the command writes a token-safe repair
script at `~/.varel/install-hyperdrive-claude-code.sh`. `varel hyperdrive
status` checks that your account and Hyperdrive connection are ready.

`varel init` checks your Varel entitlement first, then tries to clone the private core over SSH and falls back to HTTPS. The default HTTPS fallback bypasses broad Git `insteadOf` rules that would redirect it to SSH, while preserving credential helpers and leaving your Git configuration unchanged. Custom clone URLs retain your configured rewrite behavior. After the core files are copied, it removes the template repository metadata and initializes a fresh local Git repository without a remote. Add your own remote with `git remote add origin <your-repo-url>`, or pass `--disable-git` to leave the new app uninitialized. If cloning fails after entitlement approval, check local GitHub authentication with `ssh -T git@github.com` or `gh auth status`. If the authenticated GitHub account cannot access `varelhq/varel-core`, confirm its Polar GitHub repository access benefit in the Varel customer portal, then rerun `varel init`. Support can provide `--repo-url` or `VAREL_CORE_REPO_URL` for temporary clone overrides.

The interactive init wizard defaults to Launch-ready with local/development and
production selected. Preview is optional because some provider preview
environments require extra setup or paid tiers. For scripted init, use
`--environments local,prod` or add preview explicitly with
`--environments local,preview,prod`.

## Development

```bash
pnpm install
pnpm check
pnpm dev -- --help
```

## Local Dogfooding

Run the internal app first:

```bash
cd ~/projects/varel-workspace/internal
pnpm dev
```

Then log in from the CLI repo:

```bash
cd ~/projects/varel-workspace/cli
pnpm dev login
```

When invoked through the `dev` script, the CLI uses `http://localhost:3000` as the Varel API URL. A built CLI uses production defaults.

For offline CLI UI work:

```bash
VAREL_CLI_OFFLINE=1 pnpm dev -- whoami
```

## Publishing

Before publishing:

```bash
pnpm check
npm pack --dry-run
```

The package publishes only `dist` and this README. `prepack` runs a clean TypeScript build so stale local artifacts are not included.
