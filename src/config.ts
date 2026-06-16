import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { z } from "zod";

const authStateSchema = z.object({
  token: z.string().min(1),
  email: z.string().email().optional(),
  clerkUserId: z.string().optional(),
  expiresAt: z.string().optional(),
});

export type AuthState = z.infer<typeof authStateSchema>;

export type CliConfig = {
  auth?: AuthState;
  apiUrl?: string;
  hyperdriveMcpUrl?: string;
};

const configSchema = z.object({
  auth: authStateSchema.optional(),
  apiUrl: z.string().url().optional(),
  hyperdriveMcpUrl: z.string().url().optional(),
});

export function configDir() {
  return path.join(os.homedir(), ".varel");
}

export function configPath() {
  return path.join(configDir(), "config.json");
}

export function readConfig(): CliConfig {
  const file = configPath();
  if (!fs.existsSync(file)) {
    return {};
  }

  return configSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

export function writeConfig(config: CliConfig) {
  fs.mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function clearAuth() {
  const current = readConfig();
  delete current.auth;
  writeConfig(current);
}

export function requireAuth(config = readConfig()): AuthState {
  if (!config.auth?.token) {
    throw new Error("Run `varel login` before using this command.");
  }

  return config.auth;
}

export function defaultApiUrl() {
  if (process.env.VAREL_API_URL) {
    return process.env.VAREL_API_URL;
  }

  if (process.env.npm_lifecycle_event === "dev") {
    return "http://localhost:3000";
  }

  return "https://www.varel.dev";
}

export function defaultHyperdriveMcpUrl() {
  return process.env.VAREL_HYPERDRIVE_MCP_URL ?? "https://hyperdrive.varel.dev/mcp";
}
