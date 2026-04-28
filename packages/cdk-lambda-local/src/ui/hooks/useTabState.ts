import { useInput } from "ink";
import { useState } from "react";

export function useTabState<T extends string>(tabs: readonly T[]): [T, (t: T) => void] {
	const [active, setActive] = useState<T>(tabs[0]!);

	useInput((input, key) => {
		if (key.tab) {
			setActive((prev) => {
				const idx = tabs.indexOf(prev);
				return tabs[(idx + 1) % tabs.length]!;
			});
		}
	});

	return [active, setActive];
}
