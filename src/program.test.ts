import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  normalizeArgv,
  resolveInitSetupConfig,
  shouldPromptForSetup,
  starterCloneRecoveryActions,
  starterCloneSources,
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

  it("tries SSH and HTTPS starter clone URLs by default", () => {
    expect(starterCloneSources()).toEqual([
      {
        label: "ssh",
        url: "git@github.com:vibeshiphq/vibeship-starter.git",
      },
      {
        label: "https",
        url: "https://github.com/vibeshiphq/vibeship-starter.git",
      },
    ]);
  });

  it("allows support to override the starter clone URL", () => {
    expect(starterCloneSources("https://example.com/custom.git")).toEqual([
      { label: "custom", url: "https://example.com/custom.git" },
    ]);

    vi.stubEnv("VIBESHIP_STARTER_REPO_URL", "file:///tmp/starter.git");
    expect(starterCloneSources()).toEqual([
      { label: "custom", url: "file:///tmp/starter.git" },
    ]);
  });

  it("explains GitHub access recovery when clone fails", () => {
    expect(
      starterCloneRecoveryActions([
        {
          label: "ssh",
          url: "git@github.com:vibeshiphq/vibeship-starter.git",
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
        integrations: "clerk,convex,polar,resend,vercel,posthog",
      }),
    ).resolves.toMatchObject({
      workflow: "launch-ready",
      environments: ["development", "preview", "production"],
      integrations: {
        posthog: true,
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

  it("writes setup into .vibeship/project.json", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "vibeship-cli-"));
    try {
      await fs.mkdir(path.join(tempRoot, ".vibeship"));
      await fs.writeFile(
        path.join(tempRoot, ".vibeship/project.json"),
        JSON.stringify({ name: "app", starter: true }),
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
            resend: true,
            posthog: false,
            vercel: true,
            calCom: false,
          },
        },
      });

      await expect(
        fs.readFile(path.join(tempRoot, ".vibeship/project.json"), "utf8"),
      ).resolves.toContain('"workflow": "local-first"');
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
