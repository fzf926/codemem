export function parseArgs(argv: string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      values.set(key, "true");
      continue;
    }
    values.set(key, next);
    index += 1;
  }
  return values;
}

export function getRequiredArg(args: Map<string, string>, key: string): string {
  const value = args.get(key);
  if (!value) {
    throw new Error(`--${key} is required`);
  }
  return value;
}
