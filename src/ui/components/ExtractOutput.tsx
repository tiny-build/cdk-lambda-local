import { Box, Text } from "ink";
import React from "react";
import type { LocalManifest } from "../../types.js";

interface Props {
	manifest: LocalManifest;
	outPath?: string;
}

export function ExtractOutput({ manifest, outPath }: Props): React.ReactElement {
	const routeCount = Object.keys(manifest.routes).length;
	const lambdaCount = Object.keys(manifest.lambdas).length;
	return (
		<Box flexDirection="column" paddingX={1}>
			<Text color="green" bold>
				{"✓ manifest extracted"}
			</Text>
			<Text>
				{"  routes:  "}
				<Text color="cyan">{routeCount}</Text>
			</Text>
			<Text>
				{"  lambdas: "}
				<Text color="cyan">{lambdaCount}</Text>
			</Text>
			<Text>
				{"  stack:   "}
				<Text color="cyan">{manifest.stack}</Text>
			</Text>
			<Text>
				{"  stage:   "}
				<Text color="cyan">{manifest.stage}</Text>
			</Text>
			{outPath && (
				<Text color="gray">
					{"  wrote → "}
					{outPath}
				</Text>
			)}
		</Box>
	);
}
