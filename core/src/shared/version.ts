function splitVersion(version: string): string[] {
  return version.trim().split(/[.+-]/).filter(Boolean);
}

function comparePart(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);

  if (leftNumeric && rightNumeric) {
    const diff = Number(left) - Number(right);
    return diff === 0 ? 0 : diff > 0 ? 1 : -1;
  }

  const diff = left.localeCompare(right);
  return diff === 0 ? 0 : diff > 0 ? 1 : -1;
}

export function compareVersions(left: string, right: string): number {
  const leftParts = splitVersion(left);
  const rightParts = splitVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] || "0";
    const rightPart = rightParts[index] || "0";
    const diff = comparePart(leftPart, rightPart);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export function parseMinVersion(range: string): string | null {
  const match = /^>=\s*([0-9A-Za-z.+-]+)$/.exec(range.trim());
  return match ? match[1] : null;
}

export function satisfiesMinVersion(current: string, range: string): boolean {
  const minVersion = parseMinVersion(range);
  if (!minVersion) {
    return false;
  }
  return compareVersions(current, minVersion) >= 0;
}
