import { useEffect, useState } from "react";
import type { LogBus, LogEntry } from "../../logger/log-bus";

const MAX_ENTRIES = 200;

export function useLogFeed(bus: LogBus): LogEntry[] {
	const [entries, setEntries] = useState<LogEntry[]>([]);

	useEffect(() => {
		const handler = (entry: LogEntry): void => {
			setEntries((prev) => {
				const next = [...prev, entry];
				return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
			});
		};
		bus.on("log", handler);
		return () => {
			bus.off("log", handler);
		};
	}, [bus]);

	return entries;
}
