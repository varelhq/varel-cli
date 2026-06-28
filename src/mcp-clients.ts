import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { execa } from "execa";

const HYPERDRIVE_SERVER_NAME = "varel-hyperdrive";

type JsonObject = Record<string, unknown>;

type RunCommand = (
  command: string,
  args: string[],
  options: { stdio: "ignore" },
) => Promise<unknown>;

export type ClaudeCodeInstallResult = {
  status: "configured" | "not-found" | "failed";
  manualCommand: string;
  message?: string;
};

export function userCursorConfigPath() {
  return process.env.CURSOR_MCP_CONFIG ?? path.join(os.homedir(), ".cursor", "mcp.json");
}

export function userClaudeCodeFallbackScriptPath() {
  return process.env.VAREL_CLAUDE_CODE_FALLBACK_SCRIPT
    ?? path.join(os.homedir(), ".varel", "install-hyperdrive-claude-code.sh");
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
  token,
  run = execa,
}: {
  mcpUrl: string;
  token: string;
  run?: RunCommand;
}): Promise<ClaudeCodeInstallResult> {
  const args = [
    "mcp",
    "add",
    "--scope",
    "user",
    "--transport",
    "http",
    HYPERDRIVE_SERVER_NAME,
    mcpUrl,
    "--header",
    `Authorization: Bearer ${token}`,
  ];

  try {
    await removeExistingClaudeCodeConfig(run);
    await run("claude", args, { stdio: "ignore" });
    return {
      status: "configured",
      manualCommand: claudeCodeManualInstallCommand(mcpUrl),
    };
  } catch (error) {
    return {
      status: isCommandNotFound(error) ? "not-found" : "failed",
      manualCommand: claudeCodeManualInstallCommand(mcpUrl),
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
  } catch (error) {
    if (isCommandNotFound(error)) {
      throw error;
    }
  }
}

export function claudeCodeManualInstallCommand(mcpUrl: string) {
  return [
    "TOKEN=\"$(varel whoami --token-only)\";",
    "claude",
    "mcp",
    "add",
    "--scope",
    "user",
    "--transport",
    "http",
    HYPERDRIVE_SERVER_NAME,
    shellQuote(mcpUrl),
    "--header",
    "\"Authorization: Bearer $TOKEN\"",
  ].join(" ");
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
      "TOKEN=\"$(varel whoami --token-only)\"",
      `${[
        "claude",
        "mcp",
        "remove",
        "--scope",
        "user",
        HYPERDRIVE_SERVER_NAME,
      ].join(" ")} >/dev/null 2>&1 || true`,
      [
        "claude",
        "mcp",
        "add",
        "--scope",
        "user",
        "--transport",
        "http",
        HYPERDRIVE_SERVER_NAME,
        shellQuote(mcpUrl),
        "--header",
        "\"Authorization: Bearer $TOKEN\"",
      ].join(" "),
      "echo \"Claude Code is configured for Varel Hyperdrive.\"",
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

function isCommandNotFound(error: unknown) {
  const maybe = error as { code?: unknown; cause?: { code?: unknown } };
  return maybe.code === "ENOENT" || maybe.cause?.code === "ENOENT";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
