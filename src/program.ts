import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";

import { Command } from "commander";
import { execa } from "execa";
import open from "open";

import { fetchEntitlements, fetchHyperdriveMcpStatus } from "./api.js";
import {
  clearAuth,
  defaultApiUrl,
  defaultHyperdriveMcpUrl,
  readConfig,
  requireAuth,
  writeConfig,
} from "./config.js";
import { installHyperdriveCodexConfig } from "./codex.js";
import { startBrowserLogin } from "./login.js";
import {
  parseIntegrations,
  parseWorkflow,
  setupConfigForWorkflow,
  setupIntegrations,
  writeProjectSetupConfig,
  type SetupConfig,
  type SetupIntegration,
  type SetupWorkflow,
} from "./project-config.js";
import { line, renderDone, renderInfo } from "./ui.js";

const STARTER_REPO_SSH = "git@github.com:vibeshiphq/vibeship-starter.git";
const STARTER_REPO_HTTPS = "https://github.com/vibeshiphq/vibeship-starter.git";

type CloneSource = {
  label: string;
  url: string;
};

type CloneFailure = CloneSource & {
  message: string;
};

export function starterCloneSources(overrideUrl?: string): CloneSource[] {
  const configured =
    overrideUrl ?? process.env.VIBESHIP_STARTER_REPO_URL?.trim();

  if (configured) {
    return [{ label: "custom", url: configured }];
  }

  return [
    { label: "ssh", url: STARTER_REPO_SSH },
    { label: "https", url: STARTER_REPO_HTTPS },
  ];
}

function cloneErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function starterCloneRecoveryActions(failures: CloneFailure[]) {
  const attempted = failures
    .map((failure) => `${failure.label}: ${failure.url}`)
    .join("; ");

  return [
    `Clone attempts failed (${attempted}).`,
    "Open the Polar customer portal from VibeShip and confirm the GitHub repository access benefit is connected to the right GitHub account.",
    "Confirm that account can access vibeshiphq/vibeship-starter in GitHub.",
    "For SSH, run `ssh -T git@github.com` and confirm your key is accepted.",
    "For HTTPS, run `gh auth status` or sign in to GitHub in your credential manager.",
    "If access was just granted, wait a minute and rerun `vibeship init`.",
  ];
}

async function commandLogin(options: {
  token?: string;
  email?: string;
  apiUrl?: string;
}) {
  const config = readConfig();
  const apiUrl = options.apiUrl ?? config.apiUrl ?? defaultApiUrl();

  if (!options.token) {
    const login = await startBrowserLogin({ apiUrl });
    renderInfo("Browser login", [
      line("api", apiUrl),
      line("callback", "listening on 127.0.0.1"),
    ]);

    try {
      await open(login.loginUrl);
    } catch {
      renderInfo(
        "Open this URL",
        [line("url", login.loginUrl)],
        ["Complete the browser flow to return a CLI token."],
      );
    }

    const result = await login.waitForResult.finally(() => login.close());

    writeConfig({
      ...config,
      apiUrl,
      auth: {
        token: result.token,
        email: result.email ?? options.email,
        expiresAt: result.expiresAt,
      },
    });
    renderDone("Logged in", [
      line("config", "~/.vibeship/config.json"),
      line("api", apiUrl),
      line("email", result.email ?? options.email ?? "unknown"),
      line("expires", result.expiresAt ?? "unknown", "muted"),
    ]);
    return;
  }

  writeConfig({
    ...config,
    apiUrl,
    auth: {
      token: options.token,
      email: options.email,
    },
  });
  renderDone("Logged in", [
    line("config", "~/.vibeship/config.json"),
    line("api", apiUrl),
  ]);
}

async function commandWhoami(options: { apiUrl?: string } = {}) {
  const config = readConfig();
  const auth = requireAuth(config);
  const apiUrl = options.apiUrl ?? config.apiUrl ?? defaultApiUrl();
  const status = await fetchEntitlements({
    apiUrl,
    auth,
  });
  renderDone("Account", [
    line("email", status.email ?? auth.email ?? "unknown"),
    line("api", apiUrl, "muted"),
    line("starter", status.starterAccess ? "ready" : "missing", status.starterAccess ? "success" : "warning"),
    line("hyperdrive", status.hyperdriveActive ? "active" : "inactive", status.hyperdriveActive ? "success" : "warning"),
  ]);
}

async function commandDoctor(options: { projectDir?: string; apiUrl?: string }) {
  const config = readConfig();
  const projectDir = path.resolve(options.projectDir ?? process.cwd());
  const marker = path.join(projectDir, ".vibeship", "project.json");
  const codexConfig = path.join(projectDir, ".codex", "config.toml");
  const hasAuth = Boolean(config.auth?.token);
  const hasProject = fs.existsSync(marker);
  const hasHyperdriveConfig = fs.existsSync(codexConfig);

  renderInfo(
    "Doctor",
    [
      line("auth", hasAuth ? "present" : "missing", hasAuth ? "success" : "warning"),
      line("api", options.apiUrl ?? config.apiUrl ?? defaultApiUrl(), "muted"),
      line("project", hasProject ? "vibeship starter" : "not detected", hasProject ? "success" : "warning"),
      line("hyperdrive config", hasHyperdriveConfig ? codexConfig : "not installed", hasHyperdriveConfig ? "success" : "warning"),
    ],
    doctorActions({ hasAuth, hasProject, hasHyperdriveConfig, projectDir }),
  );
}

async function cloneStarter({
  targetDir,
  localStarter,
  repoUrl,
}: {
  targetDir: string;
  localStarter?: string;
  repoUrl?: string;
}) {
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    throw new Error(`${targetDir} already exists and is not empty.`);
  }

  if (localStarter) {
    await execa("cp", ["-R", `${path.resolve(localStarter)}/.`, targetDir]);
    return;
  }

  const failures: CloneFailure[] = [];
  for (const source of starterCloneSources(repoUrl)) {
    try {
      await execa("git", ["clone", source.url, targetDir]);
      return;
    } catch (error) {
      failures.push({ ...source, message: cloneErrorMessage(error) });
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }

  throw new Error(
    [
      "Could not clone the VibeShip starter after entitlement approval.",
      ...starterCloneRecoveryActions(failures),
      "Raw git errors:",
      ...failures.map(
        (failure) => `- ${failure.label}: ${failure.message.slice(0, 500)}`,
      ),
    ].join("\n"),
  );
}

export function shouldPromptForSetup(options: {
  workflow?: string;
  integrations?: string;
  interactive?: boolean;
}) {
  if (options.interactive === false) {
    return false;
  }

  return (
    !options.workflow &&
    !options.integrations &&
    Boolean(process.stdin.isTTY && process.stdout.isTTY)
  );
}

function parseIntegrationAnswer(answer: string): SetupIntegration[] | undefined {
  return parseIntegrations(answer.trim() || undefined);
}

async function promptForSetupConfig(): Promise<SetupConfig> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const workflowAnswer = await rl.question(
      "Setup workflow [1 local-first, 2 launch-ready] (1): ",
    );
    const workflow: SetupWorkflow =
      workflowAnswer.trim() === "2" || workflowAnswer.trim() === "launch-ready"
        ? "launch-ready"
        : "local-first";
    const defaultList = setupIntegrations
      .filter((integration) =>
        ["clerk", "convex", "polar", "resend", "vercel"].includes(integration),
      )
      .join(",");
    const integrationsAnswer = await rl.question(
      `Enabled integrations (${defaultList}): `,
    );
    return setupConfigForWorkflow({
      workflow,
      integrations: parseIntegrationAnswer(integrationsAnswer) ?? undefined,
    });
  } finally {
    rl.close();
  }
}

export async function resolveInitSetupConfig(options: {
  workflow?: string;
  integrations?: string;
  interactive?: boolean;
}): Promise<SetupConfig> {
  if (shouldPromptForSetup(options)) {
    return promptForSetupConfig();
  }

  return setupConfigForWorkflow({
    workflow: parseWorkflow(options.workflow),
    integrations: parseIntegrations(options.integrations),
  });
}

async function commandInit(options: {
  targetDir?: string;
  dir?: string;
  localStarter?: string;
  repoUrl?: string;
  skipInstall?: boolean;
  apiUrl?: string;
  workflow?: string;
  integrations?: string;
}) {
  const config = readConfig();
  const auth = requireAuth(config);
  const apiUrl = options.apiUrl ?? config.apiUrl ?? defaultApiUrl();
  const status = await fetchEntitlements({
    apiUrl,
    auth,
  });

  if (!status.starterAccess) {
    throw new Error("This account does not have VibeShip starter access.");
  }

  const targetDir = path.resolve(options.dir ?? options.targetDir ?? "vibeship-app");
  const setup = await resolveInitSetupConfig({
    workflow: options.workflow,
    integrations: options.integrations,
  });
  renderInfo("Initializing starter", [
    line("directory", targetDir),
    line(
      "source",
      options.localStarter
        ? path.resolve(options.localStarter)
        : starterCloneSources(options.repoUrl)
            .map((source) => source.url)
            .join(" then "),
    ),
    line("install", options.skipInstall ? "skipped" : "pnpm install"),
    line("workflow", setup.workflow),
    line("environments", setup.environments.join(", ")),
  ]);

  await cloneStarter({
    targetDir,
    localStarter: options.localStarter,
    repoUrl: options.repoUrl,
  });

  writeProjectSetupConfig({ projectDir: targetDir, setup });

  if (!options.skipInstall) {
    await execa("pnpm", ["install"], { cwd: targetDir, stdio: "inherit" });
  }

  renderDone(
    "Starter initialized",
    [line("directory", targetDir)],
    [`cd ${targetDir}`, "vibeship hyperdrive install"],
  );
}

async function commandHyperdriveInstall(options: {
  projectDir?: string;
  mcpUrl?: string;
  apiUrl?: string;
}) {
  const config = readConfig();
  const auth = requireAuth(config);
  const apiUrl = options.apiUrl ?? config.apiUrl ?? defaultApiUrl();
  const status = await fetchEntitlements({
    apiUrl,
    auth,
  });

  if (!status.hyperdriveActive) {
    throw new Error("This account does not have an active or trialing VibeShip Hyperdrive subscription.");
  }

  const projectDir = path.resolve(options.projectDir ?? process.cwd());
  const mcpUrl = options.mcpUrl ?? config.hyperdriveMcpUrl ?? defaultHyperdriveMcpUrl();
  const file = installHyperdriveCodexConfig({ projectDir, mcpUrl });

  renderDone(
    "Hyperdrive installed",
    [
      line("project", projectDir),
      line("config", file),
      line("mcp", mcpUrl),
    ],
    [
      "export VIBESHIP_HYPERDRIVE_TOKEN=$(vibeship whoami --token-only)",
      "Open Codex in this project and use VibeShip Hyperdrive.",
    ],
  );
}

async function commandHyperdriveStatus(options: {
  projectDir?: string;
  apiUrl?: string;
  mcpUrl?: string;
}) {
  const config = readConfig();
  const auth = requireAuth(config);
  const apiUrl = options.apiUrl ?? config.apiUrl ?? defaultApiUrl();
  const status = await fetchEntitlements({
    apiUrl,
    auth,
  });
  const projectDir = path.resolve(options.projectDir ?? process.cwd());
  const codexConfig = path.join(projectDir, ".codex", "config.toml");
  const hasHyperdriveConfig = fs.existsSync(codexConfig);
  const mcpUrl = options.mcpUrl ?? config.hyperdriveMcpUrl ?? defaultHyperdriveMcpUrl();
  const details = [
    line("subscription", status.hyperdriveActive ? "active" : "inactive", status.hyperdriveActive ? "success" : "warning"),
    line("project", projectDir),
    line("config", hasHyperdriveConfig ? codexConfig : "missing", hasHyperdriveConfig ? "success" : "warning"),
    line("mcp", mcpUrl, "muted"),
  ];

  try {
    const hyperdriveStatus = await fetchHyperdriveMcpStatus({ mcpUrl, auth });
    details.push(
      line(
        "mcp auth",
        hyperdriveStatus.authenticated
          ? "accepted"
          : `rejected: ${hyperdriveStatus.reason ?? "unknown"}`,
        hyperdriveStatus.authenticated ? "success" : "warning",
      ),
      line(
        "server",
        `${hyperdriveStatus.server.name}@${hyperdriveStatus.server.version}`,
        "muted",
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    details.push(line("mcp check", message.slice(0, 140), "warning"));
  }

  renderDone("Hyperdrive status", details);
}

export async function run(argv: string[]) {
  const program = new Command();
  program
    .name("vibeship")
    .description("Initialize VibeShip starter apps and install VibeShip Hyperdrive.")
    .version("0.2.2")
    .showHelpAfterError()
    .showSuggestionAfterError()
    .configureHelp({ sortSubcommands: true })
    .addHelpText(
      "after",
      `
Examples:
  $ vibeship login
  $ vibeship init my-app
  $ vibeship init my-app --workflow local-first --integrations clerk,convex,polar,resend,vercel
  $ vibeship hyperdrive install --project-dir ./my-app
  $ vibeship doctor

Environment:
  VIBESHIP_API_URL            Override the VibeShip API URL.
  VIBESHIP_HYPERDRIVE_MCP_URL      Override the Hyperdrive MCP URL.
  VIBESHIP_STARTER_REPO_URL   Override the starter repository clone URL.
  VIBESHIP_CLI_OFFLINE=1      Use local entitlement fixtures for development.
`,
    );

  program
    .command("login")
    .description("Authenticate this machine with VibeShip.")
    .option("--token <token>", "CLI token issued by VibeShip")
    .option("--email <email>", "Email to store with a development token")
    .option("--api-url <url>", "VibeShip API URL")
    .action(commandLogin);

  program.command("logout").action(() => {
    clearAuth();
    renderDone("Logged out", [line("config", "~/.vibeship/config.json")]);
  });

  program
    .command("whoami")
    .description("Show the current VibeShip account and entitlement status.")
    .option("--token-only", "Print the stored CLI token only")
    .option("--api-url <url>", "VibeShip API URL")
    .action((options: { tokenOnly?: boolean; apiUrl?: string }) => {
      if (options.tokenOnly) {
        process.stdout.write(`${requireAuth(readConfig()).token}\n`);
        return;
      }

      return commandWhoami(options);
    });

  program
    .command("doctor")
    .description("Inspect auth, project, and Hyperdrive config for this directory.")
    .option("--project-dir <dir>", "Project directory", process.cwd())
    .option("--api-url <url>", "VibeShip API URL")
    .action(commandDoctor);

  program
    .command("init [targetDir]")
    .description("Clone the private starter into a new app directory.")
    .option("--dir <dir>", "Target directory")
    .option("--local-starter <dir>", "Use a local starter checkout")
    .option("--repo-url <url>", "Override the starter repository clone URL")
    .option("--skip-install", "Skip pnpm install")
    .option("--api-url <url>", "VibeShip API URL")
    .option("--workflow <workflow>", "Setup workflow: local-first or launch-ready")
    .option(
      "--integrations <list>",
      "Comma-separated setup integrations to enable",
    )
    .action((targetDir: string | undefined, options) =>
      commandInit({ ...options, targetDir }),
    );

  const hyperdrive = program.command("hyperdrive").description("Manage VibeShip Hyperdrive setup.");
  hyperdrive
    .command("install")
    .description("Install Hyperdrive MCP config into a Codex project.")
    .option("--project-dir <dir>", "Project directory", process.cwd())
    .option("--mcp-url <url>", "Hyperdrive MCP URL")
    .option("--api-url <url>", "VibeShip API URL")
    .action(commandHyperdriveInstall);
  hyperdrive
    .command("status")
    .description("Show Hyperdrive subscription and project config status.")
    .option("--project-dir <dir>", "Project directory", process.cwd())
    .option("--api-url <url>", "VibeShip API URL")
    .option("--mcp-url <url>", "Hyperdrive MCP URL")
    .action(commandHyperdriveStatus);

  await program.parseAsync(normalizeArgv(argv));
}

export function normalizeArgv(argv: string[]) {
  const [runtime, script, ...args] = argv;

  if (args[0] === "--") {
    return [runtime, script, ...args.slice(1)];
  }

  return argv;
}

function doctorActions({
  hasAuth,
  hasProject,
  hasHyperdriveConfig,
  projectDir,
}: {
  hasAuth: boolean;
  hasProject: boolean;
  hasHyperdriveConfig: boolean;
  projectDir: string;
}) {
  const actions: string[] = [];

  if (!hasAuth) {
    actions.push("vibeship login");
  }

  if (!hasProject) {
    actions.push("Run from a starter app, or create one with vibeship init my-app.");
  }

  if (!hasHyperdriveConfig) {
    actions.push(
      projectDir === process.cwd()
        ? "vibeship hyperdrive install"
        : `vibeship hyperdrive install --project-dir ${projectDir}`,
    );
  }

  return actions;
}
