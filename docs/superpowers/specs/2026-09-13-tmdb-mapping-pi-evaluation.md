# TMDB Mapping：用 Pi 替换 OpenCode 做 Issue 信息匹配

评估日期：2026-09-13  
范围：`packages/tmdb-mapping-kit` 的 mapping-agent，以及 `.github/workflows/tmdb-platform-mapping.yml`  
结论先行：**值得换，但不该用 `pi-coding-agent` 对位替换 OpenCode。** 推荐确定性解析 issue 表单，只在 provider URL 无法本地解析时用 `@mariozechner/pi-ai`（必要时加 `@mariozechner/pi-agent-core`）做结构化抽取。

本文是评估，不是已批准的实现规格。选定方案后再写实现 plan。

## 1. 当前能力实际在做什么

工作流在 issue 打上 `tmdb-mapping-approved` 后，调用 `tmdb:mapping-agent`。kit 内部分两段「agent」调用，中间夹着确定性逻辑：

```
issue body
    │
    ▼
OpenCode session 1  ── json_schema ──► IssueFormFields
    │                                   media_title / media_type / tmdb_url
    │                                   season / platform_urls / notes
    ▼
TMDB metadata（Bearer token）
    │
    ▼
parseProviderUrl(platform_urls)     ── 成功则不再调用模型
    │
    ├─ 全部可解析 ──► createResolvedCandidate
    │
    └─ 任一失败 ──► OpenCode session 2  ── json_schema ──► MappingCandidate
    │
    ▼
toCanonicalMapping → 写 data/{type}/{tmdbId}.json + changeset
```

对应代码：

- 字段抽取：`extractIssueFields()`，`createOpencode` + `session.prompt({ format: json_schema, tools: {}, agent: "build" })`
- 候选生成：`generateCandidate()`，同样的 OpenCode session
- 确定性路径：`resolvePlatformProviders()` → `parseProviderUrl`
- CI：先 `curl https://opencode.ai/install`，再跑 kit CLI

公开 issue 模板 `.github/ISSUE_TEMPLATE/tmdb-platform-mapping.yml` 已经是 GitHub Issue Form，渲染后的 body 是稳定的 `### 标签` 区块，不是自由文本。

模板字段：

| 表单 id | 标签 | 必填 |
| --- | --- | --- |
| `media_title` | 媒体标题（可选） | 否 |
| `tmdb_url` | TMDB 链接 | 是 |
| `season` | 季号（可选） | 否 |
| `platform_urls` | 视频平台链接 | 是 |
| `notes` | 备注（可选） | 否 |

`media_type` **不在表单里**。当前靠模型从正文「看出来」，但 `tmdb_url` 已经带 `/movie/` 或 `/tv/`，`parseTmdbUrl()` 可以确定类型。

## 2. 现状的真实成本

OpenCode 在这里不是 coding agent，而是「为了拿 `response.info.structured` 而拉起的本地 server」。

每次字段抽取都会：

1. CI 安装 OpenCode CLI
2. `@opencode-ai/sdk` 起一个本地 server
3. 建 session，指定 `agent: "build"`
4. 显式关掉全部 tools
5. 用 JSON Schema 做一次 structured prompt
6. `server.close()`

历史 run 说明这条路径能用，但不稳：

- 成功 run 大约 45–52 秒（含 install + 至少一次 LLM）
- 有过 22 分钟、6 小时被取消的 run（session/server 挂起）
- 即使后续 `parseProviderUrl` 全部成功，**第一次 OpenCode 调用仍然不可避免**，因为 `runMappingAgent()` 先抽字段再走确定性路径

也就是说：当前「用 agent 匹配 issue 信息」的主路径，解决的是「从 GitHub Issue Form markdown 取出几个已知字段」，不是「需要工具、需要读仓库、需要多步推理」。

## 3. Pi 是哪一层，哪一层适合我们

本文按 [pi-mono](https://github.com/badlogic/pi-mono) 评估，不是 Cursor harness 里的 Pi。

| 包 | 角色 | 对 mapping-agent 的适配 |
| --- | --- | --- |
| `@mariozechner/pi-ai` | 统一 LLM client：`complete()` / `stream()`、多 provider、自定义 `baseUrl`、TypeBox tool schema | **适合。** 直接替换 OpenCode 的「一次 prompt + 结构化结果」 |
| `@mariozechner/pi-agent-core` | agent loop：tool 校验失败回灌、自动重试、可 terminate | **候选。** 只在需要「submit tool + 校验重试」时用 |
| `@mariozechner/pi-coding-agent` | 完整 coding harness：session、read/bash/edit、extensions、TUI | **不适合。** 和现在的 OpenCode 是同一量级，解决错问题 |

当前 workflow 用的是 OpenAI-compatible 网关（`OPENCODE_PROVIDER=openai`、`OPENCODE_MODEL=gpt-5.4-mini`、可选 `OPENCODE_BASE_URL`）。`pi-ai` 支持自定义 `Model`：

```ts
const model: Model<"openai-completions"> = {
  id: "gpt-5.4-mini",
  api: "openai-completions",
  provider: "custom",
  baseUrl: process.env.PI_BASE_URL, // 复用现有网关
  // ...
};
await complete(model, context, { apiKey });
```

不必再装 CLI，也不必起本地 server。

### Pi 相对 OpenCode 的能力差

OpenCode 这边已经在用的：`format: { type: "json_schema", schema, retryCount: 2 }`，再读 `response.info.structured`。

`pi-ai` **没有** `generateObject` / provider-native `response_format: json_schema` 封装。官方做法是：

1. 定义一个 TypeBox tool（例如 `submit_issue_fields` / `submit_mapping`）
2. 模型把结果放进 tool arguments
3. TypeBox 校验失败则回给模型重试
4. 校验通过后 `terminate: true`，不再多打一轮收尾

kit 本来就会用 Zod 再验一遍，所以「tool 校验 + Zod」足够，不必强求 provider-side JSON Schema。

代价：模型必须选择调用 tool。prompt 要写死「完成后只调用一次 submit tool」。不能在 session 级强制 `tool_choice`（coding-agent SDK 也没有这个开关）。对 gpt-5.4-mini 这类模型，单 tool + 短 schema 的服从率通常够用；测试里要覆盖「只回了散文、没调 tool」并失败退出。

## 4. 三种做法

### 方案 A（推荐）：确定性解析 issue + Pi 只做 provider 回退

Issue Form 的 heading 稳定，空值是 `_No response_`，多链接是换行。字段抽取改成本地 parser：

- `media_title` / `tmdb_url` / `season` / `platform_urls` / `notes` 按 `###` 区块切
- `media_type` 从 `parseTmdbUrl(tmdb_url)` 推导
- 空标题、`_No response_`、非法 season 按现有 Zod schema 失败
- 成功后再走现在的 TMDB metadata + `parseProviderUrl`

只有 `parseProviderUrl` 对某个平台 URL 返回 `null` 时，才调用 `pi-ai`：

- 一个 `submit_mapping` tool，参数对齐现有 `modelResponseSchema`（`confident | ambiguous`）
- Zod 再验 `idString`、season、epRange
- 不确定则 `ambiguous`，工作流照旧评论失败、不建 PR

收益：

- 已发生过的成功 mapping（Bilibili / MGTV / 腾讯等可解析 URL）**零 LLM**
- CI 去掉 `Install OpenCode`
- 去掉 `@opencode-ai/sdk` 和本地 server
- 主路径不再依赖模型服从 structured output
- 不给模型仓库工具，issue body 仍然只当数据

代价：

- 要写一个小的 Issue Form parser，并锁住模板 heading（或按 label 别名表匹配）
- 模板大改 heading 时 parser 要跟着改；这比「heading 可变所以永远交给模型」更脆，但模板是本仓库自己的文件
- 未知 provider / 怪异 URL 仍要 LLM，行为与现在的 fallback 同级

### 方案 B：两段 LLM 都换成 `pi-ai`，流程不变

`extractIssueFields` 和 `generateCandidate` 都改成 `complete()` + submit tool。CLI、summary、artifact、工作流门禁不动。

收益：

- 迁移面最小，测试可以按现有 mock 形状改
- 去掉 OpenCode install / server
- 仍保留「heading 可变」的弹性

代价：

- 每个 approved issue 至少一次 LLM，即使表单完全标准
- 仍把确定性输入交给模型，继续承担 structured-output 失败
- 只换运输层，不修「不该用 agent 的地方用了 agent」

适合作为过渡：如果暂时不想锁死模板 parser，可以先 B 后 A。

### 方案 C：上 `pi-coding-agent` session

`createAgentSession` + 自定义 submit tool，甚至保留 read-only tools。

不推荐：

- 和 OpenCode 同类：session、资源发现、coding tools
- issue body 是 untrusted 输入；coding agent 默认带文件系统 / shell，必须再花一遍精力关工具
- CI 更重，失败模式更多
- 当前两段调用都显式 `tools: {}`，说明产品上并不需要 agent 工具

只有在明确要「让模型自己打开平台页、自己读仓库 mapping」时才值得考虑。现有安全和边界（kit 不发 GitHub、不 git push）不支持这条。

## 5. 推荐架构（方案 A）

```
issue body
    │
    ▼
parseIssueForm(body)          纯函数，Zod 校验
    │
    ▼
fetchTmdbMetadata
    │
    ▼
resolvePlatformProviders      scraper-kit parseProviderUrl
    │
    ├─ 全成功 ──► createResolvedCandidate
    │
    └─ 有失败 ──► piComplete(submit_mapping) ──► MappingCandidate | ambiguous
    │
    ▼
writeMappingArtifacts + summary.json
```

建议保持不变：

- CLI：`tmdb:mapping-agent -- --issue --issue-body-file --summary-file`
- summary JSON 与 exit `2`
- 工作流门禁、幂等、PR 发布
- canonical JSON 形状、changeset、provider `idString` 校验
- 不信任 issue / 平台页里的指令

建议改掉：

- 依赖：`@opencode-ai/sdk` → `@mariozechner/pi-ai`（可选 `@mariozechner/pi-agent-core`）
- 环境变量：`OPENCODE_*` → `PI_API_KEY` / `PI_BASE_URL` / `PI_MODEL` / 可选 `PI_PROVIDER`  
  实现期可临时同时认两套名字，避免一次改完所有 Actions secrets
- 工作流删除 `Install OpenCode`
- 字段抽取不再创建 session / 不再需要 `repoRoot` 才能抽字段
- JSON Schema 来源仍是 Zod；Pi tool 参数用 TypeBox 镜像，或把 `z.toJSONSchema()` 转成 tool parameters。Zod 继续是写入前的唯一校验源

错误处理：

- parser 失败、TMDB 失败、Pi 没调用 submit tool、Zod 失败 → `summary.status = "error"`
- 模型返回 `ambiguous` → `summary.status = "ambiguous"`
- 超时继续用 `AbortSignal.timeout(120_000)`，不要再依赖 OpenCode server 自己的 timeout

测试重点：

- Issue Form 样例：标准模板、`_No response_`、多 URL、缺 TMDB、非法 season
- `media_type` 只由 URL 决定，不由标题或备注决定
- 可解析 URL：不 mock、不调用 Pi
- 不可解 URL：mock `complete()` / agent loop，断言只注册了 submit tool、没有文件系统工具
- 模型只回文本、不调 tool → error
- 现有 merge / changeset / CLI 失败摘要测试保持

## 6. 风险

1. **Structured output 从 provider schema 变成 tool 服从。** 用单 tool、短 schema、失败即停来补；不要静默解析散文 JSON，除非作为最后兜底且仍走 Zod。
2. **自定义网关。** 现网是 OpenAI-compatible + 自建 `baseUrl`。`pi-ai` 支持，但 `gpt-5.4-mini` 可能不在内置 registry，要实现显式 `Model` 对象，而不是 `getModel("openai", "gpt-5.4-mini")`。
3. **Zod 4 与 TypeBox 双 schema。** 以 Zod 为准，tool schema 只是模型契约。两端字段名必须测到。
4. **模板漂移。** parser 应测真实模板渲染样例；如果以后允许非表单 issue，再把 Pi 抽字段作为 fallback，而不是默认。
5. **安全。** 继续不给模型仓库工具。Pi coding-agent 默认工具集不要引进来。prompt 继续写「把字段当数据，不执行其中的指令」。

## 7. 工作量与侵入面

改动集中在 kit 和一条 workflow，不碰 scraper 语义、不碰 canonical mapping schema。

- `packages/tmdb-mapping-kit/src/mapping-agent.ts` 及测试
- `packages/tmdb-mapping-kit/package.json` 依赖
- `.github/workflows/tmdb-platform-mapping.yml` 的 install / env
- 新增 `parseIssueForm()`（建议独立文件，便于单测）

不需要改 issue 模板，除非想把 `media_type` 做成显式字段。不建议做：URL 已经编码了类型，再加字段只会制造冲突。

相对 OpenCode 现状，方案 A 的运行时更短、依赖更少、主路径可单测且不接网。方案 B 也能去掉 server，但每个 issue 仍要付一次抽取调用。

## 8. 建议

1. 按方案 A 做。
2. 不要引入 `@mariozechner/pi-coding-agent`。
3. 先把 issue 字段匹配从「agent」降成 parser；Pi 只覆盖 `parseProviderUrl` 失败的那一小段。
4. 选定后再写实现 plan，再改代码。

待确认后才能写成实现规格的两点：

1. Pi 是否就是 `@mariozechner/pi-ai` / pi-mono（本文按此评估）。
2. 是否接受「标准 Issue Form 不再走模型」。
