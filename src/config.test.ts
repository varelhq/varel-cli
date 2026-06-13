import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultApiUrl, defaultHyperdriveMcpUrl } from "./config.js";

describe("defaults", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses production VibeShip endpoints by default", () => {
    expect(defaultApiUrl()).toBe("https://www.vibeship.today");
    expect(defaultHyperdriveMcpUrl()).toBe("https://hyperdrive.vibeship.today/mcp");
  });

  it("uses the local internal app while developing the CLI", () => {
    vi.stubEnv("npm_lifecycle_event", "dev");

    expect(defaultApiUrl()).toBe("http://localhost:3000");
  });
});
