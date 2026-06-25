import React from "react";
import { Box, Text, render, useApp, useInput, useStdout } from "ink";

export type DetailTone = "default" | "success" | "warning" | "danger" | "muted";

export type DetailLine = {
  label: string;
  value: string;
  tone?: DetailTone;
};

type PanelProps = {
  title: string;
  subtitle?: string;
  details?: DetailLine[];
  actions?: string[];
  tone?: DetailTone;
};

export type InitWizardWorkflowOption = {
  value: string;
  label: string;
  description: string;
  tag?: string;
};

export type InitWizardIntegrationOption = {
  value: string;
  label: string;
  description: string;
  defaultSelected?: boolean;
  tag?: string;
};

export type InitWizardResult = {
  workflow: string;
  integrations: string[];
};

type InitSetupWizardProps = {
  workflows: InitWizardWorkflowOption[];
  integrations: InitWizardIntegrationOption[];
  defaultWorkflow: string;
};

type WizardStep = "workflow" | "integrations";

const toneColor: Record<DetailTone, string | undefined> = {
  default: undefined,
  success: "green",
  warning: "yellow",
  danger: "red",
  muted: "gray",
};

export const asciiLogoLines = [
  " __     __  _    ____  _____ _",
  " \\ \\   / / / \\  |  _ \\| ____| |",
  "  \\ \\ / / / _ \\ | |_) |  _| | |",
  "   \\ V / / ___ \\|  _ <| |___| |___",
  "    \\_/ /_/   \\_\\_| \\_\\_____|_____|",
];

const amber = {
  bright: "#fbbf24",
  base: "#f59e0b",
  deep: "#d97706",
  soft: "#fde68a",
};

const logoColors = [amber.soft, amber.bright, amber.base, amber.deep, "white"];

export function line(
  label: string,
  value: string,
  tone: DetailTone = "default",
): DetailLine {
  return { label, value, tone };
}

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <Box flexDirection="column">
      {asciiLogoLines.map((logoLine, index) => (
        <Text key={logoLine} color={logoColors[index % logoColors.length]} bold>
          {logoLine}
        </Text>
      ))}
      {subtitle ? <Text color="gray">{subtitle}</Text> : null}
    </Box>
  );
}

export function StatusLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: DetailTone;
}) {
  return (
    <Text>
      <Text color="gray">{label.padEnd(14)} </Text>
      <Text color={toneColor[tone ?? "default"]}>{value}</Text>
    </Text>
  );
}

export function Panel({
  title,
  subtitle,
  details = [],
  actions = [],
  tone = "default",
}: PanelProps) {
  const titleColor = toneColor[tone] ?? "white";

  return (
    <Box flexDirection="column" paddingY={1}>
      <Logo subtitle={subtitle} />
      <Box marginTop={1} flexDirection="column">
        <Text color={titleColor} bold>
          {title}
        </Text>
        {details.map((detail) => (
          <StatusLine
            key={detail.label}
            label={detail.label}
            value={detail.value}
            tone={detail.tone}
          />
        ))}
        {actions.length > 0 ? (
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">Next steps</Text>
            {actions.map((action) => (
              <Text key={action}>{action}</Text>
            ))}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

export function renderPanel(props: PanelProps) {
  const instance = render(
    <Panel
      title={props.title}
      subtitle={props.subtitle}
      details={props.details}
      actions={props.actions}
      tone={props.tone}
    />,
  );
  instance.unmount();
}

export function renderDone(
  title: string,
  details: DetailLine[] | Array<[string, string]>,
  actions: string[] = [],
) {
  renderPanel({
    title,
    subtitle: "Command complete",
    details: normalizeDetails(details),
    actions,
    tone: "success",
  });
}

export function renderInfo(
  title: string,
  details: DetailLine[] | Array<[string, string]> = [],
  actions: string[] = [],
) {
  renderPanel({
    title,
    subtitle: "Working",
    details: normalizeDetails(details),
    actions,
  });
}

export function renderError(title: string, message: string, actions: string[] = []) {
  renderPanel({
    title,
    subtitle: "Command failed",
    details: [line("error", message, "danger")],
    actions,
    tone: "danger",
  });
}

export function normalizeDetails(
  details: DetailLine[] | Array<[string, string]>,
): DetailLine[] {
  return details.map((detail) =>
    Array.isArray(detail) ? line(detail[0], detail[1]) : detail,
  );
}

export async function promptInitSetupWizard(
  props: InitSetupWizardProps,
): Promise<InitWizardResult> {
  const instance = render(<InitSetupWizard {...props} />);
  return (await instance.waitUntilExit()) as InitWizardResult;
}

function InitSetupWizard({
  workflows,
  integrations,
  defaultWorkflow,
}: InitSetupWizardProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const defaultWorkflowIndex = Math.max(
    0,
    workflows.findIndex((workflow) => workflow.value === defaultWorkflow),
  );
  const [step, setStep] = React.useState<WizardStep>("workflow");
  const [workflowIndex, setWorkflowIndex] = React.useState(defaultWorkflowIndex);
  const [integrationIndex, setIntegrationIndex] = React.useState(0);
  const [error, setError] = React.useState<string | undefined>();
  const [selectedIntegrations, setSelectedIntegrations] = React.useState(
    integrations
      .filter((integration) => integration.defaultSelected)
      .map((integration) => integration.value),
  );
  const terminalColumns = Math.max(32, stdout.columns ?? 80);
  const panelWidth = Math.min(78, Math.max(32, terminalColumns - 2));
  const selectedWorkflow = workflows[workflowIndex] ?? workflows[0];

  function moveCursor(delta: number) {
    setError(undefined);
    if (step === "workflow") {
      setWorkflowIndex((index) => wrapIndex(index + delta, workflows.length));
      return;
    }

    setIntegrationIndex((index) => wrapIndex(index + delta, integrations.length));
  }

  function toggleIntegration(index: number) {
    const integration = integrations[index];
    if (!integration) {
      return;
    }

    setError(undefined);
    setSelectedIntegrations((selected) =>
      selected.includes(integration.value)
        ? selected.filter((value) => value !== integration.value)
        : [...selected, integration.value],
    );
  }

  function finish() {
    if (selectedIntegrations.length === 0) {
      setError("Select at least one integration.");
      return;
    }

    exit({
      workflow: selectedWorkflow.value,
      integrations: integrations
        .filter((integration) => selectedIntegrations.includes(integration.value))
        .map((integration) => integration.value),
    });
  }

  useInput((input, key) => {
    const normalizedInput = input.toLowerCase();

    if (key.upArrow || normalizedInput === "k") {
      moveCursor(-1);
      return;
    }

    if (key.downArrow || normalizedInput === "j") {
      moveCursor(1);
      return;
    }

    if (key.escape || key.leftArrow) {
      setError(undefined);
      if (step === "integrations") {
        setStep("workflow");
        return;
      }

      exit(new Error("Setup cancelled."));
      return;
    }

    if (step === "workflow") {
      const numericIndex = Number(input) - 1;
      if (Number.isInteger(numericIndex) && workflows[numericIndex]) {
        setWorkflowIndex(numericIndex);
        setStep("integrations");
        return;
      }

      if (key.return || input === " " || key.rightArrow || key.tab) {
        setStep("integrations");
      }
      return;
    }

    const numericIndex = Number(input) - 1;
    if (Number.isInteger(numericIndex) && integrations[numericIndex]) {
      toggleIntegration(numericIndex);
      return;
    }

    if (normalizedInput === "a") {
      setError(undefined);
      setSelectedIntegrations(integrations.map((integration) => integration.value));
      return;
    }

    if (normalizedInput === "n") {
      setError(undefined);
      setSelectedIntegrations([]);
      return;
    }

    if (input === " ") {
      toggleIntegration(integrationIndex);
      return;
    }

    if (key.return || key.rightArrow || key.tab) {
      finish();
    }
  });

  return (
    <Box flexDirection="column" paddingY={1}>
      <Logo subtitle="Core init wizard" />
      <Box
        marginTop={1}
        borderStyle="classic"
        borderColor={amber.base}
        flexDirection="column"
        paddingX={1}
        paddingY={1}
        width={panelWidth}
      >
        <WizardHeader
          step={step}
          workflowLabel={selectedWorkflow?.label ?? "Select workflow"}
          selectedCount={selectedIntegrations.length}
          totalCount={integrations.length}
        />
        {step === "workflow" ? (
          <WizardWorkflowStep
            workflows={workflows}
            selectedIndex={workflowIndex}
          />
        ) : (
          <WizardIntegrationStep
            integrations={integrations}
            selectedValues={selectedIntegrations}
            selectedIndex={integrationIndex}
          />
        )}
        {error ? (
          <Box marginTop={1}>
            <Text color="redBright">{error}</Text>
          </Box>
        ) : null}
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">
            Move: up/down or j/k  Select: space  Continue: enter  Back: esc
          </Text>
          {step === "integrations" ? (
            <Text color="gray">Shortcuts: a selects all, n clears all</Text>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}

function WizardHeader({
  step,
  workflowLabel,
  selectedCount,
  totalCount,
}: {
  step: WizardStep;
  workflowLabel: string;
  selectedCount: number;
  totalCount: number;
}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text color={step === "workflow" ? amber.bright : amber.soft} bold>
          {step === "workflow" ? "[1]" : "[x]"} Workflow
        </Text>
        <Text color="gray"> {"->"} </Text>
        <Text color={step === "integrations" ? amber.bright : "gray"} bold>
          [2] Integrations
        </Text>
      </Text>
      <Text color="white" bold>
        {step === "workflow" ? "Choose your setup flow" : "Choose integrations"}
      </Text>
      <Text color="gray">
        Workflow: {workflowLabel} | Integrations: {selectedCount}/{totalCount}
      </Text>
    </Box>
  );
}

function WizardWorkflowStep({
  workflows,
  selectedIndex,
}: {
  workflows: InitWizardWorkflowOption[];
  selectedIndex: number;
}) {
  return (
    <Box flexDirection="column">
      {workflows.map((workflow, index) => (
        <WizardOption
          key={workflow.value}
          index={index}
          active={index === selectedIndex}
          selected={index === selectedIndex}
          marker={index === selectedIndex ? "(*)" : "( )"}
          label={workflow.label}
          description={workflow.description}
          tag={workflow.tag}
          color={amber.bright}
        />
      ))}
    </Box>
  );
}

function WizardIntegrationStep({
  integrations,
  selectedValues,
  selectedIndex,
}: {
  integrations: InitWizardIntegrationOption[];
  selectedValues: string[];
  selectedIndex: number;
}) {
  return (
    <Box flexDirection="column">
      {integrations.map((integration, index) => (
        <WizardOption
          key={integration.value}
          index={index}
          active={index === selectedIndex}
          selected={selectedValues.includes(integration.value)}
          marker={selectedValues.includes(integration.value) ? "[x]" : "[ ]"}
          label={integration.label}
          description={integration.description}
          tag={integration.tag}
          color={amber.bright}
        />
      ))}
    </Box>
  );
}

function WizardOption({
  index,
  active,
  selected,
  marker,
  label,
  description,
  tag,
  color,
}: {
  index: number;
  active: boolean;
  selected: boolean;
  marker: string;
  label: string;
  description: string;
  tag?: string;
  color: string;
}) {
  const labelColor = active || selected ? color : "white";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text color={active ? color : "gray"}>{active ? ">" : " "} </Text>
        <Text color={selected ? color : "gray"}>{marker} </Text>
        <Text color={labelColor} bold={active}>
          {index + 1}. {label}
        </Text>
        {tag ? <Text color="yellowBright"> {tag}</Text> : null}
      </Text>
      <Text color="gray">     {description}</Text>
    </Box>
  );
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) {
    return 0;
  }

  return (index + length) % length;
}
