---
"@rexnow/danmu-universal": patch
---

修复 0.18.0 在 Rex 中加载失败（encoding API missing）：运行时缺少 TextEncoder / TextDecoder 时补上 UTF-8 实现。
