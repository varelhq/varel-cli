import { describe, expect, it } from "vitest";

import { fetchHyperdriveMcpStatus } from "./api.js";

describe("Hyperdrive MCP API", () => {
  it("calls the status tool with the stored CLI token", async () => {
    const requests: Array<{ input: URL | RequestInfo; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ input, init });

      return Response.json({
        jsonrpc: "2.0",
        id: "vibeship-cli-status",
        result: {
          structuredContent: {
            authenticated: true,
            subject: "user_1",
            email: "founder@example.com",
            reason: null,
            entitlements: ["hyperdrive:active"],
            tokenExpiresAt: "2026-06-10T00:00:00.000Z",
            subscriptionStatus: "active",
            server: {
              name: "vibeship-hyperdrive",
              version: "0.3.0",
              protocolVersion: "2025-06-18",
              authority: "guidance-only",
            },
            providers: ["clerk", "convex"],
            rateLimit: null,
          },
        },
      });
    };

    await expect(
      fetchHyperdriveMcpStatus({
        mcpUrl: "https://hyperdrive.vibeship.today/mcp",
        auth: { token: "cli-token" },
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      authenticated: true,
      server: { name: "vibeship-hyperdrive", version: "0.3.0" },
    });

    expect(String(requests[0]?.input)).toBe("https://hyperdrive.vibeship.today/mcp");
    expect(requests[0]?.init?.headers).toMatchObject({
      authorization: "Bearer cli-token",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(requests[0]?.init?.body))).toMatchObject({
      method: "tools/call",
      params: { name: "vibeship_hyperdrive_status" },
    });
  });

  it("surfaces JSON-RPC errors", async () => {
    await expect(
      fetchHyperdriveMcpStatus({
        mcpUrl: "https://hyperdrive.vibeship.today/mcp",
        auth: { token: "cli-token" },
        fetchImpl: async () =>
          Response.json({
            jsonrpc: "2.0",
            id: "vibeship-cli-status",
            error: { code: -32029, message: "rate limit storage missing" },
          }),
      }),
    ).rejects.toThrow("rate limit storage missing");
  });
});
