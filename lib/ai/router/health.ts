import type { ProviderHealthSnapshot } from "./types";

const cooldownMs = 30_000;
const health = new Map<string, ProviderHealthSnapshot>();

function get(provider: string): ProviderHealthSnapshot {
  return health.get(provider) ?? { provider, lastSuccessAt: null, consecutiveFailures: 0, cooldownUntil: null, unavailable: false };
}

export function providerAvailable(provider: string, now = Date.now()) {
  const snapshot = get(provider);
  return !snapshot.unavailable && (!snapshot.cooldownUntil || snapshot.cooldownUntil <= now);
}

export function recordProviderSuccess(provider: string, now = Date.now()) {
  health.set(provider, { provider, lastSuccessAt: now, consecutiveFailures: 0, cooldownUntil: null, unavailable: false });
}

export function recordProviderFailure(provider: string, retryable: boolean, now = Date.now()) {
  const previous = get(provider);
  const failures = previous.consecutiveFailures + 1;
  health.set(provider, {
    ...previous,
    consecutiveFailures: failures,
    cooldownUntil: retryable ? now + cooldownMs : null,
    unavailable: !retryable,
  });
}

export function getProviderHealth(): ProviderHealthSnapshot[] {
  return [...health.values()].map((snapshot) => ({ ...snapshot }));
}

export function resetProviderHealth() {
  health.clear();
}
