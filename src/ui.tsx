import React from "react";
import { Box, Text, render } from "ink";

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

const toneColor: Record<DetailTone, string | undefined> = {
  default: undefined,
  success: "green",
  warning: "yellow",
  danger: "red",
  muted: "gray",
};

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
      <Text color="cyanBright" bold>
        Varel
      </Text>
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
