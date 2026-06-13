import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { installHyperdriveCodexConfig, hyperdriveCodexConfig } from "./codex.js";

describe("Codex Hyperdrive config", () => {
  it("renders streamable HTTP MCP config", () => {
    expect(hyperdriveCodexConfig({ mcpUrl: "https://hyperdrive.vibeship.today/mcp" }))
      .toMatchInlineSnapshot(`
        "[mcp_servers.vibeship-hyperdrive]
        url = "https://hyperdrive.vibeship.today/mcp"
        bearer_token_env_var = "VIBESHIP_HYPERDRIVE_TOKEN"
        default_tools_approval_mode = "prompt"
        "
      `);
  });

  it("writes project config", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeship-cli-"));
    const file = installHyperdriveCodexConfig({
      projectDir: dir,
      mcpUrl: "http://127.0.0.1:8787/mcp",
    });

    expect(file).toBe(path.join(dir, ".codex", "config.toml"));
    expect(fs.readFileSync(file, "utf8")).toContain("vibeship-hyperdrive");
  });
});
