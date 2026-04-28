import { Box, Text, useInput } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, LogLevel } from "../../logger/log-bus.js";

interface Props {
	entries: LogEntry[];
	visibleRows: number;
}

const LEVEL_COLORS: Record<LogLevel, string> = {
	trace: "gray",
	debug: "cyan",
	info: "green",
	warn: "yellow",
	error: "red",
	fatal: "red",
};

const SOURCE_FILTERS = ["all", "framework", "lambda"] as const;
type SourceFilter = (typeof SOURCE_FILTERS)[number];

const LEVEL_FILTERS = ["all", "debug", "info", "warn", "error"] as const;
type LevelFilter = (typeof LEVEL_FILTERS)[number];

const LEVEL_ORDER: Record<string, number> = {
	trace: 0,
	debug: 1,
	info: 2,
	warn: 3,
	error: 4,
	fatal: 5,
};

export function TabLogs({ entries, visibleRows }: Props): React.ReactElement {
	const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
	const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
	// scrollOffset: how many entries from the bottom we are scrolled up
	// 0 = bottom (newest visible), max = top (oldest visible)
	const [scrollOffset, setScrollOffset] = useState(0);
	const [follow, setFollow] = useState(true);

	const filtered = useMemo(() => {
		return entries.filter((e) => {
			if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
			if (levelFilter !== "all" && LEVEL_ORDER[e.level]! < LEVEL_ORDER[levelFilter]!) return false;
			return true;
		});
	}, [entries, sourceFilter, levelFilter]);

	const VISIBLE = Math.max(3, visibleRows);
	const maxOffset = Math.max(0, filtered.length - VISIBLE);

	// Auto-stick to bottom when in follow mode
	const prevLenRef = useRef(filtered.length);
	useEffect(() => {
		if (follow && filtered.length !== prevLenRef.current) {
			setScrollOffset(0);
		}
		prevLenRef.current = filtered.length;
	}, [filtered.length, follow]);

	useInput((input, key) => {
		// Source filter cycle
		if (input === "s") {
			setSourceFilter((prev) => {
				const idx = SOURCE_FILTERS.indexOf(prev);
				return SOURCE_FILTERS[(idx + 1) % SOURCE_FILTERS.length]!;
			});
			setScrollOffset(0);
			return;
		}
		// Level filter cycle
		if (input === "l") {
			setLevelFilter((prev) => {
				const idx = LEVEL_FILTERS.indexOf(prev);
				return LEVEL_FILTERS[(idx + 1) % LEVEL_FILTERS.length]!;
			});
			setScrollOffset(0);
			return;
		}
		// Follow toggle
		if (input === "f") {
			setFollow((prev) => {
				const next = !prev;
				if (next) setScrollOffset(0);
				return next;
			});
			return;
		}
		// Jump to top
		if (input === "g") {
			setFollow(false);
			setScrollOffset(maxOffset);
			return;
		}
		// Jump to bottom
		if (input === "G") {
			setFollow(true);
			setScrollOffset(0);
			return;
		}
		// Page up
		if (input === "u" || (key.ctrl && input === "u") || key.pageUp) {
			setFollow(false);
			setScrollOffset((o) => Math.min(maxOffset, o + Math.floor(VISIBLE / 2)));
			return;
		}
		// Page down
		if (input === "d" || (key.ctrl && input === "d") || key.pageDown || input === " ") {
			setScrollOffset((o) => {
				const next = Math.max(0, o - Math.floor(VISIBLE / 2));
				if (next === 0) setFollow(true);
				return next;
			});
			return;
		}
		// Line up
		if (input === "k" || key.upArrow) {
			setFollow(false);
			setScrollOffset((o) => Math.min(maxOffset, o + 1));
			return;
		}
		// Line down
		if (input === "j" || key.downArrow) {
			setScrollOffset((o) => {
				const next = Math.max(0, o - 1);
				if (next === 0) setFollow(true);
				return next;
			});
			return;
		}
	});

	// Recompute clamped offset (in case filter shrunk the list)
	const clampedOffset = Math.min(scrollOffset, maxOffset);
	const sliceEnd = filtered.length - clampedOffset;
	const sliceStart = Math.max(0, sliceEnd - VISIBLE);
	const visible = filtered.slice(sliceStart, sliceEnd);

	// Pad with empty rows if we have fewer entries than rows so the layout is stable
	const paddingRows = Math.max(0, VISIBLE - visible.length);

	// Scrollbar geometry
	const scrollbar = computeScrollbar({
		total: filtered.length,
		viewport: VISIBLE,
		offsetFromBottom: clampedOffset,
	});

	return (
		<Box flexDirection="column" paddingX={1} flexGrow={1}>
			<Box flexDirection="row" flexGrow={1}>
				{/* Log lines */}
				<Box flexDirection="column" flexGrow={1}>
					{visible.length === 0 && filtered.length === 0 && (
						<Text dimColor>{"  (no log entries match current filters)"}</Text>
					)}
					{visible.map((e, i) => {
						const ts = new Date(e.time).toTimeString().slice(0, 8);
						const isLambda = e.source === "lambda";
						const entryKey = `${e.time}-${e.source}-${sliceStart + i}`;
						return (
							<Box key={entryKey}>
								<Text color="gray" dimColor>
									{ts}
									{"  "}
								</Text>
								{isLambda ? (
									<Text color="magenta" bold>
										{"[λ "}
										{e.lambdaName ?? "?"}
										{"] "}
									</Text>
								) : (
									<Text color="gray" dimColor>
										{"[cdk-local] "}
									</Text>
								)}
								{e.requestId && (
									<Text color="gray" dimColor>
										{e.requestId.slice(0, 8)}{" "}
									</Text>
								)}
								<Text color={LEVEL_COLORS[e.level]} bold={e.level === "fatal"}>
									{e.level.toUpperCase().padEnd(5)}{" "}
								</Text>
								<Text>{e.msg}</Text>
							</Box>
						);
					})}
					{Array.from({ length: paddingRows }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: stable padding rows
						<Text key={`pad-${i}`}> </Text>
					))}
				</Box>
				{/* Scrollbar */}
				<Box flexDirection="column" marginLeft={1} width={1}>
					{scrollbar.map((kind, i) => (
						<Text
							// biome-ignore lint/suspicious/noArrayIndexKey: scrollbar cells map 1:1 to viewport rows
							key={`sb-${i}`}
							color={kind === "thumb" ? "cyan" : "gray"}
							dimColor={kind !== "thumb"}
						>
							{kind === "thumb" ? "█" : "│"}
						</Text>
					))}
				</Box>
			</Box>

			{/* Status line */}
			<Box marginTop={1}>
				<Text color="gray">
					{filtered.length === 0
						? "0 entries"
						: `${sliceStart + 1}–${sliceEnd} of ${filtered.length}`}
					{"  "}
				</Text>
				<Text color="gray">
					{"source: "}
					<Text color="cyan">{sourceFilter}</Text>
					{"  level: "}
					<Text color="cyan">{levelFilter}</Text>
					{"  "}
				</Text>
				<Text color={follow ? "green" : "yellow"} bold>
					{follow ? "● follow" : "◌ paused"}
				</Text>
			</Box>
		</Box>
	);
}

type ScrollbarCell = "thumb" | "track";

function computeScrollbar(opts: {
	total: number;
	viewport: number;
	offsetFromBottom: number;
}): ScrollbarCell[] {
	const { total, viewport, offsetFromBottom } = opts;
	if (total <= viewport) {
		// Entire content visible — show full thumb
		return Array.from({ length: viewport }, () => "thumb");
	}
	const thumbHeight = Math.max(1, Math.floor((viewport * viewport) / total));
	const maxOffset = total - viewport;
	const linesAbove = maxOffset - offsetFromBottom; // number of off-screen lines above viewport
	const trackSpace = viewport - thumbHeight;
	const thumbStart = Math.round((linesAbove / maxOffset) * trackSpace);
	const cells: ScrollbarCell[] = [];
	for (let i = 0; i < viewport; i++) {
		cells.push(i >= thumbStart && i < thumbStart + thumbHeight ? "thumb" : "track");
	}
	return cells;
}
