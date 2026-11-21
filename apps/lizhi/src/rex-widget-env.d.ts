/// <reference types='@rexnow/libs/env' />
declare namespace BaranwangMusicLizhi {
    interface GlobalParams {
        /** 语言 */
        language: string;
        /**
         * CDN 线路
         * @description 用于加载封面与 20 MB 以内的音频；超过 20 MB 的大文件将自动切换至 GitHub Raw
         * @default 'testingcf'
         */
        cdnMirror: 'testingcf' | 'jsdelivr' | 'fastly' | 'raw';
        /**
         * 播放器偏好
         * @default 'auto'
         */
        playerType: 'auto' | 'system' | 'app';
    }
}

//#region home
/** Params of 首页推荐 */
interface LoadHomeParams extends BaranwangMusicLizhi.GlobalParams, VideoListParams {
    /**
     * 筛选
     * @default 'all'
     */
    filter: 'all' | 'picks' | 'albums' | 'recent';
    /** 页码 */
    page: string;
}

/** Return Type of 首页推荐 */
interface LoadHomeReturnType extends Array<VideoItem> {
}

/**
 * 首页推荐
 * @description 每日随机推荐与精选专辑
 */
declare let loadHome: (params: LoadHomeParams) => LoadHomeReturnType | Promise<LoadHomeReturnType>;
//#endregion home

//#region albums
/** Params of 专辑 */
interface LoadAlbumsParams extends BaranwangMusicLizhi.GlobalParams, VideoListParams {
    /**
     * 排序
     * @default 'default'
     */
    sort: 'default' | 'tracks' | 'daily';
    /** 页码 */
    page: string;
}

/** Return Type of 专辑 */
interface LoadAlbumsReturnType extends Array<VideoItem> {
}

/**
 * 专辑
 * @description 全部专辑与现场录音
 */
declare let loadAlbums: (params: LoadAlbumsParams) => LoadAlbumsReturnType | Promise<LoadAlbumsReturnType>;
//#endregion albums

//#region allSongs
/** Params of 全部歌曲 */
interface LoadAllSongsParams extends BaranwangMusicLizhi.GlobalParams, VideoListParams {
    /**
     * 排序
     * @default 'album'
     */
    sort: 'album' | 'title' | 'daily';
    /** 页码 */
    page: string;
}

/** Return Type of 全部歌曲 */
interface LoadAllSongsReturnType extends Array<VideoItem> {
}

/**
 * 全部歌曲
 * @description 完整曲库浏览与播放
 */
declare let loadAllSongs: (params: LoadAllSongsParams) => LoadAllSongsReturnType | Promise<LoadAllSongsReturnType>;
//#endregion allSongs

//#region musicRadios
/** Params of 电台 */
interface LoadRadiosParams extends BaranwangMusicLizhi.GlobalParams, VideoListParams {
    /** 电台 ID */
    radioId: string;
    /** 分区 */
    section: 'songs' | 'albums' | 'artists';
    /** 页码 */
    page: string;
    /** 偏移量 */
    offset: string;
}

/** Return Type of 电台 */
interface LoadRadiosReturnType extends Array<VideoItem> {
}

/**
 * 电台
 * @description 随机连播与每日电台
 */
declare let loadRadios: (params: LoadRadiosParams) => LoadRadiosReturnType | Promise<LoadRadiosReturnType>;
//#endregion musicRadios

//#region musicArtists
/** Params of 歌手 */
interface LoadArtistsParams extends BaranwangMusicLizhi.GlobalParams, VideoListParams {
    /** 歌手 ID */
    peopleId: string;
    /** 歌手分区 */
    section: 'songs' | 'albums' | 'profile' | 'artists';
    /** 页码 */
    page: string;
    /** 偏移量 */
    offset: string;
}

/** Return Type of 歌手 */
interface LoadArtistsReturnType extends Array<VideoItem> {
}

/**
 * 歌手
 * @description 李志主页与全部作品
 */
declare let loadArtists: (params: LoadArtistsParams) => LoadArtistsReturnType | Promise<LoadArtistsReturnType>;
//#endregion musicArtists

//#region recent
/** Params of 最近播放 */
interface LoadRecentParams extends BaranwangMusicLizhi.GlobalParams, VideoListParams {
    /** 页码 */
    page: string;
}

/** Return Type of 最近播放 */
interface LoadRecentReturnType extends Array<VideoItem> {
}

/**
 * 最近播放
 * @description 本机收听历史记录
 */
declare let loadRecent: (params: LoadRecentParams) => LoadRecentReturnType | Promise<LoadRecentReturnType>;
//#endregion recent

//#region search
/** Params of 搜索 */
interface SearchParams extends BaranwangMusicLizhi.GlobalParams {
    /** 搜索关键词（由 Rex 注入） */
    keyword: string;
    /**
     * 结果类型
     * @default 'all'
     */
    kind: 'all' | 'songs' | 'albums' | 'artists';
    /** 页码 */
    page: string;
}

/** Return Type of 搜索 */
interface SearchReturnType extends Array<VideoItem> {
}

/**
 * 搜索
 * @description 搜索李志的歌曲、专辑与歌手
 */
declare let search: (params: SearchParams) => SearchReturnType | Promise<SearchReturnType>;
//#endregion search
