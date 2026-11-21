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

> 重要提示：YouTube Music 鉴权必需的登录态字段（`HSID`、`SSID`、`__Secure-1PSID`、`__Secure-3PSID` 等）带有 `HttpOnly` 标记，**无法通过 `document.cookie` 直接读取**，也**不能只填写单个 `SAPISID` 值**，必须从浏览器 **Network（网络）** 面板获取完整请求的 Cookie。

#### 步骤 1：复制 `browse` 请求的 cURL

1. 在桌面浏览器登录 [https://music.youtube.com](https://music.youtube.com)。
2. 打开开发者工具（`F12` / `Cmd+Option+I`）→ 切到 **Network（网络）** 面板 → 在筛选框输入 `browse`（若列表为空，刷新页面或点一下左侧「媒体库」）。
3. 右键任意一条 `browse?prettyPrint=false` 请求 → **Copy → Copy as cURL (bash)**（Safari 为「拷贝为 cURL」，Firefox 为「复制为 cURL (POSIX)」）。

#### 步骤 2：粘贴到 Rex（二选一）

- **方式 A（最简单，直接粘贴）**：直接把刚才复制的**整段 cURL** 粘贴到 Rex 模块设置的「YouTube Music Cookie（可选）」中，插件会自动提取其中的完整 `Cookie`（同时保留多账号 `x-goog-authuser` 与品牌账号 `x-goog-pageid`）。
- **方式 B（控制台一键提取纯净 Cookie，适合发送到手机 / Apple TV）**：在浏览器的 **Console（控制台）** 粘贴以下脚本并回车，然后在页面右上角弹出的输入框中按 `Cmd+V` / `Ctrl+V` 粘贴刚才复制的 cURL，脚本会自动提取并校验必填字段，同时复制到剪贴板并打印到控制台：

```js
(() => {
  document.getElementById("rex-ytm-cookie-helper")?.remove();
  const el = (tag, css, text) => {
    const node = document.createElement(tag);
    if (css) node.style.cssText = css;
    if (text) node.textContent = text;
    return node;
  };
  const box = el(
    "div",
    "position:fixed;top:16px;right:16px;z-index:999999;width:380px;padding:14px;border-radius:12px;background:#18181b;color:#f4f4f5;box-shadow:0 12px 32px rgba(0,0,0,.5);font:13px/1.5 system-ui,sans-serif;border:1px solid #3f3f46",
  );
  box.id = "rex-ytm-cookie-helper";
  const head = el(
    "div",
    "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600",
  );
  const closeBtn = el("button", "background:none;border:none;color:#a1a1aa;cursor:pointer;font-size:16px", "×");
  closeBtn.type = "button";
  closeBtn.onclick = () => box.remove();
  head.append(el("span", "", "Rex YouTube Music Cookie 提取器"), closeBtn);
  const area = el(
    "textarea",
    "width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid #52525b;background:#09090b;color:#fafafa;font:12px/1.4 ui-monospace,monospace;resize:vertical",
  );
  area.rows = 4;
  area.placeholder = "在此按 Cmd+V / Ctrl+V 粘贴刚复制的 Copy as cURL...";
  const status = el("div", "margin-top:8px;color:#a1a1aa", "等待粘贴 cURL 或 Request Headers...");
  box.append(head, area, status);
  const extract = (raw) => {
    let t = raw.trim();
    if (/(?:^|\s)(?:curl\s+\^"|(?:-H|--header|-b|--cookie)\s+\^")/i.test(t)) {
      t = t.replace(/\^\r?\n/g, " ").replace(/\^([\s\S])/g, "$1");
    }
    const header = (name) => {
      const m =
        t.match(new RegExp(`(?:^|[\\s\\\\])(?:-H|--header)\\s+'${name}:\\s*((?:[^']|'\\\\'')*)'`, "i")) ||
        t.match(new RegExp(`(?:^|[\\s\\\\])(?:-H|--header)\\s+"${name}:\\s*((?:[^"\\\\]|\\\\.)*)"`, "i")) ||
        t.match(new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "i")) ||
        t.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, "im"));
      return m
        ? m[1]
            .replace(/'\\''/g, "'")
            .replace(/\\(["\\])/g, "$1")
            .trim()
        : "";
    };
    const b =
      t.match(/(?:^|[\s\\])(?:-b|--cookie)\s+'((?:[^']|'\\'')*)'/) ||
      t.match(/(?:^|[\s\\])(?:-b|--cookie)\s+"((?:[^"\\]|\\.)*)"/);
    const cookie =
      (b
        ? b[1]
            .replace(/'\\''/g, "'")
            .replace(/\\(["\\])/g, "$1")
            .trim()
        : "") ||
      header("cookie") ||
      (!/^\s*(?:curl\s+|fetch\s*\()/i.test(t) ? t.replace(/\r?\n+/g, "; ").trim() : "");
    return { cookie, authUser: header("x-goog-authuser"), pageId: header("x-goog-pageid") };
  };
  area.addEventListener("input", async () => {
    const { cookie, authUser, pageId } = extract(area.value);
    const hasSapisid = /(?:^|;\s*)(?:__Secure-3PAPISID|SAPISID)=/.test(cookie);
    const hasSession = /(?:^|;\s*)(?:HSID|SSID|__Secure-1PSID|__Secure-3PSID|LOGIN_INFO)=/.test(cookie);
    if (!cookie || !hasSapisid) {
      status.style.color = "#f87171";
      status.textContent =
        "❌ 未提取到完整 Cookie（请确认对 browse 请求执行了 Copy as cURL，不能只粘贴单个 SAPISID 值）";
      return;
    }
    if (!hasSession) {
      status.style.color = "#fbbf24";
      status.textContent =
        "⚠️ 缺少 HttpOnly 会话字段（HSID / __Secure-3PSID 等），请从 Network 面板复制 cURL 而非 document.cookie";
      return;
    }
    const out =
      (authUser && authUser !== "0") || pageId
        ? [
            `Cookie: ${cookie}`,
            ...(authUser ? [`X-Goog-AuthUser: ${authUser}`] : []),
            ...(pageId ? [`X-Goog-PageId: ${pageId}`] : []),
          ].join("\n")
        : cookie;
    area.value = out;
    area.select();
    console.log("[Rex YouTube Music Cookie]\n" + out);
    try {
      await navigator.clipboard.writeText(out);
      status.style.color = "#4ade80";
      status.textContent = "✅ 提取成功并已自动复制到剪贴板！请直接粘贴到 Rex 的「YouTube Music Cookie」设置中。";
    } catch {
      document.execCommand("copy");
      status.style.color = "#4ade80";
      status.textContent = "✅ 提取成功（内容已全选并打印到 Console），按 Cmd+C / Ctrl+C 复制后粘贴到 Rex 设置即可。";
    }
  });
  document.body.appendChild(box);
  area.focus();
})();
```

#### 最终贴到 Rex 设置里的是什么？

应该是包含多个 `key=value;` 键值对的**完整 Cookie 字符串**（而不是像 `AbCdEf123456/XyZ789...` 这样的单个字段值），例如：

```text
VISITOR_INFO1_LIVE=...; HSID=...; SSID=...; APISID=...; SAPISID=...; __Secure-1PSID=...; __Secure-3PSID=...; __Secure-3PAPISID=...
```

> 保存配置后，请下拉刷新首页（首页模块有 600 秒缓存），或直接打开「我的音乐库」确认是否已加载出你的「我喜欢的音乐 / 我的歌单」。
> **安全提醒**：完整 Cookie 等同于你的 Google 登录凭证，请勿分享给他人或上传到公开页面。

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
