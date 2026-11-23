let e, t = [
    "MUSIC_U",
    "__csrf",
    "NMTID"
];
function i(e) {
    return e.replace(/'\\''/g, "'").trim();
}
function l(e) {
    return e.replace(/\\(["\\])/g, "$1").trim();
}
function r(e) {
    return Object.entries(e).filter(([e, t])=>!!(e && t)).map(([e, t])=>`${e}=${t}`).join("; ");
}
function a(e) {
    let t = (e || "").trim();
    if (!t) return {
        cookieHeader: "",
        cookies: {},
        hasMusicU: !1
    };
    let a = t;
    /(?:^|\s)(?:curl\s+\^"|(?:-H|--header|-b|--cookie)\s+\^")/i.test(a) && (a = a.replace(/\^\r?\n/g, " ").replace(/\^([\s\S])/g, "$1"));
    let n = "", o = /(?:^|[\s\\])(?:-b|--cookie)\s+'((?:[^']|'\\'')*)'/.exec(a);
    if ((null == o ? void 0 : o[1]) && (n = i(o[1])), !n) {
        let e = /(?:^|[\s\\])(?:-b|--cookie)\s+"((?:[^"\\]|\\.)*)"/.exec(a);
        (null == e ? void 0 : e[1]) && (n = l(e[1]));
    }
    if (n || (n = function(e, t) {
        let r = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), a = RegExp(`(?:^|[\\s\\\\])(?:-H|--header)\\s+'${r}:\\s*((?:[^']|'\\\\'')*)'`, "i").exec(e);
        if (null == a ? void 0 : a[1]) return i(a[1]);
        let n = RegExp(`(?:^|[\\s\\\\])(?:-H|--header)\\s+"${r}:\\s*((?:[^"\\\\]|\\\\.)*)"`, "i").exec(e);
        if (null == n ? void 0 : n[1]) return l(n[1]);
        let o = RegExp(`"${r}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "i").exec(e);
        if (null == o ? void 0 : o[1]) return l(o[1]);
        let s = RegExp(`^\\s*${r}:\\s*(.+)$`, "im").exec(e);
        return (null == s ? void 0 : s[1]) ? s[1].trim() : "";
    }(a, "cookie")), !n && !/^\s*(?:curl\s+|fetch\s*\()/i.test(a)) {
        let e = a.replace(/\r?\n+/g, "; ").trim();
        n = !e.includes("=") && !e.includes(";") && /^[A-Za-z0-9._-]{32,}$/.test(e) ? `MUSIC_U=${e}` : e;
    }
    let s = function(e) {
        let t = {};
        if (!e) return t;
        for (let i of e.split(";")){
            let e = i.indexOf("=");
            if (e <= 0) continue;
            let l = i.slice(0, e).trim(), r = i.slice(e + 1).trim();
            !l || !r || /[\r\n]/.test(l) || /[\r\n]/.test(r) || (t[l] = r);
        }
        return t;
    }(n);
    return {
        cookieHeader: r(s),
        cookies: s,
        hasMusicU: !!s.MUSIC_U
    };
}
function n(e, i = Date.now()) {
    let l = {}, r = [];
    if (!e) return {
        updates: l,
        deletes: r
    };
    let a = "";
    for (let [t, i] of Object.entries(e))"set-cookie" === t.toLowerCase() && "string" == typeof i && (a = a ? `${a}, ${i}` : i);
    if (!a) return {
        updates: l,
        deletes: r
    };
    for (let e of function(e) {
        if (!e) return [];
        let t = [], i = 0, l = !1;
        for(let r = 0; r < e.length; r++){
            let a = e[r];
            if (";" === a) {
                let t = e.slice(r + 1).trimStart();
                l = /^expires\s*=/i.test(t);
            } else if ("," === a) {
                if (l) {
                    l = !1;
                    continue;
                }
                let a = e.slice(i, r).trim();
                a && t.push(a), i = r + 1;
            }
        }
        let r = e.slice(i).trim();
        return r && t.push(r), t;
    }(a)){
        var o;
        let a = e.split(";"), n = (null == (o = a[0]) ? void 0 : o.trim()) || "", s = n.indexOf("=");
        if (s <= 0) continue;
        let u = n.slice(0, s).trim();
        if (!t.includes(u)) continue;
        let d = n.slice(s + 1).trim(), c = !d;
        for (let e of a.slice(1)){
            let t = e.trim(), l = /^max-age\s*=\s*(-?\d+)$/i.exec(t);
            (null == l ? void 0 : l[1]) && 0 >= Number(l[1]) && (c = !0);
            let r = /^expires\s*=\s*(.+)$/i.exec(t);
            if (null == r ? void 0 : r[1]) {
                let e = Date.parse(r[1]);
                Number.isFinite(e) && e <= i && (c = !0);
            }
        }
        if (c) delete l[u], r.includes(u) || r.push(u);
        else {
            l[u] = d;
            let e = r.indexOf(u);
            e >= 0 && r.splice(e, 1);
        }
    }
    return {
        updates: l,
        deletes: r
    };
}
let o = "https://music.163.com", s = "e82ckenh8dichen8", u = "9ca17ae2e6ffcda170e2e6ee8af14fbabdb988f225b3868eb2c15a879b9a83d274a790ac8ff54a97b889d5d42af0feaec3b92af58cff99c470a7eafd88f75e839a9ea7c14e909da883e83fb692a3abdb6b92adee9e", d = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", c = {
    osver: "Microsoft-Windows-10-Professional-build-19045-64bit",
    os: "pc",
    appver: "3.1.29.205117",
    versioncode: "140",
    resolution: "1920x1080",
    channel: "netease"
}, p = {
    osver: "15.5",
    os: "osx",
    appver: "3.1.10.5100",
    versioncode: "140",
    resolution: "1920x1080",
    channel: "netease"
}, f = {
    osver: "14",
    os: "android",
    appver: "9.5.61",
    versioncode: "9005061",
    resolution: "1080x2400",
    channel: "xiaomi"
}, m = `Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/${c.appver}`, y = "toggleFavorite", g = "like_song", h = "unlike_song", v = "sub_playlist", b = "unsub_playlist", k = "sub_album", A = "unsub_album", I = "sub_artist", P = "unsub_artist", S = "sub_podcast", C = "unsub_podcast", w = [
    "standard",
    "higher",
    "exhigh",
    "lossless",
    "hires",
    "jyeffect",
    "sky",
    "dolby",
    "vivid",
    "jymaster"
], U = {
    standard: 128000,
    higher: 192000,
    exhigh: 320000,
    lossless: 999000,
    hires: 999000,
    jyeffect: 999000,
    sky: 999000,
    dolby: 999000,
    vivid: 999000,
    jymaster: 999000
};
function T(e) {
    return "lossless" === e || "hires" === e || "jyeffect" === e || "sky" === e || "dolby" === e || "jymaster" === e;
}
let M = {
    ALL: 0,
    ZH: 7,
    EA: 96,
    KR: 16,
    JP: 8
}, O = {
    ALL: -1,
    ZH: 7,
    EA: 96,
    JP: 8,
    KR: 16,
    OTHER: 0
}, j = {
    ALL: -1,
    MALE: 1,
    FEMALE: 2,
    BAND: 3
}, $ = {
    ZH: 1,
    EA: 2,
    KR: 3,
    JP: 4
}, N = {
    songs: 1,
    albums: 10,
    artists: 100,
    playlists: 1000,
    lyrics: 1006,
    dj: 1009
}, D = [
    {
        id: "华语",
        title: "华语",
        subtitle: "语种",
        artistArea: "ZH"
    },
    {
        id: "欧美",
        title: "欧美",
        subtitle: "语种",
        artistArea: "EA"
    },
    {
        id: "日语",
        title: "日语",
        subtitle: "语种",
        artistArea: "JP"
    },
    {
        id: "韩语",
        title: "韩语",
        subtitle: "语种",
        artistArea: "KR"
    },
    {
        id: "粤语",
        title: "粤语",
        subtitle: "语种",
        artistArea: "ZH"
    },
    {
        id: "流行",
        title: "流行",
        subtitle: "风格",
        styleTagId: "1000"
    },
    {
        id: "摇滚",
        title: "摇滚",
        subtitle: "风格",
        styleTagId: "1008"
    },
    {
        id: "民谣",
        title: "民谣",
        subtitle: "风格",
        styleTagId: "1003"
    },
    {
        id: "电子",
        title: "电子",
        subtitle: "风格",
        styleTagId: "1015"
    },
    {
        id: "说唱",
        title: "说唱",
        subtitle: "风格",
        styleTagId: "1017"
    },
    {
        id: "轻音乐",
        title: "轻音乐",
        subtitle: "风格",
        styleTagId: "1006"
    },
    {
        id: "爵士",
        title: "爵士",
        subtitle: "风格",
        styleTagId: "1011"
    },
    {
        id: "古典",
        title: "古典",
        subtitle: "风格",
        styleTagId: "1022"
    },
    {
        id: "古风",
        title: "古风",
        subtitle: "风格",
        styleTagId: "10119"
    },
    {
        id: "R&B/Soul",
        title: "R&B/Soul",
        subtitle: "风格",
        styleTagId: "1028"
    },
    {
        id: "ACG",
        title: "ACG",
        subtitle: "主题",
        styleTagId: "1252"
    },
    {
        id: "影视原声",
        title: "影视原声",
        subtitle: "主题",
        styleTagId: "1010"
    },
    {
        id: "游戏",
        title: "游戏",
        subtitle: "主题"
    },
    {
        id: "怀旧",
        title: "怀旧",
        subtitle: "情感"
    },
    {
        id: "治愈",
        title: "治愈",
        subtitle: "情感"
    },
    {
        id: "夜晚",
        title: "夜晚",
        subtitle: "场景"
    },
    {
        id: "学习",
        title: "学习",
        subtitle: "场景"
    },
    {
        id: "运动",
        title: "运动",
        subtitle: "场景"
    },
    {
        id: "驾车",
        title: "驾车",
        subtitle: "场景"
    }
], E = "ncm:song:", _ = "ncm:album:", W = "ncm:playlist:", R = "ncm:dj:", L = "ncm:hot:", V = "ncm:genre:", x = "ncm:radio:";
function H(e) {
    return `${E}${e}`;
}
function F(e) {
    return `${W}${e}`;
}
function q(e) {
    return `${R}${e}`;
}
function B(e) {
    return `${L}${encodeURIComponent(e.trim())}`;
}
function z(e) {
    return `${V}${e}`;
}
function K(e) {
    return `${x}${e}`;
}
function J(e) {
    return /^\d{1,20}$/.test(e);
}
function G(e) {
    let t = (e || "").trim();
    if (!t) return null;
    if (t.startsWith(E)) {
        let e = t.slice(E.length).trim();
        return J(e) ? {
            kind: "song",
            id: e
        } : null;
    }
    if (t.startsWith(_)) {
        let e = t.slice(_.length).trim();
        return J(e) ? {
            kind: "album",
            id: e
        } : null;
    }
    if (t.startsWith(W)) {
        let e = t.slice(W.length).trim();
        return J(e) ? {
            kind: "playlist",
            id: e
        } : null;
    }
    if (t.startsWith(R)) {
        let e = t.slice(R.length).trim();
        return J(e) ? {
            kind: "dj",
            id: e
        } : null;
    }
    if (t.startsWith(L)) {
        let e = t.slice(L.length).trim();
        if (!e) return null;
        try {
            let t = decodeURIComponent(e).trim();
            return t ? {
                kind: "hot",
                keyword: t
            } : null;
        } catch (t) {
            return {
                kind: "hot",
                keyword: e
            };
        }
    }
    let i = /music\.163\.com\/(?:#\/)?(song|album|playlist|djradio|radio)\?[^#]*\bid=(\d{1,20})\b/i.exec(t);
    if ((null == i ? void 0 : i[1]) && i[2]) {
        let e = i[1].toLowerCase();
        return {
            kind: "djradio" === e || "radio" === e ? "dj" : e,
            id: i[2]
        };
    }
    return null;
}
function Z(e) {
    if ("string" != typeof e) return;
    let t = e.trim();
    if (t) {
        if (t.startsWith("https://")) return t;
        if (t.startsWith("http://")) return `https://${t.slice(7)}`;
    }
}
function X(e, t = 500) {
    let i = Z(e);
    if (!i) return;
    if (!/^https:\/\/p\d+\.music\.126\.net\//i.test(i) || /[?&]param=/i.test(i)) return i;
    let l = /[?&]imageView=/i.test(i) ? i.split("?")[0] : i, r = l.includes("?") ? "&" : "?";
    return `${l}${r}param=${t}y${t}`;
}
function Q(e) {
    let t = [];
    for(let i = 0; i < e.length; i++){
        let l = e.charCodeAt(i);
        if (l >= 0xd800 && l <= 0xdbff && i + 1 < e.length) {
            let t = e.charCodeAt(i + 1);
            t >= 0xdc00 && t <= 0xdfff && (l = 0x10000 + (l - 0xd800 << 10) + (t - 0xdc00), i++);
        }
        l < 0x80 ? t.push(l) : l < 0x800 ? t.push(0xc0 | l >> 6, 0x80 | 0x3f & l) : l < 0x10000 ? t.push(0xe0 | l >> 12, 0x80 | l >> 6 & 0x3f, 0x80 | 0x3f & l) : t.push(0xf0 | l >> 18, 0x80 | l >> 12 & 0x3f, 0x80 | l >> 6 & 0x3f, 0x80 | 0x3f & l);
    }
    return new Uint8Array(t);
}
let Y = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", ee = [
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21
], et = Array.from({
    length: 64
}, (e, t)=>Math.floor(0x100000000 * Math.abs(Math.sin(t + 1))) >>> 0);
function ei(e) {
    let t = "";
    for(let i = 0; i < 4; i++)t += (e >>> 8 * i & 0xff).toString(16).padStart(2, "0");
    return t;
}
let el = new Uint8Array([
    0x63,
    0x7c,
    0x77,
    0x7b,
    0xf2,
    0x6b,
    0x6f,
    0xc5,
    0x30,
    0x01,
    0x67,
    0x2b,
    0xfe,
    0xd7,
    0xab,
    0x76,
    0xca,
    0x82,
    0xc9,
    0x7d,
    0xfa,
    0x59,
    0x47,
    0xf0,
    0xad,
    0xd4,
    0xa2,
    0xaf,
    0x9c,
    0xa4,
    0x72,
    0xc0,
    0xb7,
    0xfd,
    0x93,
    0x26,
    0x36,
    0x3f,
    0xf7,
    0xcc,
    0x34,
    0xa5,
    0xe5,
    0xf1,
    0x71,
    0xd8,
    0x31,
    0x15,
    0x04,
    0xc7,
    0x23,
    0xc3,
    0x18,
    0x96,
    0x05,
    0x9a,
    0x07,
    0x12,
    0x80,
    0xe2,
    0xeb,
    0x27,
    0xb2,
    0x75,
    0x09,
    0x83,
    0x2c,
    0x1a,
    0x1b,
    0x6e,
    0x5a,
    0xa0,
    0x52,
    0x3b,
    0xd6,
    0xb3,
    0x29,
    0xe3,
    0x2f,
    0x84,
    0x53,
    0xd1,
    0x00,
    0xed,
    0x20,
    0xfc,
    0xb1,
    0x5b,
    0x6a,
    0xcb,
    0xbe,
    0x39,
    0x4a,
    0x4c,
    0x58,
    0xcf,
    0xd0,
    0xef,
    0xaa,
    0xfb,
    0x43,
    0x4d,
    0x33,
    0x85,
    0x45,
    0xf9,
    0x02,
    0x7f,
    0x50,
    0x3c,
    0x9f,
    0xa8,
    0x51,
    0xa3,
    0x40,
    0x8f,
    0x92,
    0x9d,
    0x38,
    0xf5,
    0xbc,
    0xb6,
    0xda,
    0x21,
    0x10,
    0xff,
    0xf3,
    0xd2,
    0xcd,
    0x0c,
    0x13,
    0xec,
    0x5f,
    0x97,
    0x44,
    0x17,
    0xc4,
    0xa7,
    0x7e,
    0x3d,
    0x64,
    0x5d,
    0x19,
    0x73,
    0x60,
    0x81,
    0x4f,
    0xdc,
    0x22,
    0x2a,
    0x90,
    0x88,
    0x46,
    0xee,
    0xb8,
    0x14,
    0xde,
    0x5e,
    0x0b,
    0xdb,
    0xe0,
    0x32,
    0x3a,
    0x0a,
    0x49,
    0x06,
    0x24,
    0x5c,
    0xc2,
    0xd3,
    0xac,
    0x62,
    0x91,
    0x95,
    0xe4,
    0x79,
    0xe7,
    0xc8,
    0x37,
    0x6d,
    0x8d,
    0xd5,
    0x4e,
    0xa9,
    0x6c,
    0x56,
    0xf4,
    0xea,
    0x65,
    0x7a,
    0xae,
    0x08,
    0xba,
    0x78,
    0x25,
    0x2e,
    0x1c,
    0xa6,
    0xb4,
    0xc6,
    0xe8,
    0xdd,
    0x74,
    0x1f,
    0x4b,
    0xbd,
    0x8b,
    0x8a,
    0x70,
    0x3e,
    0xb5,
    0x66,
    0x48,
    0x03,
    0xf6,
    0x0e,
    0x61,
    0x35,
    0x57,
    0xb9,
    0x86,
    0xc1,
    0x1d,
    0x9e,
    0xe1,
    0xf8,
    0x98,
    0x11,
    0x69,
    0xd9,
    0x8e,
    0x94,
    0x9b,
    0x1e,
    0x87,
    0xe9,
    0xce,
    0x55,
    0x28,
    0xdf,
    0x8c,
    0xa1,
    0x89,
    0x0d,
    0xbf,
    0xe6,
    0x42,
    0x68,
    0x41,
    0x99,
    0x2d,
    0x0f,
    0xb0,
    0x54,
    0xbb,
    0x16
]), er = [
    0x01,
    0x02,
    0x04,
    0x08,
    0x10,
    0x20,
    0x40,
    0x80,
    0x1b,
    0x36
];
function ea(e) {
    return (e << 1 ^ (0x80 & e ? 0x1b : 0)) & 0xff;
}
function en(e) {
    for(var t = 1; t < arguments.length; t++){
        var i = null != arguments[t] ? arguments[t] : {}, l = Object.keys(i);
        "function" == typeof Object.getOwnPropertySymbols && (l = l.concat(Object.getOwnPropertySymbols(i).filter(function(e) {
            return Object.getOwnPropertyDescriptor(i, e).enumerable;
        }))), l.forEach(function(t) {
            var l;
            l = i[t], t in e ? Object.defineProperty(e, t, {
                value: l,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }) : e[t] = l;
        });
    }
    return e;
}
function eo(e, t) {
    return t = null != t ? t : {}, Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : (function(e) {
        var t = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
            var i = Object.getOwnPropertySymbols(e);
            t.push.apply(t, i);
        }
        return t;
    })(Object(t)).forEach(function(i) {
        Object.defineProperty(e, i, Object.getOwnPropertyDescriptor(t, i));
    }), e;
}
function es(e) {
    return null !== e && "object" == typeof e && !Array.isArray(e);
}
function eu(e) {
    return "string" == typeof e ? /^\d+$/.test(e.trim()) ? e.trim() : "" : "number" == typeof e && Number.isFinite(e) && e > 0 ? String(Math.floor(e)) : "";
}
function ed(e) {
    return "string" == typeof e ? e.trim() : "";
}
function ec(e) {
    let t = Number(e);
    return Number.isFinite(t) ? t : 0;
}
function ep(e) {
    if (!Number.isFinite(e) || e <= 0) return "";
    let t = Math.round(e), i = Math.floor(t / 3600), l = Math.floor(t % 3600 / 60), r = t % 60;
    return i > 0 ? `${i}:${String(l).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${l}:${String(r).padStart(2, "0")}`;
}
function ef(e) {
    if (!es(e)) return null;
    let t = eu(e.id), i = ed(e.name);
    if (!i) return null;
    let l = X(ed(e.img1v1Url) || ed(e.picUrl) || ed(e.avatarUrl)), r = Array.isArray(e.alias) ? e.alias.map(ed).filter(Boolean) : [], a = ed(e.trans) || r[0] || void 0;
    return en({
        id: t,
        name: i
    }, l ? {
        imageUrl: l
    } : {}, a ? {
        subtitle: a
    } : {});
}
function em(e) {
    if (!es(e)) return null;
    let t = eu(e.id), i = ed(e.name);
    if (!t || !i) return null;
    let l = (Array.isArray(e.artists) ? e.artists : e.artist ? [
        e.artist
    ] : []).map(ef).filter((e)=>null !== e), r = X(ed(e.picUrl) || ed(e.blurPicUrl)), a = function(e) {
        let t = ec(e);
        if (t <= 0) return;
        let i = new Date(t);
        if (Number.isNaN(i.getTime())) return;
        let l = i.getUTCFullYear(), r = String(i.getUTCMonth() + 1).padStart(2, "0"), a = String(i.getUTCDate()).padStart(2, "0");
        return `${l}-${r}-${a}`;
    }(e.publishTime), n = ed(e.description) || void 0, o = ec(e.size) || void 0, s = ed(e.company) || void 0, u = ed(e.subType) || void 0;
    return en({
        id: t,
        name: i,
        artists: l
    }, r ? {
        imageUrl: r
    } : {}, a ? {
        released: a
    } : {}, n ? {
        description: n
    } : {}, o ? {
        trackCount: o
    } : {}, s ? {
        company: s
    } : {}, u ? {
        subType: u
    } : {});
}
function ey(e) {
    if (!es(e)) return null;
    let t = eu(e.id), i = ed(e.name);
    if (!t || !i) return null;
    let l = X(ed(e.coverImgUrl) || ed(e.picUrl)), r = es(e.creator) ? e.creator : void 0, a = ed(null == r ? void 0 : r.nickname) || ed(e.copywriter) || void 0, n = ec(e.trackCount) || void 0, o = Array.isArray(e.tags) ? e.tags.map(ed).filter((e)=>!!e) : void 0, s = [], u = ed(e.updateFrequency);
    u && s.push(u);
    let d = ed(e.description);
    if (d && s.push(d), Array.isArray(e.tracks) && e.tracks.length) {
        let t = e.tracks.slice(0, 3).map((e, t)=>{
            if (!es(e)) return "";
            let i = ed(e.first), l = ed(e.second);
            return i ? l ? `${t + 1}. ${i} · ${l}` : `${t + 1}. ${i}` : "";
        }).filter(Boolean);
        t.length && s.push(t.join("\n"));
    }
    let c = s.filter(Boolean).join("\n") || void 0;
    return en({
        id: t,
        name: i
    }, l ? {
        imageUrl: l
    } : {}, a ? {
        owner: a
    } : {}, c ? {
        description: c
    } : {}, n ? {
        trackCount: n
    } : {}, (null == o ? void 0 : o.length) ? {
        tags: o
    } : {});
}
function eg(e) {
    if (!es(e)) return null;
    let t = es(e.song) ? e.song : e, i = eu(t.id) || eu(e.id), l = ed(t.name) || ed(e.name);
    if (!i || !l) return null;
    let r = (Array.isArray(t.ar) ? t.ar : Array.isArray(t.artists) ? t.artists : Array.isArray(e.ar) ? e.ar : []).map(ef).filter((e)=>null !== e), a = es(t.al) ? t.al : es(t.album) ? t.album : void 0, n = eu(null == a ? void 0 : a.id), o = ed(null == a ? void 0 : a.name), s = X(ed(null == a ? void 0 : a.picUrl) || ed(e.picUrl)), u = ec(t.dt) || ec(t.duration), d = u > 0 ? Math.round(u / 1000) : 0, c = ec(t.fee), p = ec(t.mv) || ec(t.mvid) || ec(e.mv) || void 0;
    return en(eo(en({
        id: i,
        name: l,
        artists: r
    }, o || n ? {
        album: {
            id: n,
            name: o,
            imageUrl: s
        }
    } : {}), {
        duration: d
    }), s ? {
        imageUrl: s
    } : {}, c ? {
        fee: c
    } : {}, p && p > 0 ? {
        mvId: p
    } : {});
}
function eh(e) {
    if (!es(e)) return null;
    let t = eu(e.id), i = ed(e.name);
    if (!t || !i) return null;
    let l = X(ed(e.picUrl) || ed(e.intervenePicUrl)), r = es(e.dj) ? e.dj : void 0, a = ed(null == r ? void 0 : r.nickname) || ed(e.rcmdtext) || ed(e.rcmdText) || void 0, n = ed(e.category) || void 0, o = ed(e.desc) || ed(e.rcmdText) || ed(e.rcmdtext) || void 0, s = ec(e.programCount) || void 0;
    return en({
        id: t,
        name: i
    }, l ? {
        imageUrl: l
    } : {}, a ? {
        host: a
    } : {}, n ? {
        category: n
    } : {}, o ? {
        description: o
    } : {}, s ? {
        programCount: s
    } : {});
}
function ev(e) {
    if (!es(e)) return null;
    let t = es(e.mainSong) ? e.mainSong : void 0, i = eu(null == t ? void 0 : t.id) || eu(e.mainTrackId), l = eu(e.id) || i, r = ed(e.name) || ed(null == t ? void 0 : t.name);
    if (!i || !r) return null;
    let a = X(ed(e.coverUrl) || ed(e.blurCoverUrl)), n = es(e.dj) ? e.dj : void 0, o = es(e.radio) ? e.radio : void 0, s = ed(null == n ? void 0 : n.nickname) || void 0, u = ed(null == o ? void 0 : o.name) || void 0, d = ec(e.duration) || ec(null == t ? void 0 : t.duration), c = d > 0 ? Math.round(d / 1000) : 0, p = ed(e.description) || void 0;
    return en(eo(en({
        id: l,
        mainSongId: i,
        name: r
    }, a ? {
        imageUrl: a
    } : {}, s ? {
        host: s
    } : {}, u ? {
        radioName: u
    } : {}), {
        duration: c
    }), p ? {
        description: p
    } : {});
}
function eb(e) {
    if (!es(e)) return null;
    let t = eu(e.tagId), i = ed(e.tagName);
    if (!t || !i) return null;
    let l = ed(e.enName) || void 0, r = X(ed(e.picUrl));
    return en({
        tagId: t,
        tagName: i
    }, l ? {
        enName: l
    } : {}, r ? {
        imageUrl: r
    } : {});
}
function ek(e) {
    if (!(null == e ? void 0 : e.length)) return;
    let t = new Set(), i = [];
    for (let l of e){
        let e = l.trim();
        !e || t.has(e) || (t.add(e), i.push({
            id: z(e),
            title: e
        }));
    }
    return i.length ? i : void 0;
}
function eA(e) {
    let t = new Set(), i = [];
    for (let l of e)!l.id || !l.name || t.has(l.id) || (t.add(l.id), i.push(eo(en({
        id: l.id,
        title: l.name
    }, l.imageUrl ? {
        avatar: l.imageUrl
    } : {}), {
        role: Widget.i18n("歌手")
    })));
    return i.length ? i : void 0;
}
function eI(e) {
    var t, i;
    let l = e.artists.map((e)=>e.name).filter(Boolean).join(" / ") || (null == (t = e.album) ? void 0 : t.name) || void 0, r = e.imageUrl || (null == (i = e.album) ? void 0 : i.imageUrl), a = eA(e.artists), n = ep(e.duration);
    return en({
        id: e.id,
        type: "url",
        mediaType: "song",
        link: H(e.id),
        title: e.name
    }, l ? {
        subtitle: l
    } : {}, r ? {
        posterPath: r,
        coverUrl: r
    } : {}, e.duration > 0 ? {
        duration: e.duration,
        durationText: n
    } : {}, a ? {
        peoples: a
    } : {});
}
function eP(e) {
    var t;
    let i = e.artists.map((e)=>e.name).filter(Boolean).join(" / "), l = eA(e.artists);
    return en({
        id: e.id,
        type: "url",
        mediaType: "album",
        link: (t = e.id, `${_}${t}`),
        title: e.name
    }, i ? {
        subtitle: i
    } : {}, e.imageUrl ? {
        posterPath: e.imageUrl,
        coverUrl: e.imageUrl
    } : {}, e.released ? {
        releaseDate: e.released
    } : {}, l ? {
        peoples: l
    } : {});
}
function eS(e) {
    let t = ek(e.tags);
    return en({
        id: e.id,
        type: "url",
        mediaType: "playlist",
        link: F(e.id),
        title: e.name
    }, e.owner ? {
        subtitle: e.owner
    } : {}, e.imageUrl ? {
        posterPath: e.imageUrl,
        coverUrl: e.imageUrl
    } : {}, e.description ? {
        description: e.description
    } : {}, t ? {
        genreItems: t
    } : {});
}
function eC(e) {
    let t = [
        e.host || "",
        e.category || ""
    ].filter(Boolean).join(" · ") || void 0;
    return en({
        id: `dj:${e.id}`,
        type: "url",
        mediaType: "playlist",
        link: q(e.id),
        title: e.name
    }, t ? {
        subtitle: t
    } : {}, e.imageUrl ? {
        posterPath: e.imageUrl,
        coverUrl: e.imageUrl
    } : {}, e.description ? {
        description: e.description
    } : {});
}
function ew(e) {
    let t = [
        e.host || "",
        e.radioName || ""
    ].filter(Boolean).join(" · ") || void 0, i = ep(e.duration);
    return en({
        id: e.mainSongId,
        type: "url",
        mediaType: "song",
        link: H(e.mainSongId),
        title: e.name
    }, t ? {
        subtitle: t
    } : {}, e.imageUrl ? {
        posterPath: e.imageUrl,
        coverUrl: e.imageUrl
    } : {}, e.duration > 0 ? {
        duration: e.duration,
        durationText: i
    } : {}, e.description ? {
        description: e.description
    } : {});
}
function eU(e, t) {
    return en({
        id: e.id,
        type: "person",
        mediaType: "person",
        title: e.name
    }, e.subtitle ? {
        subtitle: e.subtitle
    } : {}, e.imageUrl ? {
        avatar: e.imageUrl,
        posterPath: e.imageUrl,
        coverUrl: e.imageUrl
    } : {}, t ? {
        description: t
    } : {});
}
function eT(e) {
    let t = new Set(), i = [];
    for (let l of e){
        let e = `${l.mediaType || l.type}:${l.id}`;
        t.has(e) || (t.add(e), i.push(l));
    }
    return i;
}
function eM(e) {
    for(var t = 1; t < arguments.length; t++){
        var i = null != arguments[t] ? arguments[t] : {}, l = Object.keys(i);
        "function" == typeof Object.getOwnPropertySymbols && (l = l.concat(Object.getOwnPropertySymbols(i).filter(function(e) {
            return Object.getOwnPropertyDescriptor(i, e).enumerable;
        }))), l.forEach(function(t) {
            var l;
            l = i[t], t in e ? Object.defineProperty(e, t, {
                value: l,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }) : e[t] = l;
        });
    }
    return e;
}
let eO = "ncm:config", ej = "ncm:deviceId", e$ = "ncm:serverCookies", eN = "ncm:account", eD = "ncm:streams", eE = "ncm:songMeta", e_ = "ncm:genreCovers", eW = "ncm:artistAvatars", eR = "ncm:favorites", eL = {
    cookie: "",
    quality: "exhigh",
    allowTrial: !1,
    playerType: "auto",
    reportHistory: !1
};
function eV(e) {
    try {
        let t = Widget.storage.get(e);
        if (null == t) return null;
        if ("string" == typeof t) try {
            return JSON.parse(t);
        } catch (e) {}
        return t;
    } catch (e) {
        return null;
    }
}
function ex(e, t) {
    try {
        Widget.storage.set(e, t);
    } catch (e) {}
}
function eH(e) {
    try {
        Widget.storage.remove(e);
    } catch (e) {}
}
function eF(e) {
    return e && w.includes(e) ? e : "exhigh";
}
function eq(e) {
    return "system" === e || "app" === e || "auto" === e ? e : "auto";
}
function eB() {
    let e = eV(eO);
    return e && "object" == typeof e ? {
        cookie: "string" == typeof e.cookie ? e.cookie : eL.cookie,
        quality: eF(e.quality),
        allowTrial: !!e.allowTrial,
        playerType: eq(e.playerType),
        reportHistory: !!e.reportHistory
    } : eM({}, eL);
}
function ez(e) {
    let t = eB();
    if (!e) return t;
    let i = {
        cookie: "string" == typeof e.cookie ? e.cookie.trim() : t.cookie,
        quality: void 0 !== e.quality ? eF(e.quality) : t.quality,
        allowTrial: void 0 !== e.allowTrial ? "true" === e.allowTrial : t.allowTrial,
        playerType: void 0 !== e.playerType ? eq(e.playerType) : t.playerType,
        reportHistory: void 0 !== e.reportHistory ? "true" === e.reportHistory : t.reportHistory
    };
    return i.cookie !== t.cookie && (eH(eN), eH(eD), eH(eR)), ex(eO, i), i;
}
function eK() {
    let e = eV(e$);
    return e && "object" == typeof e ? eM({}, e) : {};
}
function eJ(e) {
    if (!(Object.keys(e.updates).length > 0) && !e.deletes.length) return;
    let t = eK();
    for (let i of e.deletes)delete t[i];
    for (let [i, l] of Object.entries(e.updates))l && (t[i] = l);
    ex(e$, t);
}
function eG(e, t) {
    let i = e.filter((e)=>"song" === e.mediaType && "string" == typeof e.id && e.id);
    if (!i.length) return;
    let l = new Map();
    if (t) for (let e of t)e.id && l.set(e.id, e);
    let r = eV(eE), a = r && "object" == typeof r ? eM({}, r) : {};
    for (let e of i){
        var n, o;
        let t = String(e.id), i = a[t], r = l.get(t), s = null != (n = null == r ? void 0 : r.mvId) ? n : null == i ? void 0 : i.mvId, u = (null == r ? void 0 : r.albumId) || (null == i ? void 0 : i.albumId);
        delete a[t], a[t] = eM({
            id: t,
            title: e.title
        }, e.subtitle ? {
            subtitle: e.subtitle
        } : {}, e.posterPath ? {
            posterPath: e.posterPath
        } : {}, e.coverUrl ? {
            coverUrl: e.coverUrl
        } : {}, "number" == typeof e.duration ? {
            duration: e.duration
        } : {}, e.durationText ? {
            durationText: e.durationText
        } : {}, (null == (o = e.peoples) ? void 0 : o.length) ? {
            peoples: e.peoples
        } : {}, s && s > 0 ? {
            mvId: s
        } : {}, u ? {
            albumId: u
        } : {});
    }
    let s = Object.keys(a);
    if (s.length > 160) for (let e of s.slice(0, s.length - 160))delete a[e];
    ex(eE, a);
}
function eZ(e, t = Date.now()) {
    let i = Object.entries(e).filter(([e, t])=>!!(e && t));
    if (!i.length) return;
    let l = eV(eW), r = l && "object" == typeof l ? eM({}, l) : {};
    for (let [e, l] of i)delete r[e], r[e] = {
        url: l,
        cachedAt: t
    };
    let a = Object.keys(r);
    if (a.length > 300) for (let e of a.slice(0, a.length - 300))delete r[e];
    ex(eW, r);
}
function eX(e) {
    if (!e) return {
        cookieKey: "",
        buckets: {}
    };
    let t = eV(eR);
    return t && "object" == typeof t && t.cookieKey === e && t.buckets ? {
        cookieKey: e,
        buckets: eM({}, t.buckets)
    } : {
        cookieKey: e,
        buckets: {}
    };
}
function eQ(e, t, i = Date.now()) {
    if (!e) return null;
    let l = eX(e).buckets[t];
    return l && Array.isArray(l.ids) && "number" == typeof l.cachedAt && !(i - l.cachedAt > 600000) ? new Set(l.ids.filter((e)=>"string" == typeof e && e.length > 0)) : null;
}
function eY(e, t, i, l = Date.now()) {
    if (!e) return;
    let r = eX(e), a = Array.from(new Set(Array.from(i).filter((e)=>!!e)));
    r.buckets[t] = {
        ids: a,
        cachedAt: l
    }, ex(eR, r);
}
function e0(e, t, i, l = Date.now()) {
    var r;
    if (!e) return;
    let a = null != (r = eQ(e, t, l)) ? r : new Set();
    for (let e of i)e && a.add(e);
    eY(e, t, a, l);
}
function e1(e, t, i, l, r = Date.now()) {
    var a;
    if (!e || !i) return;
    let n = null != (a = eQ(e, t, r)) ? a : new Set();
    l ? n.add(i) : n.delete(i), eY(e, t, n, r);
}
function e2(e, t, i, l, r, a, n) {
    try {
        var o = e[a](n), s = o.value;
    } catch (e) {
        i(e);
        return;
    }
    o.done ? t(s) : Promise.resolve(s).then(l, r);
}
function e3(e) {
    return function() {
        var t = this, i = arguments;
        return new Promise(function(l, r) {
            var a = e.apply(t, i);
            function n(e) {
                e2(a, l, r, n, o, "next", e);
            }
            function o(e) {
                e2(a, l, r, n, o, "throw", e);
            }
            n(void 0);
        });
    };
}
function e6(e, t, i) {
    return t in e ? Object.defineProperty(e, t, {
        value: i,
        enumerable: !0,
        configurable: !0,
        writable: !0
    }) : e[t] = i, e;
}
function e8(e) {
    for(var t = 1; t < arguments.length; t++){
        var i = null != arguments[t] ? arguments[t] : {}, l = Object.keys(i);
        "function" == typeof Object.getOwnPropertySymbols && (l = l.concat(Object.getOwnPropertySymbols(i).filter(function(e) {
            return Object.getOwnPropertyDescriptor(i, e).enumerable;
        }))), l.forEach(function(t) {
            e6(e, t, i[t]);
        });
    }
    return e;
}
function e5(e, t) {
    return t = null != t ? t : {}, Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : (function(e) {
        var t = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
            var i = Object.getOwnPropertySymbols(e);
            t.push.apply(t, i);
        }
        return t;
    })(Object(t)).forEach(function(i) {
        Object.defineProperty(e, i, Object.getOwnPropertyDescriptor(t, i));
    }), e;
}
class e4 extends Error {
    constructor(e, t = 0, i = !1){
        super(e), e6(this, "code", void 0), e6(this, "transient", void 0), this.name = "NeteaseApiError", this.code = t, this.transient = i;
    }
}
let e9 = new Set([
    "mp3",
    "flac",
    "m4a",
    "aac",
    "ogg",
    "wav",
    "mp4"
]);
function e7(e) {
    let t = eK(), i = a(e.cookie), l = {};
    return t.NMTID && (l.NMTID = t.NMTID), t.__csrf && (l.__csrf = t.__csrf), Object.assign(l, i.cookies), !i.cookies.NMTID && t.NMTID && (l.NMTID = t.NMTID), l;
}
function te(e) {
    return Object.entries(e).map(([e, t])=>`${encodeURIComponent(e)}=${encodeURIComponent(String(t))}`).join("&");
}
function tt(e) {
    if ("string" == typeof e) try {
        return JSON.parse(e);
    } catch (e) {
        throw new e4(Widget.i18n("网易云返回了无法解析的响应"), 0, !1);
    }
    if (e && "object" == typeof e) return e;
    throw new e4(Widget.i18n("网易云返回了无效数据"), 0, !1);
}
function ti(e, t) {
    let i = e.code;
    if (null == i) return;
    let l = Number(i);
    if (t.includes(l)) return;
    if (301 === l || 302 === l || 401 === l) throw new e4(Widget.i18n("网易云登录状态已失效或需要登录，请检查 Cookie 配置"), l, !1);
    if (-460 === l || 460 === l) throw new e4(Widget.i18n("网易云暂时触发风控限制，请稍后重试"), l, !0);
    if (405 === l || 429 === l) throw new e4(Widget.i18n("网易云请求过于频繁，请稍后重试"), l, !0);
    let r = "string" == typeof e.message && e.message.trim() ? e.message.trim() : `code ${l}`;
    throw new e4(`${Widget.i18n("网易云接口返回错误")} (${r})`, l, l >= 500);
}
function tl(e) {
    if (e instanceof e4) return e.transient;
    let t = e instanceof Error ? e.message : String(e);
    return /^HTTP\s+(?:429|5\d\d)\b/i.test(t);
}
function tr(e, t = 3) {
    return e3(function*() {
        let i;
        for(let l = 1; l <= t; l++)try {
            return yield e(l);
        } catch (e) {
            if (i = e, !tl(e) || l >= t) throw e;
            yield function(e) {
                return e3(function*() {
                    yield new Promise((t)=>setTimeout(t, e));
                })();
            }(250 * l);
        }
        throw i;
    })();
}
function ta(e, t) {
    return e3(function*(e, t = {}, i, l = {}) {
        var a, s;
        let u, c = l.method || "GET", p = e7(i), f = e8({}, t);
        "POST" === c && p.__csrf && void 0 === f.csrf_token && (f.csrf_token = p.__csrf);
        let m = r(p), y = e8({
            "user-agent": d,
            referer: `${o}/`
        }, m ? {
            cookie: m
        } : {}), g = `${o}${e}`;
        if ("POST" === c) y["content-type"] = "application/x-www-form-urlencoded", u = te(f);
        else {
            let e = te(f);
            e && (g += (g.includes("?") ? "&" : "?") + e);
        }
        let h = yield Widget.http.request(e5(e8({
            url: g,
            method: c,
            headers: y
        }, void 0 !== u ? {
            data: u
        } : {}), {
            timeout: null != (a = l.timeout) ? a : 18
        }));
        eJ(n(h.headers));
        let v = tt(h.data);
        return ti(v, null != (s = l.allowedCodes) ? s : [
            200
        ]), v;
    }).apply(this, arguments);
}
function tn(e, t, i) {
    return e3(function*(e, t, i, l = {}) {
        var r, a;
        let o = e7(i), d = Date.now(), y = function() {
            let e = eV(ej);
            if ("string" == typeof e && /^[0-9A-F]{52}$/.test(e)) return e;
            let t = "";
            for(let e = 0; e < 52; e++)t += Math.floor(16 * Math.random()).toString(16).toUpperCase();
            return ex(ej, t), t;
        }(), g = "android" === l.clientProfile ? f : "osx" === l.clientProfile ? p : c, h = "android" === l.clientProfile ? "NeteaseMusic/9.5.61.260802021928(9005061);Dalvik/2.1.0 (Linux; U; Android 12; HBN-AL00 Build/cd737a2.0)" : "osx" === l.clientProfile ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" : m, v = e5(e8({}, g), {
            deviceId: y,
            mobilename: "",
            buildver: String(Math.floor(d / 1000)),
            requestId: `${d}_${String(Math.floor(1000 * Math.random())).padStart(4, "0")}`,
            __csrf: o.__csrf || ""
        });
        l.checkToken && (v["X-antiCheatToken"] = u), o.MUSIC_U && (v.MUSIC_U = o.MUSIC_U), o.NMTID && (v.NMTID = o.NMTID);
        let b = function(e, t, i = s) {
            let l = JSON.stringify(t), r = function(e) {
                let t = Q(e), i = 8 * t.length, l = ((t.length + 8 >>> 6) + 1) * 64, r = new Uint8Array(l);
                r.set(t), r[t.length] = 0x80;
                let a = i >>> 0, n = Math.floor(i / 0x100000000) >>> 0, o = l - 8;
                r[o] = 0xff & a, r[o + 1] = a >>> 8 & 0xff, r[o + 2] = a >>> 16 & 0xff, r[o + 3] = a >>> 24 & 0xff, r[o + 4] = 0xff & n, r[o + 5] = n >>> 8 & 0xff, r[o + 6] = n >>> 16 & 0xff, r[o + 7] = n >>> 24 & 0xff;
                let s = 0x67452301, u = 0xefcdab89, d = 0x98badcfe, c = 0x10325476, p = new Uint32Array(16);
                for(let e = 0; e < l; e += 64){
                    for(let t = 0; t < 16; t++){
                        let i = e + 4 * t;
                        p[t] = (r[i] | r[i + 1] << 8 | r[i + 2] << 16 | r[i + 3] << 24) >>> 0;
                    }
                    let t = s, i = u, l = d, a = c;
                    for(let e = 0; e < 64; e++){
                        var f, m;
                        let r, n;
                        e < 16 ? (r = i & l | ~i & a, n = e) : e < 32 ? (r = a & i | ~a & l, n = 5 * e + 1 & 15) : e < 48 ? (r = i ^ l ^ a, n = 3 * e + 5 & 15) : (r = l ^ (i | ~a), n = 7 * e & 15);
                        let o = a;
                        a = l, l = i, i = i + ((f = t + r + et[e] + p[n] | 0) << (m = ee[e]) | f >>> 32 - m) | 0, t = o;
                    }
                    s = s + t | 0, u = u + i | 0, d = d + l | 0, c = c + a | 0;
                }
                return ei(s) + ei(u) + ei(d) + ei(c);
            }(`nobody${e}use${l}md5forencrypt`);
            return function(e, t = s) {
                let i = Q(e), l = function(e) {
                    if (16 !== e.length) throw Error(`AES-128 key must be 16 bytes, got ${e.length}`);
                    let t = new Uint8Array(176);
                    t.set(e);
                    for(let e = 4; e < 44; e++){
                        let i = (e - 1) * 4, l = t[i], r = t[i + 1], a = t[i + 2], n = t[i + 3];
                        if (e % 4 == 0) {
                            let t = l;
                            l = el[r] ^ er[e / 4 - 1], r = el[a], a = el[n], n = el[t];
                        }
                        let o = (e - 4) * 4, s = 4 * e;
                        t[s] = t[o] ^ l, t[s + 1] = t[o + 1] ^ r, t[s + 2] = t[o + 2] ^ a, t[s + 3] = t[o + 3] ^ n;
                    }
                    return t;
                }(Q(t)), r = 16 - i.length % 16, a = new Uint8Array(i.length + r);
                a.set(i), a.fill(r, i.length);
                let n = new Uint8Array(16), o = "";
                for(let e = 0; e < a.length; e += 16){
                    n.set(a.subarray(e, e + 16)), function(e, t) {
                        for(let i = 0; i < 16; i++)e[i] ^= t[i];
                        for(let i = 1; i <= 10; i++){
                            for(let t = 0; t < 16; t++)e[t] = el[e[t]];
                            let l = e[1];
                            if (e[1] = e[5], e[5] = e[9], e[9] = e[13], e[13] = l, l = e[2], e[2] = e[10], e[10] = l, l = e[6], e[6] = e[14], e[14] = l, l = e[15], e[15] = e[11], e[11] = e[7], e[7] = e[3], e[3] = l, i < 10) for(let t = 0; t < 16; t += 4){
                                let i = e[t], l = e[t + 1], r = e[t + 2], a = e[t + 3], n = i ^ l ^ r ^ a;
                                e[t] = i ^ n ^ ea(i ^ l), e[t + 1] = l ^ n ^ ea(l ^ r), e[t + 2] = r ^ n ^ ea(r ^ a), e[t + 3] = a ^ n ^ ea(a ^ i);
                            }
                            let r = 16 * i;
                            for(let i = 0; i < 16; i++)e[i] ^= t[r + i];
                        }
                    }(n, l);
                    for(let e = 0; e < 16; e++)o += n[e].toString(16).padStart(2, "0").toUpperCase();
                }
                return o;
            }(`${e}-36cd479b6b5-${l}-36cd479b6b5-${r}`, i);
        }(e, e5(e8({}, t), {
            header: v,
            e_r: !1
        })), k = Object.entries(v).map(([e, t])=>`${encodeURIComponent(e)}=${encodeURIComponent(t)}`).join("; "), A = l.host || "https://interfacepc.music.163.com", I = `${A}${e.replace(/^\/api\//, "/eapi/")}`, P = yield Widget.http.request({
            url: I,
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                "user-agent": h,
                cookie: k
            },
            data: `params=${b}`,
            timeout: null != (r = l.timeout) ? r : 18
        });
        eJ(n(P.headers));
        let S = tt(P.data);
        return ti(S, null != (a = l.allowedCodes) ? a : [
            200
        ]), S;
    }).apply(this, arguments);
}
function to(e) {
    return e3(function*() {
        var t, i, l;
        let r = a(e.cookie);
        if (!r.hasMusicU) throw Error(Widget.i18n("请在模块设置中填写包含 MUSIC_U 的网易云音乐 Cookie 后查看个人内容"));
        let n = r.cookies.MUSIC_U, o = function(e, t = Date.now()) {
            if (!e) return null;
            let i = eV(eN);
            return i && i.cookieKey === e && i.uid && !(t - i.cachedAt > 1800000) ? i : null;
        }(n);
        if (o) return {
            uid: o.uid,
            nickname: o.nickname
        };
        let s = yield ta("/api/nuser/account/get", {}, e), u = null != (t = null == (i = s.profile) ? void 0 : i.userId) ? t : null == (l = s.account) ? void 0 : l.id, d = u ? String(u) : "";
        if (!d || !/^\d+$/.test(d) || !s.profile) throw Error(Widget.i18n("网易云登录状态已失效或 Cookie 无效，请更新包含 MUSIC_U 的 Cookie"));
        let c = "string" == typeof s.profile.nickname ? s.profile.nickname : "";
        return !function(e, t, i, l = Date.now()) {
            e && i && ex(eN, {
                uid: e,
                nickname: t,
                cookieKey: i,
                cachedAt: l
            });
        }(d, c, n), {
            uid: d,
            nickname: c
        };
    })();
}
function ts(e, t) {
    return e3(function*() {
        let i = Array.from(new Set(e.filter((e)=>/^\d+$/.test(e))));
        if (!i.length) return [];
        let l = new Map();
        for(let e = 0; e < i.length; e += 100){
            let r = i.slice(e, e + 100), a = yield ta("/api/v3/song/detail", {
                c: JSON.stringify(r.map((e)=>({
                        id: Number(e)
                    })))
            }, t, {
                method: "POST"
            });
            for (let e of Array.isArray(a.songs) ? a.songs : []){
                let t = eg(e);
                t && l.set(t.id, t);
            }
        }
        let r = [];
        for (let e of i){
            let t = l.get(e);
            t && r.push(t);
        }
        return r;
    })();
}
function tu(e, t, i, l) {
    return e3(function*() {
        if (!l.reportHistory || !a(l.cookie).hasMusicU) return;
        let r = /^\d+$/.test(String(t || "")) ? String(t) : "0", n = {
            id: e,
            type: "song",
            mainsite: "1",
            mainsiteWeb: "1",
            content: `id=${r}`
        }, o = {
            host: "https://clientlog.music.163.com",
            clientProfile: "osx",
            timeout: 4
        };
        yield tn("/api/feedback/weblog", {
            logs: JSON.stringify([
                {
                    action: "startplay",
                    json: n
                }
            ])
        }, l, o), yield tn("/api/feedback/weblog", {
            logs: JSON.stringify([
                {
                    action: "play",
                    json: e5(e8({}, n), {
                        download: 0,
                        end: "playend",
                        sourceId: r,
                        time: Math.max(0, Math.round(i)),
                        wifi: 0,
                        source: "list"
                    })
                }
            ])
        }, l, o);
    })();
}
function td(e, t) {
    if (!Array.isArray(e)) return [];
    let i = [];
    for (let l of e){
        let e = t(l), r = null != e ? String(e) : "";
        /^\d+$/.test(r) && i.push(r);
    }
    return i;
}
let tc = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, tp = /^\[(ti|ar|al|by|offset):[^\]]*\]$/i;
function tf(e) {
    if ("string" != typeof e) return "";
    let t = e.replace(/\r\n?/g, "\n").trim();
    if (!t) return "";
    let i = t.split("\n").map((e)=>e.trim()).filter(Boolean);
    return 1 === i.length && /纯音乐[，,]?\s*请欣赏/.test(i[0]) ? "" : t;
}
function tm(e) {
    let t = [], i = [];
    for (let r of e.replace(/\r\n?/g, "\n").split("\n")){
        let e = r.trim();
        if (!e) continue;
        if (tp.test(e)) {
            t.push(e);
            continue;
        }
        let a = Array.from(e.matchAll(tc));
        if (!a.length) continue;
        let n = e.replace(tc, "").trim();
        if (n) for (let e of a){
            var l;
            let t = Number(e[1]), r = Number(e[2]), a = (l = e[3]) ? 1 === l.length ? 100 * Number(l) : 2 === l.length ? 10 * Number(l) : Number(l.slice(0, 3)) : 0;
            if (!Number.isFinite(t) || !Number.isFinite(r) || !Number.isFinite(a)) continue;
            let o = 60000 * t + 1000 * r + a;
            i.push({
                timeMs: o,
                timestamp: function(e) {
                    let t = Math.max(0, Math.round(e)), i = Math.floor(t / 60000), l = Math.floor(t % 60000 / 1000), r = Math.floor(t % 1000 / 10);
                    return `[${String(i).padStart(2, "0")}:${String(l).padStart(2, "0")}.${String(r).padStart(2, "0")}]`;
                }(o),
                text: n
            });
        }
    }
    return i.sort((e, t)=>e.timeMs - t.timeMs), {
        metadata: t,
        lines: i
    };
}
function ty(e) {
    return `data:text/plain;charset=utf-8;base64,${function(e) {
        let t = "";
        for(let i = 0; i < e.length; i += 3){
            let l = e[i], r = i + 1 < e.length, a = i + 2 < e.length, n = l << 16 | (r ? e[i + 1] : 0) << 8 | (a ? e[i + 2] : 0);
            t += Y[n >>> 18 & 0x3f], t += Y[n >>> 12 & 0x3f], t += r ? Y[n >>> 6 & 0x3f] : "=", t += a ? Y[0x3f & n] : "=";
        }
        return t;
    }(Q(e))}`;
}
function tg(e, t, i, l, r, a, n) {
    try {
        var o = e[a](n), s = o.value;
    } catch (e) {
        i(e);
        return;
    }
    o.done ? t(s) : Promise.resolve(s).then(l, r);
}
function th(e) {
    return function() {
        var t = this, i = arguments;
        return new Promise(function(l, r) {
            var a = e.apply(t, i);
            function n(e) {
                tg(a, l, r, n, o, "next", e);
            }
            function o(e) {
                tg(a, l, r, n, o, "throw", e);
            }
            n(void 0);
        });
    };
}
function tv(e) {
    for(var t = 1; t < arguments.length; t++){
        var i = null != arguments[t] ? arguments[t] : {}, l = Object.keys(i);
        "function" == typeof Object.getOwnPropertySymbols && (l = l.concat(Object.getOwnPropertySymbols(i).filter(function(e) {
            return Object.getOwnPropertyDescriptor(i, e).enumerable;
        }))), l.forEach(function(t) {
            var l;
            l = i[t], t in e ? Object.defineProperty(e, t, {
                value: l,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }) : e[t] = l;
        });
    }
    return e;
}
function tb(e, t) {
    return t = null != t ? t : {}, Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : (function(e) {
        var t = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
            var i = Object.getOwnPropertySymbols(e);
            t.push.apply(t, i);
        }
        return t;
    })(Object(t)).forEach(function(i) {
        Object.defineProperty(e, i, Object.getOwnPropertyDescriptor(t, i));
    }), e;
}
function tk(e) {
    let t = Number(e);
    return Number.isFinite(t) && t >= 1 ? Math.floor(t) : 1;
}
function tA(e, t = 30) {
    let i = Number(e.offset);
    return void 0 !== e.offset && "" !== e.offset && Number.isFinite(i) && i >= 0 ? Math.floor(i) : (tk(e.page) - 1) * t;
}
function tI(e, t, i = 30) {
    let l = tA(t, i);
    return e.slice(l, l + i);
}
function tP(e, t) {
    return e.startsWith(t) ? e.slice(t.length) : e;
}
function tS(e, t) {
    eG(t, e.map((e)=>{
        var t;
        return tv({
            id: e.id
        }, e.mvId ? {
            mvId: e.mvId
        } : {}, (null == (t = e.album) ? void 0 : t.id) ? {
            albumId: e.album.id
        } : {});
    }));
}
function tC(e, t) {
    return th(function*(e, t, i = 300) {
        var l;
        let r = (yield ta("/api/v6/playlist/detail", {
            id: e,
            n: 100000,
            s: 0
        }, t, {
            method: "POST"
        })).playlist, a = null != (l = ey(r)) ? l : {
            id: e,
            name: e
        }, n = (Array.isArray(null == r ? void 0 : r.tracks) ? r.tracks : []).map(eg).filter((e)=>null !== e), o = new Map(n.map((e)=>[
                e.id,
                e
            ])), s = (Array.isArray(null == r ? void 0 : r.trackIds) ? r.trackIds : []).map((e)=>(null == e ? void 0 : e.id) !== void 0 ? String(e.id) : "").filter((e)=>J(e)).slice(0, i);
        if (!s.length) return {
            playlist: a,
            tracks: n.slice(0, i)
        };
        let u = s.filter((e)=>!o.has(e));
        if (u.length) for (let e of yield ts(u, t))o.set(e.id, e);
        let d = [];
        for (let e of s){
            let t = o.get(e);
            t && d.push(t);
        }
        return {
            playlist: a,
            tracks: d
        };
    }).apply(this, arguments);
}
function tw(e, t) {
    return th(function*(e, t, i = 100) {
        var l;
        let [r, a] = yield Promise.allSettled([
            tn("/api/djradio/v2/get", {
                id: e
            }, t),
            tn("/api/dj/program/byradio", {
                radioId: e,
                limit: i,
                offset: 0,
                asc: !1
            }, t)
        ]), n = null != (l = eh("fulfilled" === r.status ? r.value.data : void 0)) ? l : {
            id: e,
            name: e
        }, o = ("fulfilled" === a.status && Array.isArray(a.value.programs) ? a.value.programs : []).map(ev).filter((e)=>null !== e).map((e)=>tb(tv({}, e), {
                host: e.host || n.host,
                radioName: e.radioName || n.name,
                imageUrl: e.imageUrl || n.imageUrl
            }));
        if (!o.length && "rejected" === r.status && "rejected" === a.status) throw r.reason;
        return {
            radio: n,
            programs: o
        };
    }).apply(this, arguments);
}
function tU(e, t, i) {
    let l = [
        i,
        e.subtitle || ""
    ].filter(Boolean).join(" · ") || void 0;
    return tv({}, e, l ? {
        subtitle: l
    } : {}, t ? {
        backdropPath: t
    } : {}, !e.posterPath && t ? {
        posterPath: t
    } : {}, t ? {
        coverUrl: t
    } : {});
}
function tT(e, t) {
    return th(function*() {
        var i;
        let l = [], r = new Set(), a = new Map();
        for (let t of e){
            let e = t.imageUrl || (null == (i = t.album) ? void 0 : i.imageUrl);
            for (let i of t.artists)!i.id || r.has(i.id) || (r.add(i.id), l.push(i), e && !a.has(i.id) && a.set(i.id, e));
        }
        let n = l.filter((e)=>!e.imageUrl).map((e)=>e.id), o = n.length ? yield e3(function*() {
            let e = Array.from(new Set(n.filter((e)=>/^\d+$/.test(e)))).slice(0, 30);
            if (!e.length) return {};
            let i = function(e = Date.now()) {
                let t = eV(eW);
                if (!t || "object" != typeof t) return {};
                let i = {};
                for (let [l, r] of Object.entries(t))r && "string" == typeof r.url && "number" == typeof r.cachedAt && e - r.cachedAt <= 604800000 && (i[l] = r.url);
                return i;
            }(), l = {}, r = [];
            for (let t of e)i[t] ? l[t] = i[t] : r.push(t);
            if (!r.length) return l;
            let a = {}, o = [];
            for(let e = 0; e < r.length; e += 15)o.push(r.slice(e, e + 15));
            let s = yield Promise.allSettled(o.map((e)=>{
                let i = {};
                for (let t of e)i[`/api/v1/artist/${t}`] = "{}";
                return tn("/api/batch", i, t, {
                    timeout: 10
                });
            }));
            for(let e = 0; e < o.length; e++){
                let t = s[e];
                if ("fulfilled" === t.status && t.value) for (let i of o[e]){
                    let e = t.value[`/api/v1/artist/${i}`], r = null == e ? void 0 : e.artist, n = (null == r ? void 0 : r.img1v1Url) || (null == r ? void 0 : r.picUrl) || (null == r ? void 0 : r.avatar), o = X("string" == typeof n ? n : void 0);
                    o && (l[i] = o, a[i] = o);
                }
            }
            return Object.keys(a).length && eZ(a), l;
        })() : {}, s = {}, u = l.map((e)=>{
            let t = e.imageUrl || o[e.id] || a.get(e.id);
            return e.imageUrl && (s[e.id] = e.imageUrl), eU(tv({}, e, t ? {
                imageUrl: t
            } : {}));
        });
        return Object.keys(s).length && eZ(s), eT(u);
    })();
}
function tM(e, t, i) {
    return th(function*() {
        let l = D.find((t)=>t.id === e);
        if (!l) return null;
        if (l.styleTagId) try {
            var r;
            let e = yield tn("/api/style-tag/home/artist", {
                tagId: l.styleTagId,
                cursor: t,
                size: 30,
                sort: 0
            }, i, {
                timeout: 8
            }), a = (Array.isArray(null == (r = e.data) ? void 0 : r.artists) ? e.data.artists : []).map(ef).filter((e)=>null !== e && !!e.id);
            if (a.length) {
                let e = {};
                for (let t of a)t.imageUrl && (e[t.id] = t.imageUrl);
                return eZ(e), eT(a.map((e)=>eU(e)));
            }
        } catch (e) {}
        if (l.artistArea) try {
            let e = yield tn("/api/v1/artist/list", {
                area: O[l.artistArea],
                type: -1,
                limit: 30,
                offset: t,
                total: !0
            }, i, {
                timeout: 8
            }), r = (Array.isArray(e.artists) ? e.artists : []).map(ef).filter((e)=>null !== e && !!e.id);
            if (r.length) {
                let e = {};
                for (let t of r)t.imageUrl && (e[t.id] = t.imageUrl);
                return eZ(e), eT(r.map((e)=>eU(e)));
            }
        } catch (e) {}
        return null;
    })();
}
function tO(e, t, i) {
    return th(function*() {
        if (!a(i.cookie).hasMusicU) throw Error(Widget.i18n("私人漫游需要配置网易云音乐 Cookie（含 MUSIC_U）"));
        let l = yield tn("/api/v1/radio/get", {
            mode: e,
            subMode: t,
            limit: 10
        }, i);
        return (Array.isArray(l.data) ? l.data : []).map(eg).filter((e)=>null !== e);
    })();
}
let tj = {
    "fm:DEFAULT": {
        mode: "DEFAULT",
        subMode: ""
    },
    "fm:FAMILIAR": {
        mode: "FAMILIAR",
        subMode: ""
    },
    "fm:EXPLORE": {
        mode: "EXPLORE",
        subMode: ""
    },
    "fm:SCENE_EXERCISE": {
        mode: "SCENE_RCMD",
        subMode: "EXERCISE"
    },
    "fm:SCENE_FOCUS": {
        mode: "SCENE_RCMD",
        subMode: "FOCUS"
    },
    "fm:SCENE_NIGHT": {
        mode: "SCENE_RCMD",
        subMode: "NIGHT_EMO"
    }
};
function t$(e) {
    var t;
    let i = String(null != (t = e.id) ? t : "").trim();
    if (!i) return null;
    if ("song" === e.mediaType && J(i)) return {
        kind: "song",
        resourceId: i
    };
    if ("album" === e.mediaType && J(i)) return {
        kind: "album",
        resourceId: i
    };
    if ("playlist" === e.mediaType) {
        if (J(i)) return {
            kind: "playlist",
            resourceId: i
        };
        if (i.startsWith("dj:")) {
            let e = i.slice(3);
            if (J(e)) return {
                kind: "podcast",
                resourceId: e
            };
        }
    }
    return ("person" === e.type || "person" === e.mediaType) && J(i) ? {
        kind: "artist",
        resourceId: i
    } : null;
}
function tN(e, t) {
    return th(function*() {
        let i = a(t.cookie);
        if (!i.hasMusicU) return null;
        let l = i.cookies.MUSIC_U, r = new Set();
        for (let t of e){
            let e = t$(t);
            e && r.add(e.kind);
        }
        if (!r.size) return null;
        let n = eQ(l, "songs"), o = eQ(l, "playlists"), s = eQ(l, "ownedPlaylists"), u = eQ(l, "albums"), d = eQ(l, "artists"), c = eQ(l, "podcasts"), p = [];
        return r.has("song") && null === n && p.push(e3(function*() {
            let { uid: e } = yield to(t);
            return td((yield tn("/api/song/like/get", {
                uid: e
            }, t, {
                timeout: 5
            })).ids, (e)=>e);
        })().then((e)=>{
            eY(l, "songs", e), n = new Set(e);
        }).catch(()=>void 0)), r.has("playlist") && null === o && p.push(e3(function*() {
            let { uid: e } = yield to(t), i = yield ta("/api/user/playlist", {
                uid: e,
                limit: 200,
                offset: 0,
                includeVideo: !0
            }, t, {
                timeout: 5
            }), l = [], r = [];
            for (let t of Array.isArray(i.playlist) ? i.playlist : []){
                let i = (null == t ? void 0 : t.id) !== void 0 ? String(t.id) : "";
                /^\d+$/.test(i) && (!0 === t.subscribed ? l.push(i) : void 0 !== t.userId && String(t.userId) === e && r.push(i));
            }
            return {
                subscribed: l,
                owned: r
            };
        })().then(({ subscribed: e, owned: t })=>{
            eY(l, "playlists", e), eY(l, "ownedPlaylists", t), o = new Set(e), s = new Set(t);
        }).catch(()=>void 0)), r.has("album") && null === u && p.push(e3(function*() {
            return td((yield tn("/api/album/sublist", {
                limit: 100,
                offset: 0,
                total: !0
            }, t, {
                timeout: 5
            })).data, (e)=>null == e ? void 0 : e.id);
        })().then((e)=>{
            eY(l, "albums", e), u = new Set(e);
        }).catch(()=>void 0)), r.has("artist") && null === d && p.push(e3(function*() {
            return td((yield tn("/api/artist/sublist", {
                limit: 100,
                offset: 0,
                total: !0
            }, t, {
                timeout: 5
            })).data, (e)=>null == e ? void 0 : e.id);
        })().then((e)=>{
            eY(l, "artists", e), d = new Set(e);
        }).catch(()=>void 0)), r.has("podcast") && null === c && p.push(e3(function*() {
            return td((yield tn("/api/djradio/get/subed", {
                limit: 100,
                offset: 0,
                total: !0
            }, t, {
                timeout: 5
            })).djRadios, (e)=>null == e ? void 0 : e.id);
        })().then((e)=>{
            eY(l, "podcasts", e), c = new Set(e);
        }).catch(()=>void 0)), p.length && (yield Promise.allSettled(p)), {
            songs: null != n ? n : new Set(),
            playlists: null != o ? o : new Set(),
            ownedPlaylists: null != s ? s : new Set(),
            albums: null != u ? u : new Set(),
            artists: null != d ? d : new Set(),
            podcasts: null != c ? c : new Set()
        };
    })();
}
function tD(e, t) {
    var i;
    let l = function(e, t) {
        let i = t$(e);
        if (!i) return null;
        switch(i.kind){
            case "song":
                {
                    let e = t.songs.has(i.resourceId);
                    return {
                        id: e ? h : g,
                        title: Widget.i18n(e ? "取消红心" : "红心喜欢"),
                        functionName: y
                    };
                }
            case "playlist":
                {
                    if (t.ownedPlaylists.has(i.resourceId)) return null;
                    let e = t.playlists.has(i.resourceId);
                    return {
                        id: e ? b : v,
                        title: Widget.i18n(e ? "取消收藏" : "收藏歌单"),
                        functionName: y
                    };
                }
            case "album":
                {
                    let e = t.albums.has(i.resourceId);
                    return {
                        id: e ? A : k,
                        title: Widget.i18n(e ? "取消收藏" : "收藏专辑"),
                        functionName: y
                    };
                }
            case "artist":
                {
                    let e = t.artists.has(i.resourceId);
                    return {
                        id: e ? P : I,
                        title: Widget.i18n(e ? "取消关注" : "关注歌手"),
                        functionName: y
                    };
                }
            case "podcast":
                {
                    let e = t.podcasts.has(i.resourceId);
                    return {
                        id: e ? C : S,
                        title: Widget.i18n(e ? "取消订阅" : "订阅播客"),
                        functionName: y
                    };
                }
        }
    }(e, t);
    if (!l) return e;
    let r = (null != (i = e.actions) ? i : []).filter((e)=>e.functionName !== y);
    return tb(tv({}, e), {
        actions: [
            l,
            ...r
        ]
    });
}
function tE(e) {
    return (t)=>th(function*() {
            var i, l;
            return i = yield e(t), l = eB(), th(function*() {
                if (!i.length) return i;
                let e = yield tN(i, l);
                return e ? i.map((t)=>tD(t, e)) : i;
            })();
        })();
}
let t_ = tE(function(e) {
    return th(function*() {
        var t, i, l, r, n, o, s;
        let u = ez(e), d = e.filter || "all", c = a(u.cookie).hasMusicU;
        if ("daily" === d) {
            let t = yield ta("/api/v3/discovery/recommend/songs", {}, u), i = (Array.isArray(null == (n = t.data) ? void 0 : n.dailySongs) ? t.data.dailySongs : []).map(eg).filter((e)=>null !== e), l = eT(i.map(eI));
            return tS(i, l), tI(l, e);
        }
        if ("history_daily" === d) {
            if (!c) throw Error(Widget.i18n("请在模块设置中填写包含 MUSIC_U 的网易云音乐 Cookie 后查看个人内容"));
            let t = yield tn("/api/discovery/recommend/songs/history/recent", {}, u), i = (Array.isArray(null == (o = t.data) ? void 0 : o.dates) ? t.data.dates.filter(Boolean) : [])[0];
            if (!i) return [];
            let l = yield tn("/api/discovery/recommend/songs/history/detail", {
                date: i
            }, u), r = (Array.isArray(null == (s = l.data) ? void 0 : s.songs) ? l.data.songs : []).map(eg).filter((e)=>null !== e), a = eT(r.map(eI));
            return tS(r, a), tI(a, e);
        }
        if ("highquality" === d) {
            let t = yield tn("/api/playlist/highquality/list", {
                cat: "全部",
                limit: 60,
                lasttime: 0,
                total: !0
            }, u);
            return tI(eT((Array.isArray(t.playlists) ? t.playlists : []).map(ey).filter((e)=>null !== e).map(eS)), e);
        }
        let p = {};
        ("all" === d || "songs" === d) && (c && (p.dailySongs = ta("/api/v3/discovery/recommend/songs", {}, u).then((e)=>{
            var t;
            return (Array.isArray(null == (t = e.data) ? void 0 : t.dailySongs) ? e.data.dailySongs : []).map(eg).filter((e)=>null !== e);
        })), p.newSongs = ta("/api/personalized/newsong", {
            limit: 20
        }, u).then((e)=>(Array.isArray(e.result) ? e.result : []).map(eg).filter((e)=>null !== e))), ("all" === d || "playlists" === d) && (c && (p.dailyPlaylists = ta("/api/v1/discovery/recommend/resource", {}, u).then((e)=>(Array.isArray(e.recommend) ? e.recommend : []).map(ey).filter((e)=>null !== e))), p.recommendedPlaylists = ta("/api/personalized/playlist", {
            limit: 30
        }, u).then((e)=>(Array.isArray(e.result) ? e.result : []).map(ey).filter((e)=>null !== e)));
        let [f, m, y, g] = yield Promise.allSettled([
            null != (t = p.dailySongs) ? t : Promise.resolve([]),
            null != (i = p.dailyPlaylists) ? i : Promise.resolve([]),
            null != (l = p.recommendedPlaylists) ? l : Promise.resolve([]),
            null != (r = p.newSongs) ? r : Promise.resolve([])
        ]), h = [], v = [];
        if ("fulfilled" === f.status) for (let e of f.value)v.push(e), h.push(eI(e));
        if ("fulfilled" === m.status) for (let e of m.value)h.push(eS(e));
        if ("fulfilled" === y.status) for (let e of y.value)h.push(eS(e));
        if ("fulfilled" === g.status) for (let e of g.value)v.push(e), h.push(eI(e));
        if (!h.length) {
            let e = [
                f,
                m,
                y,
                g
            ].find((e)=>"rejected" === e.status);
            if ((null == e ? void 0 : e.status) === "rejected") throw e.reason;
        }
        let b = eT(h);
        return tS(v, b), tI(b, e);
    })();
}), tW = tE(function(e) {
    return th(function*() {
        var t, i;
        let l = ez(e), r = "pc" === (t = e.clientType) || "iphone" === t || "android" === t || "ipad" === t ? t : "ipad", a = yield tn("/api/v2/banner/get", {
            clientType: r
        }, l), n = (Array.isArray(a.banners) ? a.banners : []).map((e)=>{
            let t = (null == e ? void 0 : e.targetId) !== void 0 ? String(e.targetId).trim() : "", i = Number(null == e ? void 0 : e.targetType) || 0, l = Z("string" == typeof (null == e ? void 0 : e.pic) ? e.pic : "string" == typeof (null == e ? void 0 : e.imageUrl) ? e.imageUrl : void 0), r = "string" == typeof (null == e ? void 0 : e.typeTitle) ? e.typeTitle.trim() : "", a = 1 === i ? eg(null == e ? void 0 : e.song) : null;
            return {
                targetId: t,
                targetType: i,
                bannerImage: l,
                typeTitle: r,
                embeddedSong: a
            };
        }).filter((e)=>J(e.targetId) && "0" !== e.targetId && (1 === e.targetType || 10 === e.targetType || 1000 === e.targetType || 1009 === e.targetType));
        if (!n.length) return [];
        let o = n.filter((e)=>1 === e.targetType && !e.embeddedSong).map((e)=>e.targetId), s = Array.from(new Set(n.filter((e)=>10 === e.targetType).map((e)=>e.targetId))), u = Array.from(new Set(n.filter((e)=>1000 === e.targetType).map((e)=>e.targetId))), d = Array.from(new Set(n.filter((e)=>1009 === e.targetType).map((e)=>e.targetId))), [c, p, f, m] = yield Promise.all([
            o.length ? ts(o, l).catch(()=>[]) : Promise.resolve([]),
            Promise.allSettled(s.map((e)=>ta(`/api/v1/album/${e}`, {}, l, {
                    timeout: 8
                }))),
            Promise.allSettled(u.map((e)=>ta("/api/v6/playlist/detail", {
                    id: e,
                    n: 0,
                    s: 0
                }, l, {
                    method: "POST",
                    timeout: 8
                }))),
            Promise.allSettled(d.map((e)=>tn("/api/djradio/v2/get", {
                    id: e
                }, l, {
                    timeout: 8
                })))
        ]), y = new Map();
        for (let e of c)y.set(e.id, e);
        let g = new Map();
        for(let e = 0; e < s.length; e++){
            let t = p[e];
            if ("fulfilled" === t.status) {
                let i = em(t.value.album);
                i && g.set(s[e], i);
            }
        }
        let h = new Map();
        for(let e = 0; e < u.length; e++){
            let t = f[e];
            if ("fulfilled" === t.status) {
                let i = ey(t.value.playlist);
                i && h.set(u[e], i);
            }
        }
        let v = new Map();
        for(let e = 0; e < d.length; e++){
            let t = m[e];
            if ("fulfilled" === t.status) {
                let i = eh(t.value.data);
                i && v.set(d[e], i);
            }
        }
        let b = [], k = [];
        for (let e of n){
            if (1 === e.targetType) {
                let t = null != (i = e.embeddedSong) ? i : y.get(e.targetId);
                t ? (k.push(t), b.push(tU(eI(t), e.bannerImage, e.typeTitle))) : b.push(tU({
                    id: e.targetId,
                    type: "url",
                    mediaType: "song",
                    link: H(e.targetId),
                    title: e.typeTitle || e.targetId
                }, e.bannerImage, ""));
                continue;
            }
            if (10 === e.targetType) {
                let t = g.get(e.targetId), i = t ? eP(t) : {
                    id: e.targetId,
                    type: "url",
                    mediaType: "album",
                    link: `ncm:album:${e.targetId}`,
                    title: e.typeTitle || e.targetId
                };
                b.push(tU(i, e.bannerImage, t ? e.typeTitle : ""));
                continue;
            }
            if (1000 === e.targetType) {
                let t = h.get(e.targetId), i = t ? eS(t) : {
                    id: e.targetId,
                    type: "url",
                    mediaType: "playlist",
                    link: F(e.targetId),
                    title: e.typeTitle || e.targetId
                };
                b.push(tU(i, e.bannerImage, t ? e.typeTitle : ""));
                continue;
            }
            if (1009 === e.targetType) {
                let t = v.get(e.targetId), i = t ? eC(t) : {
                    id: `dj:${e.targetId}`,
                    type: "url",
                    mediaType: "playlist",
                    link: q(e.targetId),
                    title: e.typeTitle || e.targetId
                };
                b.push(tU(i, e.bannerImage, t ? e.typeTitle : ""));
            }
        }
        let A = eT(b);
        return tS(k, A), tI(A, e);
    })();
}), tR = tE(function(e) {
    return th(function*() {
        let t = ez(e), i = e.category || "all";
        if ("artists" === i) {
            var l;
            let i = $["EA" === e.artistArea || "KR" === e.artistArea || "JP" === e.artistArea ? e.artistArea : "ZH"], r = yield tn("/api/toplist/artist", {
                type: i,
                limit: 100,
                offset: 0,
                total: !0
            }, t);
            return tI(eT((Array.isArray(null == (l = r.list) ? void 0 : l.artists) ? r.list.artists : []).map(ef).filter((e)=>null !== e && !!e.id).map((e)=>eU(e))), e);
        }
        let r = yield ta("/api/toplist/detail", {}, t);
        return tI(eT((Array.isArray(r.list) ? r.list : []).filter((e)=>{
            let t = "string" == typeof e.ToplistType && e.ToplistType.length > 0;
            return "official" === i ? t : "global" !== i || !t;
        }).map(ey).filter((e)=>null !== e).map(eS)), e);
    })();
}), tL = tE(function(e) {
    return th(function*() {
        var t;
        let i = ez(e), l = e.category || "albums", r = "ZH" === (t = e.area) || "EA" === t || "KR" === t || "JP" === t ? t : "ALL", a = tA(e);
        if ("songs" === l) {
            let e = M[r], t = yield ta("/api/v1/discovery/new/songs", {
                areaId: e,
                total: !0
            }, i, {
                method: "POST"
            }), l = (Array.isArray(t.data) ? t.data : []).map(eg).filter((e)=>null !== e), n = eT(l.map(eI));
            return tS(l, n), n.slice(a, a + 30);
        }
        let n = yield ta("/api/album/new", {
            area: r,
            limit: 30,
            offset: a
        }, i);
        return eT((Array.isArray(n.albums) ? n.albums : []).map(em).filter((e)=>null !== e).map(eP));
    })();
}), tV = tE(function(e) {
    return th(function*() {
        var t, i, l, r;
        let a = ez(e), n = tP((e.genreId || "").trim(), V);
        if (!n) {
            let t = e.source || "all";
            if ("styles" === t) {
                let t = yield tn("/api/tag/list/get", {}, a);
                return tI((Array.isArray(t.data) ? t.data : []).map(eb).filter((e)=>null !== e).map((e)=>tv({
                        id: `style:${e.tagId}`,
                        type: "url",
                        mediaType: "genre",
                        link: z(`style:${e.tagId}`),
                        title: e.tagName,
                        subtitle: e.enName || Widget.i18n("曲风馆"),
                        genreTitle: e.tagName
                    }, e.imageUrl ? {
                        posterPath: e.imageUrl,
                        coverUrl: e.imageUrl
                    } : {})), e);
            }
            let i = yield th(function*() {
                let e = function(e = Date.now()) {
                    let t = eV(e_);
                    if (!t || "object" != typeof t) return {};
                    let i = {};
                    for (let [l, r] of Object.entries(t))r && "string" == typeof r.url && "number" == typeof r.cachedAt && e - r.cachedAt <= 86400000 && (i[l] = r.url);
                    return i;
                }(), t = D.filter((t)=>!e[t.id]);
                if (!t.length) return e;
                let i = tv({}, e), l = {}, r = t.filter((e)=>!!e.styleTagId);
                if (r.length) try {
                    let e = yield tn("/api/tag/list/get", {}, a, {
                        timeout: 6
                    }), t = new Map();
                    for (let i of Array.isArray(e.data) ? e.data : []){
                        let e = eb(i);
                        (null == e ? void 0 : e.tagId) && e.imageUrl && t.set(e.tagId, e.imageUrl);
                    }
                    for (let e of r){
                        let r = e.styleTagId ? t.get(e.styleTagId) : void 0;
                        r && (i[e.id] = r, l[e.id] = r);
                    }
                } catch (e) {}
                let n = D.filter((e)=>!i[e.id]);
                if (n.length) {
                    let e = yield Promise.allSettled(n.map((e)=>tn("/api/playlist/list", {
                            cat: e.id,
                            order: "hot",
                            limit: 1,
                            offset: 0
                        }, a, {
                            timeout: 6
                        })));
                    for(let t = 0; t < n.length; t++){
                        let r = e[t];
                        if ("fulfilled" !== r.status) continue;
                        let a = Array.isArray(r.value.playlists) ? r.value.playlists[0] : void 0, o = X((null == a ? void 0 : a.coverImgUrl) || (null == a ? void 0 : a.picUrl));
                        if (o) {
                            let e = n[t].id;
                            i[e] = o, l[e] = o;
                        }
                    }
                }
                return Object.keys(l).length && function(e, t = Date.now()) {
                    let i = Object.entries(e).filter(([, e])=>!!e);
                    if (!i.length) return;
                    let l = eV(e_), r = l && "object" == typeof l ? eM({}, l) : {};
                    for (let [e, l] of i)r[e] = {
                        url: l,
                        cachedAt: t
                    };
                    ex(e_, r);
                }(l), i;
            })();
            return "highquality" === t ? tI(D.map((e)=>{
                let t = i[e.id];
                return tv({
                    id: `hq:${e.id}`,
                    type: "url",
                    mediaType: "genre",
                    link: z(`hq:${e.id}`),
                    title: Widget.i18n(e.title),
                    subtitle: `${Widget.i18n("精品歌单")} · ${Widget.i18n(e.subtitle)}`,
                    genreTitle: Widget.i18n(e.title)
                }, t ? {
                    posterPath: t,
                    coverUrl: t
                } : {});
            }), e) : tI(D.map((e)=>{
                let t = i[e.id];
                return tv({
                    id: e.id,
                    type: "url",
                    mediaType: "genre",
                    link: z(e.id),
                    title: Widget.i18n(e.title),
                    subtitle: Widget.i18n(e.subtitle),
                    genreTitle: Widget.i18n(e.title)
                }, t ? {
                    posterPath: t,
                    coverUrl: t
                } : {});
            }), e);
        }
        let o = tA(e), s = e.section || "albums";
        if (n.startsWith("style:") && J(n.slice(6))) {
            let e = n.slice(6);
            if ("songs" === s) {
                let i = yield tn("/api/style-tag/home/song", {
                    tagId: e,
                    cursor: o,
                    size: 30,
                    sort: 0
                }, a), l = (Array.isArray(null == (t = i.data) ? void 0 : t.songs) ? i.data.songs : []).map(eg).filter((e)=>null !== e), r = eT(l.map(eI));
                return tS(l, r), r;
            }
            if ("artists" === s) {
                let t = yield tn("/api/style-tag/home/artist", {
                    tagId: e,
                    cursor: o,
                    size: 30,
                    sort: 0
                }, a);
                return eT((Array.isArray(null == (i = t.data) ? void 0 : i.artists) ? t.data.artists : []).map(ef).filter((e)=>null !== e && !!e.id).map((e)=>eU(e)));
            }
            let [u, d] = yield Promise.allSettled([
                tn("/api/style-tag/home/album", {
                    tagId: e,
                    cursor: o,
                    size: 15,
                    sort: 0
                }, a),
                tn("/api/style-tag/home/playlist", {
                    tagId: e,
                    cursor: o,
                    size: 15,
                    sort: 0
                }, a)
            ]), c = [];
            if ("fulfilled" === u.status) for (let e of (Array.isArray(null == (l = u.value.data) ? void 0 : l.albums) ? u.value.data.albums : []).map(em).filter((e)=>null !== e))c.push(eP(e));
            if ("fulfilled" === d.status) for (let e of (Array.isArray(null == (r = d.value.data) ? void 0 : r.playlist) ? d.value.data.playlist : []).map(ey).filter((e)=>null !== e))c.push(eS(e));
            if (!c.length && "rejected" === u.status) throw u.reason;
            return eT(c);
        }
        if (n.startsWith("hq:")) {
            let t = n.slice(3) || "全部";
            if ("artists" === s) {
                let e = yield tM(t, o, a);
                if (null == e ? void 0 : e.length) return e;
            }
            let i = yield tn("/api/playlist/highquality/list", {
                cat: t,
                limit: 60,
                lasttime: 0,
                total: !0
            }, a), l = (Array.isArray(i.playlists) ? i.playlists : []).map(ey).filter((e)=>null !== e);
            if ("songs" === s || "artists" === s) {
                let t = l[0];
                if (!t) return [];
                let { tracks: i } = yield tC(t.id, a, 60);
                if ("artists" === s) return tI((yield tT(i, a)), e);
                let r = eT(i.map(eI));
                return tS(i, r), tI(r, e);
            }
            return tI(eT(l.map(eS)), e);
        }
        if ("artists" === s) {
            let e = yield tM(n, o, a);
            if (null == e ? void 0 : e.length) return e;
        }
        let u = yield ta("/api/playlist/list", {
            cat: n,
            order: "hot",
            limit: 30,
            offset: o,
            total: !0
        }, a), d = (Array.isArray(u.playlists) ? u.playlists : []).map(ey).filter((e)=>null !== e);
        if ("songs" === s || "artists" === s) {
            let e = d[0];
            if (!e) return [];
            let { tracks: t } = yield tC(e.id, a, 60);
            if ("artists" === s) return tT(t, a);
            let i = eT(t.map(eI));
            return tS(t, i), i;
        }
        return eT(d.map(eS));
    })();
}), tx = tE(function(e) {
    return th(function*() {
        let t = ez(e), i = tP((e.radioId || "").trim(), x);
        if (!i) {
            let i = [
                {
                    id: "fm:DEFAULT",
                    type: "url",
                    mediaType: "radio",
                    link: K("fm:DEFAULT"),
                    title: Widget.i18n("私人漫游 · 默认"),
                    subtitle: Widget.i18n("根据你的听歌口味持续推荐（需配置 Cookie）")
                },
                {
                    id: "fm:FAMILIAR",
                    type: "url",
                    mediaType: "radio",
                    link: K("fm:FAMILIAR"),
                    title: Widget.i18n("私人漫游 · 熟悉"),
                    subtitle: Widget.i18n("重温你熟悉和喜欢的旋律（需配置 Cookie）")
                },
                {
                    id: "fm:EXPLORE",
                    type: "url",
                    mediaType: "radio",
                    link: K("fm:EXPLORE"),
                    title: Widget.i18n("私人漫游 · 探索"),
                    subtitle: Widget.i18n("发现新鲜小众好音乐（需配置 Cookie）")
                },
                {
                    id: "fm:SCENE_EXERCISE",
                    type: "url",
                    mediaType: "radio",
                    link: K("fm:SCENE_EXERCISE"),
                    title: Widget.i18n("场景漫游 · 运动"),
                    subtitle: Widget.i18n("高燃节奏伴你运动（需配置 Cookie）")
                },
                {
                    id: "fm:SCENE_FOCUS",
                    type: "url",
                    mediaType: "radio",
                    link: K("fm:SCENE_FOCUS"),
                    title: Widget.i18n("场景漫游 · 专注"),
                    subtitle: Widget.i18n("沉浸工作与学习氛围（需配置 Cookie）")
                },
                {
                    id: "fm:SCENE_NIGHT",
                    type: "url",
                    mediaType: "radio",
                    link: K("fm:SCENE_NIGHT"),
                    title: Widget.i18n("场景漫游 · 深夜情绪"),
                    subtitle: Widget.i18n("治愈深夜情绪的私藏歌单（需配置 Cookie）")
                },
                {
                    id: "heart",
                    type: "url",
                    mediaType: "radio",
                    link: K("heart"),
                    title: Widget.i18n("心动模式"),
                    subtitle: Widget.i18n("以我喜欢的音乐为种子智能推荐（需配置 Cookie）")
                },
                {
                    id: "sport",
                    type: "url",
                    mediaType: "radio",
                    link: K("sport"),
                    title: Widget.i18n("跑步漫游"),
                    subtitle: Widget.i18n("按 160 BPM 步频推荐的动感节奏")
                },
                {
                    id: "radar",
                    type: "url",
                    mediaType: "radio",
                    link: K("radar"),
                    title: Widget.i18n("私人雷达"),
                    subtitle: Widget.i18n("每日更新的个性化精选电台")
                }
            ];
            try {
                let e = yield ta("/api/toplist/detail", {}, t);
                for (let t of (Array.isArray(e.list) ? e.list : []).map(ey).filter((e)=>null !== e).slice(0, 8))i.push(tv({
                    id: `pl:${t.id}`,
                    type: "url",
                    mediaType: "radio",
                    link: K(`pl:${t.id}`),
                    title: t.name
                }, t.owner ? {
                    subtitle: t.owner
                } : {}, t.imageUrl ? {
                    posterPath: t.imageUrl,
                    coverUrl: t.imageUrl
                } : {}));
            } catch (e) {}
            return tI(i, e);
        }
        let l = [], r = tj[i];
        if (r) {
            let [e, i] = yield Promise.allSettled([
                tO(r.mode, r.subMode, t),
                tO(r.mode, r.subMode, t)
            ]);
            if ("fulfilled" === e.status && l.push(...e.value), "fulfilled" === i.status && l.push(...i.value), !l.length && "rejected" === e.status) throw e.reason;
        } else if ("heart" === i) l = yield th(function*() {
            let { uid: e } = yield to(t), i = yield ta("/api/user/playlist", {
                uid: e,
                limit: 30,
                offset: 0
            }, t), l = (Array.isArray(i.playlist) ? i.playlist : []).find((e)=>5 === Number(e.specialType)), r = (null == l ? void 0 : l.id) ? String(l.id) : "";
            if (!r) throw Error(Widget.i18n("未找到「我喜欢的音乐」歌单，无法开启心动模式"));
            let { tracks: a } = yield tC(r, t, 50), n = a[Math.floor(Math.random() * a.length)];
            if (!n) throw Error(Widget.i18n("「我喜欢的音乐」为空，请先收藏几首歌曲再使用心动模式"));
            let o = yield tn("/api/playmode/intelligence/list", {
                songId: n.id,
                startMusicId: n.id,
                playlistId: r,
                type: "fromPlayOne",
                count: 30
            }, t), s = (Array.isArray(o.data) ? o.data : []).map((e)=>eg(null == e ? void 0 : e.songInfo)).filter((e)=>null !== e);
            return s.length ? s : a;
        })();
        else if ("sport" === i) l = yield th(function*() {
            var e;
            let i = yield Promise.allSettled([
                tn("/api/radio/sport/get", {
                    bpm: 160
                }, t),
                tn("/api/radio/sport/get", {
                    bpm: 160
                }, t),
                tn("/api/radio/sport/get", {
                    bpm: 160
                }, t)
            ]), l = [];
            for (let e of i)if ("fulfilled" === e.status && Array.isArray(e.value.data)) for (let t of e.value.data){
                let e = eg(t);
                e && l.push(e);
            }
            if (!l.length && (null == (e = i[0]) ? void 0 : e.status) === "rejected") throw i[0].reason;
            return l;
        })();
        else if ("radar" === i) l = (yield tC("3136952023", t, 60)).tracks;
        else if (i.startsWith("pl:") && J(i.slice(3))) l = (yield tC(i.slice(3), t, 60)).tracks;
        else if (i.startsWith("dj:") && J(i.slice(3))) {
            let { programs: l } = yield tw(i.slice(3), t, 60), r = eT(l.map(ew));
            return eG(r), tI(r, e);
        } else J(i) && (l = (yield tC(i, t, 60)).tracks);
        let a = e.section || "songs";
        if ("artists" === a) return tI((yield tT(l, t)), e);
        if ("albums" === a) return tI(eT(l.flatMap((e)=>{
            var t;
            return (null == (t = e.album) ? void 0 : t.id) ? [
                eP({
                    id: e.album.id,
                    name: e.album.name,
                    imageUrl: e.album.imageUrl || e.imageUrl,
                    artists: e.artists
                })
            ] : [];
        })), e);
        let n = eT(l.map(eI));
        return tS(l, n), tI(n, e);
    })();
}), tH = tE(function(e) {
    return th(function*() {
        let t = ez(e), i = e.category || "recommend", l = tA(e);
        if ("programs" === i) {
            let e = yield tn("/api/program/toplist/v1", {
                limit: 30,
                offset: l
            }, t), i = eT((Array.isArray(e.toplist) ? e.toplist : []).map((e)=>ev(null == e ? void 0 : e.program)).filter((e)=>null !== e).map(ew));
            return eG(i), i;
        }
        if ("hot" === i) {
            let e = yield tn("/api/djradio/hot/v1", {
                limit: 30,
                offset: l
            }, t);
            return eT((Array.isArray(e.djRadios) ? e.djRadios : []).map(eh).filter((e)=>null !== e).map(eC));
        }
        if ("toplist_hot" === i || "toplist_new" === i) {
            let e = yield tn("/api/djradio/toplist", {
                type: +("toplist_hot" === i),
                limit: 30,
                offset: l
            }, t);
            return eT((Array.isArray(e.toplist) ? e.toplist : []).map(eh).filter((e)=>null !== e).map(eC));
        }
        let r = yield tn("/api/djradio/recommend/v1", {}, t);
        return tI(eT((Array.isArray(r.djRadios) ? r.djRadios : []).map(eh).filter((e)=>null !== e).map(eC)), e);
    })();
}), tF = tE(function(e) {
    return th(function*() {
        let t = ez(e), i = (e.peopleId || "").trim(), l = tA(e);
        if (!i) {
            var r, a;
            let i = "ZH" === (r = e.area) || "EA" === r || "JP" === r || "KR" === r || "OTHER" === r ? r : "ALL", n = "MALE" === (a = e.artistType) || "FEMALE" === a || "BAND" === a ? a : "ALL";
            if ("ALL" !== i || "ALL" !== n) {
                let e = yield tn("/api/v1/artist/list", {
                    area: O[i],
                    type: j[n],
                    limit: 30,
                    offset: l,
                    total: !0
                }, t);
                return eT((Array.isArray(e.artists) ? e.artists : []).map(ef).filter((e)=>null !== e && !!e.id).map((e)=>eU(e)));
            }
            let o = yield ta("/api/artist/top", {
                limit: 30,
                offset: l
            }, t);
            return eT((Array.isArray(o.artists) ? o.artists : []).map(ef).filter((e)=>null !== e && !!e.id).map((e)=>eU(e)));
        }
        if (!J(i)) return [];
        if ("profile" === e.section) {
            let [e, l] = yield Promise.allSettled([
                ta(`/api/v1/artist/${i}`, {}, t),
                tn("/api/artist/introduction", {
                    id: i
                }, t, {
                    timeout: 6
                })
            ]);
            if ("rejected" === e.status) throw e.reason;
            let r = ef(e.value.artist);
            if (!r) return [];
            let a = e.value.artist || {}, n = ("fulfilled" === l.status && "string" == typeof l.value.briefDesc ? l.value.briefDesc.trim() : "") || ("string" == typeof a.briefDesc ? a.briefDesc.trim() : ""), o = Number(a.musicSize) || 0, s = Number(a.albumSize) || 0, u = [
                o > 0 ? `${o} ${Widget.i18n("首歌曲")}` : "",
                s > 0 ? `${s} ${Widget.i18n("张专辑")}` : ""
            ].filter(Boolean).join(" · "), d = [];
            if ("fulfilled" === l.status && Array.isArray(l.value.introduction)) for (let e of l.value.introduction.slice(0, 3)){
                let t = "string" == typeof (null == e ? void 0 : e.ti) ? e.ti.trim() : "", i = "string" == typeof (null == e ? void 0 : e.txt) ? e.txt.trim() : "";
                t && i && d.push(`${t}\n${i}`);
            }
            return [
                eU(r, [
                    u,
                    n,
                    ...d
                ].filter(Boolean).join("\n\n") || void 0)
            ];
        }
        if ("albums" === e.section) {
            let e = yield ta(`/api/artist/albums/${i}`, {
                limit: 30,
                offset: l
            }, t);
            return eT((Array.isArray(e.hotAlbums) ? e.hotAlbums : []).map(em).filter((e)=>null !== e).map(eP));
        }
        if ("artists" === e.section) try {
            let l = yield ta("/api/discovery/simiArtist", {
                artistid: i
            }, t, {
                method: "POST"
            }), r = (Array.isArray(l.artists) ? l.artists : []).map(ef).filter((e)=>null !== e && !!e.id && e.id !== i);
            return tI(eT(r.map((e)=>eU(e))), e);
        } catch (e) {
            return [];
        }
        if (0 === l) {
            let e = yield ta(`/api/v1/artist/${i}`, {}, t), l = (Array.isArray(e.hotSongs) ? e.hotSongs : []).map(eg).filter((e)=>null !== e);
            if (l.length) {
                let e = eT(l.map(eI));
                return tS(l, e), e.slice(0, 30);
            }
        }
        let n = yield ta("/api/v1/artist/songs", {
            id: i,
            order: "hot",
            limit: 30,
            offset: l
        }, t, {
            method: "POST"
        }), o = (Array.isArray(n.songs) ? n.songs : []).map(eg).filter((e)=>null !== e), s = eT(o.map(eI));
        return tS(o, s), s;
    })();
}), tq = tE(function(e) {
    return th(function*() {
        var t, i, l, r;
        let n = ez(e), o = e.tab || "liked", s = tA(e), { uid: u } = yield to(n), d = a(n.cookie).cookies.MUSIC_U || "";
        if ("recent_songs" === o) {
            let t = yield tn("/api/play-record/song/list", {
                limit: 100
            }, n), l = (Array.isArray(null == (i = t.data) ? void 0 : i.list) ? t.data.list : []).map((e)=>eg(null == e ? void 0 : e.data)).filter((e)=>null !== e), r = eT(l.map(eI));
            return tS(l, r), tI(r, e);
        }
        if ("recent_albums" === o) {
            let t = yield tn("/api/play-record/album/list", {
                limit: 100
            }, n);
            return tI(eT((Array.isArray(null == (l = t.data) ? void 0 : l.list) ? t.data.list : []).map((e)=>em(null == e ? void 0 : e.data)).filter((e)=>null !== e).map(eP)), e);
        }
        if ("recent_playlists" === o) {
            let t = yield tn("/api/play-record/playlist/list", {
                limit: 100
            }, n);
            return tI(eT((Array.isArray(null == (r = t.data) ? void 0 : r.list) ? t.data.list : []).map((e)=>ey(null == e ? void 0 : e.data)).filter((e)=>null !== e).map(eS)), e);
        }
        if ("sub_albums" === o) {
            let e = yield tn("/api/album/sublist", {
                limit: 30,
                offset: s,
                total: !0
            }, n), t = (Array.isArray(e.data) ? e.data : []).map(em).filter((e)=>null !== e);
            return e0(d, "albums", t.map((e)=>e.id)), eT(t.map(eP));
        }
        if ("sub_artists" === o) {
            let e = yield tn("/api/artist/sublist", {
                limit: 30,
                offset: s,
                total: !0
            }, n), t = (Array.isArray(e.data) ? e.data : []).map(ef).filter((e)=>null !== e && !!e.id);
            return e0(d, "artists", t.map((e)=>e.id)), eT(t.map((e)=>eU(e)));
        }
        if ("sub_podcasts" === o) {
            let e = yield tn("/api/djradio/get/subed", {
                limit: 30,
                offset: s,
                total: !0
            }, n), t = (Array.isArray(e.djRadios) ? e.djRadios : []).map(eh).filter((e)=>null !== e);
            return e0(d, "podcasts", t.map((e)=>e.id)), eT(t.map(eC));
        }
        if ("cloud" === o) {
            let e = yield tn("/api/v1/cloud/get", {
                limit: 30,
                offset: s
            }, n), t = [];
            for (let i of Array.isArray(e.data) ? e.data : []){
                let e = eg(i.simpleSong);
                if (e) {
                    t.push(e);
                    continue;
                }
                let l = i.songId ? String(i.songId) : "";
                J(l) && t.push({
                    id: l,
                    name: i.songName || l,
                    artists: i.artist ? [
                        {
                            id: "",
                            name: i.artist
                        }
                    ] : [],
                    album: i.album ? {
                        id: "",
                        name: i.album
                    } : void 0,
                    duration: 0
                });
            }
            let i = eT(t.map(eI));
            return tS(t, i), i;
        }
        if ("recent_week" === o || "recent_all" === o) {
            let t = +("recent_week" === o), i = yield ta("/api/v1/play/record", {
                uid: u,
                type: t
            }, n, {
                method: "POST"
            }), l = 1 === t ? i.weekData : i.allData, r = (Array.isArray(l) ? l : []).map((e)=>eg(null == e ? void 0 : e.song)).filter((e)=>null !== e), a = eT(r.map(eI));
            return tS(r, a), tI(a, e);
        }
        let c = yield ta("/api/user/playlist", {
            uid: u,
            limit: 30,
            offset: "playlists" === o ? s : 0
        }, n), p = Array.isArray(c.playlist) ? c.playlist : [], f = [], m = [];
        for (let e of p){
            let t = (null == e ? void 0 : e.id) !== void 0 ? String(e.id) : "";
            J(t) && (!0 === e.subscribed ? f.push(t) : void 0 !== e.userId && String(e.userId) === u && m.push(t));
        }
        if (f.length && e0(d, "playlists", f), m.length && e0(d, "ownedPlaylists", m), "playlists" === o) return eT(p.map(ey).filter((e)=>null !== e).map(eS));
        let y = null != (t = p.find((e)=>5 === Number(e.specialType))) ? t : p[0], g = (null == y ? void 0 : y.id) ? String(y.id) : "";
        if (!g) return [];
        let { tracks: h } = yield tC(g, n, 300);
        e0(d, "songs", h.map((e)=>e.id));
        let v = eT(h.map(eI));
        return tS(h, v), tI(v, e);
    })();
}), tB = tE(function(e) {
    return th(function*() {
        var t, i, l, r, a, n, o, s, u, d, c;
        let p = ez(e), f = (e.keyword || "").trim();
        if (!f) return th(function*() {
            try {
                let t = yield tn("/api/hotsearchlist/get", {}, p, {
                    timeout: 10
                }), i = Array.isArray(t.data) ? t.data : [], l = [];
                return i.forEach((e, t)=>{
                    let i = "string" == typeof (null == e ? void 0 : e.searchWord) ? e.searchWord.trim() : "";
                    if (!i) return;
                    let r = t + 1, a = "string" == typeof e.content ? e.content.trim() : "", n = Number(e.score) || 0, o = a || (n > 0 ? `${Widget.i18n("热搜")} · ${n}` : Widget.i18n("网易云热搜榜")), s = X("string" == typeof e.iconUrl ? e.iconUrl : void 0);
                    l.push(tv({
                        id: `hot:${r}`,
                        type: "url",
                        mediaType: "playlist",
                        link: B(i),
                        title: `${r}. ${i}`,
                        subtitle: o
                    }, s ? {
                        posterPath: s,
                        coverUrl: s
                    } : {}));
                }), tI(l, e);
            } catch (e) {
                return [];
            }
        })();
        let m = e.kind || "all", y = tk(e.page), g = tA(e);
        if ("voices" === m) {
            let e = yield tn("/api/search/voice/get", {
                keyword: f,
                scene: "normal",
                limit: 30,
                offset: g
            }, p), t = eT((Array.isArray(null == (i = e.data) ? void 0 : i.resources) ? e.data.resources : []).map((e)=>ev(null == e ? void 0 : e.baseInfo)).filter((e)=>null !== e).map(ew));
            return eG(t), t;
        }
        if ("all" === m) {
            if (1 === y && 0 === g) {
                let [e, t, i, l] = yield Promise.allSettled([
                    ta("/api/cloudsearch/pc", {
                        s: f,
                        type: N.songs,
                        limit: 20,
                        offset: 0,
                        total: !0
                    }, p, {
                        method: "POST"
                    }),
                    ta("/api/cloudsearch/pc", {
                        s: f,
                        type: N.artists,
                        limit: 4,
                        offset: 0,
                        total: !0
                    }, p, {
                        method: "POST"
                    }),
                    ta("/api/cloudsearch/pc", {
                        s: f,
                        type: N.albums,
                        limit: 4,
                        offset: 0,
                        total: !0
                    }, p, {
                        method: "POST"
                    }),
                    ta("/api/cloudsearch/pc", {
                        s: f,
                        type: N.playlists,
                        limit: 4,
                        offset: 0,
                        total: !0
                    }, p, {
                        method: "POST"
                    })
                ]), s = [], u = [];
                if ("fulfilled" === t.status) for (let e of (Array.isArray(null == (r = t.value.result) ? void 0 : r.artists) ? t.value.result.artists : []).map(ef).filter((e)=>null !== e && !!e.id))s.push(eU(e));
                if ("fulfilled" === i.status) for (let e of (Array.isArray(null == (a = i.value.result) ? void 0 : a.albums) ? i.value.result.albums : []).map(em).filter((e)=>null !== e))s.push(eP(e));
                if ("fulfilled" === e.status) for (let t of (Array.isArray(null == (n = e.value.result) ? void 0 : n.songs) ? e.value.result.songs : []).map(eg).filter((e)=>null !== e))u.push(t), s.push(eI(t));
                if ("fulfilled" === l.status) for (let e of (Array.isArray(null == (o = l.value.result) ? void 0 : o.playlists) ? l.value.result.playlists : []).map(ey).filter((e)=>null !== e))s.push(eS(e));
                if (!s.length && "rejected" === e.status) throw e.reason;
                let d = eT(s);
                return tS(u, d), d;
            }
            let e = Math.max(20, (y - 1) * 20), t = yield ta("/api/cloudsearch/pc", {
                s: f,
                type: N.songs,
                limit: 20,
                offset: e,
                total: !0
            }, p, {
                method: "POST"
            }), i = (Array.isArray(null == (l = t.result) ? void 0 : l.songs) ? t.result.songs : []).map(eg).filter((e)=>null !== e), s = eT(i.map(eI));
            return tS(i, s), s;
        }
        let h = N[m], v = yield ta("/api/cloudsearch/pc", {
            s: f,
            type: h,
            limit: 30,
            offset: g,
            total: !0
        }, p, {
            method: "POST"
        });
        if ("songs" === m || "lyrics" === m) {
            let e = Array.isArray(null == (s = v.result) ? void 0 : s.songs) ? v.result.songs : [], t = [], i = [];
            for (let l of e){
                let e = eg(l);
                if (!e) continue;
                t.push(e);
                let r = eI(e);
                if ("lyrics" === m && Array.isArray(null == l ? void 0 : l.lyrics) && l.lyrics.length) {
                    let e = l.lyrics.slice(0, 3).map((e)=>"string" == typeof e ? e.replace(/<[^>]+>/g, "").trim() : "").filter(Boolean).join("\n");
                    e && (r.description = e);
                }
                i.push(r);
            }
            let l = eT(i);
            return tS(t, l), l;
        }
        return "albums" === m ? eT((Array.isArray(null == (u = v.result) ? void 0 : u.albums) ? v.result.albums : []).map(em).filter((e)=>null !== e).map(eP)) : "artists" === m ? eT((Array.isArray(null == (d = v.result) ? void 0 : d.artists) ? v.result.artists : []).map(ef).filter((e)=>null !== e && !!e.id).map((e)=>eU(e))) : "dj" === m ? eT((Array.isArray(null == (c = v.result) ? void 0 : c.djRadios) ? v.result.djRadios : []).map(eh).filter((e)=>null !== e).map(eC)) : eT((Array.isArray(null == (t = v.result) ? void 0 : t.playlists) ? v.result.playlists : []).map(ey).filter((e)=>null !== e).map(eS));
    })();
});
function tz(e, t, i, l, r, a, n) {
    try {
        var o = e[a](n), s = o.value;
    } catch (e) {
        i(e);
        return;
    }
    o.done ? t(s) : Promise.resolve(s).then(l, r);
}
function tK(e) {
    return function() {
        var t = this, i = arguments;
        return new Promise(function(l, r) {
            var a = e.apply(t, i);
            function n(e) {
                tz(a, l, r, n, o, "next", e);
            }
            function o(e) {
                tz(a, l, r, n, o, "throw", e);
            }
            n(void 0);
        });
    };
}
WidgetMetadata = {
    id: "baranwang.music.netease",
    title: "网易云音乐 (测试)",
    description: "网易云音乐插件，支持首页推荐、焦点轮播、精品歌单、排行榜、新歌速递、歌单分类与曲风馆、播客电台、私人与场景漫游、歌手主页、搜索、时间轴歌词、个人音乐库与高解析音频播放",
    author: "Baran",
    version: (e = new Date(), `0.0.0-${[
        e.getFullYear(),
        e.getMonth() + 1,
        e.getDate(),
        e.getHours(),
        e.getMinutes()
    ].map((e)=>e.toString().padStart(2, "0")).join("")}`),
    site: "https://github.com/baranwang/rex-widget/tree/main/apps/netease-music",
    requiredVersion: "0.0.7",
    contentType: "music",
    continuousPlay: !0,
    iconurl: "https://s1.music.126.net/style/favicon.ico",
    detailCacheDuration: 60,
    i18n: {
        en: {
            网易云音乐: "NetEase Cloud Music",
            "网易云音乐 (测试)": "NetEase Cloud Music (Dev)",
            "网易云音乐插件，支持首页推荐、焦点轮播、精品歌单、排行榜、新歌速递、歌单分类与曲风馆、播客电台、私人与场景漫游、歌手主页、搜索、时间轴歌词、个人音乐库与高解析音频播放": "NetEase Cloud Music plugin supporting Home, Featured Banners, High-Quality Playlists, Charts, New Releases, Categories & Style Hall, Podcasts, Personal & Scene FM, Artists, Search, Synced Lyrics, My Library, and Hi-Res Audio Playback",
            "网易云音乐插件，支持首页推荐、精品歌单、排行榜、新歌速递、歌单分类与曲风馆、播客电台、私人与场景漫游、歌手主页、搜索、时间轴歌词、个人音乐库与高解析音频播放": "NetEase Cloud Music plugin supporting Home, High-Quality Playlists, Charts, New Releases, Categories & Style Hall, Podcasts, Personal & Scene FM, Artists, Search, Synced Lyrics, My Library, and Hi-Res Audio Playback",
            "网易云音乐 Cookie（可选）": "NetEase Cloud Music Cookie (Optional)",
            "可选。支持直接粘贴 MUSIC_U 值、完整 Cookie 请求头或 Copy as cURL；不填可直接使用公开曲库与免费歌曲，填写后解锁每日推荐、历史日推、私人漫游、个人音乐库、动态封面、听歌打卡与黑胶 VIP / 无损音质。": "Optional. Paste a raw MUSIC_U token, full Cookie header, or Copy as cURL; leave empty for public catalog and free songs, or set it to unlock Daily Picks, History Picks, Personal FM, My Library, Motion Artwork, Scrobble, and VIP / Lossless quality.",
            音质偏好: "Audio Quality",
            "无损与 SVIP 高解析音质需要黑胶 VIP / SVIP Cookie，FLAC 在自动模式下优先使用软件解码": "Lossless and SVIP Hi-Res tiers require VIP / SVIP Cookie; standalone FLAC automatically prefers software decoder in Auto mode.",
            "标准 (128k)": "Standard (128k)",
            "较高 (192k)": "Higher (192k)",
            "极高 (320k，兼容性最佳)": "ExHigh (320k, Best Compatibility)",
            "无损 (FLAC，需 VIP)": "Lossless (FLAC, VIP)",
            "Hi-Res (FLAC，需 SVIP)": "Hi-Res (FLAC, SVIP)",
            "高清臻音 (SVIP)": "Spatial Audio HD (jyeffect, SVIP)",
            "沉浸环绕声 (SVIP)": "Immersive Surround (sky, SVIP)",
            "杜比全景声 (SVIP)": "Dolby Atmos (SVIP)",
            "臻音全景声 (SVIP)": "Vivid Surround (SVIP)",
            "超清母带 (SVIP)": "Master Quality (jymaster, SVIP)",
            "VIP 试听片段": "VIP Trial Previews",
            "遇到无完整权限的 VIP 歌曲时，是否允许播放 30 秒试听片段": "Whether to allow playing 30-second trial previews for VIP tracks without full access",
            "跳过试听（仅播放完整歌曲）": "Skip Previews (Full Tracks Only)",
            "允许播放 30 秒试听": "Allow 30s Previews",
            播放器偏好: "Player Preference",
            自动: "Auto",
            "系统播放器 (system)": "System Player (system)",
            "软件解码 (app)": "App Decoder (app)",
            听歌打卡: "Scrobble Listening History",
            "填写 Cookie 后，播放歌曲时上报至网易云听歌记录以更新听歌排行与每日推荐": "When Cookie is set, report playback to NetEase to keep your play ranks and recommendations fresh",
            关闭: "Off",
            "开启（需配置 Cookie）": "On (Requires Cookie)",
            首页推荐: "Home",
            "每日推荐、历史日推、精品歌单与新歌精选": "Daily picks, historical picks, high-quality playlists, and new songs",
            筛选: "Filter",
            全部: "All",
            每日推荐: "Daily Picks",
            历史日推: "History Daily Picks",
            精品歌单: "High-Quality Playlists",
            歌曲: "Songs",
            歌单: "Playlists",
            页码: "Page",
            焦点轮播: "Featured Banners",
            "网易云首页轮播焦点推荐，支持切换客户端来源": "NetEase Cloud Music featured banner picks with selectable client source",
            来源端: "Client Source",
            "iPad（新歌与新碟，推荐）": "iPad (New Songs & Albums, Recommended)",
            "PC（桌面端焦点）": "PC (Desktop Picks)",
            "iPhone（移动端歌单）": "iPhone (Mobile Playlists)",
            "Android（安卓端歌单）": "Android (Android Playlists)",
            排行榜: "Charts",
            官方榜与全球精选榜单: "Official and global music charts",
            "官方榜、全球精选榜单与歌手榜": "Official charts, global charts, and top artists",
            分类: "Category",
            官方榜: "Official Charts",
            全球榜: "Global Charts",
            歌手榜: "Top Artists Chart",
            歌手榜地区: "Artist Chart Region",
            新歌速递: "New Releases",
            最新上架专辑与新歌速递: "Newly released albums and singles",
            地区: "Region",
            新专辑: "New Albums",
            新歌: "New Songs",
            华语: "Chinese",
            欧美: "Western",
            韩国: "Korean",
            日本: "Japanese",
            其他: "Other",
            歌单分类: "Categories",
            "按语种、风格、曲风馆与精品标签浏览": "Browse by playlist categories, Style Hall, and high-quality tags",
            浏览模式: "Browse Mode",
            曲风馆: "Style Hall",
            精品歌单分类: "High-Quality Tags",
            "分类 ID": "Category ID",
            分区: "Section",
            "歌单 / 专辑": "Playlists / Albums",
            专辑: "Albums",
            偏移量: "Offset",
            电台与漫游: "Radio & FM",
            "私人漫游、场景漫游、跑步漫游、心动模式与榜单电台": "Personal FM, Scene FM, Running FM, Heart Mode, and chart stations",
            "电台 ID": "Radio ID",
            播客电台: "Podcasts & Radio",
            "精选播客、热门电台榜与高人气节目": "Featured podcasts, top radio charts, and popular episodes",
            精选播客: "Featured Podcasts",
            热门播客: "Popular Podcasts",
            热门电台榜: "Top Radios",
            新晋电台榜: "Rising Radios",
            热门节目榜: "Top Episodes",
            歌手: "Artists",
            "热门歌手、分类筛选与歌手主页": "Popular artists, category filters, and artist profiles",
            类型: "Type",
            男歌手: "Male",
            女歌手: "Female",
            乐队组合: "Bands & Groups",
            "歌手 ID": "Artist ID",
            歌手分区: "Artist Section",
            资料: "Profile",
            相似歌手: "Similar Artists",
            我的音乐库: "My Library",
            "我喜欢的音乐、个人歌单、云盘、最近播放与收藏（需配置 Cookie）": "Liked songs, playlists, cloud drive, recent plays, and collections (Requires Cookie)",
            我喜欢的音乐: "Liked Songs",
            我的歌单: "My Playlists",
            音乐云盘: "Cloud Drive",
            "最近播放 · 歌曲": "Recently Played · Songs",
            "最近播放 · 专辑": "Recently Played · Albums",
            "最近播放 · 歌单": "Recently Played · Playlists",
            收藏的专辑: "Collected Albums",
            关注的歌手: "Followed Artists",
            订阅的播客电台: "Subscribed Podcasts",
            最近一周听歌排行: "Weekly Top Played",
            所有时间听歌排行: "All-Time Top Played",
            歌词: "Lyrics",
            "网易云音乐时间轴歌词（双语 / 原文 / 译文 / 罗马音）": "NetEase Cloud Music synced lyrics (Bilingual / Original / Translation / Romaji)",
            "双语歌词（原文 + 译文）": "Bilingual Lyrics (Original + Translation)",
            原文歌词: "Original Lyrics",
            中文翻译歌词: "Chinese Translation",
            罗马音歌词: "Romaji Lyrics",
            搜索: "Search",
            "搜索歌曲、歌词、专辑、歌手、歌单、播客电台与声音（留空展示热搜榜）": "Search songs, lyrics, albums, artists, playlists, podcasts, and episodes (leave empty for Hot Search)",
            "搜索歌曲、专辑、歌手、歌单与播客电台": "Search songs, albums, artists, playlists, and podcasts",
            结果类型: "Result Type",
            "全部（音乐混合）": "All (Mixed Music)",
            按歌词搜歌: "Search by Lyrics",
            "声音 / 单集": "Voices & Episodes",
            热搜: "Trending",
            网易云热搜榜: "NetEase Trending Search",
            语种: "Language",
            风格: "Genre",
            主题: "Theme",
            情感: "Mood",
            场景: "Scene",
            日语: "Japanese",
            韩语: "Korean",
            粤语: "Cantonese",
            流行: "Pop",
            摇滚: "Rock",
            民谣: "Folk",
            电子: "Electronic",
            说唱: "Hip-Hop",
            轻音乐: "Easy Listening",
            爵士: "Jazz",
            古典: "Classical",
            古风: "Chinese Traditional",
            影视原声: "Soundtrack",
            游戏: "Gaming",
            怀旧: "Nostalgic",
            治愈: "Healing",
            夜晚: "Night",
            学习: "Study",
            运动: "Workout",
            驾车: "Driving",
            "私人漫游 · 默认": "Personal FM · Default",
            "根据你的听歌口味持续推荐（需配置 Cookie）": "Continuous recommendations tailored to your taste (Requires Cookie)",
            "私人漫游 · 熟悉": "Personal FM · Familiar",
            "重温你熟悉和喜欢的旋律（需配置 Cookie）": "Revisit familiar favorites (Requires Cookie)",
            "私人漫游 · 探索": "Personal FM · Explore",
            "发现新鲜小众好音乐（需配置 Cookie）": "Discover fresh tracks (Requires Cookie)",
            "场景漫游 · 运动": "Scene FM · Workout",
            "高燃节奏伴你运动（需配置 Cookie）": "Energetic beats for workouts (Requires Cookie)",
            "场景漫游 · 专注": "Scene FM · Focus",
            "沉浸工作与学习氛围（需配置 Cookie）": "Deep focus atmosphere for work and study (Requires Cookie)",
            "场景漫游 · 深夜情绪": "Scene FM · Late Night",
            "治愈深夜情绪的私藏歌单（需配置 Cookie）": "Soothing late-night mood mix (Requires Cookie)",
            心动模式: "Heart Mode",
            "以我喜欢的音乐为种子智能推荐（需配置 Cookie）": "Smart mix seeded from your liked songs (Requires Cookie)",
            跑步漫游: "Running FM",
            "按 160 BPM 步频推荐的动感节奏": "Upbeat 160 BPM tracks for running",
            私人雷达: "Private Radar",
            每日更新的个性化精选电台: "Daily updated personalized radar station",
            首歌曲: "songs",
            张专辑: "albums",
            试听: "Preview",
            未找到该专辑: "Album not found",
            无法识别的详情链接: "Unrecognized detail link",
            "请在模块设置中填写包含 MUSIC_U 的网易云音乐 Cookie 后查看个人内容": "Please set your NetEase Cloud Music Cookie (including MUSIC_U) in module settings to view personal library",
            "私人漫游需要配置网易云音乐 Cookie（含 MUSIC_U）": "Personal FM requires a NetEase Cloud Music Cookie (including MUSIC_U)",
            "未找到「我喜欢的音乐」歌单，无法开启心动模式": "Could not find your Liked Songs playlist for Heart Mode",
            "「我喜欢的音乐」为空，请先收藏几首歌曲再使用心动模式": "Your Liked Songs playlist is empty; like some songs first",
            网易云返回了无法解析的响应: "NetEase returned an unparseable response",
            网易云返回了无效数据: "NetEase returned invalid data",
            "网易云登录状态已失效或需要登录，请检查 Cookie 配置": "NetEase session expired or login required; please check your Cookie",
            "网易云登录状态已失效或 Cookie 无效，请更新包含 MUSIC_U 的 Cookie": "NetEase session expired or invalid Cookie; please update MUSIC_U",
            "网易云暂时触发风控限制，请稍后重试": "NetEase temporarily rate-limited this request; please try again later",
            "网易云请求过于频繁，请稍后重试": "Too many requests to NetEase; please try again later",
            网易云接口返回错误: "NetEase API returned an error",
            "当前歌曲暂无可用播放源，可能需要登录网易云黑胶 VIP 账号或受地区版权限制": "No playable audio stream found; VIP account or region availability may be required",
            "当前歌曲仅返回 30 秒 VIP 试听片段；请配置黑胶 VIP Cookie，或在模块设置中开启「允许播放 30 秒试听」": "Only a 30s VIP preview is available; provide a VIP Cookie or enable 30s previews in settings",
            红心喜欢: "Like Song",
            取消红心: "Unlike Song",
            收藏歌单: "Save Playlist",
            取消收藏: "Remove from Library",
            收藏专辑: "Save Album",
            关注歌手: "Follow Artist",
            取消关注: "Unfollow Artist",
            订阅播客: "Subscribe Podcast",
            取消订阅: "Unsubscribe",
            已加入我喜欢的音乐: "Added to Liked Songs",
            已取消红心喜欢: "Removed from Liked Songs",
            已收藏歌单: "Playlist saved",
            已取消收藏歌单: "Playlist removed",
            已收藏专辑: "Album saved",
            已取消收藏专辑: "Album removed",
            已关注歌手: "Artist followed",
            已取消关注歌手: "Artist unfollowed",
            已订阅播客: "Podcast subscribed",
            已取消订阅播客: "Podcast unsubscribed",
            "请在模块设置中填写包含 MUSIC_U 的网易云音乐 Cookie 后操作": "Please configure a NetEase Cookie containing MUSIC_U in settings first",
            "无法识别该歌曲 ID": "Invalid song ID",
            "无法识别该歌单 ID": "Invalid playlist ID",
            "无法识别该专辑 ID": "Invalid album ID",
            "无法识别该歌手 ID": "Invalid artist ID",
            "无法识别该播客 ID": "Invalid podcast ID",
            不支持的操作: "Unsupported action"
        },
        "zh-Hant": {
            网易云音乐: "網易雲音樂",
            "网易云音乐 (测试)": "網易雲音樂 (測試)",
            "网易云音乐插件，支持首页推荐、焦点轮播、精品歌单、排行榜、新歌速递、歌单分类与曲风馆、播客电台、私人与场景漫游、歌手主页、搜索、时间轴歌词、个人音乐库与高解析音频播放": "網易雲音樂插件，支援首頁推薦、焦點輪播、精品歌單、排行榜、新歌速遞、歌單分類與曲風館、播客電台、私人與場景漫遊、歌手主頁、搜尋、時間軸歌詞、個人音樂庫與高解析音訊播放",
            "网易云音乐插件，支持首页推荐、精品歌单、排行榜、新歌速递、歌单分类与曲风馆、播客电台、私人与场景漫游、歌手主页、搜索、时间轴歌词、个人音乐库与高解析音频播放": "網易雲音樂插件，支援首頁推薦、精品歌單、排行榜、新歌速遞、歌單分類與曲風館、播客電台、私人與場景漫遊、歌手主頁、搜尋、時間軸歌詞、個人音樂庫與高解析音訊播放",
            "网易云音乐 Cookie（可选）": "網易雲音樂 Cookie（選填）",
            "可选。支持直接粘贴 MUSIC_U 值、完整 Cookie 请求头或 Copy as cURL；不填可直接使用公开曲库与免费歌曲，填写后解锁每日推荐、历史日推、私人漫游、个人音乐库、动态封面、听歌打卡与黑胶 VIP / 无损音质。": "選填。支援直接貼上 MUSIC_U 值、完整 Cookie 請求標頭或 Copy as cURL；不填可直接使用公開曲庫與免費歌曲，填寫後解鎖每日推薦、歷史日推、私人漫遊、個人音樂庫、動態封面、聽歌打卡與黑膠 VIP / 無損音質。",
            音质偏好: "音質偏好",
            "无损与 SVIP 高解析音质需要黑胶 VIP / SVIP Cookie，FLAC 在自动模式下优先使用软件解码": "無損與 SVIP 高解析音質需要黑膠 VIP / SVIP Cookie，FLAC 在自動模式下優先使用軟體解碼",
            "标准 (128k)": "標準 (128k)",
            "较高 (192k)": "較高 (192k)",
            "极高 (320k，兼容性最佳)": "極高 (320k，相容性最佳)",
            "无损 (FLAC，需 VIP)": "無損 (FLAC，需 VIP)",
            "Hi-Res (FLAC，需 SVIP)": "Hi-Res (FLAC，需 SVIP)",
            "高清臻音 (SVIP)": "高清臻音 (SVIP)",
            "沉浸环绕声 (SVIP)": "沉浸環繞聲 (SVIP)",
            "杜比全景声 (SVIP)": "杜比全景聲 (SVIP)",
            "臻音全景声 (SVIP)": "臻音全景聲 (SVIP)",
            "超清母带 (SVIP)": "超清母帶 (SVIP)",
            "VIP 试听片段": "VIP 試聽片段",
            "遇到无完整权限的 VIP 歌曲时，是否允许播放 30 秒试听片段": "遇到無完整權限的 VIP 歌曲時，是否允許播放 30 秒試聽片段",
            "跳过试听（仅播放完整歌曲）": "略過試聽（僅播放完整歌曲）",
            "允许播放 30 秒试听": "允許播放 30 秒試聽",
            播放器偏好: "播放器偏好",
            自动: "自動",
            "系统播放器 (system)": "系統播放器 (system)",
            "软件解码 (app)": "軟體解碼 (app)",
            听歌打卡: "聽歌打卡",
            "填写 Cookie 后，播放歌曲时上报至网易云听歌记录以更新听歌排行与每日推荐": "填寫 Cookie 後，播放歌曲時上報至網易雲聽歌記錄以更新聽歌排行與每日推薦",
            关闭: "關閉",
            "开启（需配置 Cookie）": "開啟（需設定 Cookie）",
            首页推荐: "首頁推薦",
            "每日推荐、历史日推、精品歌单与新歌精选": "每日推薦、歷史日推、精品歌單與新歌精選",
            筛选: "篩選",
            全部: "全部",
            每日推荐: "每日推薦",
            历史日推: "歷史日推",
            精品歌单: "精品歌單",
            歌曲: "歌曲",
            歌单: "歌單",
            页码: "頁碼",
            焦点轮播: "焦點輪播",
            "网易云首页轮播焦点推荐，支持切换客户端来源": "網易雲首頁輪播焦點推薦，支援切換用戶端來源",
            来源端: "來源端",
            "iPad（新歌与新碟，推荐）": "iPad（新歌與新碟，推薦）",
            "PC（桌面端焦点）": "PC（桌面端焦點）",
            "iPhone（移动端歌单）": "iPhone（行動端歌單）",
            "Android（安卓端歌单）": "Android（安卓端歌單）",
            排行榜: "排行榜",
            官方榜与全球精选榜单: "官方榜與全球精選榜單",
            "官方榜、全球精选榜单与歌手榜": "官方榜、全球精選榜單與歌手榜",
            分类: "分類",
            官方榜: "官方榜",
            全球榜: "全球榜",
            歌手榜: "歌手榜",
            歌手榜地区: "歌手榜地區",
            新歌速递: "新歌速遞",
            最新上架专辑与新歌速递: "最新上架專輯與新歌速遞",
            地区: "地區",
            新专辑: "新專輯",
            新歌: "新歌",
            华语: "華語",
            欧美: "歐美",
            韩国: "韓國",
            日本: "日本",
            其他: "其他",
            歌单分类: "歌單分類",
            "按语种、风格、曲风馆与精品标签浏览": "按語種、風格、曲風館與精品標籤瀏覽",
            浏览模式: "瀏覽模式",
            曲风馆: "曲風館",
            精品歌单分类: "精品歌單分類",
            "分类 ID": "分類 ID",
            分区: "分區",
            "歌单 / 专辑": "歌單 / 專輯",
            专辑: "專輯",
            偏移量: "偏移量",
            电台与漫游: "電台與漫遊",
            "私人漫游、场景漫游、跑步漫游、心动模式与榜单电台": "私人漫遊、場景漫遊、跑步漫遊、心動模式與榜單電台",
            "电台 ID": "電台 ID",
            播客电台: "播客電台",
            "精选播客、热门电台榜与高人气节目": "精選播客、熱門電台榜與高人氣節目",
            精选播客: "精選播客",
            热门播客: "熱門播客",
            热门电台榜: "熱門電台榜",
            新晋电台榜: "新晉電台榜",
            热门节目榜: "熱門節目榜",
            歌手: "歌手",
            "热门歌手、分类筛选与歌手主页": "熱門歌手、分類篩選與歌手主頁",
            类型: "類型",
            男歌手: "男歌手",
            女歌手: "女歌手",
            乐队组合: "樂團組合",
            "歌手 ID": "歌手 ID",
            歌手分区: "歌手分區",
            资料: "資料",
            相似歌手: "相似歌手",
            我的音乐库: "我的音樂庫",
            "我喜欢的音乐、个人歌单、云盘、最近播放与收藏（需配置 Cookie）": "我喜歡的音樂、個人歌單、雲端硬碟、最近播放與收藏（需設定 Cookie）",
            我喜欢的音乐: "我喜歡的音樂",
            我的歌单: "我的歌單",
            音乐云盘: "音樂雲端硬碟",
            "最近播放 · 歌曲": "最近播放 · 歌曲",
            "最近播放 · 专辑": "最近播放 · 專輯",
            "最近播放 · 歌单": "最近播放 · 歌單",
            收藏的专辑: "收藏的專輯",
            关注的歌手: "關注的歌手",
            订阅的播客电台: "訂閱的播客電台",
            最近一周听歌排行: "最近一週聽歌排行",
            所有时间听歌排行: "所有時間聽歌排行",
            歌词: "歌詞",
            "网易云音乐时间轴歌词（双语 / 原文 / 译文 / 罗马音）": "網易雲音樂時間軸歌詞（雙語 / 原文 / 譯文 / 羅馬音）",
            "双语歌词（原文 + 译文）": "雙語歌詞（原文 + 譯文）",
            原文歌词: "原文歌詞",
            中文翻译歌词: "中文翻譯歌詞",
            罗马音歌词: "羅馬音歌詞",
            搜索: "搜尋",
            "搜索歌曲、歌词、专辑、歌手、歌单、播客电台与声音（留空展示热搜榜）": "搜尋歌曲、歌詞、專輯、歌手、歌單、播客電台與聲音（留空顯示熱搜榜）",
            "搜索歌曲、专辑、歌手、歌单与播客电台": "搜尋歌曲、專輯、歌手、歌單與播客電台",
            结果类型: "結果類型",
            "全部（音乐混合）": "全部（音樂混合）",
            按歌词搜歌: "按歌詞搜歌",
            "声音 / 单集": "聲音 / 單集",
            热搜: "熱搜",
            网易云热搜榜: "網易雲熱搜榜",
            语种: "語種",
            风格: "風格",
            主题: "主題",
            情感: "情感",
            场景: "場景",
            日语: "日語",
            韩语: "韓語",
            粤语: "粵語",
            流行: "流行",
            摇滚: "搖滾",
            民谣: "民謠",
            电子: "電子",
            说唱: "饒舌",
            轻音乐: "輕音樂",
            爵士: "爵士",
            古典: "古典",
            古风: "古風",
            影视原声: "影視原聲",
            游戏: "遊戲",
            怀旧: "懷舊",
            治愈: "治癒",
            夜晚: "夜晚",
            学习: "學習",
            运动: "運動",
            驾车: "駕車",
            "私人漫游 · 默认": "私人漫遊 · 預設",
            "根据你的听歌口味持续推荐（需配置 Cookie）": "根據你的聽歌口味持續推薦（需設定 Cookie）",
            "私人漫游 · 熟悉": "私人漫遊 · 熟悉",
            "重温你熟悉和喜欢的旋律（需配置 Cookie）": "重溫你熟悉和喜歡的旋律（需設定 Cookie）",
            "私人漫游 · 探索": "私人漫遊 · 探索",
            "发现新鲜小众好音乐（需配置 Cookie）": "發現新鮮小眾好音樂（需設定 Cookie）",
            "场景漫游 · 运动": "場景漫遊 · 運動",
            "高燃节奏伴你运动（需配置 Cookie）": "高燃節奏伴你運動（需設定 Cookie）",
            "场景漫游 · 专注": "場景漫遊 · 專注",
            "沉浸工作与学习氛围（需配置 Cookie）": "沉浸工作與學習氛圍（需設定 Cookie）",
            "场景漫游 · 深夜情绪": "場景漫遊 · 深夜情緒",
            "治愈深夜情绪的私藏歌单（需配置 Cookie）": "治癒深夜情緒的私藏歌單（需設定 Cookie）",
            心动模式: "心動模式",
            "以我喜欢的音乐为种子智能推荐（需配置 Cookie）": "以我喜歡的音樂為種子智慧推薦（需設定 Cookie）",
            跑步漫游: "跑步漫遊",
            "按 160 BPM 步频推荐的动感节奏": "按 160 BPM 步頻推薦的動感節奏",
            私人雷达: "私人雷達",
            每日更新的个性化精选电台: "每日更新的個人化精選電台",
            首歌曲: "首歌曲",
            张专辑: "張專輯",
            试听: "試聽",
            未找到该专辑: "找不到該專輯",
            无法识别的详情链接: "無法識別的詳情連結",
            "请在模块设置中填写包含 MUSIC_U 的网易云音乐 Cookie 后查看个人内容": "請在模組設定中填寫包含 MUSIC_U 的網易雲音樂 Cookie 後檢視個人內容",
            "私人漫游需要配置网易云音乐 Cookie（含 MUSIC_U）": "私人漫遊需要設定網易雲音樂 Cookie（含 MUSIC_U）",
            "未找到「我喜欢的音乐」歌单，无法开启心动模式": "找不到「我喜歡的音樂」歌單，無法開啟心動模式",
            "「我喜欢的音乐」为空，请先收藏几首歌曲再使用心动模式": "「我喜歡的音樂」為空，請先收藏幾首歌曲再使用心動模式",
            网易云返回了无法解析的响应: "網易雲回傳了無法解析的回應",
            网易云返回了无效数据: "網易雲回傳了無效資料",
            "网易云登录状态已失效或需要登录，请检查 Cookie 配置": "網易雲登入狀態已失效或需要登入，請檢查 Cookie 設定",
            "网易云登录状态已失效或 Cookie 无效，请更新包含 MUSIC_U 的 Cookie": "網易雲登入狀態已失效或 Cookie 無效，請更新包含 MUSIC_U 的 Cookie",
            "网易云暂时触发风控限制，请稍后重试": "網易雲暫時觸發風控限制，請稍後重試",
            "网易云请求过于频繁，请稍后重试": "網易雲請求過於頻繁，請稍後重試",
            网易云接口返回错误: "網易雲介面回傳錯誤",
            "当前歌曲暂无可用播放源，可能需要登录网易云黑胶 VIP 账号或受地区版权限制": "目前歌曲暫無可用播放來源，可能需要登入網易雲黑膠 VIP 帳號或受地區版權限制",
            "当前歌曲仅返回 30 秒 VIP 试听片段；请配置黑胶 VIP Cookie，或在模块设置中开启「允许播放 30 秒试听」": "目前歌曲僅回傳 30 秒 VIP 試聽片段；請設定黑膠 VIP Cookie，或在模組設定中開啟「允許播放 30 秒試聽」",
            红心喜欢: "紅心喜歡",
            取消红心: "取消紅心",
            收藏歌单: "收藏歌單",
            取消收藏: "取消收藏",
            收藏专辑: "收藏專輯",
            关注歌手: "關注歌手",
            取消关注: "取消關注",
            订阅播客: "訂閱播客",
            取消订阅: "取消訂閱",
            已加入我喜欢的音乐: "已加入我喜歡的音樂",
            已取消红心喜欢: "已取消紅心喜歡",
            已收藏歌单: "已收藏歌單",
            已取消收藏歌单: "已取消收藏歌單",
            已收藏专辑: "已收藏專輯",
            已取消收藏专辑: "已取消收藏專輯",
            已关注歌手: "已關注歌手",
            已取消关注歌手: "已取消關注歌手",
            已订阅播客: "已訂閱播客",
            已取消订阅播客: "已取消訂閱播客",
            "请在模块设置中填写包含 MUSIC_U 的网易云音乐 Cookie 后操作": "請在模組設定中填寫包含 MUSIC_U 的網易雲音樂 Cookie 後操作",
            "无法识别该歌曲 ID": "無法識別該歌曲 ID",
            "无法识别该歌单 ID": "無法識別該歌單 ID",
            "无法识别该专辑 ID": "無法識別該專輯 ID",
            "无法识别该歌手 ID": "無法識別該歌手 ID",
            "无法识别该播客 ID": "無法識別該播客 ID",
            不支持的操作: "不支援的操作"
        }
    },
    globalParams: [
        {
            name: "cookie",
            title: "网易云音乐 Cookie（可选）",
            description: "可选。支持直接粘贴 MUSIC_U 值、完整 Cookie 请求头或 Copy as cURL；不填可直接使用公开曲库与免费歌曲，填写后解锁每日推荐、历史日推、私人漫游、个人音乐库、动态封面、听歌打卡与黑胶 VIP / 无损音质。",
            type: "input",
            value: ""
        },
        {
            name: "quality",
            title: "音质偏好",
            description: "无损与 SVIP 高解析音质需要黑胶 VIP / SVIP Cookie，FLAC 在自动模式下优先使用软件解码",
            type: "enumeration",
            value: "exhigh",
            enumOptions: [
                {
                    title: "标准 (128k)",
                    value: "standard"
                },
                {
                    title: "较高 (192k)",
                    value: "higher"
                },
                {
                    title: "极高 (320k，兼容性最佳)",
                    value: "exhigh"
                },
                {
                    title: "无损 (FLAC，需 VIP)",
                    value: "lossless"
                },
                {
                    title: "Hi-Res (FLAC，需 SVIP)",
                    value: "hires"
                },
                {
                    title: "高清臻音 (SVIP)",
                    value: "jyeffect"
                },
                {
                    title: "沉浸环绕声 (SVIP)",
                    value: "sky"
                },
                {
                    title: "杜比全景声 (SVIP)",
                    value: "dolby"
                },
                {
                    title: "臻音全景声 (SVIP)",
                    value: "vivid"
                },
                {
                    title: "超清母带 (SVIP)",
                    value: "jymaster"
                }
            ]
        },
        {
            name: "allowTrial",
            title: "VIP 试听片段",
            description: "遇到无完整权限的 VIP 歌曲时，是否允许播放 30 秒试听片段",
            type: "enumeration",
            value: "false",
            enumOptions: [
                {
                    title: "跳过试听（仅播放完整歌曲）",
                    value: "false"
                },
                {
                    title: "允许播放 30 秒试听",
                    value: "true"
                }
            ]
        },
        {
            name: "playerType",
            title: "播放器偏好",
            type: "enumeration",
            value: "auto",
            enumOptions: [
                {
                    title: "自动",
                    value: "auto"
                },
                {
                    title: "系统播放器 (system)",
                    value: "system"
                },
                {
                    title: "软件解码 (app)",
                    value: "app"
                }
            ]
        },
        {
            name: "reportHistory",
            title: "听歌打卡",
            description: "填写 Cookie 后，播放歌曲时上报至网易云听歌记录以更新听歌排行与每日推荐",
            type: "enumeration",
            value: "false",
            enumOptions: [
                {
                    title: "关闭",
                    value: "false"
                },
                {
                    title: "开启（需配置 Cookie）",
                    value: "true"
                }
            ]
        }
    ],
    modules: [
        {
            id: "home",
            title: "首页推荐",
            subtitle: "每日推荐、历史日推、精品歌单与新歌精选",
            type: "video",
            functionName: "loadHome",
            cacheDuration: 600,
            params: [
                {
                    name: "filter",
                    title: "筛选",
                    type: "enumeration",
                    value: "all",
                    enumOptions: [
                        {
                            title: "全部",
                            value: "all"
                        },
                        {
                            title: "每日推荐",
                            value: "daily"
                        },
                        {
                            title: "历史日推",
                            value: "history_daily"
                        },
                        {
                            title: "精品歌单",
                            value: "highquality"
                        },
                        {
                            title: "歌曲",
                            value: "songs"
                        },
                        {
                            title: "歌单",
                            value: "playlists"
                        }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        },
        {
            id: "banners",
            title: "焦点轮播",
            subtitle: "网易云首页轮播焦点推荐，支持切换客户端来源",
            type: "video",
            functionName: "loadBanners",
            cacheDuration: 600,
            params: [
                {
                    name: "clientType",
                    title: "来源端",
                    type: "enumeration",
                    value: "ipad",
                    enumOptions: [
                        {
                            title: "iPad（新歌与新碟，推荐）",
                            value: "ipad"
                        },
                        {
                            title: "PC（桌面端焦点）",
                            value: "pc"
                        },
                        {
                            title: "iPhone（移动端歌单）",
                            value: "iphone"
                        },
                        {
                            title: "Android（安卓端歌单）",
                            value: "android"
                        }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        },
        {
            id: "charts",
            title: "排行榜",
            subtitle: "官方榜、全球精选榜单与歌手榜",
            type: "video",
            functionName: "loadCharts",
            cacheDuration: 3600,
            params: [
                {
                    name: "category",
                    title: "分类",
                    type: "enumeration",
                    value: "all",
                    enumOptions: [
                        {
                            title: "全部",
                            value: "all"
                        },
                        {
                            title: "官方榜",
                            value: "official"
                        },
                        {
                            title: "全球榜",
                            value: "global"
                        },
                        {
                            title: "歌手榜",
                            value: "artists"
                        }
                    ]
                },
                {
                    name: "artistArea",
                    title: "歌手榜地区",
                    type: "enumeration",
                    value: "ZH",
                    belongTo: {
                        paramName: "category",
                        value: [
                            "artists"
                        ]
                    },
                    enumOptions: [
                        {
                            title: "华语",
                            value: "ZH"
                        },
                        {
                            title: "欧美",
                            value: "EA"
                        },
                        {
                            title: "韩国",
                            value: "KR"
                        },
                        {
                            title: "日本",
                            value: "JP"
                        }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        },
        {
            id: "newReleases",
            title: "新歌速递",
            subtitle: "最新上架专辑与新歌速递",
            type: "video",
            functionName: "loadNewReleases",
            cacheDuration: 3600,
            params: [
                {
                    name: "category",
                    title: "分类",
                    type: "enumeration",
                    value: "albums",
                    enumOptions: [
                        {
                            title: "新专辑",
                            value: "albums"
                        },
                        {
                            title: "新歌",
                            value: "songs"
                        }
                    ]
                },
                {
                    name: "area",
                    title: "地区",
                    type: "enumeration",
                    value: "ALL",
                    enumOptions: [
                        {
                            title: "全部",
                            value: "ALL"
                        },
                        {
                            title: "华语",
                            value: "ZH"
                        },
                        {
                            title: "欧美",
                            value: "EA"
                        },
                        {
                            title: "韩国",
                            value: "KR"
                        },
                        {
                            title: "日本",
                            value: "JP"
                        }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        },
        {
            id: "musicGenres",
            title: "歌单分类",
            subtitle: "按语种、风格、曲风馆与精品标签浏览",
            type: "video",
            functionName: "loadGenres",
            cacheDuration: 3600,
            params: [
                {
                    name: "source",
                    title: "浏览模式",
                    type: "enumeration",
                    value: "all",
                    enumOptions: [
                        {
                            title: "歌单分类",
                            value: "all"
                        },
                        {
                            title: "曲风馆",
                            value: "styles"
                        },
                        {
                            title: "精品歌单分类",
                            value: "highquality"
                        }
                    ]
                },
                {
                    name: "genreId",
                    title: "分类 ID",
                    type: "input"
                },
                {
                    name: "section",
                    title: "分区",
                    type: "enumeration",
                    enumOptions: [
                        {
                            title: "歌单 / 专辑",
                            value: "albums"
                        },
                        {
                            title: "歌曲",
                            value: "songs"
                        },
                        {
                            title: "歌手",
                            value: "artists"
                        }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                },
                {
                    name: "offset",
                    title: "偏移量",
                    type: "offset"
                }
            ]
        },
        {
            id: "musicRadios",
            title: "电台与漫游",
            subtitle: "私人漫游、场景漫游、跑步漫游、心动模式与榜单电台",
            type: "video",
            functionName: "loadRadios",
            cacheDuration: 300,
            params: [
                {
                    name: "radioId",
                    title: "电台 ID",
                    type: "input"
                },
                {
                    name: "section",
                    title: "分区",
                    type: "enumeration",
                    enumOptions: [
                        {
                            title: "歌曲",
                            value: "songs"
                        },
                        {
                            title: "专辑",
                            value: "albums"
                        },
                        {
                            title: "歌手",
                            value: "artists"
                        }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                },
                {
                    name: "offset",
                    title: "偏移量",
                    type: "offset"
                }
            ]
        },
        {
            id: "podcasts",
            title: "播客电台",
            subtitle: "精选播客、热门电台榜与高人气节目",
            type: "video",
            functionName: "loadPodcasts",
            cacheDuration: 1800,
            params: [
                {
                    name: "category",
                    title: "分类",
                    type: "enumeration",
                    value: "recommend",
                    enumOptions: [
                        {
                            title: "精选播客",
                            value: "recommend"
                        },
                        {
                            title: "热门播客",
                            value: "hot"
                        },
                        {
                            title: "热门电台榜",
                            value: "toplist_hot"
                        },
                        {
                            title: "新晋电台榜",
                            value: "toplist_new"
                        },
                        {
                            title: "热门节目榜",
                            value: "programs"
                        }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        },
        {
            id: "musicArtists",
            title: "歌手",
            subtitle: "热门歌手、分类筛选与歌手主页",
            type: "person",
            functionName: "loadArtists",
            cacheDuration: 3600,
            params: [
                {
                    name: "area",
                    title: "地区",
                    type: "enumeration",
                    value: "ALL",
                    enumOptions: [
                        {
                            title: "全部",
                            value: "ALL"
                        },
                        {
                            title: "华语",
                            value: "ZH"
                        },
                        {
                            title: "欧美",
                            value: "EA"
                        },
                        {
                            title: "日本",
                            value: "JP"
                        },
                        {
                            title: "韩国",
                            value: "KR"
                        },
                        {
                            title: "其他",
                            value: "OTHER"
                        }
                    ]
                },
                {
                    name: "artistType",
                    title: "类型",
                    type: "enumeration",
                    value: "ALL",
                    enumOptions: [
                        {
                            title: "全部",
                            value: "ALL"
                        },
                        {
                            title: "男歌手",
                            value: "MALE"
                        },
                        {
                            title: "女歌手",
                            value: "FEMALE"
                        },
                        {
                            title: "乐队组合",
                            value: "BAND"
                        }
                    ]
                },
                {
                    name: "peopleId",
                    title: "歌手 ID",
                    type: "input"
                },
                {
                    name: "section",
                    title: "歌手分区",
                    type: "enumeration",
                    enumOptions: [
                        {
                            title: "歌曲",
                            value: "songs"
                        },
                        {
                            title: "专辑",
                            value: "albums"
                        },
                        {
                            title: "资料",
                            value: "profile"
                        },
                        {
                            title: "相似歌手",
                            value: "artists"
                        }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                },
                {
                    name: "offset",
                    title: "偏移量",
                    type: "offset"
                }
            ]
        },
        {
            id: "library",
            title: "我的音乐库",
            subtitle: "我喜欢的音乐、个人歌单、云盘、最近播放与收藏（需配置 Cookie）",
            type: "video",
            functionName: "loadLibrary",
            cacheDuration: 120,
            params: [
                {
                    name: "tab",
                    title: "分类",
                    type: "enumeration",
                    value: "liked",
                    enumOptions: [
                        {
                            title: "我喜欢的音乐",
                            value: "liked"
                        },
                        {
                            title: "我的歌单",
                            value: "playlists"
                        },
                        {
                            title: "音乐云盘",
                            value: "cloud"
                        },
                        {
                            title: "最近播放 · 歌曲",
                            value: "recent_songs"
                        },
                        {
                            title: "最近播放 · 专辑",
                            value: "recent_albums"
                        },
                        {
                            title: "最近播放 · 歌单",
                            value: "recent_playlists"
                        },
                        {
                            title: "收藏的专辑",
                            value: "sub_albums"
                        },
                        {
                            title: "关注的歌手",
                            value: "sub_artists"
                        },
                        {
                            title: "订阅的播客电台",
                            value: "sub_podcasts"
                        },
                        {
                            title: "最近一周听歌排行",
                            value: "recent_week"
                        },
                        {
                            title: "所有时间听歌排行",
                            value: "recent_all"
                        }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        },
        {
            id: "loadSubtitle",
            title: "歌词",
            subtitle: "网易云音乐时间轴歌词（双语 / 原文 / 译文 / 罗马音）",
            type: "subtitle",
            functionName: "loadSubtitle",
            cacheDuration: 3600
        }
    ],
    search: {
        id: "search",
        title: "搜索",
        subtitle: "搜索歌曲、歌词、专辑、歌手、歌单、播客电台与声音（留空展示热搜榜）",
        functionName: "search",
        params: [
            {
                name: "kind",
                title: "结果类型",
                type: "enumeration",
                value: "all",
                enumOptions: [
                    {
                        title: "全部（音乐混合）",
                        value: "all"
                    },
                    {
                        title: "歌曲",
                        value: "songs"
                    },
                    {
                        title: "按歌词搜歌",
                        value: "lyrics"
                    },
                    {
                        title: "专辑",
                        value: "albums"
                    },
                    {
                        title: "歌手",
                        value: "artists"
                    },
                    {
                        title: "歌单",
                        value: "playlists"
                    },
                    {
                        title: "播客电台",
                        value: "dj"
                    },
                    {
                        title: "声音 / 单集",
                        value: "voices"
                    }
                ]
            },
            {
                name: "page",
                title: "页码",
                type: "page"
            }
        ]
    }
}, loadHome = (e)=>tK(function*() {
        return t_(e);
    })(), loadBanners = (e)=>tK(function*() {
        return tW(e);
    })(), loadCharts = (e)=>tK(function*() {
        return tR(e);
    })(), loadNewReleases = (e)=>tK(function*() {
        return tL(e);
    })(), loadGenres = (e)=>tK(function*() {
        return tV(e);
    })(), loadRadios = (e)=>tK(function*() {
        return tx(e);
    })(), loadPodcasts = (e)=>tK(function*() {
        return tH(e);
    })(), loadArtists = (e)=>tK(function*() {
        return tF(e);
    })(), loadLibrary = (e)=>tK(function*() {
        return tq(e);
    })(), loadSubtitle = (e)=>tK(function*() {
        return th(function*() {
            var t, i;
            let l = ez(e), r = function(e) {
                if (e.link) {
                    let t = G(e.link);
                    if ((null == t ? void 0 : t.kind) === "song") return t.id;
                }
                let t = (e.id || "").trim();
                if (J(t)) return t;
                let i = G(t);
                return (null == i ? void 0 : i.kind) === "song" ? i.id : "";
            }(e);
            if (!r) {
                let i = [
                    e.title || e.episodeName || "",
                    e.seriesName || ""
                ].map((e)=>e.trim()).filter(Boolean).join(" ").trim();
                if (!i) return [];
                let a = yield ta("/api/cloudsearch/pc", {
                    s: i,
                    type: N.songs,
                    limit: 1,
                    offset: 0,
                    total: !0
                }, l, {
                    method: "POST"
                }), n = Array.isArray(null == (t = a.result) ? void 0 : t.songs) ? eg(a.result.songs[0]) : null;
                if (!n) return [];
                r = n.id;
            }
            let a = yield (i = r, e3(function*() {
                return tn("/api/song/lyric", {
                    id: i,
                    tv: -1,
                    lv: -1,
                    rv: -1,
                    kv: -1,
                    _nmclfl: 1
                }, l, {
                    timeout: 10
                });
            })());
            return function(e, t) {
                var i, l, r;
                let a = tf(null == (i = t.lrc) ? void 0 : i.lyric), n = tf(null == (l = t.tlyric) ? void 0 : l.lyric), o = tf(null == (r = t.romalrc) ? void 0 : r.lyric), s = [];
                if (a && n) {
                    let t = function(e, t) {
                        let i = tm(e), l = tm(t);
                        if (!i.lines.length || !l.lines.length) return "";
                        let r = [
                            ...i.metadata
                        ], a = 0;
                        for (let e of i.lines){
                            for(r.push(`${e.timestamp}${e.text}`); a < l.lines.length && l.lines[a].timeMs < e.timeMs - 250;)a++;
                            let t = "", i = 251, n = a;
                            for(; n < l.lines.length && l.lines[n].timeMs <= e.timeMs + 250;){
                                let r = Math.abs(l.lines[n].timeMs - e.timeMs);
                                r < i && (i = r, t = l.lines[n].text), n++;
                            }
                            t && t !== e.text && r.push(`${e.timestamp}${t}`);
                        }
                        return r.join("\n");
                    }(a, n);
                    t && s.push({
                        id: `ncm:lyric:${e}:bilingual`,
                        title: Widget.i18n("双语歌词（原文 + 译文）"),
                        lang: "zh-CN",
                        url: ty(t)
                    });
                }
                return a && s.push({
                    id: `ncm:lyric:${e}:orig`,
                    title: Widget.i18n("原文歌词"),
                    lang: n ? "und" : "zh-CN",
                    url: ty(a)
                }), n && s.push({
                    id: `ncm:lyric:${e}:tlyric`,
                    title: Widget.i18n("中文翻译歌词"),
                    lang: "zh-CN",
                    url: ty(n)
                }), o && s.push({
                    id: `ncm:lyric:${e}:romalrc`,
                    title: Widget.i18n("罗马音歌词"),
                    lang: "und",
                    url: ty(o)
                }), s;
            }(r, a);
        })();
    })(), search = (e)=>tK(function*() {
        return tB(e);
    })(), loadDetail = (e)=>tK(function*() {
        return th(function*() {
            var t, i, l, r, n, s;
            let u, c = G(e);
            if (!c) throw Error(`${Widget.i18n("无法识别的详情链接")}: ${e}`);
            let p = eB();
            return s = u = "song" === c.kind ? yield (t = c.id, th(function*() {
                var e, i, l;
                let r, n = (r = eV(eE)) && "object" == typeof r && null != (l = r[t]) ? l : null, s = p.reportHistory && a(p.cookie).hasMusicU, u = s && !!n, [c, f, m, y] = yield Promise.all([
                    e3(function*() {
                        var e, i, l;
                        let r = function(e, t, i, l = Date.now()) {
                            let r = eV(eD);
                            if (!r || "object" != typeof r) return null;
                            let a = r[`${e}:${t}:${i ? "1" : "0"}`];
                            return !a || "string" != typeof a.url || "number" != typeof a.cachedAt || l - a.cachedAt > 900000 ? null : a;
                        }(t, p.quality, p.allowTrial);
                        if (r) return {
                            url: r.url,
                            format: r.format,
                            level: r.level,
                            bitrate: r.bitrate,
                            isTrial: r.isTrial,
                            headers: {
                                "User-Agent": d,
                                Referer: `${o}/`
                            }
                        };
                        let a = "vivid" === p.quality ? "mp3" : T(p.quality) ? "flac" : "mp3", n = "vivid" === p.quality ? "android" : "pc", s = {
                            ids: `[${t}]`,
                            level: p.quality,
                            encodeType: a
                        };
                        "sky" === p.quality && (s.immerseType = "c51");
                        let u = [];
                        try {
                            let e = yield tr(()=>tn("/api/song/enhance/player/url/v1", s, p, {
                                    clientProfile: n
                                }), 3);
                            u = Array.isArray(e.data) ? e.data : [];
                        } catch (i) {
                            if (!tl(i)) throw i;
                            let e = yield tr(()=>tn("/api/song/enhance/player/url", {
                                    ids: `[${t}]`,
                                    br: U[p.quality] || 320000
                                }, p), 2);
                            u = Array.isArray(e.data) ? e.data : [];
                        }
                        let c = null != (l = (i = u).find((e)=>String(e.id) === t)) ? l : i[0], f = Z(null != (e = null == c ? void 0 : c.url) ? e : void 0), m = (null == c ? void 0 : c.freeTrialInfo) !== null && (null == c ? void 0 : c.freeTrialInfo) !== void 0;
                        if (!c || !f || void 0 !== c.code && 200 !== c.code) throw Error(Widget.i18n("当前歌曲暂无可用播放源，可能需要登录网易云黑胶 VIP 账号或受地区版权限制"));
                        if (m && !p.allowTrial) throw Error(Widget.i18n("当前歌曲仅返回 30 秒 VIP 试听片段；请配置黑胶 VIP Cookie，或在模块设置中开启「允许播放 30 秒试听」"));
                        let y = (c.type || (c.level && T(c.level) ? "flac" : "mp3")).toLowerCase(), g = e9.has(y) ? y : "mp3", h = "string" == typeof c.level && c.level ? c.level : p.quality, v = "number" == typeof c.br && Number.isFinite(c.br) ? c.br : 0;
                        return !function(e, t, i, l, r = Date.now()) {
                            var a, n;
                            let o = eV(eD), s = o && "object" == typeof o ? eM({}, o) : {}, u = `${e}:${t}:${i ? "1" : "0"}`;
                            delete s[u], s[u] = (a = eM({}, l), n = n = {
                                cachedAt: r
                            }, Object.getOwnPropertyDescriptors ? Object.defineProperties(a, Object.getOwnPropertyDescriptors(n)) : (function(e) {
                                var t = Object.keys(e);
                                if (Object.getOwnPropertySymbols) {
                                    var i = Object.getOwnPropertySymbols(e);
                                    t.push.apply(t, i);
                                }
                                return t;
                            })(Object(n)).forEach(function(e) {
                                Object.defineProperty(a, e, Object.getOwnPropertyDescriptor(n, e));
                            }), a);
                            let d = Object.keys(s);
                            if (d.length > 50) for (let e of d.slice(0, d.length - 50))delete s[e];
                            ex(eD, s);
                        }(t, p.quality, p.allowTrial, {
                            url: f,
                            format: g,
                            level: h,
                            bitrate: v,
                            isTrial: m
                        }), {
                            url: f,
                            format: g,
                            level: h,
                            bitrate: v,
                            isTrial: m,
                            headers: {
                                "User-Agent": d,
                                Referer: `${o}/`
                            }
                        };
                    })(),
                    n ? Promise.resolve(null) : ts([
                        t
                    ], p).then((e)=>{
                        var t;
                        return null != (t = e[0]) ? t : null;
                    }).catch(()=>null),
                    th(function*() {
                        try {
                            let e = yield tn("/api/v1/discovery/simiSong", {
                                songid: t,
                                limit: 10,
                                offset: 0
                            }, p, {
                                timeout: 6
                            }), i = (Array.isArray(e.songs) ? e.songs : []).map(eg).filter((e)=>null !== e && e.id !== t), l = eT(i.map(eI));
                            return tS(i, l), l;
                        } catch (e) {
                            return [];
                        }
                    })(),
                    e3(function*() {
                        var e;
                        if (a(p.cookie).hasMusicU) return Z(null == (e = (yield tn("/api/songplay/dynamic-cover", {
                            songId: t
                        }, p, {
                            timeout: 6
                        })).data) ? void 0 : e.videoPlayUrl);
                    })().catch(()=>void 0),
                    u ? tu(t, null == n ? void 0 : n.albumId, (null == n ? void 0 : n.duration) || 180, p).catch(()=>void 0) : Promise.resolve()
                ]);
                if (!n && f) {
                    let e = eI(f);
                    tS([
                        f
                    ], [
                        e
                    ]), n = {
                        id: t,
                        title: e.title,
                        subtitle: e.subtitle,
                        posterPath: e.posterPath,
                        coverUrl: e.coverUrl,
                        duration: e.duration,
                        durationText: e.durationText,
                        peoples: e.peoples,
                        mvId: f.mvId,
                        albumId: null == (i = f.album) ? void 0 : i.id
                    };
                }
                let g = (null == n ? void 0 : n.mvId) || (null == f ? void 0 : f.mvId) || 0, h = (null == n ? void 0 : n.duration) || 0, [v] = yield Promise.all([
                    g > 0 ? e3(function*() {
                        var e;
                        if (Number.isFinite(g) && !(g <= 0)) return Z(null == (e = (yield tn("/api/song/enhance/play/mv/url", {
                            id: Math.floor(g),
                            r: 1080
                        }, p, {
                            timeout: 6
                        })).data) ? void 0 : e.url);
                    })().catch(()=>void 0) : Promise.resolve(void 0),
                    s && !u ? tu(t, null == n ? void 0 : n.albumId, h || 180, p).catch(()=>void 0) : Promise.resolve()
                ]), b = h > 0 ? ep(h) : null == n ? void 0 : n.durationText, k = (null == n ? void 0 : n.posterPath) || (null == n ? void 0 : n.coverUrl), A = function(e, t) {
                    if ("system" === e || "app" === e) return e;
                    let i = t.toLowerCase();
                    if ("flac" === i || "alac" === i) return "app";
                }(p.playerType, c.format), I = [
                    (null == n ? void 0 : n.subtitle) || "",
                    c.isTrial ? Widget.i18n("试听") : ""
                ].filter(Boolean);
                return tv(tb(tv({
                    id: t,
                    type: "url",
                    mediaType: "song",
                    link: H(t),
                    title: (null == n ? void 0 : n.title) || t
                }, I.length ? {
                    subtitle: I.join(" · ")
                } : {}, k ? {
                    posterPath: k,
                    coverUrl: k
                } : {}, h > 0 ? tv({
                    duration: h
                }, b ? {
                    durationText: b
                } : {}) : {}, (null == n || null == (e = n.peoples) ? void 0 : e.length) ? {
                    peoples: n.peoples
                } : {}, y ? {
                    albumMotionArtwork: y
                } : {}, v ? {
                    trailers: [
                        tb(tv({}, k ? {
                            coverUrl: k
                        } : {}), {
                            videoUrl: v
                        })
                    ]
                } : {}, m.length ? {
                    relatedItems: m
                } : {}), {
                    videoUrl: c.url,
                    customHeaders: c.headers
                }), A ? {
                    playerType: A
                } : {});
            })()) : "album" === c.kind ? yield (i = c.id, th(function*() {
                let e = yield ta(`/api/v1/album/${i}`, {}, p), t = em(e.album);
                if (!t) throw Error(Widget.i18n("未找到该专辑"));
                let l = (Array.isArray(e.songs) ? e.songs : []).map(eg).filter((e)=>null !== e).map((e)=>tb(tv({}, e), {
                        artists: e.artists.length ? e.artists : t.artists,
                        album: {
                            id: t.id,
                            name: t.name,
                            imageUrl: t.imageUrl
                        },
                        imageUrl: e.imageUrl || t.imageUrl
                    })), r = l.map(eI);
                tS(l, r);
                let a = t.artists.map((e)=>e.name).filter(Boolean).join(" / "), n = eA(t.artists), o = X(t.imageUrl), s = [
                    [
                        t.subType || "",
                        t.company || ""
                    ].filter(Boolean).join(" · "),
                    t.description || ""
                ].filter(Boolean).join("\n") || void 0;
                return tb(tv({
                    id: t.id,
                    type: "url",
                    mediaType: "album",
                    link: `ncm:album:${t.id}`,
                    title: t.name
                }, a ? {
                    subtitle: a
                } : {}, o ? {
                    posterPath: o,
                    coverUrl: o
                } : {}, t.released ? {
                    releaseDate: t.released
                } : {}, s ? {
                    description: s
                } : {}, n ? {
                    peoples: n
                } : {}), {
                    tracks: r
                });
            })()) : "dj" === c.kind ? yield (l = c.id, th(function*() {
                let { radio: e, programs: t } = yield tw(l, p, 100), i = t.map(ew);
                eG(i);
                let r = [
                    e.host || "",
                    e.category || ""
                ].filter(Boolean).join(" · ") || void 0;
                return tb(tv({
                    id: `dj:${e.id}`,
                    type: "url",
                    mediaType: "playlist",
                    link: q(e.id),
                    title: e.name
                }, r ? {
                    subtitle: r
                } : {}, e.imageUrl ? {
                    posterPath: e.imageUrl,
                    coverUrl: e.imageUrl
                } : {}, e.description ? {
                    description: e.description
                } : {}), {
                    tracks: i
                });
            })()) : "hot" === c.kind ? yield (r = c.keyword, th(function*() {
                var e, t, i;
                let l = yield ta("/api/cloudsearch/pc", {
                    s: r,
                    type: N.songs,
                    limit: 30,
                    offset: 0,
                    total: !0
                }, p, {
                    method: "POST"
                }), a = (Array.isArray(null == (e = l.result) ? void 0 : e.songs) ? l.result.songs : []).map(eg).filter((e)=>null !== e), n = eT(a.map(eI));
                tS(a, n);
                let o = (null == (t = n[0]) ? void 0 : t.posterPath) || (null == (i = n[0]) ? void 0 : i.coverUrl);
                return tb(tv({
                    id: `hot:${r}`,
                    type: "url",
                    mediaType: "playlist",
                    link: B(r),
                    title: r,
                    subtitle: Widget.i18n("网易云热搜榜")
                }, o ? {
                    posterPath: o,
                    coverUrl: o
                } : {}), {
                    tracks: n
                });
            })()) : yield (n = c.id, th(function*() {
                let [{ playlist: e, tracks: t }, i] = yield Promise.all([
                    tC(n, p, 300),
                    th(function*() {
                        try {
                            var e;
                            let t = yield tn("/api/playlist/detail/rcmd/get", {
                                scene: "playlist_head",
                                playlistId: n,
                                newStyle: "true"
                            }, p, {
                                timeout: 6
                            }), i = (Array.isArray(null == (e = t.data) ? void 0 : e.recPlaylist) ? t.data.recPlaylist : []).map((e)=>ey(null == e ? void 0 : e.playlist)).filter((e)=>null !== e && e.id !== n);
                            return eT(i.map(eS));
                        } catch (e) {
                            return [];
                        }
                    })()
                ]), l = t.map(eI);
                tS(t, l);
                let r = ek(e.tags);
                return tb(tv({
                    id: e.id,
                    type: "url",
                    mediaType: "playlist",
                    link: F(e.id),
                    title: e.name
                }, e.owner ? {
                    subtitle: e.owner
                } : {}, e.imageUrl ? {
                    posterPath: e.imageUrl,
                    coverUrl: e.imageUrl
                } : {}, e.description ? {
                    description: e.description
                } : {}, r ? {
                    genreItems: r
                } : {}, i.length ? {
                    relatedItems: i
                } : {}), {
                    tracks: l
                });
            })()), th(function*() {
                var e, t, i;
                let l = [
                    s,
                    ...null != (e = s.tracks) ? e : [],
                    ...null != (t = s.childItems) ? t : [],
                    ...null != (i = s.relatedItems) ? i : []
                ], r = yield tN(l, p);
                return r ? tv({}, tD(s, r), s.tracks ? {
                    tracks: s.tracks.map((e)=>tD(e, r))
                } : {}, s.childItems ? {
                    childItems: s.childItems.map((e)=>tD(e, r))
                } : {}, s.relatedItems ? {
                    relatedItems: s.relatedItems.map((e)=>tD(e, r))
                } : {}) : s;
            })();
        })();
    })(), toggleFavorite = (e)=>tK(function*() {
        return th(function*() {
            let t = ez(e), i = a(t.cookie);
            if (!i.hasMusicU) return {
                message: Widget.i18n("请在模块设置中填写包含 MUSIC_U 的网易云音乐 Cookie 后操作")
            };
            let l = i.cookies.MUSIC_U, r = (e.actionId || "").trim(), n = String(e.itemId || "").trim();
            switch(r){
                case g:
                case h:
                    {
                        let e = tP(n, E);
                        if (!J(e)) return {
                            message: Widget.i18n("无法识别该歌曲 ID")
                        };
                        let i = r === g;
                        return yield e3(function*() {
                            yield tn("/api/radio/like", {
                                alg: "itembased",
                                trackId: e,
                                like: i,
                                time: "3"
                            }, t, {
                                clientProfile: "osx",
                                timeout: 10
                            });
                        })(), e1(l, "songs", e, i), {
                            message: Widget.i18n(i ? "已加入我喜欢的音乐" : "已取消红心喜欢"),
                            refresh: !0
                        };
                    }
                case v:
                case b:
                    {
                        let e = tP(n, W);
                        if (!J(e)) return {
                            message: Widget.i18n("无法识别该歌单 ID")
                        };
                        let i = r === v;
                        return yield e3(function*() {
                            yield tn(i ? "/api/playlist/subscribe" : "/api/playlist/unsubscribe", i ? {
                                id: e,
                                checkToken: u
                            } : {
                                id: e
                            }, t, {
                                checkToken: !0,
                                timeout: 10
                            });
                        })(), e1(l, "playlists", e, i), {
                            message: Widget.i18n(i ? "已收藏歌单" : "已取消收藏歌单"),
                            refresh: !0
                        };
                    }
                case k:
                case A:
                    {
                        let e = tP(n, _);
                        if (!J(e)) return {
                            message: Widget.i18n("无法识别该专辑 ID")
                        };
                        let i = r === k;
                        return yield e3(function*() {
                            yield tn(i ? "/api/album/sub" : "/api/album/unsub", {
                                id: e
                            }, t, {
                                timeout: 10
                            });
                        })(), e1(l, "albums", e, i), {
                            message: Widget.i18n(i ? "已收藏专辑" : "已取消收藏专辑"),
                            refresh: !0
                        };
                    }
                case I:
                case P:
                    {
                        let e = tP(n, "ncm:artist:");
                        if (!J(e)) return {
                            message: Widget.i18n("无法识别该歌手 ID")
                        };
                        let i = r === I;
                        return yield e3(function*() {
                            yield tn(i ? "/api/artist/sub" : "/api/artist/unsub", {
                                artistId: e,
                                artistIds: `[${e}]`
                            }, t, {
                                timeout: 10
                            });
                        })(), e1(l, "artists", e, i), {
                            message: Widget.i18n(i ? "已关注歌手" : "已取消关注歌手"),
                            refresh: !0
                        };
                    }
                case S:
                case C:
                    {
                        let e = tP(tP(n, R), "dj:");
                        if (!J(e)) return {
                            message: Widget.i18n("无法识别该播客 ID")
                        };
                        let i = r === S;
                        return yield e3(function*() {
                            yield tn(i ? "/api/djradio/sub" : "/api/djradio/unsub", {
                                id: e
                            }, t, {
                                timeout: 10
                            });
                        })(), e1(l, "podcasts", e, i), {
                            message: Widget.i18n(i ? "已订阅播客" : "已取消订阅播客"),
                            refresh: !0
                        };
                    }
                default:
                    return {
                        message: Widget.i18n("不支持的操作")
                    };
            }
        })();
    })();
