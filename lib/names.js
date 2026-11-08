/**
 * Variable names and the `DSH_VAR_` namespace.
 *
 * dsh-go exposes every variable to shell commands as `$DSH_VAR_<NAME>`. The
 * prefix belongs to the engine's managed `DSH_*` namespace, so a name is only
 * usable if the prefixed form is a legal POSIX shell identifier.
 * @module names
 */

/** Prefix the engine's shell environment reserves for plugin-contributed facts. */
export const PREFIX = 'DSH_VAR_'

/** Keys the engine owns; a contributor may not claim them. */
export const RESERVED = Object.freeze(
  new Set(['HOME', 'SHELL', 'SESSION_ID', 'PROFILE', 'PROFILE_DIR'].map((key) => `${PREFIX}${key}`)),
)

/** Uppercase letter first, then letters, digits and underscores. */
const NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/

/** Longest accepted name, excluding the prefix. */
export const MAX_NAME_LENGTH = 64

/**
 * Canonical form of a user-supplied name: trimmed and uppercased.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeName(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
}

/**
 * Validate a name in canonical form.
 * @param {string} name
 * @returns {'empty' | 'too-long' | 'bad-charset' | 'reserved' | null} `null` when valid.
 */
export function validateName(name) {
  if (name.length === 0) return 'empty'
  if (name.length > MAX_NAME_LENGTH) return 'too-long'
  if (!NAME_PATTERN.test(name)) return 'bad-charset'
  if (RESERVED.has(`${PREFIX}${name}`)) return 'reserved'
  return null
}

/**
 * Full environment variable name for a validated name.
 * @param {string} name
 * @returns {string}
 */
export function envNameOf(name) {
  return `${PREFIX}${name}`
}
