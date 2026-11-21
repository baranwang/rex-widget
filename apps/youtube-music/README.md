# YouTube Music 插件 (@rexnow/youtube-music)

[![NPM Version](https://img.shields.io/npm/v/@rexnow/youtube-music)](https://www.npmjs.com/package/@rexnow/youtube-music)
[![License](https://img.shields.io/npm/l/@rexnow/youtube-music)](https://github.com/baranwang/rex-widget)

面向 Rex `0.0.7+` 原生音乐体验的 YouTube Music 模块（`contentType: "music"`），支持无需本地 `ffmpeg` / `yt-dlp` 的直接音频流播放。

> 免责声明：本插件与 YouTube / Google 无任何关联或背书，依赖 YouTube Music 私有接口，可能随上游变更而失效，仅供个人学习与使用。

## 功能特性

- **无需登录即可使用**：首页推荐、排行榜、新发行、流派与心情（原生 `musicGenres`）、电台（原生 `musicRadios`）、歌手资料与作品（原生 `musicArtists`）、搜索（歌曲/专辑/歌手/歌单）、专辑与歌单详情、直接音频播放。
- **可选 Cookie 登录**：填入 `music.youtube.com` 的请求 Cookie（含 `SAPISID` / `__Secure-3PAPISID`）后，自动使用 `SAPISIDHASH` 认证，解锁个人首页推荐、我喜欢的音乐、我的歌单、最近播放以及可选的收听历史记录上报。
- **直接音频播放**：主通道沿用 VisionOS 客户端获取无需签名解密的直链音频流，并在失败时自动回退 iOS 客户端；默认优先选择兼容性最佳的 `AAC (M4A)`，也支持在模块设置中切换 `Opus (WebM)`（自动指定 `playerType: "app"` 软解）或最高码率。
- **多语言支持**：内置简体中文、繁体中文与英文界面词典，并根据 Rex 注入的 `language` 参数向 YouTube Music 请求对应语言目录。

## 安装使用

### 一键安装

[![Rex Widget](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Funpkg.com%2F%40rexnow%2Fyoutube-music%2Fpackage.json&query=%24.version&prefix=YouTube%20Music%20v&style=flat-square&label=Rex%20Widget&labelColor=black)](https://rexnow.tv/widget/?url=https://unpkg.com/@rexnow/youtube-music)

安装链接：<https://rexnow.tv/widget/?url=https://unpkg.com/@rexnow/youtube-music>

### 手动安装

在 Rex `0.0.7+` 的模块管理中导入以下 URL：

```text
https://unpkg.com/@rexnow/youtube-music
```

### 可选：配置 Cookie

> 为什么不能直接用 `console.log(document.cookie)`？  
> Google 将核心登录态字段（`HSID`、`SSID`、`__Secure-1PSID`、`__Secure-3PSID` 等）设为了 `HttpOnly`，浏览器禁止页面 JS / Console 读取；只填单个 `SAPISID` 值也无法通过鉴权，必须从 **Network（网络）** 面板复制。

只需 2 步（不用写任何代码）：

1. 桌面浏览器登录 [https://music.youtube.com](https://music.youtube.com) → 打开开发者工具（`F12` / `Cmd+Option+I`）→ 切到 **Network（网络）** 面板 → 筛选 `browse`（若列表为空，刷新页面或点一下左侧「媒体库」）。
2. 以下两种方式**任选其一**，直接粘贴到 Rex 模块设置的「YouTube Music Cookie（可选）」即可：
   - **方式 A（推荐，最省事）**：右键任意一条 `browse?prettyPrint=false` 请求 → **Copy → Copy as cURL (bash)**（Safari 为「拷贝为 cURL」），把整段 cURL 直接粘贴进去，插件会自动提取完整 Cookie（含多账号 `x-goog-authuser` 与品牌账号 `x-goog-pageid`）。
   - **方式 B（只复制纯净 Cookie）**：点开一条 `browse?prettyPrint=false` 请求 → 右侧 **Headers → Request Headers** → 右键 `cookie` 这一行 → **Copy value**，粘贴进去即可。内容应为多组 `key=value;` 键值对，例如：

```text
VISITOR_INFO1_LIVE=...; HSID=...; SSID=...; APISID=...; SAPISID=...; __Secure-1PSID=...; __Secure-3PSID=...; __Secure-3PAPISID=...
```

> 保存后请下拉刷新首页（首页模块有 600 秒缓存），或直接点进「我的音乐库」确认是否已加载出你的「我喜欢的音乐 / 我的歌单」。  
> **安全提醒**：完整 Cookie 等同于你的 Google 登录态，请勿分享给他人或发到公开页面。

## 开发

### 构建

```bash
pnpm --filter @rexnow/youtube-music build
```

### 测试

```bash
pnpm --filter @rexnow/youtube-music test
```

## 鸣谢

- [egoist/mygo-music-youtube-music](https://github.com/egoist/mygo-music-youtube-music)
