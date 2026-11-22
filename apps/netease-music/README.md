# 网易云音乐插件 (@rexnow/netease-music)

[![NPM Version](https://img.shields.io/npm/v/@rexnow/netease-music)](https://www.npmjs.com/package/@rexnow/netease-music)
[![License](https://img.shields.io/npm/l/@rexnow/netease-music)](https://github.com/baranwang/rex-widget)

面向 Rex `0.0.7+` 原生音乐体验的网易云音乐模块（`contentType: "music"`），纯 JavaScript 实现 EAPI 加密与明文音频直链播放，无需任何外部后端或原生组件。

> 免责声明：本插件与网易云音乐无任何关联或背书，依赖公开及客户端接口，可能随上游变更而失效，仅供个人学习与使用。

## 功能特性

- **无需登录即可使用**：首页推荐（含精品歌单）、排行榜（官方榜 / 全球榜 / 歌手榜）、新歌速递（新专辑 / 新歌，按地区筛选）、歌单分类与曲风馆（原生 `musicGenres`，支持曲风馆原生歌曲/专辑/歌手与精品标签）、播客电台（精选播客、热门电台榜、新晋电台榜、热门节目榜与单集直连播放）、电台与漫游（跑步漫游、私人雷达与榜单电台，原生 `musicRadios`）、歌手主页（地区/类型筛选、热门歌手、歌曲、专辑、完整生平资料、相似歌手，原生 `musicArtists`）、搜索（混合 / 歌曲 / 按歌词搜歌 / 专辑 / 歌手 / 歌单 / 播客电台 / 声音单集，留空展示实时热搜榜并可点开直接播放）、专辑与歌单详情（附相关推荐、可点击标签与 MV 预告片）、免费歌曲直接音频播放。
- **原生时间轴歌词（`loadSubtitle`）**：接入网易云歌词接口，支持自动合并时间戳的**双语歌词（原文 + 译文）**、原文歌词、中文翻译歌词与罗马音歌词，并通过纯 JS Base64 `data:` URI 返回。
- **可选 Cookie 登录**：支持直接粘贴单个 `MUSIC_U` 值、完整 Cookie 请求头或浏览器 `Copy as cURL`。配置后自动解锁每日推荐、历史日推、私人漫游（默认 / 熟悉 / 探索）、场景漫游（运动 / 专注 / 深夜情绪）、心动模式、我的音乐库（我喜欢的音乐 / 我的歌单 / 音乐云盘 / 最近播放歌曲·专辑·歌单 / 收藏的专辑 / 关注的歌手 / 订阅的播客电台 / 听歌排行）、动态封面（`albumMotionArtwork`）、听歌打卡上报以及黑胶 VIP / SVIP 高解析音质。
- **高兼容直链播放**：通过纯 JS 实现 MD5 + AES-128-ECB EAPI 请求 `/api/song/enhance/player/url/v1`，内置 `-460` 风控重试、服务端 `NMTID` 自动刷新与旧版 `player/url` 接口回退；支持标准 / 较高 / 极高 / 无损 / Hi-Res / 高清臻音（`jyeffect`）/ 沉浸环绕声（`sky`）/ 杜比全景声（`dolby`）/ 臻音全景声（`vivid`，自动切换 Android 客户端协议）/ 超清母带（`jymaster`）音质档位、VIP 30 秒试听开关，并在自动模式下将独立 FLAC/ALAC 自动路由至软件解码（`playerType: "app"`）。
- **多语言支持**：内置简体中文、繁体中文与英文界面词典。

## 安装使用

### 一键安装

[![Rex Widget](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Funpkg.com%2F%40rexnow%2Fnetease-music%2Fpackage.json&query=%24.version&prefix=%E7%BD%91%E6%98%93%E4%BA%91%E9%9F%B3%E4%B9%90%20v&style=flat-square&label=Rex%20Widget&labelColor=black)](https://rexnow.tv/widget/?url=https://unpkg.com/@rexnow/netease-music)

安装链接：<https://rexnow.tv/widget/?url=https://unpkg.com/@rexnow/netease-music>

### 手动安装

在 Rex `0.0.7+` 的模块管理中导入以下 URL：

```text
https://unpkg.com/@rexnow/netease-music
```

### 可选：配置 Cookie

1. 在桌面浏览器登录 [https://music.163.com](https://music.163.com)，打开开发者工具（`F12` / `Cmd+Option+I`）切换到 **Network（网络）** 或 **Application（应用）→ Cookies**。
2. 以下任意一种方式均可直接粘贴到模块设置的「网易云音乐 Cookie（可选）」中：
   - **仅粘贴 `MUSIC_U` 值（最简）**：复制 `MUSIC_U` 对应的值直接粘贴，插件会自动补全 `MUSIC_U=` 前缀。
   - **粘贴完整 Cookie 字符串**：例如 `MUSIC_U=...; __csrf=...; NMTID=...`。
   - **直接粘贴 Copy as cURL**：在 Network 面板中右键任意 `music.163.com` 请求 → **Copy as cURL** 整段粘贴。

> 说明：`MUSIC_U` 等同于网易云音乐账号登录凭证，请妥善保管；部分地区/版权歌曲受网易云地区限制影响，需视当前网络环境而定。

## 开发

### 构建

```bash
pnpm --filter @rexnow/netease-music build
```

### 测试

```bash
pnpm --filter @rexnow/netease-music test
```
