/** Applied by chokidar; {@link ../server/hot-reloader} exempts `manifestPath` from these rules. */
export const WATCHER_IGNORED_PATTERNS: readonly RegExp[] = [
  /(^|[\\/])node_modules([\\/]|$)/,
  /(^|[\\/])\.git([\\/]|$)/,
  /\.map$/,
  /\.generated\./
];
