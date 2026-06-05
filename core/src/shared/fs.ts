import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function loadJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
