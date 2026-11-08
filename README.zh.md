# dsh-go-env-vars

在 **dsh-go** 的原生面板里管理环境变量。每个值都会注入到 agent 执行的每条 shell 命令中，以 `$DSH_VAR_<名称>` 的形式提供。

值保存在主机的本地 JSON 文件里，不进入对话记录。

[English](README.md)

## 为什么

你需要让命令能用上 token —— `git`、`gh`、`curl`、某个脚本 —— 但又不想把它贴在对话里：那会留在会话记录中，也会出现在之后每一次请求里。

这个插件把值存在磁盘上，通过引擎自带的 `ctx.shellEnv` 注册表注入，并提供一个面板来新增、显示、复制和删除。

## 前提

- dsh-go 且已装原生插件桥接（主机上存在 `/etc/dsh-app/runtime.json`）
- 引擎提供 `ctx.shellEnv` —— `@deepseek-ai/dsh-base` 会挂载它

## 安装

```sh
dsh plugin --profile web add /path/to/dsh-go-env-vars
```

发布到 npm 后也可以：

```sh
dsh plugin --profile web add dsh-go-env-vars
```

重启引擎，然后打开面板：**全部功能 → 环境变量**，或输入框上方的 **+** 菜单。

## 使用

1. 打开面板，看到变量列表。
2. 点右上角的 **+**，填名称（`GITHUB_TOKEN`）、值和可选的**备注**，点**保存**。备注只显示在面板里，用来提醒自己这是什么。
3. 之后要修改，点该行的**编辑** —— 名称和值会预填展开。改名称就是重命名；
   存到一个已存在的名称上会覆盖它。
4. 在任意命令里引用：

```sh
curl -H "Authorization: Bearer $DSH_VAR_GITHUB_TOKEN" https://api.github.com/user
```

改动对**下一条命令**即刻生效，不需要重启。

### 让 gh、git 等工具直接用上

引擎只接受 `DSH_*` 命名空间里的变量，所以存的 `GITHUB_TOKEN` 在命令里是
`$DSH_VAR_GITHUB_TOKEN`。而 `gh`、`git`、`curl` 读的是无前缀的名字。

插件每次保存后都会重新生成 `~/.dsh/dsh-go/env.sh`，把每个变量按原名再导出一次：

```sh
. ~/.dsh/dsh-go/env.sh
gh auth status          # 现在能读到 GITHUB_TOKEN
```

想永久生效，把这一行加进 `~/.bashrc`：

```sh
echo '. ~/.dsh/dsh-go/env.sh' >> ~/.bashrc
```

脚本只在对应变量已设置时才导出，删除变量后重新 source 即可，不会留下旧值。

### 名称规则

名称要能写成 `$DSH_VAR_<名称>`，所以必须符合 POSIX shell 标识符规则：

| 规则 | |
|---|---|
| 允许字符 | `A-Z`、`0-9`、`_` |
| 首字符 | 字母 |
| 长度 | 不超过 64 个字符 |
| 大小写 | 小写输入会自动转大写 |

`MY-TOKEN`、`my token`、`_LEAD`、`1ABC` 以及中文等非 ASCII 名称都不接受。以下名称被引擎保留：`HOME`、`SHELL`、`SESSION_ID`、`PROFILE`、`PROFILE_DIR`。

### 隐私

**隐私模式**（默认开启）把值显示为圆点。点某一行的**显示**临时查看明文，点**复制**把真实值放进剪贴板。

值以明文存放在 `~/.dsh/dsh-go/env-vars.json`。任何能读你家目录的进程都能读到 —— 这是便利存储，不是保险箱。文件按进程 umask 创建，若你的场景需要更严的权限，自行收紧：

```sh
chmod 600 ~/.dsh/dsh-go/env-vars.json
```

## 实现方式

```
面板表单 ──▶ 存储（env-vars.json）
                 │
                 ▼
       ctx.shellEnv.register({ resolve })
                 │
                 ▼
    引擎为每条命令构建 $DSH_VAR_*
```

引擎会为每次 shell 调用重建受管的 `DSH_*` 环境，并丢弃继承来的值，所以父进程里的旧值绝不会混进来。resolver 每次都读当前存储，这就是改动能立刻生效的原因。

插件为每个变量注册一个 contributor，变量被删除或插件释放时注销。

## 开发

```sh
npm test        # 单元测试，不需要引擎
```

面板视图用 dsh-go 插件工具包检查：

```sh
node ~/.dsh/skills/dsh-go-plugin/kit/bin/check.mjs . --load
```

### 文件结构

| 文件 | 作用 |
|---|---|
| `lib/index.js` | 插件入口、面板、动作、注册表接线 |
| `lib/names.js` | 名称规范化、校验、`DSH_VAR_` 前缀 |
| `lib/store.js` | 原子写入的 JSON 存储，兼容旧格式 |
| `lib/form.js` | 读取表单提交的字段 |
| `lib/text.js` | 中英文文案与掩码 |

### 表单载荷

App 序列化表单时，把绑定路径当作字面键名：

```json
{ "values": { "data.newName": "abc", "data.newValue": "1244" } }
```

`lib/form.js` 同时接受这种形状和更扁平/更深层的变体，因为这个信封在不同 App 版本间变过。若将来又变了，只需要改 `readField` 一处。

## 许可

MIT
