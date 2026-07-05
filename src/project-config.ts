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
  "sanity",
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
const environmentSchema = z.enum(setupEnvironments);
const integrationsSchema = z
  .array(z.enum(setupIntegrations))
  .min(1, "Select at least one integration.");

const environmentAliases: Record<string, SetupEnvironment> = {
  dev: "development",
  development: "development",
  local: "development",
  preview: "preview",
  prod: "production",
  production: "production",
};

export function defaultIntegrations() {
  return {
    clerk: true,
    convex: true,
    polar: true,
    sanity: true,
    resend: true,
    posthog: false,
    vercel: true,
    calCom: false,
  } satisfies Record<SetupIntegration, boolean>;
}

export function environmentsForWorkflow(
  workflow: SetupWorkflow,
): SetupEnvironment[] {
  return workflow === "local-first" ? ["development"] : ["development", "production"];
}

function normalizeEnvironments(environments: SetupEnvironment[]) {
  return setupEnvironments.filter((environment) =>
    environments.includes(environment),
  );
}

export function validateEnvironmentsForWorkflow(
  workflow: SetupWorkflow,
  environments: SetupEnvironment[],
) {
  if (!environments.includes("development")) {
    throw new Error("Setup environments must include local/development.");
  }

  if (workflow === "local-first") {
    if (environments.length !== 1 || environments[0] !== "development") {
      throw new Error("local-first setup only supports local/development.");
    }
    return;
  }

  if (!environments.includes("production")) {
    throw new Error(
      "launch-ready setup requires production; preview is optional.",
    );
  }
}

export function setupConfigForWorkflow({
  workflow,
  integrations,
  environments,
}: {
  workflow: SetupWorkflow;
  integrations?: SetupIntegration[];
  environments?: SetupEnvironment[];
}): SetupConfig {
  const enabled: Record<SetupIntegration, boolean> = {
    ...defaultIntegrations(),
  };
  const selectedEnvironments = normalizeEnvironments(
    environments ?? environmentsForWorkflow(workflow),
  );

  validateEnvironmentsForWorkflow(workflow, selectedEnvironments);

  if (integrations) {
    for (const integration of setupIntegrations) {
      enabled[integration] = integrations.includes(integration);
    }
  }

  return {
    workflow,
    environments: selectedEnvironments,
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

export function parseEnvironments(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      const environment = environmentAliases[entry];
      if (!environment) {
        return environmentSchema.parse(entry);
      }
      return environment;
    });

  return normalizeEnvironments(parsed);
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
