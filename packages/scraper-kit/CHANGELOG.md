# @rexnow/scraper-kit

## 0.0.2

### Patch Changes

- 3146553: 接入 MediaRef：先按 TMDB 季和集解析各平台合集和分集，解析不到再走豆瓣和模糊搜索；移除本地 TMDB 映射表和映射 agent，映射以 MediaRef 为准；移除弹幕繁简转换；生产产物加密。请求和报错日志遮掉 X-API-Key、Authorization、Cookie 请求头。
- Updated dependencies [3146553]
  - @rexnow/libs-fetch@0.0.2

## 0.0.1

### Patch Changes

- Updated dependencies [dc2b01d]
  - @rexnow/libs-fetch@0.0.1
  - @rexnow/libs-storage@0.0.1
