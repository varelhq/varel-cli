# Varel CLI

Public CLI for initializing the private Varel core and installing Varel Hyperdrive for guided setup.

```bash
npm install -g @varelhq/cli
varel login
varel init my-app
cd my-app
varel hyperdrive install
```

The CLI does not embed proprietary setup runbooks. It authenticates the user, checks core/Hyperdrive entitlement through Varel, clones the private core, and writes local Codex MCP config for Hyperdrive.

## Commands

```bash
varel login                    # Authenticate this machine with Varel
varel logout                   # Remove local CLI auth
varel whoami                   # Show account and entitlement status
varel doctor                   # Inspect auth, project, and Hyperdrive config
varel init [targetDir]         # Clone the private core into a new app
varel hyperdrive install   # Install Hyperdrive MCP config into .codex/config.toml
varel hyperdrive status    # Show Hyperdrive subscription, config, and MCP reachability
```

Configuration is stored at `~/.varel/config.json`. The default production API is `https://www.varel.dev`; override it with `VAREL_API_URL` or `--api-url` when dogfooding against a local internal app.

Hyperdrive MCP defaults to `https://hyperdrive.varel.dev/mcp`; override it with
`VAREL_HYPERDRIVE_MCP_URL` or `--mcp-url`. `varel hyperdrive status` calls Hyperdrive's
`varel_hyperdrive_status` MCP tool with your stored CLI token and reports whether
the server accepted the token.

`varel init` checks your Varel entitlement first, then tries to clone the private core over SSH and falls back to HTTPS. If GitHub access fails after entitlement approval, connect the Polar GitHub repository access benefit in the Varel customer portal, verify access to `varelhq/varel-core`, and rerun `varel init`. Support can provide `--repo-url` or `VAREL_CORE_REPO_URL` for temporary clone overrides.

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
