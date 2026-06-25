import React from "react";
import { renderToString } from "ink";
import { describe, expect, it } from "vitest";

import { Logo, asciiLogoLines } from "./ui.js";

describe("ui", () => {
  it("keeps the Varel logo ASCII-only", () => {
    const logo = asciiLogoLines.join("\n");

    expect(logo).toContain("____");
    expect([...logo].every((character) => character.charCodeAt(0) <= 127)).toBe(
      true,
    );
  });

  it("renders the logo with a subtitle", () => {
    expect(renderToString(<Logo subtitle="Core init wizard" />)).toContain(
      "Core init wizard",
    );
  });
});
