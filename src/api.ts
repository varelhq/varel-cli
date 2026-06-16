import type { AuthState } from "./config.js";
import { z } from "zod";

export type EntitlementStatus = {
  email?: string;
  coreAccess: boolean;
  hyperdriveActive: boolean;
  entitlements: string[];
};

const hyperdriveMcpStatusSchema = z
  .object({
    authenticated: z.boolean(),
    subject: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    entitlements: z.array(z.string()).default([]),
    tokenExpiresAt: z.string().nullable().optional(),
    subscriptionStatus: z.string().nullable().optional(),
    server: z
      .object({
        name: z.string(),
        version: z.string(),
        protocolVersion: z.string(),
        authority: z.string(),
      })
      .passthrough(),
    providers: z.array(z.string()).default([]),
    rateLimit: z.unknown().nullable().optional(),
  })
  .passthrough();

export type HyperdriveMcpStatus = z.infer<typeof hyperdriveMcpStatusSchema>;

export async function fetchEntitlements({
  apiUrl,
  auth,
}: {
  apiUrl: string;
  auth: AuthState;
}): Promise<EntitlementStatus> {
  if (process.env.VAREL_CLI_OFFLINE === "1") {
    return {
      email: auth.email,
      coreAccess: true,
      hyperdriveActive: true,
      entitlements: ["license:core", "hyperdrive:active"],
    };
  }

  const url = new URL("/api/cli/entitlements", apiUrl);
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach Varel at ${url.origin}: ${message}`);
  }

  if (!response.ok) {
    throw new Error(
      `Entitlement check failed with HTTP ${response.status}${await responseSuffix(
        response,
      )}.`,
    );
  }

  return (await response.json()) as EntitlementStatus;
}

export async function fetchHyperdriveMcpStatus({
  mcpUrl,
  auth,
  fetchImpl = fetch,
}: {
  mcpUrl: string;
  auth: AuthState;
  fetchImpl?: typeof fetch;
}): Promise<HyperdriveMcpStatus> {
  const url = new URL(mcpUrl);
  let response: Response;

  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "varel-cli-status",
        method: "tools/call",
        params: {
          name: "varel_hyperdrive_status",
          arguments: {},
        },
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach Hyperdrive MCP at ${url.origin}: ${message}`);
  }

  if (!response.ok) {
    throw new Error(
      `Hyperdrive MCP check failed with HTTP ${response.status}${await responseSuffix(
        response,
      )}.`,
    );
  }

  const body = (await response.json()) as {
    error?: { message?: unknown };
    result?: {
      structuredContent?: unknown;
      content?: Array<{ type?: string; text?: unknown }>;
    };
  };

  if (body.error) {
    const message =
      typeof body.error.message === "string"
        ? body.error.message
        : "JSON-RPC error";
    throw new Error(`Hyperdrive MCP check failed: ${message}`);
  }

  const status =
    body.result?.structuredContent ??
    parseTextContent(body.result?.content?.find((item) => item.type === "text"));
  const parsed = hyperdriveMcpStatusSchema.safeParse(status);

  if (!parsed.success) {
    throw new Error("Hyperdrive MCP status response was not recognized.");
  }

  return parsed.data;
}

function parseTextContent(item: { text?: unknown } | undefined) {
  if (typeof item?.text !== "string") {
    return null;
  }

  try {
    return JSON.parse(item.text) as unknown;
  } catch {
    return null;
  }
}

async function responseSuffix(response: Response) {
  const text = (await response.text()).trim();

  if (!text) {
    return "";
  }

  try {
    const json = JSON.parse(text) as { error?: unknown; message?: unknown };
    const message = json.error ?? json.message;
    return typeof message === "string" ? `: ${message}` : "";
  } catch {
    return `: ${text.slice(0, 180)}`;
  }
}
