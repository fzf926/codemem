import { spawnSync } from "node:child_process";

export function fail(message: string): never {
  throw new Error(message);
}

export function run(command: string, args: string[], options: Record<string, unknown> = {}): void {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    fail(`Command failed: ${command} ${args.join(" ")}`);
  }
}

export function runTar(args: string[]): void {
  run("env", [
    "-i",
    `PATH=${process.env.PATH || ""}`,
    `HOME=${process.env.HOME || ""}`,
    "LANG=C",
    "LC_ALL=C",
    "tar",
    ...args,
  ]);
}
