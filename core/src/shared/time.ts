export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function nowToken(): string {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}
