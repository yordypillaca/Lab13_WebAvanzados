const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  blockedUntil?: number;
}

const attempts = new Map<string, AttemptRecord>();

export function isBlocked(email: string): {
  blocked: boolean;
  remainingMs?: number;
} {
  const record = attempts.get(email.toLowerCase());

  if (!record?.blockedUntil) {
    return { blocked: false };
  }

  if (Date.now() < record.blockedUntil) {
    return {
      blocked: true,
      remainingMs: record.blockedUntil - Date.now(),
    };
  }

  attempts.delete(email.toLowerCase());
  return { blocked: false };
}

export function recordFailedAttempt(email: string): {
  blocked: boolean;
  attemptsLeft?: number;
} {
  const key = email.toLowerCase();
  const record = attempts.get(key) ?? { count: 0 };

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    attempts.set(key, record);
    return { blocked: true };
  }

  attempts.set(key, record);
  return { blocked: false, attemptsLeft: MAX_ATTEMPTS - record.count };
}

export function resetAttempts(email: string): void {
  attempts.delete(email.toLowerCase());
}
