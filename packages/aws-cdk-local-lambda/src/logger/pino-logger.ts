import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pino, { type Logger } from "pino";
import type { LogBus, LogEntry, LogLevel } from "./log-bus.js";

export interface LogConfig {
	logLevel: LogLevel;
	logOutput: "stdout" | "file";
	logFilePath?: string;
}

const PINO_LEVELS: Record<LogLevel, number> = {
	trace: 10,
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60,
};

export class PinoLogger {
	private readonly logger: Logger;
	private readonly unsubscribe: () => void;

	constructor(config: LogConfig, bus: LogBus) {
		if (config.logOutput === "file" && config.logFilePath) {
			mkdirSync(dirname(config.logFilePath), { recursive: true });
			this.logger = pino(
				{ level: config.logLevel },
				pino.destination({ dest: config.logFilePath, append: true, sync: false }),
			);
		} else {
			this.logger = pino({
				level: config.logLevel,
				transport: {
					target: "pino-pretty",
					options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
				},
			});
		}

		const handler = (entry: LogEntry): void => {
			const levelNum = PINO_LEVELS[entry.level];
			if (levelNum < PINO_LEVELS[config.logLevel]) return;
			const { msg, time, level, ...rest } = entry;
			void time;
			void level;
			this.logger[entry.level]({ ...rest }, msg);
		};

		bus.on("log", handler);
		this.unsubscribe = () => bus.off("log", handler);
	}

	destroy(): void {
		this.unsubscribe();
		this.logger.flush?.();
	}
}
