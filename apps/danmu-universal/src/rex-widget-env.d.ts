/// <reference types='@rexnow/libs/env' />
declare namespace BaranwangDanmuUniversal {
    interface GlobalParams {
        /**
         * 模糊匹配
         * @description 是否开启模糊匹配
         * @default 'auto'
         */
        fuzzyMatch: 'auto' | 'always' | 'never';
        /**
         * 360 影视搜索（实验性）
         * @description 是否开启 360 影视搜索
         * @default 'false'
         */
        qihooSearch?: 'false' | 'true';
        /**
         * 未匹配到资源提示
         * @description 是否显示未匹配到资源提示
         * @default 'true'
         */
        emptyAnimeTitle: 'true' | 'false';
        /**
         * 弹幕内容聚合
         * @default 'true'
         */
        'global.content.aggregation': 'true' | 'false';
        /**
         * 保留弹幕颜色
         * @description 关闭后，弹幕统一显示为白色
         * @default 'true'
         */
        'global.content.preserveDanmakuColor': 'true' | 'false';
        /**
         * MediaRef API Key
         * @description 留空使用内置 key；填写后改用自己的 key
         * @default ''
         */
        'global.mediaRef.apiKey': string;
        /**
         * [人人视频] 弹幕模式
         * @description 弹幕模式，精选弹幕相比默认弹幕质量更高
         * @default 'default'
         */
        'provider.renren.mode': 'default' | 'choice';
        /**
         * 豆瓣书影音档案（实验性）
         * @description 是否开启自动同步豆瓣书影音档案
         * @default 'false'
         */
        'global.experimental.doubanHistory.enabled': 'false' | 'true';
        /**
         * 豆瓣 Cookie 中的 dbcl2 值
         * @default ''
         */
        'global.experimental.doubanHistory.dbcl2'?: string;
        /**
         * 豆瓣自定义评论
         * @default '自豪的使用 Rex*'
         */
        'global.experimental.doubanHistory.customComment'?: string;
    }
}

//#region searchDanmu
/** Params of 搜索弹幕 */
interface SearchDanmuParams extends BaranwangDanmuUniversal.GlobalParams, BaseParams {
}

interface SearchDanmuReturnType {
    animes: Array<AnimeItem>;
}

/**
 * 搜索弹幕
 * @description 搜索弹幕
 */
declare let searchDanmu: (params: SearchDanmuParams) => SearchDanmuReturnType | Promise<SearchDanmuReturnType>;
//#endregion searchDanmu

//#region getDetail
/** Params of 获取详情 */
interface GetDetailParams extends BaranwangDanmuUniversal.GlobalParams, BaseParams, AnimeItem {
}

interface GetDetailReturnType extends Array<GetDetailResponseItem> {
}

/**
 * 获取详情
 * @description 获取详情
 */
declare let getDetail: (params: GetDetailParams) => GetDetailReturnType | Promise<GetDetailReturnType>;
//#endregion getDetail

//#region getComments
/** Params of 获取弹幕 */
interface GetCommentsGetCommentsParams extends BaranwangDanmuUniversal.GlobalParams, BaseParams, EpisodeItem {
}

type GetCommentsGetCommentsReturnType = DanmuCommentsResult;
//#endregion getComments

//#region getDanmuWithSegmentTime
/** Params of 获取弹幕切片 */
interface GetDanmuWithSegmentTimeGetCommentsParams extends BaranwangDanmuUniversal.GlobalParams, BaseParams, GetDanmuWithSegmentTimeParams {
}

type GetDanmuWithSegmentTimeGetCommentsReturnType = DanmuCommentsResult;
//#endregion getDanmuWithSegmentTime
type GetCommentsParams = GetCommentsGetCommentsParams | GetDanmuWithSegmentTimeGetCommentsParams;
type GetCommentsReturnType = GetCommentsGetCommentsReturnType | GetDanmuWithSegmentTimeGetCommentsReturnType;

/**
 * 获取弹幕
 * @description 获取弹幕
 */
declare let getComments: (params: GetCommentsParams) => GetCommentsReturnType | Promise<GetCommentsReturnType>;
