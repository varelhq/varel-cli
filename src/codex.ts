import fs from "node:fs";
import path from "node:path";

export function projectCodexConfigPath(projectDir: string) {
  return path.join(projectDir, ".codex", "config.toml");
}

export function hyperdriveCodexConfig({
  mcpUrl,
}: {
  mcpUrl: string;
}) {
  return `[mcp_servers.varel-hyperdrive]
url = "${mcpUrl}"
bearer_token_env_var = "VAREL_HYPERDRIVE_TOKEN"
default_tools_approval_mode = "prompt"
`;
}

export function installHyperdriveCodexConfig({
  projectDir,
  mcpUrl,
}: {
  projectDir: string;
  mcpUrl: string;
}) {
  const file = projectCodexConfigPath(projectDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const marker = "[mcp_servers.varel-hyperdrive]";
  const next = existing.includes(marker)
    ? existing.replace(
        /\[mcp_servers\.varel-hyperdrive\][\s\S]*?(?=\n\[|$)/,
        hyperdriveCodexConfig({ mcpUrl }).trimEnd(),
      )
    : `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}${hyperdriveCodexConfig({
        mcpUrl,
      }).trimEnd()}\n`;

  fs.writeFileSync(file, next);
  return file;
}
