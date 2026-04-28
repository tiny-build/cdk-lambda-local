import { Box, Text, useInput, useStdout } from "ink";
import React, { useEffect, useState } from "react";
import type { LogBus } from "../../logger/log-bus.js";
import type { LocalManifest } from "../../types.js";
import { useLogFeed } from "../hooks/useLogFeed.js";
import { useTabState } from "../hooks/useTabState.js";
import { HelpModal } from "./HelpModal.js";
import { TabLogs } from "./TabLogs.js";
import { TabRoutes } from "./TabRoutes.js";

interface ReloadInfo {
	file: string;
	count: number;
	time: string;
}

interface Props {
	manifest: LocalManifest;
	port: number;
	bus: LogBus;
	onRestart?: () => void;
	onQuit: () => void;
}

const TABS = ["Routes", "Logs"] as const;

// Rows reserved for: header (3) + tab bar (3) + footer (3) + log status line (2)
const CHROME_ROWS = 11;

export function DevDashboard({
	manifest,
	port,
	bus,
	onRestart,
	onQuit,
}: Props): React.ReactElement {
	const { stdout } = useStdout();
	const [activeTab] = useTabState(TABS);
	const entries = useLogFeed(bus);
	const [lastReload, setLastReload] = useState<ReloadInfo | null>(null);
	const [showHelp, setShowHelp] = useState(false);
	const [terminalRows, setTerminalRows] = useState(stdout?.rows ?? 30);

	useEffect(() => {
		if (!stdout) return;
		const handler = (): void => setTerminalRows(stdout.rows ?? 30);
		stdout.on("resize", handler);
		return () => {
			stdout.off("resize", handler);
		};
	}, [stdout]);

	useEffect(() => {
		const handler = (_path: string, count: number): void => {
			setLastReload({
				file: _path.split("/").pop() ?? _path,
				count,
				time: new Date().toTimeString().slice(0, 8),
			});
		};
		bus.on("reload" as never, handler as never);
		return () => {
			bus.off("reload" as never, handler as never);
		};
	}, [bus]);

	useInput((input, key) => {
		if (input === "?") {
			setShowHelp((prev) => !prev);
			return;
		}
		if (showHelp && (key.escape || input === "q")) {
			setShowHelp(false);
			return;
		}
		if (input === "q" || (key.ctrl && input === "c")) {
			onQuit();
			return;
		}
		if (input === "r") onRestart?.();
	});

	const routes = Object.values(manifest.routes);
	const routeCount = routes.length;
	const visibleLogRows = Math.max(5, terminalRows - CHROME_ROWS);

	return (
		<Box flexDirection="column" height={terminalRows}>
			{/* Header — fixed height (1 content row + 2 border rows) */}
			<Box paddingX={1} borderStyle="single" borderColor="green" height={3} flexShrink={0}>
				<Text color="green" bold>
					{"● cdk-local "}
				</Text>
				<Text>{`http://localhost:${port}`}</Text>
				<Text color="gray">{"  stage: "}</Text>
				<Text color="cyan">{manifest.stage}</Text>
				<Text color="gray">{`  ${routeCount} routes`}</Text>
			</Box>

			{/* Tab bar — fixed height */}
			<Box paddingX={1} gap={2} borderStyle="single" borderColor="gray" height={3} flexShrink={0}>
				{TABS.map((tab) => (
					<Text
						key={tab}
						color={activeTab === tab ? "cyan" : "gray"}
						bold={activeTab === tab}
						dimColor={activeTab !== tab}
					>
						{`[${tab}]`}
					</Text>
				))}
			</Box>

			{/* Tab content or help modal — flex-grows to fill remaining space */}
			<Box flexGrow={1} flexDirection="column" overflow="hidden">
				{showHelp ? (
					<HelpModal activeTab={activeTab} />
				) : activeTab === "Routes" ? (
					<TabRoutes routes={routes} lastReload={lastReload} />
				) : (
					<TabLogs entries={entries} visibleRows={visibleLogRows} />
				)}
			</Box>

			{/* Footer — fixed height */}
			<Box paddingX={1} borderStyle="single" borderColor="gray" height={3} flexShrink={0}>
				<Text color="gray" dimColor>
					{activeTab === "Logs"
						? "[Tab] tabs  [j/k] line  [d/u] page  [g/G] top/bot  [f] follow  [s] src  [l] level  [?] help  [q] quit"
						: "[Tab] switch tab  [r] reload notice  [?] help  [q] quit"}
				</Text>
			</Box>
		</Box>
	);
}
