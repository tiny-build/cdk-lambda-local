const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

/** Union of lowercase HTTP methods supported by the local server. */
export type SupportedHttpMethod = (typeof HTTP_METHODS)[number];

/** Set of all {@link SupportedHttpMethod} values, used to filter out unsupported methods from the manifest. */
export const SUPPORTED_HTTP_METHODS: ReadonlySet<SupportedHttpMethod> = new Set(HTTP_METHODS);
