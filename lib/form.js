/**
 * Reading values out of a panel form submission.
 *
 * The app serializes a submitted form as
 * `{ values: { "data.<field>": "<text>" } }` — the binding path is used
 * verbatim as the key, so it keeps its literal `data.` prefix. Older and
 * newer app builds have been seen nesting the same pairs differently, so the
 * lookup searches breadth-first for either spelling instead of assuming one
 * envelope. Being permissive here only affects which string is read; the name
 * is validated separately.
 * @module form
 */

/** How deep to search before giving up. */
const MAX_DEPTH = 6

/**
 * Find the first string (or stringifiable primitive) stored under any of
 * `keys`, either as-is or behind the literal `data.` prefix.
 * @param {unknown} value Form submission payload.
 * @param {readonly string[]} keys Candidate field names, most specific first.
 * @param {number} [depth] Internal recursion depth.
 * @returns {string | undefined} The value, or `undefined` when absent.
 */
export function readField(value, keys, depth = 0) {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return undefined
  /** @type {Record<string, unknown>} */
  const record = /** @type {Record<string, unknown>} */ (value)
  for (const key of keys) {
    for (const candidate of [key, `data.${key}`]) {
      const found = record[candidate]
      if (typeof found === 'string') return found
      if (typeof found === 'boolean' || typeof found === 'number') return String(found)
    }
  }
  for (const child of Object.values(record)) {
    if (child !== null && typeof child === 'object') {
      const found = readField(child, keys, depth + 1)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/**
 * Read a checkbox-like field as a boolean.
 * @param {unknown} value Form submission payload.
 * @param {readonly string[]} keys
 * @returns {boolean | undefined} `undefined` when the field is absent.
 */
export function readFlag(value, keys) {
  const raw = readField(value, keys)
  if (raw === undefined) return undefined
  return raw === 'true'
}
