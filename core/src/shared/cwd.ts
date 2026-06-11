import { resolve } from "node:path";

export function safeCurrentWorkingDir(fallback?: string): string {
  try {
    return process.cwd();
  } catch {
    if (fallback) {
      return resolve(fallback);
    }

    if (process.env.CODEMEM_FALLBACK_CWD) {
      return resolve(process.env.CODEMEM_FALLBACK_CWD);
    }

    if (process.env.HOME) {
      return resolve(process.env.HOME);
    }

    return resolve("/");
  }
}
