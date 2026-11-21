# 李志音乐插件 (@rexnow/lizhi)

[![NPM Version](https://img.shields.io/npm/v/@rexnow/lizhi)](https://www.npmjs.com/package/@rexnow/lizhi)
[![License](https://img.shields.io/npm/l/@rexnow/lizhi)](https://github.com/baranwang/rex-widget)

面向 Rex `0.0.7+` 原生音乐体验的李志音乐模块（`contentType: "music"`），参考 [djyde/mygo-lizhi](https://github.com/djyde/mygo-lizhi)，收听公开仓库 [nj-lizhi/song](https://github.com/nj-lizhi/song) 收录的李志专辑与现场录音。

> 免责声明：音频版权归原作者所有，本插件仅索引并播放公开仓库中的音频文件，仅供个人学习与欣赏。

## 功能特性

- **首页推荐与每日精选**：每日基于日期生成固定的 30 首随机推荐（`今天听李志` 歌单与曲目列表），支持筛选今日推荐、全部专辑与最近播放。
- **专辑与全部歌曲浏览**：自然数字排序展示全部专辑与现场录音，支持按默认、曲目数或每日随机排序；专辑详情提供完整曲目列表与相关专辑推荐。
- **原生电台连播（`musicRadios`）**：内置「随机播放」（全部曲库随机顺序连播）与「今天听李志」电台。
- **原生歌手主页（`musicArtists`）**：支持歌手资料、每日精选歌曲与全部专辑分区。
- **搜索**：支持按歌曲、专辑、歌手（`李志` / `lizhi` / `li zhi`）以及混合搜索，优先匹配歌名再匹配专辑名。
- **最近播放**：在 `loadDetail` 播放时自动记录本机最近播放历史（最多保留 50 首）。
- **容错与大文件分流**：
  - 优先读取 GitHub Tree API 获取完整目录与文件大小并缓存 24 小时；不可用时自动降级读取 `audio/list-v2.js`（缓存 1 小时），全部失败时回退本地旧缓存。
  - 默认经 `testingcf.jsdelivr.net` 加载封面与 20 MB 以内音频，支持在全局参数中切换 CDN 线路；超过 20 MB 的大文件（长曲现场、FLAC、WAV）自动切换至 `raw.githubusercontent.com`。
  - 自动为 `.flac` 指定软件解码（`playerType: "app"`），并可在全局参数中覆盖播放器偏好。
- **多语言支持**：内置简体中文、繁体中文与英文词典。

> 说明：由于 Rex `0.0.7` 模块协议暂未提供同步歌词（LRC）接口，暂不包含原插件的 LRCLIB 滚动歌词功能。

## 安装使用

### 一键安装

[![Rex Widget](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Funpkg.com%2F%40rexnow%2Flizhi%2Fpackage.json&query=%24.version&prefix=%E6%9D%8E%E5%BF%97%20v&style=flat-square&label=Rex%20Widget&labelColor=black)](https://rexnow.tv/widget/?url=https://unpkg.com/@rexnow/lizhi)

安装链接：<https://rexnow.tv/widget/?url=https://unpkg.com/@rexnow/lizhi>

### 手动安装

在 Rex `0.0.7+` 的模块管理中导入以下 URL：

```text
https://unpkg.com/@rexnow/lizhi
```

## 开发

### 构建

```bash
pnpm --filter @rexnow/lizhi build
```

### 测试

```bash
pnpm --filter @rexnow/lizhi test
```

## 鸣谢

- [djyde/mygo-lizhi](https://github.com/djyde/mygo-lizhi)
- [nj-lizhi/song](https://github.com/nj-lizhi/song)
