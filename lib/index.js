/**
 * Environment variables for dsh-go.
 *
 * Every stored variable is contributed to the engine's managed `DSH_*` shell
 * environment through `ctx.shellEnv`, so a command sees it as
 * `$DSH_VAR_<NAME>`. Values live in a local JSON file and never enter the
 * conversation transcript.
 *
 * The panel is a dsh-go native surface; the engine half below runs in the
 * dsh-go host and is inert on hosts without the bridge.
 * @module dsh-go-env-vars
 */

import { readFlag, readField } from './form.js'
import { envNameOf, normalizeName, PREFIX, validateName } from './names.js'
import { deleteVariable, load, putVariable, setPrivacy } from './store.js'
import { langOf, maskValue, message, removedText, savedText } from './text.js'

export const name = 'dsh-go-env-vars'

/** The shell environment registry this plugin contributes facts to. */
export const inject = ['shellEnv']

/** Names the panel is currently showing in clear text. */
const revealed = new Set()

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  /** @type {Map<string, () => void>} env name → unregister */
  const registered = new Map()

  /**
   * Cached store snapshot, refreshed after every write.
   * @type {{ privacy: boolean, vars: Record<string, string> } | null}
   */
  let state = null

  /**
   * Name of the variable whose edit form is open, or `null`.
   * @type {string | null}
   */
  let editing = null

  /** Whether the add form is showing instead of the list. */
  let adding = false

  /**
   * Data-model fields for the edit form. Bound fields read the model rather
   * than their inline `value`, so this is the only way to prefill them.
   * @returns {{ editName: string, editValue: string }}
   */
  const editFields = () => ({
    editName: editing ?? '',
    editValue: editing === null ? '' : (state?.vars[editing]?.value ?? ''),
    editNote: editing === null ? '' : (state?.vars[editing]?.note ?? ''),
  })

  /**
   * Register or unregister one contributor so the shell environment matches
   * the store. The resolver reads the store on every execution, so a value
   * changed in the panel applies to the next command without a restart.
   * @param {string} key Full `DSH_VAR_*` name.
   * @param {boolean} wanted
   */
  const sync = (key, wanted) => {
    const dispose = registered.get(key)
    if (wanted && dispose === undefined) {
      const envName = /** @type {string} */ (key)
      const name = envName.slice(PREFIX.length)
      registered.set(
        key,
        ctx.shellEnv.register({
          name: `dsh-go-env-vars:${name}`,
          variables: { [envName]: { description: `dsh-go environment variable ${name}` } },
          resolve: () => {
            const value = state?.vars[name]?.value
            return typeof value === 'string' && value !== '' ? { [envName]: value } : {}
          },
        }),
      )
      return
    }
    if (!wanted && dispose !== undefined) {
      dispose()
      registered.delete(key)
    }
  }

  /**
   * Reload the store and reconcile the registry with it.
   * @returns {Promise<{ privacy: boolean, vars: Record<string, string> }>}
   */
  const refresh = async () => {
    state = await load()
    const wanted = new Set(
      Object.entries(state.vars)
        .filter(([, item]) => typeof item?.value === 'string' && item.value !== '')
        .map(([name]) => envNameOf(name)),
    )
    for (const key of wanted) sync(key, true)
    for (const key of [...registered.keys()]) if (!wanted.has(key)) sync(key, false)
    return state
  }

  ctx.inject(['dshGo'], (dshGoCtx) => {
    /**
     * Validate and store one variable, then bring the shell environment in
     * step.
     * @param {string | undefined} rawName
     * @param {string | undefined} rawValue
     * @param {string | undefined} rawNote
     * @param {import('./text.js').Lang} lang
     * @returns {Promise<string>} Toast text.
     */
    const saveVariable = async (rawName, rawValue, rawNote, lang) => {
      const name = normalizeName(rawName)
      const invalid = validateName(name)
      if (invalid === 'empty') return message(lang, 'nameFirst')
      if (invalid === 'too-long') return message(lang, 'nameTooLong')
      if (invalid === 'bad-charset') return message(lang, 'nameCharset')
      if (invalid === 'reserved') return message(lang, 'nameReserved')
      const value = typeof rawValue === 'string' ? rawValue : ''
      if (value === '') return message(lang, 'valueEmpty')
      try {
        await putVariable(name, value, typeof rawNote === 'string' ? rawNote.trim() : '')
      } catch {
        return message(lang, 'saveFailed')
      }
      await refresh()
      return savedText(lang, envNameOf(name))
    }

    dshGoCtx.dshGo.panel('env', {
      view: async (_scope, caps) => {
        const lang = langOf(caps.locale)
        const { privacy, vars } = await refresh()
        const names = Object.keys(vars).sort((a, b) => a.localeCompare(b))
        const zh = lang === 'zh'

        // Two screens: the list (default) and the add form, reached from the
        // + button in the list header.
        if (adding) {
          return {
            v: 2,
            type: 'stack',
            title: zh ? '添加变量' : 'Add variable',
            accent: 'teal',
            children: [
              {
                type: 'row',
                style: { align: 'start' },
                children: [
                  {
                    type: 'actions',
                    items: [
                      {
                        label: zh ? '返回' : 'Back',
                        icon: 'expand',
                        style: 'plain',
                        action: { id: 'closeAdd' },
                      },
                    ],
                  },
                ],
              },
              {
                type: 'form',
                submitLabel: zh ? '保存' : 'Save',
                submit: 'upsert',
                children: [
                  {
                    type: 'textField',
                    label: zh ? '名称' : 'Name',
                    bind: 'data.newName',
                    placeholder: 'GITHUB_TOKEN',
                    maxLength: 64,
                  },
                  {
                    type: 'textField',
                    label: zh ? '值' : 'Value',
                    bind: 'data.newValue',
                    maxLength: 2000,
                  },
                  {
                    type: 'textField',
                    label: zh ? '备注（可空）' : 'Note (optional)',
                    bind: 'data.newNote',
                    maxLength: 200,
                  },
                ],
              },
              {
                type: 'text',
                tone: 'muted',
                text: zh
                  ? '名称会转为大写，须符合 POSIX 命名；命令里用 $DSH_VAR_名称 引用。'
                  : 'The name is uppercased and must be POSIX-valid; reference it as $DSH_VAR_NAME.',
              },
            ],
          }
        }

        /** @type {unknown[]} */
        const children = []

        // Header: section label on the left, + on the right.
        children.push({
          type: 'row',
          style: { align: 'end', gap: 'S' },
          children: [
            { type: 'text', text: zh ? '变量' : 'Variables', tone: 'muted' },
            {
              type: 'actions',
              items: [{ label: zh ? '添加' : 'Add', icon: 'add', action: { id: 'openAdd' } }],
            },
          ],
        })

        if (names.length === 0) {
          children.push({
            type: 'emptyState',
            icon: 'terminal',
            title: zh ? '还没有变量' : 'No variables yet',
            message: zh ? '点右上角 + 添加第一个。' : 'Tap + in the corner to add one.',
            action: { label: zh ? '添加' : 'Add', icon: 'add', action: { id: 'openAdd' } },
          })
        } else {
          for (const name of names) {
            const entry = vars[name]
            const value = entry?.value ?? ''
            const note = entry?.note ?? ''
            const shown = privacy && !revealed.has(name) ? maskValue(value) : value
            const isEditing = editing === name
            children.push({
              type: 'stack',
              children: [
                // The row shows only the name the user chose.
                { type: 'text', text: name },
                ...(note === '' ? [] : [{ type: 'text', text: note, tone: 'muted' }]),
                { type: 'text', text: shown || (zh ? '（空）' : '(empty)'), tone: 'muted' },
                {
                  type: 'actions',
                  items: [
                    {
                      label: isEditing ? (zh ? '收起' : 'Close') : zh ? '编辑' : 'Edit',
                      icon: 'edit',
                      action: { id: 'edit', args: { name } },
                    },
                    {
                      label: zh ? '显示' : 'Show',
                      icon: 'select-text',
                      action: { id: 'reveal', args: { name } },
                    },
                    { label: zh ? '复制' : 'Copy', icon: 'copy', action: { id: 'copy', args: { name } } },
                    {
                      label: zh ? '删除' : 'Delete',
                      icon: 'remove',
                      style: 'plain',
                      action: { id: 'remove', args: { name } },
                    },
                  ],
                },
                ...(isEditing
                  ? [
                      {
                        type: 'form',
                        label: zh ? `编辑 ${name}` : `Edit ${name}`,
                        submitLabel: zh ? '保存修改' : 'Save changes',
                        submit: { id: 'commitEdit', args: { original: name } },
                        children: [
                          // Bound fields read the data model; `editFields()`
                          // pushes the prefill, so no inline value is needed.
                          {
                            type: 'textField',
                            label: zh ? '名称' : 'Name',
                            bind: 'data.editName',
                            maxLength: 64,
                          },
                          {
                            type: 'textField',
                            label: zh ? '值' : 'Value',
                            bind: 'data.editValue',
                            maxLength: 2000,
                          },
                          {
                            type: 'textField',
                            label: zh ? '备注' : 'Note',
                            bind: 'data.editNote',
                            maxLength: 200,
                          },
                        ],
                      },
                    ]
                  : []),
              ],
            })
          }
        }

        // Privacy sits at the bottom so the list stays the first thing seen.
        children.push({ type: 'text', text: zh ? '隐私' : 'Privacy', tone: 'muted' })
        children.push({
          type: 'toggle',
          label: zh ? '隐私模式' : 'Privacy mode',
          bind: 'data.privacy',
          // Without onChange the switch would flip and never persist.
          onChange: 'setPrivacy',
        })
        children.push({
          type: 'text',
          tone: 'muted',
          text: zh
            ? '开启后变量值显示为圆点，点“显示”才临时查看。变量在每次命令执行时注入。'
            : 'When on, values show as dots until you tap Show. Values are injected into every command.',
        })

        // The bridge file is what lets gh/git see the plain names.
        children.push({
          type: 'callout',
          tone: 'info',
          text: zh
            ? `已生成 ~/.dsh/dsh-go/env.sh。在 shell 里执行 . ~/.dsh/dsh-go/env.sh 后，gh、git 等工具就能直接用 ${names.length ? '变量原名' : '变量原名'}。想永久生效，把这一行加进 ~/.bashrc。`
            : 'Wrote ~/.dsh/dsh-go/env.sh. Run `. ~/.dsh/dsh-go/env.sh` in a shell and tools like gh and git see the plain names. Add that line to ~/.bashrc to make it permanent.',
        })

        return {
          v: 2,
          type: 'stack',
          title: zh ? '环境变量' : 'Env vars',
          accent: 'teal',
          children,
        }
      },

      data: (_scope, emit) => {
        const current = state ?? { privacy: true, vars: {} }
        emit({ privacy: current.privacy, newName: '', newValue: '', ...editFields() })
        return () => {}
      },

      actions: {
        openAdd: () => {
          adding = true
          editing = null
          return { patch: { newName: '', newValue: '', newNote: '' }, refresh: true }
        },

        closeAdd: () => {
          adding = false
          return { refresh: true }
        },

        upsert: async (_scope, event) => {
          const lang = langOf(event.locale)
          const toast = await saveVariable(
            readField(event.value, ['newName', 'new_name', 'name']),
            readField(event.value, ['newValue', 'new_value', 'value']),
            readField(event.value, ['newNote', 'new_note', 'note']),
            lang,
          )
          // A successful save closes the add screen and returns to the list.
          if (adding && toast !== message(lang, 'nameFirst') && toast !== message(lang, 'valueEmpty')) {
            adding = false
          }
          return { toast, patch: { newName: '', newValue: '', newNote: '' }, refresh: true }
        },

        edit: (_scope, event) => {
          const name = String(event.value?.name ?? '')
          if (name === '') return {}
          editing = editing === name ? null : name
          // `refresh` re-renders the view but leaves the data model alone; the
          // bound edit fields read the data model, so push their prefill too.
          return { patch: editFields(), refresh: true }
        },

        commitEdit: async (_scope, event) => {
          const lang = langOf(event.locale)
          const original = String(event.value?.original ?? '')
          if (original === '') return { toast: message(lang, 'noSuchVariable') }
          const nextName = normalizeName(readField(event.value, ['editName', 'newName', 'name']) ?? original)
          const invalid = validateName(nextName)
          if (invalid === 'empty') return { toast: message(lang, 'nameFirst') }
          if (invalid === 'too-long') return { toast: message(lang, 'nameTooLong') }
          if (invalid === 'bad-charset') return { toast: message(lang, 'nameCharset') }
          if (invalid === 'reserved') return { toast: message(lang, 'nameReserved') }
          const value = readField(event.value, ['editValue', 'newValue', 'value'])
          if (value === undefined || value === '') return { toast: message(lang, 'valueEmpty') }
          const note = readField(event.value, ['editNote', 'newNote', 'note']) ?? '' 
          // Renaming onto an existing name replaces that variable; say so
          // instead of reporting a plain save.
          const replaced = nextName !== original && Object.hasOwn(state?.vars ?? {}, nextName)
          // Renaming: drop the old key first so the store never holds both.
          if (nextName !== original) {
            try {
              await deleteVariable(original)
            } catch {
              return { toast: message(lang, 'saveFailed') }
            }
          }
          try {
            await putVariable(nextName, value, note.trim())
          } catch {
            return { toast: message(lang, 'saveFailed') }
          }
          editing = null
          revealed.delete(original)
          await refresh()
          const toast = replaced
            ? lang === 'zh'
              ? `已覆盖 $${envNameOf(nextName)}`
              : `Replaced $${envNameOf(nextName)}`
            : savedText(lang, envNameOf(nextName))
          return { toast, refresh: true }
        },

        reveal: (_scope, event) => {
          const name = String(event.value?.name ?? '')
          if (name === '') return { refresh: false }
          if (revealed.has(name)) revealed.delete(name)
          else revealed.add(name)
          return { refresh: true }
        },

        copy: (_scope, event) => {
          const lang = langOf(event.locale)
          const name = String(event.value?.name ?? '')
          const value = state?.vars?.[name]
          if (typeof value !== 'string' || value === '') return { toast: message(lang, 'nothingToCopy') }
          return { copy: value, toast: message(lang, 'copied') }
        },

        remove: async (_scope, event) => {
          const lang = langOf(event.locale)
          const name = String(event.value?.name ?? '')
          let removed = false
          try {
            removed = await deleteVariable(name)
          } catch {
            return { toast: message(lang, 'removeFailed') }
          }
          if (!removed) return { toast: message(lang, 'noSuchVariable') }
          revealed.delete(name)
          await refresh()
          return { toast: removedText(lang, name), refresh: true }
        },

        setPrivacy: async (_scope, event) => {
          const next = readFlag(event.value, ['privacy'])
          const current = state ?? (await refresh())
          const privacy = next === undefined ? !current.privacy : next
          try {
            await setPrivacy(privacy)
          } catch {
            return { toast: message(langOf(event.locale), 'saveFailed') }
          }
          await refresh()
          return { refresh: true }
        },
      },
    })
  })

  // The strip shows the variable count next to the composer, so the panel is
  // reachable without opening the + menu.
  ctx.inject(['dshGo'], (dshGoCtx) => {
    dshGoCtx.dshGo.strip('env-count', (_scope, emit, caps) => {
      const zh = langOf(caps.locale) === 'zh'
      const push = () => {
        const count = Object.keys(state?.vars ?? {}).length
        emit({
          text: count === 0 ? (zh ? '环境变量 · 空' : 'Env vars · none') : (zh ? `环境变量 · ${count}` : `Env vars · ${count}`),
          icon: 'terminal',
          tone: count === 0 ? 'muted' : 'good',
        })
      }
      push()
      const timer = setInterval(push, 30_000)
      return () => clearInterval(timer)
    })
  })

  // Register stored variables at load so commands work before the panel opens.
  void refresh()
}
