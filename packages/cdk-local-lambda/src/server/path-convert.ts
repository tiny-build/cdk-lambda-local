const PLACEHOLDER_RE = /\{([^}]+)\}/g;

export function toExpressPath(apiPath: string): string {
  return apiPath.replace(PLACEHOLDER_RE, (_m, inner: string) => {
    if (inner === 'proxy+') return '*';
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(inner)) return `:${inner}`;
    throw new Error(
      `Unsupported path placeholder "{${inner}}" in "${apiPath}"`
    );
  });
}
