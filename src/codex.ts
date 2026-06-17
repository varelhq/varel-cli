import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function projectCodexConfigPath(projectDir: string) {
  return path.join(projectDir, ".codex", "config.toml");
}

export function userCodexConfigPath() {
  return path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "config.toml");
}

export function hyperdriveCodexConfig({
  mcpUrl,
  token,
}: {
  mcpUrl: string;
  token?: string;
}) {
  const auth = token
    ? `
[mcp_servers.varel-hyperdrive.http_headers]
Authorization = "Bearer ${tomlString(token)}"
`
    : `bearer_token_env_var = "VAREL_HYPERDRIVE_TOKEN"
`;

  return `[mcp_servers.varel-hyperdrive]
url = "${mcpUrl}"
default_tools_approval_mode = "prompt"
${auth}`;
}

function tomlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function upsertHyperdriveConfig(file: string, config: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const marker = "[mcp_servers.varel-hyperdrive]";
  const pattern = /\n*\[mcp_servers\.varel-hyperdrive\][\s\S]*?(?=\n\[(?!mcp_servers\.varel-hyperdrive\.)|$)/;
  const next = existing.includes(marker)
    ? existing.replace(pattern, (match, offset: number) => {
        const separator = offset === 0 ? "" : "\n\n";
        return `${separator}${config.trimEnd()}\n`;
      })
    : `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}${config.trimEnd()}\n`;

  fs.writeFileSync(file, next, { mode: 0o600 });
  return file;
}

export function removeHyperdriveProjectCodexConfig(projectDir: string) {
  const file = projectCodexConfigPath(projectDir);
  if (!fs.existsSync(file)) {
    return { file, removed: false };
  }

  const existing = fs.readFileSync(file, "utf8");
  const pattern = /\n*\[mcp_servers\.varel-hyperdrive\][\s\S]*?(?=\n\[(?!mcp_servers\.varel-hyperdrive\.)|$)/;
  if (!pattern.test(existing)) {
    return { file, removed: false };
  }

  const next = `${existing.replace(pattern, "").trimEnd()}\n`;
  fs.writeFileSync(file, next, { mode: 0o600 });
  return { file, removed: true };
}

export function installHyperdriveUserCodexConfig({
  mcpUrl,
  token,
}: {
  mcpUrl: string;
  token: string;
}) {
  return upsertHyperdriveConfig(userCodexConfigPath(), hyperdriveCodexConfig({ mcpUrl, token }));
}

export function installHyperdriveProjectCodexConfig({
  projectDir,
  mcpUrl,
}: {
  projectDir: string;
  mcpUrl: string;
}) {
  return upsertHyperdriveConfig(projectCodexConfigPath(projectDir), hyperdriveCodexConfig({ mcpUrl }));
}

export function installHyperdriveCodexConfig({
  projectDir,
  mcpUrl,
}: {
  projectDir: string;
  mcpUrl: string;
}) {
  return installHyperdriveProjectCodexConfig({ projectDir, mcpUrl });
}
