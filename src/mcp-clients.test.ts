import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  claudeCodePluginManifest,
  claudeCodePluginMcpConfig,
  hasHyperdriveCursorConfig,
  hasHyperdriveClaudeCodePluginConfig,
  hyperdriveCursorServerConfig,
  installHyperdriveClaudeCodeConfig,
  installHyperdriveUserCursorConfig,
  userClaudeCodePluginDir,
  userCursorConfigPath,
  writeClaudeCodeFallbackScript,
  writeClaudeCodePlugin,
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

  it("renders Claude Code plugin config with a dynamic header helper", () => {
    expect(claudeCodePluginManifest()).toMatchObject({
      name: "varel-hyperdrive",
      displayName: "Varel Hyperdrive",
      version: "0.2.12",
      mcpServers: "./.mcp.json",
      skills: "./skills/",
    });

    expect(claudeCodePluginMcpConfig("https://hyperdrive.varel.dev/mcp")).toEqual({
      mcpServers: {
        "varel-hyperdrive": {
          type: "http",
          url: "https://hyperdrive.varel.dev/mcp",
          headersHelper: "./bin/varel-hyperdrive-headers",
        },
      },
    });
  });

  it("writes a Claude Code plugin without storing the token", () => {
    const pluginDir = path.join(os.tmpdir(), `varel-claude-plugin-${randomUUID()}`);
    vi.stubEnv("VAREL_CLAUDE_CODE_PLUGIN_DIR", pluginDir);

    const file = writeClaudeCodePlugin({ mcpUrl: "https://hyperdrive.varel.dev/mcp" });

    expect(file).toBe(userClaudeCodePluginDir());
    expect(hasHyperdriveClaudeCodePluginConfig()).toBe(pluginDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginDir, ".claude-plugin", "plugin.json"), "utf8"),
    ) as { name: string };
    const mcpConfig = JSON.parse(
      fs.readFileSync(path.join(pluginDir, ".mcp.json"), "utf8"),
    ) as { mcpServers: Record<string, unknown> };
    const skill = fs.readFileSync(
      path.join(pluginDir, "skills", "hyperdrive", "SKILL.md"),
      "utf8",
    );
    const helper = path.join(pluginDir, "bin", "varel-hyperdrive-headers");
    const helperContents = fs.readFileSync(helper, "utf8");

    expect(manifest.name).toBe("varel-hyperdrive");
    expect(mcpConfig.mcpServers["varel-hyperdrive"]).toEqual({
      type: "http",
      url: "https://hyperdrive.varel.dev/mcp",
      headersHelper: "./bin/varel-hyperdrive-headers",
    });
    expect(skill).toContain("varel_hyperdrive_task_impact");
    expect(skill).toContain("mcp__varel-hyperdrive__varel_hyperdrive_task_impact");
    expect(skill).toContain("exact-prefix lookup fails");
    expect(skill).toContain("varel_hyperdrive_product_design_spec_prompt");
    expect(skill).toContain("Do not use Hyperdrive for generic Next.js");
    expect(skill).toContain("/reload-plugins");
    expect(helperContents).toContain("varel whoami --token-only");
    expect(helperContents).toContain("JSON.stringify");
    expect(helperContents).not.toContain("stored-token");
    expect(fs.statSync(helper).mode & 0o777).toBe(0o700);
  });

  it("installs Claude Code by writing a plugin and removing stale direct MCP config", async () => {
    const pluginDir = path.join(os.tmpdir(), `varel-claude-plugin-${randomUUID()}`);
    vi.stubEnv("VAREL_CLAUDE_CODE_PLUGIN_DIR", pluginDir);
    const run = vi.fn(async () => undefined);

    const result = await installHyperdriveClaudeCodeConfig({
      mcpUrl: "https://hyperdrive.varel.dev/mcp",
      run,
    });

    expect(result.status).toBe("configured");
    expect(result.pluginDir).toBe(pluginDir);
    expect(hasHyperdriveClaudeCodePluginConfig()).toBe(pluginDir);
    expect(run).toHaveBeenNthCalledWith(
      1,
      "claude",
      ["mcp", "remove", "--scope", "user", "varel-hyperdrive"],
      { stdio: "ignore" },
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not require the claude executable to write the Claude Code plugin", async () => {
    const pluginDir = path.join(os.tmpdir(), `varel-claude-plugin-${randomUUID()}`);
    vi.stubEnv("VAREL_CLAUDE_CODE_PLUGIN_DIR", pluginDir);
    const run = vi.fn(async () => {
      const error = new Error("spawn claude ENOENT") as Error & { code: string };
      error.code = "ENOENT";
      throw error;
    });

    const result = await installHyperdriveClaudeCodeConfig({
      mcpUrl: "https://hyperdrive.varel.dev/mcp",
      run,
    });

    expect(result.status).toBe("configured");
    expect(result.pluginDir).toBe(pluginDir);
    expect(hasHyperdriveClaudeCodePluginConfig()).toBe(pluginDir);
  });

  it("writes a token-safe Claude Code fallback script", () => {
    const script = path.join(os.tmpdir(), `varel-claude-${randomUUID()}.sh`);
    vi.stubEnv("VAREL_CLAUDE_CODE_FALLBACK_SCRIPT", script);

    const file = writeClaudeCodeFallbackScript("https://hyperdrive.varel.dev/mcp");

    expect(file).toBe(script);
    const contents = fs.readFileSync(file, "utf8");
    expect(contents).toContain(
      "varel hyperdrive install --hyperdrive-url 'https://hyperdrive.varel.dev/mcp'",
    );
    expect(contents).toContain("Claude Code Varel Hyperdrive plugin is configured.");
    expect(contents).not.toContain("stored-token");
    expect(fs.statSync(file).mode & 0o777).toBe(0o700);
  });
});
