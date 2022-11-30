import md5 from "md5";
import lodash from "lodash";
import fetch from "node-fetch";
import { redisCache } from "./common";


export async function miGetUserFullInfo(cookie: string) {
    return await fetch("https://bbs-api.mihoyo.com/user/wapi/getUserFullInfo?gids=2", {
        headers: {
            Cookie: cookie,
            Accept: 'application/json, text/plain, */*',
            Connection: 'keep-alive',
            Host: 'bbs-api.mihoyo.com',
            Origin: 'https://m.bbs.mihoyo.com',
            Referer: ' https://m.bbs.mihoyo.com/'
        }
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<UserFullInfo>) => {
        if (json.retcode == 0) return json.data;
        else throw json;
    });
}

export async function miGetDailyNote(uid: string, region: string, cookie: string) {
    const headers = getHeaders(`role_id=${uid}&server=${region}`) as any;
    headers.Cookie = cookie;
    return await fetch(`https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/dailyNote?role_id=${uid}&server=${region}`, {
        headers,
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<DailyNoteData>) => {
        //log.debug(json.message);
        if (json.retcode == 0) return json.data;
        else throw json;
    });
}

export async function miGetRecordIndex(uid: string, region: string, cookie: string): Promise<RecordIndexData | null> {
    const cacheIndex = await redisCache("r", `cache:talent:${uid}`, "index");
    if (cacheIndex) return JSON.parse(cacheIndex);

    const headers = getHeaders(`role_id=${uid}&server=${region}`) as any;
    headers.Cookie = cookie;
    return fetch(`https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/index?role_id=${uid}&server=${region}`, {
        method: "GET",
        headers
    }).then(res => {
        return res.json();
        //return res.json();
    }).then((json: MihoyoAPI<RecordIndexData>) => {
        if (json.retcode == 0) {
            redisCache("w", `cache:talent:${uid}`, "index", JSON.stringify(json.data), 3600 * 12);
            return json.data;
        }
        else throw json;
    }).catch(err => {
        log.error(err);
        return null;
    });
}

export async function miGetAvatarDetail(uid: string, server: string, cookie: string, avatar: Avatars) {

    const headers = getHeaders(`uid=${uid}&region=${server}&avatar_id=${avatar.id}`) as any;
    headers.Cookie = cookie;
    return await fetch(`https://api-takumi.mihoyo.com/event/e20200928calculate/v1/sync/avatar/detail?` +
        `uid=${uid}&region=${server}&avatar_id=${avatar.id}`, {
        method: "GET",
        headers,
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<AvatarDetailData>) => {
        //log.debug(json);
        if (json.data) {
            redisCache("w", `cache:talent:${uid}`, `avatar:${avatar.id}`, JSON.stringify(json.data), 3600 * 12);
            return json.data;
        }
        else throw json;
    }).catch(err => {
        log.error(err);
        return null;
    });
}

export async function miGetAvatarSkills(uid: string, server: string, cookie: string, roleId: number) {
    const headers = getHeaders(`avatar_id=${roleId}`) as any;
    headers.Cookie = cookie;
    return await fetch(`https://api-takumi.mihoyo.com/event/e20200928calculate/v1/avatarSkill/list?` +
        `avatar_id=${roleId}`, {
        method: "GET",
        headers,
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<AvatarSkills>) => {
        //log.debug(json);
        if (json.data) {
            //redisCache("w", `cache:talent:${uid}`, `avatar:${avatar.id}`, JSON.stringify(json.data), 3600 * 12);
            return json.data;
        }
        else throw json;
    }).catch(err => {
        log.error(err);
        return null;
    });
}

export async function miGetAvatarCompute(uid: string, region: string, cookie: string, body: string): Promise<AvatarCompute | null> {

    const headers = getHeaders(``, body) as any;
    headers.Cookie = cookie;
    return fetch(`https://api-takumi.mihoyo.com/event/e20200928calculate/v2/compute`, {
        method: "POST",
        body,
        headers
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<AvatarCompute>) => {
        //log.debug(json);
        if (json.retcode == 0) return json.data;
        else throw json;
    }).catch(err => {
        log.error(err);
        return null;
    });
}

export async function miGetRecordCharacters(uid: string, region: string, cookie: string): Promise<RecordCharactersData | null> {

    const cacheCharacters = await redisCache("r", `cache:talent:${uid}`, `characters`);
    if (cacheCharacters) return JSON.parse(cacheCharacters);

    const headers = getHeaders(``, `{"role_id":"${uid}","server":"${region}"}`) as any;
    headers.Cookie = cookie;
    return fetch(`https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/character`, {
        method: "POST",
        body: `{"role_id":"${uid}","server":"${region}"}`,
        headers
    }).then(res => {
        return res.json();
        //return res.json();
    }).then((json: MihoyoAPI<RecordCharactersData>) => {
        //log.debug(json);
        if (json.retcode == 0) {
            redisCache("w", `cache:talent:${uid}`, "characters", JSON.stringify(json.data), 3600 * 12);
            return json.data;
        }
        else throw json;
    }).catch(err => {
        log.error(err);
        return null;
    });
}

export async function miGetNewsList(type: number, pageSize = 10) {
    return fetch(`https://bbs-api.mihoyo.com/post/wapi/getNewsList?gids=2&page_size=${pageSize}&type=${type}`, {
        method: "GET",
        headers: { Referer: "https://bbs.mihoyo.com/" }
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<PostList>) => {
        if (json.data) return json.data;
        else throw new Error("not found data");
    }).catch(err => {
        log.error(err);
        return null;
    });
}

export async function miGetPostFull(postId: string) {
    return fetch(`https://bbs-api.mihoyo.com/post/wapi/getPostFull?gids=2&read=1&post_id=${postId}`, {
        method: "GET",
        headers: { Referer: "https://bbs.mihoyo.com/" }
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<PostFull>) => {
        if (json.data) return json.data;
        else throw new Error("not found data");
    }).catch(err => {
        log.error(err);
        return null;
    });
}

export async function miSearchPosts(keyword: string, gids = 2, size = 20) {
    return fetch(`https://bbs-api.mihoyo.com/post/wapi/searchPosts?keyword=${keyword}&gids=${gids}&size=${size}`, {
        method: "GET",
        headers: { Referer: "https://bbs.mihoyo.com/" }
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<PostSearch>) => {
        if (json.data) return json.data;
        else throw json;
    }).catch(err => {
        log.error(err);
        return null;
    });

}

export async function miGetEmoticon() {
    return fetch(`https://bbs-api-static.mihoyo.com/misc/api/emoticon_set?gids=2`).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<Emoticon>) => {
        if (json.data) return json.data;
        else throw new Error("not found data");
    }).catch(err => {
        log.error(err);
    });
}

export async function miGetSignRewardInfo(uid: string, region: string, cookie: string) {

    const headers = getHeaders(`act_id=e202009291139501&region=${region}&uid=${uid}`) as any;
    headers.Cookie = cookie;
    return fetch(`https://api-takumi.mihoyo.com/event/bbs_sign_reward/info?act_id=e202009291139501&region=${region}&uid=${uid}`, {
        method: "GET",
        headers,
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<SignRewardInfo>) => {
        if (json.data) return json.data;
        else throw json;
    }).catch(err => {
        log.error(err);
    });
}

export async function miGetSignRewardHome(uid: string, region: string, cookie: string) {

    const headers = getHeaders(`act_id=e202009291139501&region=${region}&uid=${uid}`, ``, true) as any;
    headers.Cookie = cookie;
    return fetch(`https://api-takumi.mihoyo.com/event/bbs_sign_reward/home?act_id=e202009291139501&region=${region}&uid=${uid}`, {
        method: "GET",
        headers,
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<SignRewardHome>) => {
        if (json.data) return json.data;
        else throw json;
    });
}

export async function miPostSignRewardSign(uid: string, region: string, cookie: string) {

    const headers = getHeaders(``, `{"act_id":"e202009291139501","region":"${region}","uid":"${uid}"}`, true) as any;
    headers.Cookie = cookie;
    return fetch(`https://api-takumi.mihoyo.com/event/bbs_sign_reward/sign`, {
        method: "POST",
        body: `{"act_id":"e202009291139501","region":"${region}","uid":"${uid}"}`,
        headers,
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<SignRewardSign>) => {
        if (json.data) return json.data;
        else throw json;
    });
}//SignRewardHome

/* async function abyssAll(roleArr: Avatars[], uid: string, server: string, cookie: string) {


    const headers = getHeaders(`role_id=${uid}&schedule_type=1&server=${server}`) as any;
    headers.Cookie = cookie;

    const resAbyss = await fetch(`https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/spiralAbyss?` +
        `role_id=${uid}&schedule_type=1&server=${server}`, {
        headers
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<AbyssData>) => {
        return json.data;
        //log.debug(json);
    });

    var abyss = {};

    if (roleArr.length <= 0) { return abyss; }
    if (resAbyss.total_battle_times <= 0) { return abyss; }
    if (resAbyss.reveal_rank.length <= 0) { return abyss; }
    //打了三层才放出来
    if (resAbyss.floors.length <= 2) { return abyss; }

    var start_time = new Date(parseInt(resAbyss.start_time) * 1000);
    var time = (start_time.getMonth() + 1).toString();
    if (start_time.getDate() >= 15) { time = time + "月下"; }
    else { time = time + "月上"; }

    var total_star: number | string = 0;
    var star = [];
    for (var val of resAbyss.floors) {
        if (val.index < 9) continue;
        total_star += val.star;
        star.push(val.star);
    }
    total_star = total_star + "（" + star.join("-") + "）";

    var dataName = ["damage", "take_damage", "defeat", "normal_skill", "energy_skill"];
    var data: any = [];
    var tmpRole:any = [];
    for (const val of dataName) {
        if (resAbyss[`${val}_rank`].length <= 0) {
            resAbyss[`${val}_rank`] = [
                {
                    value: 0,
                    avatar_id: 10000007,
                },
            ];
        }
        data[val] = {
            num: resAbyss[`${val}_rank`][0].value,
            name: roleIdToName(resAbyss[`${val}_rank`][0].avatar_id, true),
        };

        if (data[val].num > 1000) {
            data[val].num = (data[val].num / 10000).toFixed(1);
            data[val].num += " w";
        }

        if (tmpRole.length < 4 && !tmpRole.includes(resAbyss[`${val}_rank`][0].avatar_id)) {
            tmpRole.push(resAbyss[`${val}_rank`][0].avatar_id);
        }
    }

    var list = [];

    var avatar = lodash.keyBy(roleArr, "id");

    for (var val of resAbyss.reveal_rank) {
        if (avatar[val.avatar_id]) {
            val.life = avatar[val.avatar_id].actived_constellation_num;
        } else {
            val.life = 0;
        }
        val.name = roleToRole(val.avatar_id);
        list.push(val);
    }

    return {
        time,
        max_floor: resAbyss.max_floor,
        total_star,
        list,
        total_battle_times: resAbyss.total_battle_times,
        ...data,
    };
} */

export function getHeaders(query = '', body = '', sign = false) {
    function getdevice() {
        return `Yz-${md5(query).substring(0, 5)}`;
    }
    if (sign) return {
        'x-rpc-app_version': '2.36.1',
        'x-rpc-client_type': 5,
        'x-rpc-device_id': getGuid(),
        'User-Agent': `Mozilla/5.0 (Linux; Android 12; ${getdevice()}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36 miHoYoBBS/2.36.1`,
        'X-Requested-With': 'com.mihoyo.hyperion',
        'x-rpc-platform': 'android',
        'x-rpc-device_model': getdevice(),
        'x-rpc-device_name': getdevice(),
        'x-rpc-channel': 'miyousheluodi',
        'x-rpc-sys_version': '6.0.1',
        Referer: "https://webstatic.mihoyo.com/bbs/event/signin-ys/index.html?bbs_auth_required=true&act_id=e202009291139501&utm_source=bbs&utm_medium=mys&utm_campaign=icon",
        DS: getDsSign(),
    }
    else return {
        'x-rpc-app_version': '2.26.1',
        'x-rpc-client_type': 5,
        "DS": getDs(query, body),
    }
};

function getGuid() {
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return (S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4());
};

function getDsSign() {
    const n = 'YVEIkzDFNHLeKXLxzqCA9TzxCpWwbIbk';
    const t = Math.round(new Date().getTime() / 1000);
    const r = lodash.sampleSize('abcdefghijklmnopqrstuvwxyz0123456789', 6).join('');
    const DS = md5(`salt=${n}&t=${t}&r=${r}`);
    return `${t},${r},${DS}`;
};

function getDs(q = '', b = '') {
    let n = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'
    let t = Math.round(new Date().getTime() / 1000);
    let r = Math.floor(Math.random() * 900000 + 100000);
    let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`);
    return `${t},${r},${DS}`;
};


export interface UserFullInfo {
    user_info: {
        uid: string;
        nickname: string;
        introduce: string;
        avatar: string;
        gender: number;
        certification: {
            type: number;
            label: string;
        };
        level_exps: {
            level: number;
            exp: number;
            game_id: number;
        }[];
        achieve: {
            like_num: string;
            post_num: string;
            replypost_num: string;
            follow_cnt: string;
            followed_cnt: string;
            topic_cnt: string;
            new_follower_num: string;
            good_post_num: string;
            follow_collection_cnt: string;
        };
        community_info: {
            is_realname: boolean;
            agree_status: boolean;
            silent_end_time: number;
            forbid_end_time: number;
            info_upd_time: number;
            privacy_invisible: {
                post: boolean;
                collect: boolean;
                watermark: boolean;
                reply: boolean;
                post_and_instant: boolean;
            };
            notify_disable: {
                reply: boolean;
                upvote: boolean;
                follow: boolean;
                system: boolean;
                chat: boolean;
            };
            has_initialized: boolean;
            user_func_status: {
                enable_history_view: boolean;
                enable_recommend: boolean;
                enable_mention: boolean;
                user_center_view: number;
            };
            forum_silent_info: [];
            last_login_ip: string;
            last_login_time: number;
            created_at: number;
        };
        avatar_url: string;
        certifications: [];
        level_exp: {
            level: number;
            exp: number;
            game_id: number;
        };
        pendant: string;
        is_logoff: boolean;
        ip_region: string;
    };
    follow_relation: null;
    auth_relations: [];
    is_in_blacklist: boolean;
    is_has_collection: boolean;
    is_creator: boolean;
    customer_service: {
        is_customer_service_staff: boolean;
        game_id: number;
    };
    audit_info: {
        is_nickname_in_audit: boolean;
        nickname: string;
        is_introduce_in_audit: boolean;
        introduce: string;
        nickname_status: number;
    };
}

export interface DailyNoteData {
    current_resin: number;
    max_resin: 160;
    resin_recovery_time: number;
    finished_task_num: number;
    total_task_num: 4;
    is_extra_task_reward_received: boolean;
    remain_resin_discount_num: number;
    resin_discount_num_limit: number;
    current_expedition_num: number;
    max_expedition_num: number;
    expeditions: {
        avatar_side_icon: string;
        status: string;
        remained_time: number;
    }[];
    current_home_coin: number;                 //洞天宝钱现在
    max_home_coin: number;                     //洞天宝钱最高
    home_coin_recovery_time: number;           //洞天宝钱回复时间
    calendar_url: string;                      //日历链接
    transformer: {                             //参量质变仪
        obtained: boolean;                     //是否获取
        recovery_time: {
            Day: number;
            Hour: number;
            Minute: number;
            Second: number;
            reached: boolean;
        };
        wiki: string;
        noticed: boolean;
        latest_job_id: string;
    };
};

export interface AvatarCompute {
    avatar_consume: AvatarComputeConsume[],
    avatar_skill_consume: AvatarComputeConsume[],
    weapon_consume: AvatarComputeConsume[],
    reliquary_consume: AvatarComputeConsume[],
};
export interface AvatarComputeConsume {
    isTalent?: boolean;
    id: number;
    name: string;
    icon: string;
    num: number;
    wiki_url: string;
};

export interface Avatars {
    id: number;
    image: string;
    icon: string;
    name: string;
    element: string;
    fetter: number;
    level: number;
    rarity: number;
    weapon: {
        id: number;
        name: string;
        icon: string;
        type: number;
        rarity: number;
        level: number;
        promote_level: number;
        type_name: string;
        desc: string;
        affix_level: number;
    };
    reliquaries: {
        id: number;
        name: string;
        icon: string;
        pos: number;
        rarity: number;
        level: number;
        set: {
            id: number;
            name: string;
            affixes: {
                activation_number: number;
                effect: string;
            }[];
        };
        pos_name: string;
    }[];
    constellations: {
        id: number;
        name: string;
        icon: string;
        effect: string;
        is_actived: boolean;
        pos: number;
    }[];
    actived_constellation_num: number;
    costumes: {
        id: number;
        name: string;
        icon: string;
    }[];
    external?: any;
};

export interface OrganizedAvatar {
    star: number;
    name: string;
    icon: string;
    lv: number;
    fetter: number;
    life: number;
    skill: {
        a: number;
        e: number;
        q: number;
    };
    weapon: { name: string, lv: number, alv: number; star: number, icon: string, } | null;
    talent: { week: number, name: string; area: string; act: string[]; } | null;
};

export interface AvatarDetailData {
    skill_list: AvatarsSkillList[];
    weapon: {
        id: number;
        name: string;
        icon: string;
        weapon_cat_id: number;
        weapon_level: number;
        max_level: number;
        level_current: number;
    };
    reliquary_list: {
        id: number;
        name: string;
        icon: string;
        reliquary_cat_id: number;
        reliquary_level: number;
        level_current: number;
        max_level: number;
    }[];
};

export interface AvatarsSkillList {
    id: number;
    group_id: number;
    name: string;
    icon: string;
    max_level: number;
    level_current: number;
}

export interface AvatarSkills {
    list: AvatarsSkillList[],
}

export interface RecordIndexData {
    role: {
        AvatarUrl: string;
        nickname: string;
        region: string;
        level: number;
    };
    avatars: {
        id: number;
        image: string;
        name: string;
        element: string;
        fetter: number;
        level: number;
        rarity: number;
        actived_constellation_num: number;
        card_image: string;
        is_chosen: boolean;
    }[];
    stats: {
        active_day_number: number;
        achievement_number: number;
        anemoculus_number: number;
        geoculus_number: number;
        avatar_number: number;
        way_point_number: number;
        domain_number: number;
        spiral_abyss: string;
        precious_chest_number: number;
        luxurious_chest_number: number;
        exquisite_chest_number: number;
        common_chest_number: number;
        electroculus_number: number;
        magic_chest_number: number;
    };
    city_explorations: any[];
    world_explorations: {
        level: number;
        exploration_percentage: number;
        icon: string;
        name: string;
        type: string;
        offerings: {
            name: string;
            level: number;
            icon: string;
        }[];
        id: number;
        parent_id: number;
        map_url: string;
        strategy_url: string;
        background_image: string;
        inner_icon: string;
        cover: string;
    }[];
    homes: {
        level: number;
        visit_num: number;
        comfort_num: number;
        item_num: number;
        name: string;
        icon: string;
        comfort_level_name: string;
        comfort_level_icon: string;
    }[];
};

export interface RecordCharactersData {
    avatars: Avatars[];
    role: {
        AvatarUrl: string;
        nickname: string;
        region: string;
        level: number;
    };
};

interface AbyssData {
    schedule_id: number;
    start_time: string;
    end_time: string;
    total_battle_times: number;
    total_win_times: number;
    max_floor: string;
    reveal_rank: any[];
    defeat_rank: any[];
    damage_rank: any[];
    take_damage_rank: any[];
    normal_skill_rank: any[];
    energy_skill_rank: any[];
    floors: any[];
    total_star: number;
    is_unlock: boolean;
};

export interface PostList {
    list: PostListInfo[];
    last_id: number;
    is_last: boolean;
};

export interface PostListInfo {
    post: {
        game_id: number;
        post_id: string;
        f_forum_id: number;
        uid: string;
        subject: string;
        content: string;
        cover: string;
        view_type: number;
        created_at: number;
        images: string[];
        post_status: {
            is_top: boolean;
            is_good: boolean;
            is_official: boolean;
        };
        topic_ids: number[];
        view_status: number;
        max_floor: number;
        is_original: number;
        republish_authorization: number;
        reply_time: string;
        is_deleted: number;
        is_interactive: boolean;
        structured_content: string;
        structured_content_rows: any[];
        review_id: number;
        is_profit: boolean;
        is_in_profit: boolean;
        updated_at: number;
        deleted_at: number;
        pre_pub_status: number;
        cate_id: number;
    };
    forum: {
        id: number;
        name: string;
        icon: string;
        game_id: number;
        forum_cate?: any;
    };
    topics: {
        id: number;
        name: string;
        cover: string;
        is_top: boolean;
        is_good: boolean;
        is_interactive: boolean;
        game_id: number;
        content_type: number;
    }[];
    user: {
        uid: string;
        nickname: string;
        introduce: string;
        avatar: string;
        gender: number;
        certification: {
            type: number;
            label: string;
        };
        level_exp: {
            level: number;
            exp: number;
        };
        is_following: boolean;
        is_followed: boolean;
        avatar_url: string;
        pendant: string;
    };
    self_operation: {
        attitude: number;
        is_collected: boolean;
    };
    stat: {
        view_num: number;
        reply_num: number;
        like_num: number;
        bookmark_num: number;
        forward_num: number;
    };
    help_sys: {
        top_up?: any;
        top_n: any[];
        answer_num: number;
    };
    cover: {
        url: string;
        height: number,
        width: number,
        format: string;
        size: string;
        image_id: string;
        entity_type: string;
        entity_id: string;
    };
    image_list: {
        url: string;
        height: number;
        width: number;
        format: string;
        size: string;
        crop?: any;
        is_user_set_cover: boolean;
        image_id: string;
        entity_type: string;
        entity_id: string;
    }[];
    is_official_master: boolean;
    is_user_master: boolean;
    hot_reply_exist: boolean;
    vote_count: number;
    last_modify_time: number;
    recommend_type: string;
    collection: null;
    vod_list: [];
    is_block_on: boolean;
    link_card_list: [];
}

export interface PostSearch {
    posts: PostListInfo[];
    last_id: string;
    is_last: number;
    token_list: string[];
    databox: { [postId: string]: string };
}

export interface PostFull {
    post: PostFullPost;
}

export interface PostFullPost {
    post: {
        game_id: number;
        post_id: string;
        f_forum_id: number;
        uid: string;
        subject: string;
        content: string;
        cover: string;
        view_type: number;
        created_at: number;
        images: string[];
        post_status: {
            is_top: boolean;
            is_good: boolean;
            is_official: boolean;
        };
        topic_ids: any[];
        view_status: number;
        max_floor: number;
        is_original: number;
        republish_authorization: number;
        reply_time: string;
        is_deleted: number;
        is_interactive: boolean;
        structured_content: string;
        structured_content_rows: any[];
        review_id: number;
        is_profit: boolean;
        is_in_profit: boolean;
        updated_at: number;
        deleted_at: number;
        pre_pub_status: number;
        cate_id: number;
    };
    forum: {
        id: number;
        name: string;
        icon: string;
        game_id: number;
        forum_cate?: any;
    };
    topics: any[];
    user: {
        uid: string;
        nickname: string;
        introduce: string;
        avatar: string;
        gender: number;
        certification: {
            type: number;
            label: string;
        };
        level_exp: {
            level: number;
            exp: number;
        };
        is_following: boolean;
        is_followed: boolean;
        avatar_url: string;
        pendant: string;
    };
    self_operation: {
        attitude: number;
        is_collected: boolean;
    };
    /* stat: {
        view_num: number;
        reply_num: number;
        like_num: number;
        bookmark_num: number;
        forward_num: number;
    }; */
    stat: {
        [key: string]: number;
    };
    help_sys?: any;
    cover?: any;
    image_list: {
        url: string;
        height: number;
        width: number;
        format: string;
        size: string;
        crop?: any;
        is_user_set_cover: boolean;
        image_id: string;
        entity_type: string;
        entity_id: string;
    }[];
    is_official_master: boolean;
    is_user_master: boolean;
    hot_reply_exist: boolean;
    vote_count: number;
    last_modify_time: number;
    recommend_type: string;
    collection?: any;
    vod_list: any[];
    is_block_on: boolean;
    forum_rank_info?: any;
    link_card_list: any[];
}

export interface Emoticon {
    list: {
        id: number;
        name: string;
        icon: string;
        sort_order: number;
        num: number;
        status: string;
        list: {
            id: number;
            name: string;
            icon: string;
            sort_order: number;
            static_icon: string;
            updated_at: number;
            is_available: boolean;
            status: string;
        }[];
        updated_at: number;
        is_available: boolean;
    }[];
    recently_emoticon?: any;
}

export interface SignRewardInfo {
    total_sign_day: number;
    today: string;
    is_sign: boolean;
    first_bind: boolean;
    is_sub: boolean;
    month_first: boolean;
    sign_cnt_missed: number;
}

export interface SignRewardHome {
    month: number,
    awards: {
        icon: string,
        name: string,
        cnt: number,
    }[],
    resign: boolean,
}

export interface SignRewardSign {
    code: '';
    risk_code: 0;
    gt: '';
    challenge: '';
    success: 0;
}