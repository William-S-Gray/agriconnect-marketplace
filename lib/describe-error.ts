/**
 * Turns a thrown value into a single readable line, without leaking secrets.
 *
 * Two problems this solves, both hit during a real migration:
 *
 *   1. Node's AggregateError — which pg throws when every resolved address
 *      fails — has an EMPTY `.message`. Logging `err.message` printed
 *      "Migration failed:" and nothing else, hiding six underlying ETIMEDOUT
 *      entries. The causes live on `.errors`, so they have to be unwrapped.
 *   2. A driver error can carry the connection string, including the password.
 *      Logging the whole object would put credentials in CI output, so every
 *      line is scrubbed before it is returned.
 */

/** Redacts credentials in postgres:// URLs and standalone password fields. */
export function redactSecrets(text: string): string {
  return text
    // postgresql://user:password@host -> postgresql://user:***@host
    .replace(/\b(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/gi, '$1***@')
    // password=... / password: "..." in assorted formats
    .replace(/\b(password\s*[=:]\s*)(['"]?)[^\s,'"}]+\2/gi, '$1***');
}

function describeOne(error: unknown): string {
  if (!(error instanceof Error)) {
    return typeof error === 'string' ? error : 'unknown error';
  }

  const code = (error as NodeJS.ErrnoException).code;
  const message = error.message?.trim();

  if (message && code) return `${code}: ${message}`;
  if (message) return message;
  if (code) return String(code);
  return error.name || 'unknown error';
}

/**
 * Produces a one-line description, expanding aggregate causes.
 *
 * @param error   the thrown value
 * @param maxSubs how many underlying causes to include before summarising
 */
export function describeError(error: unknown, maxSubs = 3): string {
  const parts: string[] = [describeOne(error)];

  // AggregateError.errors holds the real failures; `.message` is usually blank.
  const subs = (error as { errors?: unknown[] })?.errors;
  if (Array.isArray(subs) && subs.length > 0) {
    // Group by errno code, not by message. The real failure produced six
    // entries whose messages all differed (one per resolved address) but shared
    // two codes — grouping on the message would have collapsed nothing. One
    // concrete example per code plus a count is the useful summary.
    const seen = new Map<string, { example: string; count: number }>();
    for (const sub of subs) {
      const code = (sub as NodeJS.ErrnoException)?.code;
      const described = describeOne(sub);
      const key = code ?? described;
      const entry = seen.get(key);
      if (entry) entry.count += 1;
      else seen.set(key, { example: described, count: 1 });
    }

    const shown = [...seen.values()]
      .slice(0, maxSubs)
      .map(({ example, count }) => (count > 1 ? `${example} (x${count})` : example));

    const hidden = seen.size - shown.length;
    if (hidden > 0) shown.push(`and ${hidden} more`);

    parts.push(`caused by: ${shown.join('; ')}`);
  }

  // A plain `cause` chain (non-aggregate) is worth one level too.
  const cause = (error as { cause?: unknown })?.cause;
  if (cause && !Array.isArray(subs)) {
    parts.push(`caused by: ${describeOne(cause)}`);
  }

  return redactSecrets(parts.join(' — '));
}

/**
 * Adds a hint for the failure modes that are environmental rather than a bug
 * in the migration itself, so the next person does not repeat the diagnosis.
 */
export function connectionHint(error: unknown): string | null {
  const text = describeError(error);
  if (/ETIMEDOUT|ENETUNREACH|ENOTFOUND|ECONNREFUSED/.test(text)) {
    return (
      'The database could not be reached. Check DATABASE_URL, and note that ' +
      'some networks cannot connect to every address a Neon endpoint resolves ' +
      'to — set DB_PINNED_HOST_IP to a reachable one if needed.'
    );
  }
  if (/password authentication failed|SASL/i.test(text)) {
    return 'Authentication failed. Check the credentials in DATABASE_URL.';
  }
  return null;
}
