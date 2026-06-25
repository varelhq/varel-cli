# Varel CLI

Public CLI for initializing the private Varel core and installing Varel Hyperdrive for guided setup.

```bash
npm install -g @varel/cli
varel login
varel init my-app
cd my-app
varel hyperdrive install
```

The CLI authenticates the user, checks core and Hyperdrive access, clones the private core, and connects Hyperdrive to your local editor.

After installing Hyperdrive, reopen your editor in the project and start with Hyperdrive access bootstrap so provider sign-in, MFA, OAuth, and email verification are handled up front. Hyperdrive will then guide scoped provider setup, domain work, launch checks, and production readiness from inside the project.

## Commands

```bash
varel login                    # Authenticate this machine with Varel
varel logout                   # Remove local CLI auth
varel whoami                   # Show account and entitlement status
varel doctor                   # Inspect auth, project, and Hyperdrive config
varel init [targetDir]         # Clone the private core into a new app
varel hyperdrive install   # Connect Hyperdrive to your local editor
varel hyperdrive status    # Show Hyperdrive subscription and connection status
```

Configuration is stored at `~/.varel/config.json`. The default production API is `https://www.varel.dev`; override it with `VAREL_API_URL` or `--api-url` when dogfooding against a local internal app.

Hyperdrive defaults to `https://hyperdrive.varel.dev/mcp`; override it with
`VAREL_HYPERDRIVE_MCP_URL` or `--hyperdrive-url` when support asks you to test another
endpoint. `varel hyperdrive install` writes authenticated user-local editor
configuration with auto-approved read-only Hyperdrive guidance calls and removes
stale project overrides. `varel hyperdrive status` checks that your account and
Hyperdrive connection are ready.

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
