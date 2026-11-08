# dsh-go-env-vars

Manage environment variables from the **dsh-go** native panel. Every value is injected into each shell command the agent runs, exposed as `$DSH_VAR_<NAME>`.

Values live in a local JSON file on the host and never enter the conversation transcript.

[中文](README.zh.md)

## Why

You need a token available to commands — `git`, `gh`, `curl`, a script — without pasting it into the chat, where it would sit in the transcript and in every later request.

This plugin keeps values on disk, contributes them through the engine's own `ctx.shellEnv` registry, and gives you a panel to add, reveal, copy and delete them.

> **Not on npm.** Install from GitHub with the commands above. The
> `market-entry.json` file is kept so the package is ready if it is ever
> published.

## Requirements

- dsh-go with the native plugin bridge (`/etc/dsh-app/runtime.json` exists on the host)
- An engine that provides `ctx.shellEnv` — `@deepseek-ai/dsh-base` mounts it

## Install

Install straight from GitHub:

```sh
dsh plugin --profile web add github:doubao01/dsh-go-env-vars
```

Or clone it and point at the directory:

```sh
git clone https://github.com/doubao01/dsh-go-env-vars.git
dsh plugin --profile web add ./dsh-go-env-vars
```

Then restart the engine: **设置 → 本机引擎 → 重启引擎**.

The panel appears under **全部功能 → 环境变量**, above the composer as an
**环境变量 · N** strip, and in the **+** menu.

## Use

1. Open the panel to see the variable list.
2. Tap **+** in the corner, then type a name (`GITHUB_TOKEN`), a value and an
   optional **note**, and tap **Save**. The note is a reminder shown only in the panel.
3. To change one later, tap **Edit** on its row — the name and value open
   pre-filled. Editing the name renames the variable; saving onto a name that
   already exists replaces it.
4. Reference it in any command:

```sh
curl -H "Authorization: Bearer $DSH_VAR_GITHUB_TOKEN" https://api.github.com/user
```

Changes apply to the next command — no restart needed.

### Making `gh`, `git` and friends work

The engine only accepts variables in its managed `DSH_*` namespace, so a stored
`GITHUB_TOKEN` reaches a command as `$DSH_VAR_GITHUB_TOKEN`. Tools like `gh`,
`git` and `curl` read the plain name instead.

Every save regenerates `~/.dsh/dsh-go/env.sh`, which re-exports each variable
under its plain name:

```sh
. ~/.dsh/dsh-go/env.sh
gh auth status          # now sees GITHUB_TOKEN
```

To make it permanent, add the line to your shell startup file:

```sh
echo '. ~/.dsh/dsh-go/env.sh' >> ~/.bashrc
```

Each export is guarded on the variable being set, so deleting a variable and
re-sourcing leaves no stale value behind.

### Names

A name must be usable as `$DSH_VAR_<NAME>`, so it follows POSIX shell identifier rules:

| Rule | |
|---|---|
| Allowed characters | `A-Z`, `0-9`, `_` |
| First character | a letter |
| Length | 64 characters or fewer |
| Case | lower case input is uppercased for you |

`MY-TOKEN`, `my token`, `_LEAD`, `1ABC` and non-ASCII names are rejected. The following are reserved by the engine: `HOME`, `SHELL`, `SESSION_ID`, `PROFILE`, `PROFILE_DIR`.

### Privacy

**Privacy mode** (on by default) shows values as dots. Tap **Show** on a row to reveal it, **Copy** to put the real value on the clipboard.

Values are stored in plain text at `~/.dsh/dsh-go/env-vars.json`. Anything that can read your home directory can read them — this is a convenience store, not a vault. The file is created with the process umask; restrict it yourself if your threat model needs that:

```sh
chmod 600 ~/.dsh/dsh-go/env-vars.json
```

## How it works

```
panel form ──▶ store (env-vars.json)
                    │
                    ▼
        ctx.shellEnv.register({ resolve })
                    │
                    ▼
     engine builds $DSH_VAR_* per command
```

The engine rebuilds the managed `DSH_*` environment for every shell call and discards inherited values, so a stale value can never leak in from the parent process. The resolver reads the current store each time, which is why a change applies immediately.

The plugin registers one contributor per variable and unregisters it when the variable is deleted or the plugin is disposed.

## Development

```sh
npm test        # unit tests, no engine required
```

The panel view is checked with the dsh-go plugin kit:

```sh
node ~/.dsh/skills/dsh-go-plugin/kit/bin/check.mjs . --load
```

### Layout

| File | Purpose |
|---|---|
| `lib/index.js` | Plugin entry, panel, actions, registry wiring |
| `lib/names.js` | Name normalization, validation, `DSH_VAR_` prefix |
| `lib/store.js` | Atomic JSON store with migration from older shapes |
| `lib/form.js` | Reading submitted form fields |
| `lib/text.js` | Localized strings and the value mask |

### Form payloads

The app serializes a submitted form with the binding path as a literal key:

```json
{ "values": { "data.newName": "abc", "data.newValue": "1244" } }
```

`lib/form.js` accepts that shape plus flatter and deeper variants, because the envelope has differed between app builds. If a future build changes it again, `readField` is the one place to update.

## License

MIT
