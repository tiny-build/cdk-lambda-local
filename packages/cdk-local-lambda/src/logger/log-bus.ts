import { EventEmitter } from "node:events";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogEntry = {
	level: LogLevel;
	source: "framework" | "lambda";
	lambdaName?: string;
	requestId?: string;
	msg: string;
	time: number;
	data?: Record<string, unknown>;
};

type LogBusEvents = {
	log: [LogEntry];
};

export class LogBus extends EventEmitter<LogBusEvents> {
	emit(entry: Omit<LogEntry, "time">): boolean;
	emit(event: string, ...args: unknown[]): boolean;
	emit(entryOrEvent: Omit<LogEntry, "time"> | string, ...args: unknown[]): boolean {
		if (typeof entryOrEvent === "string") {
			return super.emit(entryOrEvent as "log", ...(args as [LogEntry]));
		}
		return super.emit("log", { ...entryOrEvent, time: Date.now() });
	}
}
