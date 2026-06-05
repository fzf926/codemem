import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
