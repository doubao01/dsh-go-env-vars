/**
 * Localized strings and the value mask.
 * @module text
 */

/** @typedef {'zh' | 'en'} Lang */

/**
 * Pick the message language from the app's locale tag.
 * @param {string | undefined} locale
 * @returns {Lang}
 */
export function langOf(locale) {
  return String(locale ?? '').startsWith('en') ? 'en' : 'zh'
}

/** @type {Record<string, Record<Lang, string>>} */
const MESSAGES = {
  nameFirst: { zh: '先填名称', en: 'Enter a name first' },
  nameTooLong: { zh: '名称太长（最多 64 字）', en: 'Name too long (max 64)' },
  nameCharset: {
    zh: '只能大写字母、数字、下划线，且以字母开头',
    en: 'Use A-Z, 0-9 and _, starting with a letter',
  },
  nameReserved: { zh: '这个名称被引擎保留', en: 'That name is reserved' },
  valueEmpty: { zh: '值不能为空', en: 'The value cannot be empty' },
  saveFailed: { zh: '保存失败', en: 'Save failed' },
  removeFailed: { zh: '删除失败', en: 'Remove failed' },
  noSuchVariable: { zh: '没有这个变量', en: 'No such variable' },
  nothingToCopy: { zh: '没有值可复制', en: 'Nothing to copy' },
  copied: { zh: '已复制', en: 'Copied' },
}

/**
 * Translate one known message key.
 * @param {Lang} lang
 * @param {keyof typeof MESSAGES} key
 * @returns {string}
 */
export function message(lang, key) {
  return MESSAGES[key][lang]
}

/**
 * Confirmation after storing a variable.
 * @param {Lang} lang
 * @param {string} envName Full `DSH_VAR_*` name.
 * @returns {string}
 */
export function savedText(lang, envName) {
  return lang === 'zh' ? `已保存，命令里用 $${envName}` : `Saved; use $${envName}`
}

/**
 * Confirmation after removing a variable.
 * @param {Lang} lang
 * @param {string} name
 * @returns {string}
 */
export function removedText(lang, name) {
  return lang === 'zh' ? `已删除 ${name}` : `${name} removed`
}

/**
 * Mask a value for display: short values become all dots, longer ones keep a
 * three-character hint so the user can tell two entries apart.
 * @param {string} value
 * @returns {string}
 */
export function maskValue(value) {
  if (value.length === 0) return ''
  if (value.length < 8) return '*'.repeat(value.length)
  return `${value.slice(0, 3)}${'*'.repeat(Math.min(8, value.length - 3))}`
}
