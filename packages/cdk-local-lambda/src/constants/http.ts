const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options'
] as const;

export type SupportedHttpMethod = (typeof HTTP_METHODS)[number];

export const SUPPORTED_HTTP_METHODS: ReadonlySet<SupportedHttpMethod> = new Set(
  HTTP_METHODS
);
