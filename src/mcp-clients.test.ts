import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  claudeCodeManualInstallCommand,
  hasHyperdriveCursorConfig,
  hyperdriveCursorServerConfig,
  installHyperdriveClaudeCodeConfig,
  installHyperdriveUserCursorConfig,
  userCursorConfigPath,
  writeClaudeCodeFallbackScript,
} from "./mcp-clients.js";

describe("MCP client config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders Cursor remote MCP config with auth headers", () => {
    expect(
      hyperdriveCursorServerConfig({
        mcpUrl: "https://hyperdrive.varel.dev/mcp",
        token: "stored-token",
      }),
    ).toEqual({
      url: "https://hyperdrive.varel.dev/mcp",
      headers: {
        Authorization: "Bearer stored-token",
      },
    });
  });

  it("writes authenticated global Cursor config without removing other servers", () => {
    const cursorConfig = path.join(os.tmpdir(), `varel-cursor-${randomUUID()}.json`);
    vi.stubEnv("CURSOR_MCP_CONFIG", cursorConfig);
    fs.writeFileSync(
      cursorConfig,
      `${JSON.stringify({
        mcpServers: {
          convex: { command: "npx" },
        },
      })}\n`,
    );

    const file = installHyperdriveUserCursorConfig({
      mcpUrl: "https://hyperdrive.varel.dev/mcp",
      token: "stored-token",
    });

    expect(file).toBe(userCursorConfigPath());
    expect(hasHyperdriveCursorConfig()).toBe(true);
    const config = JSON.parse(fs.readFileSync(file, "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(config.mcpServers.convex).toEqual({ command: "npx" });
    expect(config.mcpServers["varel-hyperdrive"]).toEqual({
      url: "https://hyperdrive.varel.dev/mcp",
      headers: {
        Authorization: "Bearer stored-token",
      },
    });
  });

  it("installs Claude Code through the user-scoped http MCP command", async () => {
    const run = vi.fn(async () => undefined);

    const result = await installHyperdriveClaudeCodeConfig({
      mcpUrl: "https://hyperdrive.varel.dev/mcp",
      token: "stored-token",
      run,
    });

    expect(result.status).toBe("configured");
    expect(run).toHaveBeenNthCalledWith(
      1,
      "claude",
      ["mcp", "remove", "--scope", "user", "varel-hyperdrive"],
      { stdio: "ignore" },
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      "claude",
      [
        "mcp",
        "add",
        "--scope",
        "user",
        "--transport",
        "http",
        "varel-hyperdrive",
        "https://hyperdrive.varel.dev/mcp",
        "--header",
        "Authorization: Bearer stored-token",
      ],
      { stdio: "ignore" },
    );
  });

  it("ignores missing existing Claude Code config before adding the server", async () => {
    const run = vi.fn(async (_command: string, args: string[]) => {
      if (args[1] === "remove") {
        throw new Error("server not found");
      }
    });

    const result = await installHyperdriveClaudeCodeConfig({
      mcpUrl: "https://hyperdrive.varel.dev/mcp",
      token: "stored-token",
      run,
    });

    expect(result.status).toBe("configured");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("returns a sanitized Claude Code fallback command when claude is unavailable", async () => {
    const run = vi.fn(async () => {
      const error = new Error("spawn claude ENOENT") as Error & { code: string };
      error.code = "ENOENT";
      throw error;
    });

    const result = await installHyperdriveClaudeCodeConfig({
      mcpUrl: "https://hyperdrive.varel.dev/mcp",
      token: "stored-token",
      run,
    });

    expect(result.status).toBe("not-found");
    expect(result.manualCommand).toBe(
      claudeCodeManualInstallCommand("https://hyperdrive.varel.dev/mcp"),
    );
    expect(result.manualCommand).toContain("$(varel whoami --token-only)");
    expect(result.manualCommand).toContain("; claude mcp add");
    expect(result.manualCommand).toContain(
      "varel-hyperdrive 'https://hyperdrive.varel.dev/mcp' --header",
    );
    expect(result.manualCommand).not.toContain("stored-token");
  });

  it("writes a token-safe Claude Code fallback script", () => {
    const script = path.join(os.tmpdir(), `varel-claude-${randomUUID()}.sh`);
    vi.stubEnv("VAREL_CLAUDE_CODE_FALLBACK_SCRIPT", script);

    const file = writeClaudeCodeFallbackScript("https://hyperdrive.varel.dev/mcp");

    expect(file).toBe(script);
    const contents = fs.readFileSync(file, "utf8");
    expect(contents).toContain("TOKEN=\"$(varel whoami --token-only)\"");
    expect(contents).toContain(
      "claude mcp add --scope user --transport http varel-hyperdrive 'https://hyperdrive.varel.dev/mcp' --header",
    );
    expect(contents).toContain("\"Authorization: Bearer $TOKEN\"");
    expect(contents).not.toContain("stored-token");
    expect(fs.statSync(file).mode & 0o777).toBe(0o700);
  });
});
