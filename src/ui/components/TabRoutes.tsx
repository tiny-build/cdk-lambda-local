import { Box, Text } from "ink";
import React from "react";
import type { LocalRoute } from "../../types.js";

interface Props {
	routes: readonly LocalRoute[];
	lastReload?: { file: string; count: number; time: string } | null;
}

export function TabRoutes({ routes, lastReload }: Props): React.ReactElement {
	const methodColor: Record<string, string> = {
		GET: "green",
		POST: "yellow",
		PUT: "blue",
		PATCH: "cyan",
		DELETE: "red",
		HEAD: "gray",
		OPTIONS: "gray",
	};

	return (
		<Box flexDirection="column" paddingX={1}>
			{lastReload && (
				<Text color="cyan">
					{"↺ reloaded "}
					{lastReload.file}
					{" ("}
					{lastReload.count}
					{" cached) — "}
					{lastReload.time}
				</Text>
			)}
			<Box marginTop={1}>
				<Text bold color="gray">
					{"METHOD    PATH                          LAMBDA                    AUTHORIZER"}
				</Text>
			</Box>
			{routes.map((r) => (
				<Box key={`${r.method} ${r.path}`}>
					<Box width={10}>
						<Text color={methodColor[r.method] ?? "white"} bold>
							{r.method}
						</Text>
					</Box>
					<Box width={32}>
						<Text>{r.path}</Text>
					</Box>
					<Box width={26}>
						<Text color="cyan">{r.functionKey}</Text>
					</Box>
					<Box>
						<Text color="yellow">{r.authorizerKey ?? "—"}</Text>
					</Box>
				</Box>
			))}
		</Box>
	);
}
