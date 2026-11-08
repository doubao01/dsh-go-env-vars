/**
 * On-disk variable store.
 *
 * One JSON document under the dsh-go home holds every variable plus the
 * panel's display preference. Writes go through a temp file and a rename so a
 * crash cannot leave a half-written store behind.
 * @module store
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

import { writeBridge } from './bridge.js'

/** Absolute path of the store inside the dsh-go home. */
export const STORE_PATH = join(
  process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'),
  'dsh-go',
  'env-vars.json',
)

/** Shape written to disk. `vars` maps a normalized name to `{ value, note }`. */
const EMPTY_STATE = Object.freeze({ privacy: true, vars: {} })

/**
 * Coerce whatever is on disk into a known shape.
 *
 * Files written before the `{ meta, vars }` wrapper existed are read as a bare
 * name→value map, so an upgrade does not lose them.
 * @param {unknown} raw
 * @returns {{ privacy: boolean, vars: Record<string, { value: string, note: string }> }}
 */
export function parseState(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_STATE }
  const record = /** @type {Record<string, unknown>} */ (raw)
  const wrapped = record.meta !== null && typeof record.meta === 'object' && 'vars' in record
  if (!wrapped) return { privacy: true, vars: toVarMap(record) }
  const meta = /** @type {Record<string, unknown>} */ (record.meta)
  return {
    privacy: meta.privacy !== false,
    vars: toVarMap(record.vars),
  }
}

/**
 * Normalize the stored `vars` map to `name -> { value, note }`.
 *
 * Two older shapes are still read: a bare `name -> "value"` string, and
 * `name -> { value }` without a note. Both upgrade in place on next write.
 * @param {unknown} value
 * @returns {Record<string, { value: string, note: string }>}
 */
function toVarMap(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  /** @type {Record<string, { value: string, note: string }>} */
  const out = {}
  for (const [name, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      out[name] = { value: entry, note: '' }
      continue
    }
    if (entry === null || typeof entry !== 'object') continue
    const value_ = /** @type {Record<string, unknown>} */ (entry).value
    const note_ = /** @type {Record<string, unknown>} */ (entry).note
    if (typeof value_ !== 'string') continue
    out[name] = { value: value_, note: typeof note_ === 'string' ? note_ : '' }
  }
  return out
}

/** In-memory mirror; the store is read once and written through. */
let state = null

/**
 * Current state, loading it from disk on first use.
 * @returns {Promise<{ privacy: boolean, vars: Record<string, string> }>}
 */
export async function load() {
  if (state !== null) return state
  try {
    state = parseState(JSON.parse(await readFile(STORE_PATH, 'utf8')))
  } catch {
    // Missing or corrupt: start empty rather than fail the panel.
    state = { ...EMPTY_STATE, vars: {} }
  }
  return state
}

/**
 * Replace the stored state and write it through.
 * @param {{ privacy: boolean, vars: Record<string, string> }} next
 */
export async function save(next) {
  state = next
  await mkdir(dirname(STORE_PATH), { recursive: true })
  const tmp = `${STORE_PATH}.tmp`
  const body = { meta: { privacy: next.privacy }, vars: next.vars }
  await writeFile(tmp, `${JSON.stringify(body, null, 2)}\n`, 'utf8')
  await rename(tmp, STORE_PATH)
  // Keep the shell bridge in step with the store. A bridge failure must not
  // lose the save, so it is reported by the caller rather than thrown here.
  await writeBridge(next.vars)
}

/**
 * Set one variable, leaving the rest untouched.
 * @param {string} name Normalized name.
 * @param {string} value
 * @param {string} [note] Free-form reminder shown in the panel.
 * @returns {Promise<void>}
 */
export async function putVariable(name, value, note = '') {
  const current = await load()
  await save({ privacy: current.privacy, vars: { ...current.vars, [name]: { value, note } } })
}

/**
 * Read one variable's value.
 * @param {string} name
 * @returns {string | undefined}
 */
export function valueOf(state, name) {
  return state?.vars[name]?.value
}

/**
 * Remove one variable.
 * @param {string} name
 * @returns {Promise<boolean>} Whether the name existed.
 */
export async function deleteVariable(name) {
  const current = await load()
  if (!Object.hasOwn(current.vars, name)) return false
  const vars = { ...current.vars }
  delete vars[name]
  await save({ privacy: current.privacy, vars })
  return true
}

/**
 * Store the panel's privacy preference.
 * @param {boolean} privacy
 * @returns {Promise<void>}
 */
export async function setPrivacy(privacy) {
  const current = await load()
  await save({ privacy, vars: current.vars })
}
