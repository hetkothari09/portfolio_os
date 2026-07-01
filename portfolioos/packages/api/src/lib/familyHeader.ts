import type { Request } from 'express';

/**
 * Extract the "viewing as family" selector from a request.
 *
 * Frontend sends the caller's chosen family via the `X-Viewing-As-Family`
 * header (set by the Header switcher / familyScope Zustand store).
 * Query-string fallback (`?familyId=...`) is supported for endpoints
 * users may hit directly (curl, sharable links) and for tests.
 *
 * Returns the token as a string, or `undefined` for the personal view.
 * Only shape is validated here — actual membership is enforced in
 * `getEffectiveScope`, which throws Forbidden if the caller isn't an
 * ACTIVE member of the family.
 */
export function parseFamilyId(req: Request): string | undefined {
  const header = req.header('x-viewing-as-family');
  const raw = header ?? (req.query.familyId as string | undefined);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return undefined;
  return trimmed;
}
