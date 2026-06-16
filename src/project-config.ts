import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

export const setupWorkflows = ["local-first", "launch-ready"] as const;
export const setupEnvironments = [
  "development",
  "preview",
  "production",
] as const;
export const setupIntegrations = [
  "clerk",
  "convex",
  "polar",
  "resend",
  "posthog",
  "vercel",
  "calCom",
] as const;

export type SetupWorkflow = (typeof setupWorkflows)[number];
export type SetupEnvironment = (typeof setupEnvironments)[number];
export type SetupIntegration = (typeof setupIntegrations)[number];

export type SetupConfig = {
  workflow: SetupWorkflow;
  environments: SetupEnvironment[];
  integrations: Record<SetupIntegration, boolean>;
};

const workflowSchema = z.enum(setupWorkflows);
const integrationsSchema = z
  .array(z.enum(setupIntegrations))
  .min(1, "Select at least one integration.");

export function defaultIntegrations() {
  return {
    clerk: true,
    convex: true,
    polar: true,
    resend: true,
    posthog: false,
    vercel: true,
    calCom: false,
  } satisfies Record<SetupIntegration, boolean>;
}

export function environmentsForWorkflow(
  workflow: SetupWorkflow,
): SetupEnvironment[] {
  return workflow === "local-first"
    ? ["development"]
    : ["development", "preview", "production"];
}

export function setupConfigForWorkflow({
  workflow,
  integrations,
}: {
  workflow: SetupWorkflow;
  integrations?: SetupIntegration[];
}): SetupConfig {
  const enabled: Record<SetupIntegration, boolean> = {
    ...defaultIntegrations(),
  };

  if (integrations) {
    for (const integration of setupIntegrations) {
      enabled[integration] = integrations.includes(integration);
    }
  }

  return {
    workflow,
    environments: environmentsForWorkflow(workflow),
    integrations: enabled,
  };
}

export function parseWorkflow(value: string | undefined): SetupWorkflow {
  return workflowSchema.parse(value ?? "local-first");
}

export function parseIntegrations(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return integrationsSchema.parse(parsed);
}

export function writeProjectSetupConfig({
  projectDir,
  setup,
}: {
  projectDir: string;
  setup: SetupConfig;
}) {
  const varelDir = path.join(projectDir, ".varel");
  const marker = path.join(varelDir, "project.json");
  const existing = fs.existsSync(marker)
    ? JSON.parse(fs.readFileSync(marker, "utf8"))
    : {};

  fs.mkdirSync(varelDir, { recursive: true });
  fs.writeFileSync(
    marker,
    `${JSON.stringify({ ...existing, setup }, null, 2)}\n`,
  );
}
