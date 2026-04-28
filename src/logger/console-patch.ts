import { AsyncLocalStorage } from "node:async_hooks";
import { format, inspect } from "node:util";
import type { LogBus, LogLevel } from "./log-bus.js";

interface LambdaLogContext {
	lambdaName: string;
	requestId: string;
}

export const lambdaLogStore = new AsyncLocalStorage<LambdaLogContext>();

interface PatchOptions {
	lambdaName: string;
	requestId: string;
	bus: LogBus;
}

interface PatchHandle {
	restore: () => void;
}

function formatArgs(args: unknown[]): string {
	if (args.length === 0) return "";
	const formatted = args.map((a) => {
		if (a instanceof Error) {
			return a.stack ?? `${a.name}: ${a.message}`;
		}
		if (typeof a === "string") return a;
		return inspect(a, { depth: 4, breakLength: 120 });
	});
	if (typeof args[0] === "string") {
		return format(args[0], ...formatted.slice(1));
	}
	return formatted.join(" ");
}

const CONSOLE_LEVEL_MAP: Record<string, LogLevel> = {
	log: "info",
	info: "info",
	debug: "debug",
	warn: "warn",
	error: "error",
	trace: "trace",
};

export function patchConsole(opts: PatchOptions): PatchHandle {
	const originals: Record<string, (...args: unknown[]) => void> = {};
	const fallbackCtx: LambdaLogContext = {
		lambdaName: opts.lambdaName,
		requestId: opts.requestId,
	};

	for (const [method, level] of Object.entries(CONSOLE_LEVEL_MAP)) {
		const key = method as keyof Console;
		originals[method] = console[key] as (...args: unknown[]) => void;

		(console[key] as (...args: unknown[]) => void) = (...args: unknown[]) => {
			const ctx = lambdaLogStore.getStore() ?? fallbackCtx;
			const msg = formatArgs(args);
			opts.bus.emit({
				level,
				source: "lambda",
				lambdaName: ctx.lambdaName,
				requestId: ctx.requestId,
				msg,
			});
		};
	}

	return {
		restore: () => {
			for (const [method, original] of Object.entries(originals)) {
				(console[method as keyof Console] as (...args: unknown[]) => void) = original;
			}
		},
	};
}
