#!/usr/bin/env node
import { run } from "./program.js";
import { renderError } from "./ui.js";

run(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  renderError("VibeShip CLI failed", message, recoveryActions(message));
  process.exitCode = 1;
});

function recoveryActions(message: string) {
  if (message.includes("Run `vibeship login`")) {
    return ["vibeship login"];
  }

  if (message.includes("starter access")) {
    return [
      "Confirm this account has starter access at https://www.vibeship.today.",
      "Then run vibeship login again.",
    ];
  }

  if (message.includes("Hyperdrive subscription")) {
    return [
      "Confirm this account has an active Hyperdrive subscription at https://www.vibeship.today.",
      "Then run vibeship login again.",
    ];
  }

  if (message.includes("Could not reach VibeShip")) {
    return [
      "Check your network connection.",
      "Use --api-url or VIBESHIP_API_URL if you are targeting a local app.",
    ];
  }

  if (message.includes("HTTP 401") || message.includes("HTTP 403")) {
    return ["vibeship login", "vibeship whoami"];
  }

  if (message.includes("already exists and is not empty")) {
    return ["Choose a new directory: vibeship init my-app"];
  }

  if (message.includes("Could not clone the VibeShip starter")) {
    return [
      "Confirm the Polar GitHub repository access benefit is connected to your GitHub account.",
      "Check SSH with `ssh -T git@github.com` or HTTPS auth with `gh auth status`.",
      "Use --repo-url or VIBESHIP_STARTER_REPO_URL if support gave you a temporary clone URL.",
    ];
  }

  return ["Run with --help to inspect command options."];
}
