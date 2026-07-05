import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { execa } from "execa";

const HYPERDRIVE_SERVER_NAME = "varel-hyperdrive";
const CLAUDE_CODE_PLUGIN_VERSION = "0.2.12";

type JsonObject = Record<string, unknown>;

type RunCommand = (
  command: string,
  args: string[],
  options: { stdio: "ignore" },
) => Promise<unknown>;

export type ClaudeCodeInstallResult = {
  status: "configured" | "failed";
  pluginDir: string;
  message?: string;
};

export function userCursorConfigPath() {
  return process.env.CURSOR_MCP_CONFIG ?? path.join(os.homedir(), ".cursor", "mcp.json");
}

export function userClaudeCodeFallbackScriptPath() {
  return process.env.VAREL_CLAUDE_CODE_FALLBACK_SCRIPT
    ?? path.join(os.homedir(), ".varel", "install-hyperdrive-claude-code.sh");
}

export function userClaudeCodePluginDir() {
  return process.env.VAREL_CLAUDE_CODE_PLUGIN_DIR
    ?? path.join(os.homedir(), ".claude", "skills", HYPERDRIVE_SERVER_NAME);
}

export function hyperdriveCursorServerConfig({
  mcpUrl,
  token,
}: {
  mcpUrl: string;
  token: string;
}) {
  return {
    url: mcpUrl,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export function installHyperdriveUserCursorConfig({
  mcpUrl,
  token,
}: {
  mcpUrl: string;
  token: string;
}) {
  const file = userCursorConfigPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const existing = readJsonObject(file);
  const mcpServers =
    isJsonObject(existing.mcpServers) ? existing.mcpServers : {};

  const next = {
    ...existing,
    mcpServers: {
      ...mcpServers,
      [HYPERDRIVE_SERVER_NAME]: hyperdriveCursorServerConfig({ mcpUrl, token }),
    },
  };

  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return file;
}

export async function installHyperdriveClaudeCodeConfig({
  mcpUrl,
  run = execa,
}: {
  mcpUrl: string;
  run?: RunCommand;
}): Promise<ClaudeCodeInstallResult> {
  const pluginDir = userClaudeCodePluginDir();

  try {
    writeClaudeCodePlugin({ mcpUrl });
    await removeExistingClaudeCodeConfig(run);
    return {
      status: "configured",
      pluginDir,
    };
  } catch (error) {
    return {
      status: "failed",
      pluginDir,
      message: errorMessage(error),
    };
  }
}

async function removeExistingClaudeCodeConfig(run: RunCommand) {
  try {
    await run(
      "claude",
      ["mcp", "remove", "--scope", "user", HYPERDRIVE_SERVER_NAME],
      { stdio: "ignore" },
    );
  } catch {
    // Best effort only. The plugin still works when Claude Code Desktop is
    // installed without a shell-visible `claude` command.
  }
}

export function writeClaudeCodePlugin({ mcpUrl }: { mcpUrl: string }) {
  const pluginDir = userClaudeCodePluginDir();
  const manifestDir = path.join(pluginDir, ".claude-plugin");
  const skillsDir = path.join(pluginDir, "skills", "hyperdrive");
  const binDir = path.join(pluginDir, "bin");

  fs.mkdirSync(manifestDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(skillsDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(binDir, { recursive: true, mode: 0o700 });

  fs.writeFileSync(
    path.join(manifestDir, "plugin.json"),
    `${JSON.stringify(claudeCodePluginManifest(), null, 2)}\n`,
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(pluginDir, ".mcp.json"),
    `${JSON.stringify(claudeCodePluginMcpConfig(mcpUrl), null, 2)}\n`,
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(skillsDir, "SKILL.md"),
    claudeCodePluginSkill(),
    { mode: 0o600 },
  );

  const helper = path.join(binDir, "varel-hyperdrive-headers");
  fs.writeFileSync(helper, claudeCodeHeadersHelperScript(), { mode: 0o700 });
  fs.chmodSync(helper, 0o700);

  return pluginDir;
}

export function writeClaudeCodeFallbackScript(mcpUrl: string) {
  const file = userClaudeCodeFallbackScriptPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    file,
    [
      "#!/bin/sh",
      "set -eu",
      "",
      `varel hyperdrive install --hyperdrive-url ${shellQuote(mcpUrl)}`,
      "echo \"Claude Code Varel Hyperdrive plugin is configured.\"",
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  fs.chmodSync(file, 0o700);
  return file;
}

export function hasHyperdriveCursorConfig() {
  const file = userCursorConfigPath();
  if (!fs.existsSync(file)) {
    return false;
  }

  const config = readJsonObject(file);
  return isJsonObject(config.mcpServers) && HYPERDRIVE_SERVER_NAME in config.mcpServers;
}

export function hasHyperdriveClaudeCodePluginConfig() {
  const pluginDir = userClaudeCodePluginDir();
  const manifest = path.join(pluginDir, ".claude-plugin", "plugin.json");
  const mcpConfig = path.join(pluginDir, ".mcp.json");
  const skill = path.join(pluginDir, "skills", "hyperdrive", "SKILL.md");
  const helper = path.join(pluginDir, "bin", "varel-hyperdrive-headers");

  return [manifest, mcpConfig, skill, helper].every((file) => fs.existsSync(file))
    ? pluginDir
    : undefined;
}

export function claudeCodePluginManifest() {
  return {
    name: HYPERDRIVE_SERVER_NAME,
    displayName: "Varel Hyperdrive",
    version: CLAUDE_CODE_PLUGIN_VERSION,
    description:
      "Guided Varel setup, broad-work orchestration, provider handoffs, domains, and validation.",
    author: {
      name: "Varel",
      url: "https://www.varel.dev",
    },
    homepage: "https://www.varel.dev",
    repository: "https://github.com/varelhq/varel-cli",
    keywords: ["varel", "hyperdrive", "mcp", "setup", "agents"],
    skills: "./skills/",
    mcpServers: "./.mcp.json",
  };
}

export function claudeCodePluginMcpConfig(mcpUrl: string) {
  return {
    mcpServers: {
      [HYPERDRIVE_SERVER_NAME]: {
        type: "http",
        url: mcpUrl,
        headersHelper: "./bin/varel-hyperdrive-headers",
      },
    },
  };
}

function claudeCodePluginSkill() {
  return `---
name: hyperdrive
description: Use Varel Hyperdrive only for Varel Core/Varel-based projects, or when the user explicitly asks for Hyperdrive, the Varel Hyperdrive plugin, skill, or MCP tools.
---

# Varel Hyperdrive

Use the bundled Varel Hyperdrive MCP server only when the active project is Varel Core/Varel-based, or when the user explicitly asks for Hyperdrive, the Varel Hyperdrive plugin, skill, or MCP tools. Do not use Hyperdrive for generic Next.js, provider, domain, dashboard, PRD, Computer Use, or deploy tasks outside Varel.

Claude Code may expose MCP tools with server-qualified names such as \`mcp__varel-hyperdrive__varel_hyperdrive_task_impact\` rather than names that start exactly with \`varel_hyperdrive_\`. Do not report Hyperdrive tools unavailable only because exact-prefix lookup fails; use the exposed tool whose name contains \`hyperdrive\` and the intended tool stem.

Start broad tasks with \`varel_hyperdrive_task_impact\`. For Varel Core PRD/scoping work, use \`varel_hyperdrive_starter_prd_prompt\`. For broad app, dashboard, authenticated workflow, or serious SaaS UI work, use \`varel_hyperdrive_product_design_spec_prompt\` before coding unless the user explicitly waives the quality gate. For launch-quality public pages, use \`varel_hyperdrive_landing_page_plan\`. For context-heavy work, use \`varel_hyperdrive_thread_orchestration\` and then use the active Claude Code capabilities available in the session, such as subagents, worktrees, terminal commands, browser automation, Computer Use, or Chrome integration. Keep delegated workstreams non-overlapping and merge child summaries before final validation.

Before provider setup, call \`varel_hyperdrive_access_bootstrap\` with Varel-standard providers and any product-specific providers. After the user is signed in and MFA/email verification is complete, use local Varel commands, official provider CLIs, provider MCPs, provider APIs, dashboards, Browser, Computer Use, Chrome, or the active client's equivalent browser automation as needed. Create or select only resources dedicated to the current Varel product, and never create API keys in unrelated provider projects.

Before dashboard, Browser, Computer Use, Chrome, or other browser automation work, call \`varel_hyperdrive_computer_use_checkpoint\` and follow the returned stop gates. Hyperdrive does not use a domain allowlist; use whatever external website is required while stopping for paid, credential, destructive, unsafe network, and non-reversible production gates.

If Hyperdrive tools are unavailable, run \`varel login\`, then \`varel hyperdrive install\` from the project, then restart Claude Code or run \`/reload-plugins\`.
`;
}

function claudeCodeHeadersHelperScript() {
  return `#!/bin/sh
set -eu

if ! command -v varel >/dev/null 2>&1; then
  echo "varel CLI not found. Install @varel/cli, run varel login, then run varel hyperdrive install." >&2
  exit 1
fi

TOKEN="$(varel whoami --token-only)"
if [ -z "$TOKEN" ]; then
  echo "No Varel token found. Run varel login, then run varel hyperdrive install." >&2
  exit 1
fi

if command -v node >/dev/null 2>&1; then
  node -e 'const token = process.argv[1]; process.stdout.write(JSON.stringify({ Authorization: \`Bearer \${token}\` }) + "\\n");' "$TOKEN"
else
  printf '{"Authorization":"Bearer %s"}\\n' "$TOKEN"
fi
`;
}

function readJsonObject(file: string): JsonObject {
  if (!fs.existsSync(file)) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  if (!isJsonObject(parsed)) {
    throw new Error(`${file} must contain a JSON object.`);
  }

  return parsed;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
