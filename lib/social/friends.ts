export function canonicalFriendPair(first: string, second: string) {
  return [first, second].sort() as [string, string];
}

export function normalizeShareCode(value: string) {
  return value.trim().toUpperCase();
}
