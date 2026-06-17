import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  installHyperdriveCodexConfig,
  installHyperdriveUserCodexConfig,
  hyperdriveCodexConfig,
  removeHyperdriveProjectCodexConfig,
  userCodexConfigPath,
} from "./codex.js";

describe("Codex Hyperdrive config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders streamable HTTP MCP config", () => {
    expect(hyperdriveCodexConfig({ mcpUrl: "https://hyperdrive.varel.dev/mcp" }))
      .toMatchInlineSnapshot(`
        "[mcp_servers.varel-hyperdrive]
        url = "https://hyperdrive.varel.dev/mcp"
        default_tools_approval_mode = "prompt"
        bearer_token_env_var = "VAREL_HYPERDRIVE_TOKEN"
        "
      `);
  });

  it("renders authenticated user-local MCP config", () => {
    expect(
      hyperdriveCodexConfig({
        mcpUrl: "https://hyperdrive.varel.dev/mcp",
        token: 'tok"quoted',
      }),
    ).toContain('Authorization = "Bearer tok\\"quoted"');
  });

  it("writes project config", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "varel-cli-"));
    const file = installHyperdriveCodexConfig({
      projectDir: dir,
      mcpUrl: "http://127.0.0.1:8787/mcp",
    });

    expect(file).toBe(path.join(dir, ".codex", "config.toml"));
    expect(fs.readFileSync(file, "utf8")).toContain("varel-hyperdrive");
    expect(fs.readFileSync(file, "utf8")).not.toContain("Authorization");
  });

  it("writes authenticated user config under CODEX_HOME", () => {
    const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "varel-codex-home-"));
    vi.stubEnv("CODEX_HOME", codexHome);

    const file = installHyperdriveUserCodexConfig({
      mcpUrl: "https://hyperdrive.varel.dev/mcp",
      token: "stored-token",
    });

    expect(file).toBe(userCodexConfigPath());
    expect(fs.readFileSync(file, "utf8")).toContain(
      'Authorization = "Bearer stored-token"',
    );
  });

  it("removes stale project Hyperdrive config that can shadow user auth", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "varel-cli-"));
    fs.mkdirSync(path.join(dir, ".codex"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".codex", "config.toml"),
      `[mcp_servers.convex]
command = "npx"

[mcp_servers.varel-hyperdrive]
url = "https://hyperdrive.varel.dev/mcp"
bearer_token_env_var = "VAREL_HYPERDRIVE_TOKEN"
default_tools_approval_mode = "prompt"
`,
    );

    const result = removeHyperdriveProjectCodexConfig(dir);

    expect(result.removed).toBe(true);
    const next = fs.readFileSync(path.join(dir, ".codex", "config.toml"), "utf8");
    expect(next).toContain("[mcp_servers.convex]");
    expect(next).not.toContain("varel-hyperdrive");
    expect(next).not.toContain("VAREL_HYPERDRIVE_TOKEN");
  });
});
