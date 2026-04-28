import { Box, Text } from "ink";
import React from "react";

interface Props {
	activeTab: "Routes" | "Logs";
}

interface Binding {
	keys: string;
	desc: string;
}

const GLOBAL: Binding[] = [
	{ keys: "Tab", desc: "switch tab" },
	{ keys: "?", desc: "toggle this help" },
	{ keys: "r", desc: "manual reload notice" },
	{ keys: "q  /  Ctrl+C", desc: "quit (stops server)" },
];

const LOGS: Binding[] = [
	{ keys: "j  /  ↓", desc: "scroll down 1 line" },
	{ keys: "k  /  ↑", desc: "scroll up 1 line" },
	{ keys: "d  /  Space", desc: "page down" },
	{ keys: "u", desc: "page up" },
	{ keys: "g", desc: "jump to top (oldest)" },
	{ keys: "G", desc: "jump to bottom (newest)" },
	{ keys: "f", desc: "toggle follow mode" },
	{ keys: "s", desc: "cycle source filter" },
	{ keys: "l", desc: "cycle level filter" },
];

const ROUTES: Binding[] = [{ keys: "—", desc: "no view-specific bindings" }];

export function HelpModal({ activeTab }: Props): React.ReactElement {
	const tabBindings = activeTab === "Logs" ? LOGS : ROUTES;
	const tabTitle = activeTab === "Logs" ? "Logs" : "Routes";
	return (
		<Box
			flexDirection="column"
			paddingX={2}
			paddingY={1}
			borderStyle="round"
			borderColor="cyan"
			flexGrow={1}
		>
			<Text bold color="cyan">
				{"  cdk-local — keyboard shortcuts"}
			</Text>
			<Box marginTop={1} flexDirection="column">
				<Text bold>{"Global"}</Text>
				{GLOBAL.map((b) => (
					<BindingRow key={b.keys} binding={b} />
				))}
			</Box>
			<Box marginTop={1} flexDirection="column">
				<Text bold>{tabTitle}</Text>
				{tabBindings.map((b) => (
					<BindingRow key={b.keys} binding={b} />
				))}
			</Box>
			<Box marginTop={1}>
				<Text dimColor>{"Press ? or Esc to close."}</Text>
			</Box>
		</Box>
	);
}

function BindingRow({ binding }: { binding: Binding }): React.ReactElement {
	return (
		<Box>
			<Box width={18}>
				<Text color="cyan">{binding.keys}</Text>
			</Box>
			<Text>{binding.desc}</Text>
		</Box>
	);
}
