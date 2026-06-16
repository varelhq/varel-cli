import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultApiUrl, defaultHyperdriveMcpUrl } from "./config.js";

describe("defaults", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses production Varel endpoints by default", () => {
    expect(defaultApiUrl()).toBe("https://www.varel.dev");
    expect(defaultHyperdriveMcpUrl()).toBe("https://hyperdrive.varel.dev/mcp");
  });

  it("uses the local internal app while developing the CLI", () => {
    vi.stubEnv("npm_lifecycle_event", "dev");

    expect(defaultApiUrl()).toBe("http://localhost:3000");
  });
});
