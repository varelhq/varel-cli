# VibeShip CLI

Public CLI for initializing the private VibeShip starter and installing VibeShip Hyperdrive for guided setup.

```bash
npm install -g @vibeshiphq/cli
vibeship login
vibeship init my-app
cd my-app
vibeship hyperdrive install
```

The CLI does not embed proprietary setup runbooks. It authenticates the user, checks starter/Hyperdrive entitlement through VibeShip, clones the private starter, and writes local Codex MCP config for Hyperdrive.

## Commands

```bash
vibeship login                    # Authenticate this machine with VibeShip
vibeship logout                   # Remove local CLI auth
vibeship whoami                   # Show account and entitlement status
vibeship doctor                   # Inspect auth, project, and Hyperdrive config
vibeship init [targetDir]         # Clone the private starter into a new app
vibeship hyperdrive install   # Install Hyperdrive MCP config into .codex/config.toml
vibeship hyperdrive status    # Show Hyperdrive subscription, config, and MCP reachability
```

Configuration is stored at `~/.vibeship/config.json`. The default production API is `https://www.vibeship.today`; override it with `VIBESHIP_API_URL` or `--api-url` when dogfooding against a local internal app.

Hyperdrive MCP defaults to `https://hyperdrive.vibeship.today/mcp`; override it with
`VIBESHIP_HYPERDRIVE_MCP_URL` or `--mcp-url`. `vibeship hyperdrive status` calls Hyperdrive's
`vibeship_hyperdrive_status` MCP tool with your stored CLI token and reports whether
the server accepted the token.

`vibeship init` checks your VibeShip entitlement first, then tries to clone the private starter over SSH and falls back to HTTPS. If GitHub access fails after entitlement approval, connect the Polar GitHub repository access benefit in the VibeShip customer portal, verify access to `vibeshiphq/vibeship-starter`, and rerun `vibeship init`. Support can provide `--repo-url` or `VIBESHIP_STARTER_REPO_URL` for temporary clone overrides.

## Development

```bash
pnpm install
pnpm check
pnpm dev -- --help
```

## Local Dogfooding

Run the internal app first:

```bash
cd ~/projects/vibeship-workspace/internal
pnpm dev
```

Then log in from the CLI repo:

```bash
cd ~/projects/vibeship-workspace/cli
pnpm dev login
```

When invoked through the `dev` script, the CLI uses `http://localhost:3000` as the VibeShip API URL. A built CLI uses production defaults.

For offline CLI UI work:

```bash
VIBESHIP_CLI_OFFLINE=1 pnpm dev -- whoami
```

## Publishing

Before publishing:

```bash
pnpm check
npm pack --dry-run
```

The package publishes only `dist` and this README. `prepack` runs a clean TypeScript build so stale local artifacts are not included.
