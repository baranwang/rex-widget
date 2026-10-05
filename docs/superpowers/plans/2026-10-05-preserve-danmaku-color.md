# 保留弹幕颜色 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加默认开启的「保留弹幕颜色」开关，关闭后统一返回白色弹幕。

**Architecture:** 在应用配置层扩展共享 schema 的解析结果，并通过既有 WidgetMetadata 注册两态枚举。在 `Scraper.getSegmentWithTime` 的最终 `p` 序列化处选择原色或 `DEFAULT_COLOR_INT`，保持抓取、缓存和聚合语义。

**Tech Stack:** TypeScript、Zod 4、Rstest、Rslib、pnpm workspace、Changesets。

**Spec:** `docs/superpowers/specs/2026-10-05-preserve-danmaku-color.md`（执行前与本计划一起阅读）。

## Global Constraints

- 标题：`保留弹幕颜色`。
- 说明：`关闭后，弹幕统一显示为白色`。
- 选项：`开启` / `关闭`，默认 `开启`。
- 配置名：`global.content.preserveDanmakuColor`；宿主值为字符串 `"true"` / `"false"`，内部为 boolean。
- 白色：`16777215`（`0xffffff`），复用 `DEFAULT_COLOR_INT`。
- 缺失或非法配置回退为开启，兼容没有此字段的旧配置。
- 完整版、精简版均提供此选项，普通弹幕请求和切片请求均生效。
- 颜色仅在最终序列化 `CommentItem.p` 时转换，不修改抓取器、原始弹幕对象或缓存。
- 保留现有聚合键（模式、原始颜色、文本）及聚合次数；关闭开关不改变数量、文本、时间、模式、ID 和来源。
- 复用现有 Zod、Rstest 和 Rslib 工具链，不新增依赖。
- 扩展应用自己的配置 schema，不把展示偏好加入共享 `scraper-kit`。
- 本次不增加彩色比例模式或颜色过滤；不发布、不手动修改版本号。

## Review Focus

- 旧配置缺失或非法新字段：保持原色；原有聚合、繁简转换和平台配置继续解析（Task 1）。
- 关闭后重新开启，或后续请求省略该字段：恢复原色，复用的抓取结果不被修改（Task 2）。
- 原色不同但模式/文本相同：关闭后仍保留原有聚合分组和计数（Task 2）。
- 多源弹幕、三种模式、白色及黑色原色：关闭后全部为白色，其余返回字段不变（Task 2）。
- 空切片及一个平台失败：沿用现有空结果和部分成功行为，完整版/精简版均显示开关（Task 2）。

---

## 文件职责

- `apps/danmu-universal/src/index.ts`：设置项元数据；已有入口共享同一输出路径；在已有内联测试区验证元数据。
- `apps/danmu-universal/src/rex-widget-env.d.ts`：宿主参数类型声明，与元数据保持一致；若构建会生成该文件，以构建生成结果为准。
- `apps/danmu-universal/src/scrapers/config.ts`：应用独有配置解析与推导类型，保留 `Unflatten` 导出。
- `apps/danmu-universal/src/scrapers/config.test.ts`（新建）：配置默认值与旧配置兼容性。
- `apps/danmu-universal/src/scrapers/index.ts`：只调整最终颜色输出。
- `apps/danmu-universal/src/scrapers/comment-color.test.ts`（新建）：通过公开方法验证颜色、聚合及对象不变性。
- `apps/danmu-universal/README.md`：说明开关默认值和作用。
- `.changeset/preserve-danmaku-color.md`（新建）：`@rexnow/danmu-universal` 的 minor 发布说明。

## 执行准备

- 用户最新明确决定「那就白色吧」；不再依赖系统颜色继承协议。已完成 Task 1，Task 2 同步修正之前的文案及断言。
- 使用 `superpowers:using-git-worktrees` 确认隔离工作区，保留已有修改。
- 仓库当前没有安装依赖；先在仓库根目录运行 `pnpm install --frozen-lockfile`，不得以此修改锁文件。
- Rstest 配置的 `execArgv` 要求应用目录存在 `.env`；若缺失，从 `.env.example` 创建本地文件即可。本计划的测试全部使用固定数据，不需真实 TMDB 令牌，不输出既有 `.env` 内容。
- 测试 API 显式从 `@rstest/core` 导入；因 `isolate: false`，对 provider 方法的替换必须在 `finally` 中恢复。

### Task 1: 注册开关并解析应用配置

**Files:**
- Modify: `apps/danmu-universal/src/index.ts`（`WidgetMetadata.globalParams` 和已有内联测试区）
- Modify: `apps/danmu-universal/src/rex-widget-env.d.ts`（`GlobalParams`）
- Modify: `apps/danmu-universal/src/scrapers/config.ts`
- Create/Test: `apps/danmu-universal/src/scrapers/config.test.ts`

**Interfaces:**
- Consumes: 共享 `globalParamsConfigSchema`，输入为宿主扁平参数，输出含 `global.content`、`global.experimental` 和 `provider`。
- Produces: 应用导出的 `globalParamsConfigSchema`，输出新增 `global.content.preserveDanmakuColor: boolean`；`GlobalParamsConfig = z.infer<typeof globalParamsConfigSchema>`。
- Produces: 宿主参数 `"global.content.preserveDanmakuColor": "true" | "false"`，不更改 `Scraper.setGlobalParams(params: BaranwangDanmuUniversal.GlobalParams)` 签名。

- [x] **Step 1: 添加失败的配置测试及元数据内联测试**

配置测试导入本地 `./config`，用 `test.each` 验证 `{}`、`"true"`、`"false"`、`"invalid"` 和 boolean `false` 分别解析成 `true`、`true`、`false`、`true`、`true`；最终审查补充 `"off"`、`"0"`、`"FALSE"`、`null` 和数组输入，全部回退为 `true`。核心断言：

```ts
expect(globalParamsConfigSchema.parse(input).global.content.preserveDanmakuColor).toBe(expected);
```

增加兼容测试，输入聚合 `"false"`、转换 `"tc2sc"`、人人模式 `"choice"` 和新开关 `"false"`，断言对应输出分别为 `false`、`"tc2sc"`、`"choice"`、`false`，并检查 `global.experimental.doubanHistory.enabled === false`。

在 `src/index.ts` 既有内联测试区按配置名查找元数据，断言包含：

```ts
expect(option).toMatchObject({
  title: "保留弹幕颜色",
  name: "global.content.preserveDanmakuColor",
  description: "关闭后，弹幕统一显示为白色",
  value: "true",
  type: "enumeration",
  enumOptions: [
    { title: "开启", value: "true" },
    { title: "关闭", value: "false" },
  ],
});
expect(option?.belongTo).toBeUndefined();
```

- [x] **Step 2: 验证测试失败**

Run: `pnpm --filter @rexnow/danmu-universal exec rstest run src/scrapers/config.test.ts src/index.ts -t 'preserveDanmakuColor|保留弹幕颜色'`

测试名使用上述关键字。Expected: 因缺失新配置输出和元数据失败，不能是环境错误。

- [x] **Step 3: 实现配置、声明和元数据**

在本地 `config.ts` 将共享 schema 重命名导入，与应用独有的 Zod schema 用 `z.intersection` 合并。新 schema 解析扁平键 `global.content.preserveDanmakuColor`（`z.enum(["true", "false"]).catch("true").transform(value => value === "true")`），transform 输出 `{ global: { content: { preserveDanmakuColor: boolean } } }`；交集保留全部共享字段。保持 `Unflatten` 类型转导出，并从合并后的 schema 推导 `GlobalParamsConfig`。

在元数据「弹幕内容聚合」之后加入 Step 1 指定的选项，不设置 `belongTo`；在宿主 `GlobalParams` 中增加同名参数和对应说明、默认值。

- [x] **Step 4: 验证配置和元数据测试通过**

Run: Step 2 的命令。Expected: 所有选中的测试通过。

- [x] **Step 5: 提交该任务**

只 stage 本任务四个文件，使用 `feat(danmu): add preserve color setting`，footer 为 `Co-authored-by: Codex <noreply@openai.com>`。

### Task 2: 应用输出颜色策略并验证可发布产物

**Files:**
- Modify: `apps/danmu-universal/src/index.ts`（开关说明及元数据测试改为最终白色文案）
- Modify: `apps/danmu-universal/src/rex-widget-env.d.ts`（同步最终开关说明）
- Modify: `apps/danmu-universal/src/scrapers/index.ts`（`getSegmentWithTime` 最终 `comments.push`）
- Create/Test: `apps/danmu-universal/src/scrapers/comment-color.test.ts`
- Modify: `apps/danmu-universal/README.md`
- Create: `.changeset/preserve-danmaku-color.md`

**Interfaces:**
- Consumes: Task 1 的 `GlobalParamsConfig.global.content.preserveDanmakuColor: boolean`。
- Consumes: `DEFAULT_COLOR_INT`，来自 `../libs/constants`，值为 `16777215`。
- Exercises: `Scraper.setGlobalParams(params: BaranwangDanmuUniversal.GlobalParams)` 和 `Scraper.getDanmuWithSegmentTimeByVideoId(id: string, segmentTime: number): Promise<CommentItem[]>`。
- Produces: 不变的 `CommentItem[]` 接口，`p` 的第三个逗号分隔字段遵循颜色开关。

- [x] **Step 1: 添加公开路径的失败测试**

新建 `Scraper`，替换实例 `scraperMap.tencent` / `scraperMap.bilibili` 的 `getSegments` 为返回 `[{ provider: 对应平台名, segmentId: "s1", startTime: 0 }]` 的固定切片，`getComments` 返回固定对象；无需请求网络。每个用例先 `setGlobalParams`，旧配置使用 `{}` 类型断言模拟宿主缺失字段。替换方法在 `finally` 恢复。

测试名及断言：

- `preserveDanmakuColor keeps original colors by default and when enabled`：红色 `16711680`、深蓝 `139`、黄色 `16776960`、黑色 `0`、白色 `16777215` 的输出色与原色相等。
- `preserveDanmakuColor returns white across providers and modes`：两个来源及模式 `1`、`4`、`5`，关闭后的每条 `p.split(",")[2] === "16777215"`；与开启结果比较，`cid`、`m` 和 `p` 的其他字段完全相等。
- `preserveDanmakuColor restores colors without mutating source comments`：对同一组对象依次请求 `"false"`、`"true"`、`"false"`、缺省配置；期望白色、原色、白色、原色。抓取原始数组与请求前 deep copy 相等。
- `preserveDanmakuColor preserves aggregation groups`：两条红色同文同模式弹幕，时间 `2` / `1`；另有一条蓝色同文同模式弹幕，时间 `3`。聚合开启时，不论颜色开关，均得到两条，文本分别为 `"相同文本 × 2"` 和 `"相同文本"`，时间分别为 `"1.00"` 和 `"3.00"`；聚合关闭时得到三条且无计数后缀。
- `preserveDanmakuColor keeps empty and partial-success behavior`：空切片返回 `[]`；腾讯抓取抛错而哔哩哔哩成功时仍返回后者弹幕，关闭时为白色。

- [x] **Step 2: 验证颜色测试失败**

Run: `pnpm --filter @rexnow/danmu-universal exec rstest run src/scrapers/comment-color.test.ts`

Expected: 关闭颜色的用例因仍输出原色失败；默认及其他原有行为可以通过。

- [x] **Step 3: 实现输出策略**

同步 `index.ts` 元数据、内联测试和 `rex-widget-env.d.ts` 的说明为 `关闭后，弹幕统一显示为白色`。在 `getSegmentWithTime` 最终序列化时，开启使用 `item.color`，关闭使用 `DEFAULT_COLOR_INT`；只替换 `p` 中的颜色值，保持方法签名、聚合键及计数逻辑不变。无需新增 helper 或调整抓取器。

- [x] **Step 4: 验证颜色测试及相关本地回归**

Run: `pnpm --filter @rexnow/danmu-universal exec rstest run src/scrapers/comment-color.test.ts src/scrapers/config.test.ts src/scrapers/episode-context.test.ts src/index.ts`

Expected: 所有选中文件测试通过；测试不要求真实网络令牌。

- [x] **Step 5: 更新使用说明及 changeset**

README 增加设置说明：默认开启保留原色，关闭后全部白色，适用于完整/精简版。Changeset front matter 为 `"@rexnow/danmu-universal": minor`，正文说明新增默认开启的保留颜色开关，关闭统一白色。

- [x] **Step 6: 校验格式和构建**

Run: `pnpm exec biome check apps/danmu-universal/src/index.ts apps/danmu-universal/src/rex-widget-env.d.ts apps/danmu-universal/src/scrapers/config.ts apps/danmu-universal/src/scrapers/config.test.ts apps/danmu-universal/src/scrapers/index.ts apps/danmu-universal/src/scrapers/comment-color.test.ts`

Expected: 无错误；必要时按仓库格式修正。

Run: `pnpm exec turbo run build --filter=@rexnow/danmu-universal...`

Expected: 依赖构建和完整/精简版构建全部成功。检查两个 `dist/danmu-universal*.js` 的 WidgetMetadata 都包含 Step 1 指定的开关、默认值和选项，不受精简版隐藏条件限制；检查生成的类型声明与配置名一致，不提交 `dist`。若构建更改声明，仅保留本功能所需差异。

- [x] **Step 7: 提交该任务**

只 stage 本任务文件及构建产生的必要声明差异，使用 `feat(danmu): support white-only comment output`，footer 为 `Co-authored-by: Codex <noreply@openai.com>`。

## 执行记录

Task 1 已完成并通过独立任务审查，提交 `10d738a`。用户最新选择统一白色，Task 2 接入输出策略并同步最终文案；不再受缺省颜色协议调查结果阻塞。使用用户选择的 subagent-driven-development 持续执行，不重复请求批准。

最终审查补充：严格限制新字段的输入为两个枚举字符串，其余回退开启；实现及边界测试提交 `103ef0d`，已完成相应 RED/GREEN 和应用重建。既有声明生成插件提示为独立后续事项，当前声明手动同步并验证；尚未做实际宿主像素渲染测试。
