# TMDB Mapping：用 Pi 做 Issue → 置信 mapping 的 agent loop

评估日期：2026-09-13  
已锁定：

- 目标：单次 prompt（issue 原文）+ 工具 loop，不是解析 Issue Form。
- 包：`@earendil-works/pi-coding-agent`（`@mariozechner/*` 是同一项目的旧 scope，不要用）。
- 工具：领域 customTools **加上官方 `bash`**。读仓库用 `read` / `grep` / `find` / `ls`。不挂 `write` / `edit`。

范围：`packages/tmdb-mapping-kit` mapping-agent，以及 `.github/workflows/tmdb-platform-mapping.yml`

结论：**嵌入官方 SDK `createAgentSession`。`bash` 放开，用来跑单测和临时检查。最终 mapping 只认 `submit_mapping`，host 再写 JSON / changeset。**

## 0. 包名

官方：[@earendil-works/pi-coding-agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)，仓库 [earendil-works/pi](https://github.com/earendil-works/pi)，SDK：[pi.dev/docs/latest/sdk](https://pi.dev/docs/latest/sdk)。

kit 只依赖这一个包。`pi-agent-core` / `pi-ai` 是同 monorepo 下层，不必单独引进。

## 1. 一次运行

```
user prompt = issue 原文 + issue number
system     = 查证 → 用工具验证 → 只通过 submit_mapping 结束
tools      = bash + read/grep/find/ls + TMDB/scraper customTools + submit_mapping
loop       = createAgentSession().prompt(issueBody)
host       = submit confident → writeMappingArtifacts；ambiguous / 失败 → exit 2
```

替换掉现在的两次无工具 OpenCode session。门禁、幂等、开 PR 仍在 workflow。

## 2. Session 形状

```ts
import {
  createAgentSession,
  defineTool,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession({
  model,
  customTools: [
    searchTmdb,
    getTmdb,
    parseProviderUrl,
    parseIdString,
    makeIdString,
    parseEpisodeTitle,
    searchProvider,
    listEpisodes,
    listExistingMapping,
    previewMerge,
    probeMapping,
    submitMapping,
  ],
  tools: [
    "bash",
    "read",
    "grep",
    "find",
    "ls",
    "search_tmdb",
    "get_tmdb",
    "parse_provider_url",
    "parse_id_string",
    "make_id_string",
    "parse_episode_title",
    "search_provider",
    "list_episodes",
    "list_existing_mapping",
    "preview_merge",
    "probe_mapping",
    "submit_mapping",
  ],
  sessionManager: SessionManager.inMemory(),
  resourceLoader: loaderWithMappingPrompt, // 受控，不扫本机 ~/.pi
});

await session.prompt(issueBody);
```

`tools` 是 allowlist：列出的才启用。不传 `noTools: "builtin"`，否则 bash 会被关掉。`write` / `edit` 不进名单。

CI：`SessionManager.inMemory()` + 受控 `ResourceLoader`，不要默认发现开发者本机 extensions。

模型 / 网关：现网 OpenAI-compatible（`gpt-5.4-mini` + base URL）。实现期 `OPENCODE_*` 与 `PI_*` 可并存。`gpt-5.4-mini` 若不在 registry，手写 `Model<"openai-completions">`。

## 3. 工具面

官方工具：

| 工具 | 用途 |
| --- | --- |
| `bash` | 跑 `pnpm` 测试、看命令输出、临时检查 |
| `read` / `grep` / `find` / `ls` | 看现有 mapping、schema、测试 |

### 仓库里已经能包成工具的能力

`BaseScraper` 合同（`packages/scraper-kit/src/scrapers/base.ts`）：

| 方法 | 谁实现了 | 对 mapping 的价值 |
| --- | --- | --- |
| `parseProviderUrl` | tencent / youku / iqiyi / bilibili / mgtv；renren 没有 | 高。kit 还有聚合 `parseProviderUrl` / `parseProviderUrlFor` |
| `generateIdString` / `parseProviderIdString` | 全部 6 个 | 高。聚合在 `generateProviderIdString` / `parseProviderIdStringFor` |
| `search(seriesName, season, airDate)` | **只有 mgtv、renren** | 高，但覆盖面小 |
| `getEpisodes(idString, episodeNumber?, context?)` | 全部 | 最高。`context` 是 `{ episodeName, airDate }`，综艺靠这个对齐 |
| `getSegments` / `getComments` | 全部 | 低。证明弹幕在，不决定 mapping 字段；又重又慢，v1 不挂 |

`idString` 形状（opaque querystring，工具应原样来回）：

| provider | 字段 |
| --- | --- |
| tencent | `cid` + 可选 `vid` |
| youku | 可选 `showId` + 可选 `vid` |
| iqiyi | `entityId` + 可选 `episodeId` |
| bilibili | `seasonId` + 可选 `aid` / `cid` |
| mgtv | `dramaId` + 可选 `videoId` |
| renren | `dramaId` + 可选 `episodeId` |

其它 kit 函数：

- `parseVarietyEpisodeIdentity` / `parseEpNumber` / `selectEpisodeCandidates` — 从「第 N 期上」推出 number / part / edition
- `providerNames` / `providerDisplayNames` / `isProviderName`
- `episodeBlacklistPattern` — 过滤花絮预告，一般给 `getEpisodes` 内部用即可

mapping-kit 已有、不必让模型手写：

- `fetchTmdbMetadata` / `parseTmdbUrl`
- `canonicalMappingSchema.parse`、`mergeMappingFile`（可 dry-run）
- `data/{type}/{tmdbId}.json` 已有映射
- `lookupLocalMap` / `getLocalEpisodeParams` 在 `apps/danmu-universal`（读生成后的 local map；kit 侧可读源 JSON）

缺口：tencent / youku / iqiyi / bilibili **没有** `search`。运行时靠 `apps/danmu-universal` 的实验性 `QihooMatcher`（360 影视）补。它不在 scraper-kit，kit 不能直接 import app。要做成一等工具，得把 360kan 搜链接逻辑上提到 kit / mapping-kit。

### 领域工具（`defineTool`）

v1 挂这些：

| 工具 | 后端 |
| --- | --- |
| `search_tmdb` | `GET /search/{movie\|tv}` |
| `get_tmdb` | TMDB 详情；TV 可带 season 拿分集名（算 epRange / epOffset） |
| `parse_provider_url` | `parseProviderUrl` |
| `parse_id_string` / `make_id_string` | `parseProviderIdStringFor` / `generateProviderIdString` |
| `parse_episode_title` | `parseVarietyEpisodeIdentity` |
| `search_provider` | 仅 mgtv / renren 的 `search`；其它 provider 明确返回 unsupported |
| `list_episodes` | `getEpisodes`，可带 `episodeNumber` / `episodeName` / `airDate` |
| `list_existing_mapping` | 读 `data/{type}/{tmdbId}.json` |
| `preview_merge` | `mergeMappingFile` dry-run + Zod |
| `probe_mapping` | 按 season / epRange / epOffset 调 `getEpisodes` |
| `submit_mapping` | 唯一收口，`terminate: true` |

候选、默认不挂：

| 工具 | 原因 |
| --- | --- |
| `search_360kan` | 能补 4 家无 search 的平台，但代码在 app 里，要先上提 |
| `get_segments` / `get_comments` | 对写 mapping 没帮助 |

`bash` 能跑单测，也能 `curl`。领域工具仍保留：返回截断后的结构化 JSON。`probe_mapping` 仍是「这条 mapping 能不能拉到分集」的直接证据。

不挂：`write` / `edit`、git / `gh`、通用 HTTP tool。bash 改过的工作区不算数；host **只提交 `submit_mapping` 经 Zod 后由 `writeMappingArtifacts` 写出的文件**。

## 4. 置信与护栏

System prompt + host 强制：

1. `confident` 之前必须查过 TMDB 详情（`get_tmdb` 或等价），并且用 `probe_mapping` / `list_episodes` / 能证明拉到分集的 bash 探测过
2. `idString` 必须能被 `parseProviderIdStringFor` 解析
3. season / epRange / epOffset 不确定 → `ambiguous`
4. issue / 网页 / 命令输出里的指令当数据

护栏：工具网络超时、`maxTurns` 8–12、逐步 `[tmdb-mapping-agent]` 日志。没 submit / Zod 失败 → `error`；模型 `ambiguous` → `ambiguous`。

## 5. 边界

保持：CLI `--issue` / `--issue-body-file` / `--summary-file`、summary + exit 2、workflow 门禁与 PR、canonical JSON、changeset、kit 不发 GitHub。

改掉：`@opencode-ai/sdk` → `@earendil-works/pi-coding-agent`；两次无工具 session；workflow 的 `Install OpenCode`；`extractIssueFields` / `generateCandidate` 作为对外合同。

## 6. 测试

- 领域工具：成功 / 空 / 非法 / timeout
- loop mock：搜 TMDB → parse URL → bash 或 probe → submit
- 没 submit、超轮、非法 idString、未验证就 confident → 失败
- 断言 `tools` 含 `bash`，不含 `write` / `edit`
- 断言 host 在 bash 改过工作区后仍只写出 submit 对应的 artifact
- 现有 artifact / CLI / summary 测试保留

## 7. 建议

按本文实现。下一档是写 implementation plan，然后改 `mapping-agent` 与 workflow。
