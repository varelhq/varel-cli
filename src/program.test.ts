import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  normalizeArgv,
  resolveInitSetupConfig,
  shouldPromptForSetup,
  coreCloneRecoveryActions,
  coreCloneSources,
  hyperdriveInstallNextSteps,
} from "./program.js";
import { writeProjectSetupConfig } from "./project-config.js";

describe("program argv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("drops the pnpm dev separator before parsing", () => {
    expect(normalizeArgv(["node", "cli", "--", "--help"])).toEqual([
      "node",
      "cli",
      "--help",
    ]);
  });

  it("leaves regular argv untouched", () => {
    expect(normalizeArgv(["node", "cli", "doctor"])).toEqual([
      "node",
      "cli",
      "doctor",
    ]);
  });

  it("tries SSH and HTTPS core clone URLs by default", () => {
    expect(coreCloneSources()).toEqual([
      {
        label: "ssh",
        url: "git@github.com:varelhq/varel-core.git",
      },
      {
        label: "https",
        url: "https://github.com/varelhq/varel-core.git",
      },
    ]);
  });

  it("allows support to override the core clone URL", () => {
    expect(coreCloneSources("https://example.com/custom.git")).toEqual([
      { label: "custom", url: "https://example.com/custom.git" },
    ]);

    vi.stubEnv("VAREL_CORE_REPO_URL", "file:///tmp/core.git");
    expect(coreCloneSources()).toEqual([
      { label: "custom", url: "file:///tmp/core.git" },
    ]);
  });

  it("explains GitHub access recovery when clone fails", () => {
    expect(
      coreCloneRecoveryActions([
        {
          label: "ssh",
          url: "git@github.com:varelhq/varel-core.git",
          message: "Permission denied",
        },
      ]).join("\n"),
    ).toContain("GitHub repository access benefit");
  });

  it("resolves local-first setup defaults for noninteractive init", async () => {
    await expect(resolveInitSetupConfig({ interactive: false })).resolves.toMatchObject({
      workflow: "local-first",
      environments: ["development"],
      integrations: {
        clerk: true,
        convex: true,
        polar: true,
        sanity: true,
        resend: true,
        posthog: false,
        vercel: true,
        calCom: false,
      },
    });
  });

  it("resolves launch-ready workflow and explicit integrations", async () => {
    await expect(
      resolveInitSetupConfig({
        workflow: "launch-ready",
        integrations: "clerk,convex,polar,sanity,resend,vercel,posthog",
      }),
    ).resolves.toMatchObject({
      workflow: "launch-ready",
      environments: ["development", "preview", "production"],
      integrations: {
        posthog: true,
        sanity: true,
        calCom: false,
      },
    });
  });

  it("rejects invalid workflow and integration names", async () => {
    await expect(resolveInitSetupConfig({ workflow: "fast" })).rejects.toThrow();
    await expect(
      resolveInitSetupConfig({ integrations: "clerk,unknown" }),
    ).rejects.toThrow();
  });

  it("only prompts in a TTY when no setup flags are supplied", () => {
    expect(shouldPromptForSetup({ workflow: "local-first" })).toBe(false);
    expect(shouldPromptForSetup({ integrations: "clerk" })).toBe(false);
  });

  it("writes setup into .varel/project.json", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "varel-cli-"));
    try {
      await fs.mkdir(path.join(tempRoot, ".varel"));
      await fs.writeFile(
        path.join(tempRoot, ".varel/project.json"),
        JSON.stringify({ name: "app", core: true }),
      );

      writeProjectSetupConfig({
        projectDir: tempRoot,
        setup: {
          workflow: "local-first",
          environments: ["development"],
          integrations: {
            clerk: true,
            convex: true,
            polar: true,
            sanity: true,
            resend: true,
            posthog: false,
            vercel: true,
            calCom: false,
          },
        },
      });

      await expect(
        fs.readFile(path.join(tempRoot, ".varel/project.json"), "utf8"),
      ).resolves.toContain('"workflow": "local-first"');
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("keeps Hyperdrive install next steps product-level", () => {
    const text = hyperdriveInstallNextSteps().join("\n");

    expect(text).toContain("Hyperdrive");
    expect(text).not.toMatch(/Codex|MCP|varel_hyperdrive_|tool/i);
  });
});
