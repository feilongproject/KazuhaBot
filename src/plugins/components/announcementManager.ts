import lodash from "lodash";
import fetch from "node-fetch";
import { IMessageEx } from "../system/IMessageEx";
import log from "../system/logger";
import { render, renderURL } from "./render";


var emoticon: Map<any, any> | null = null;

export async function newsContentBBS(msg: IMessageEx) {
    var type = 1;
    if (msg.content.includes("资讯")) type = 3;
    if (msg.content.includes("活动")) type = 2;

    const pagesData = await getNewsList(type);
    const _page = msg.content.match(/[0-9]+/);
    const page = _page ? parseInt(_page[0]) : 1;
    if (!pagesData) return;

    if (page <= 0 || page > pagesData.list.length) {
        msg.sendMsgEx({ content: "目前只查前10条最新的公告，请输入1-10之间的整数。" });
        return true;
    }
    const postFull = await getPostFull(pagesData.list[page - 1].post.post_id);
    if (!postFull) return;
    const data = await detalData(postFull.post);
    //log.debug(data);
    render({
        app: "announcement",
        type: "announcement",
        imgType: "jpeg",
        render: { saveId: msg.author.id },
        data: {
            dataConent: data.post.content,
            data,
        }
    }).then(savePath => {
        if (savePath)
            msg.sendMsgEx({ imagePath: savePath });
    }).catch(err => {
        log.error(err);
    });
    /* renderURL({
        app: "announcement",
        type: "announcement",
        imgType: "jpeg",
        saveId: msg.author.id,
        url: `https://bbs.mihoyo.com/ys/article/${postId}`,
    }).then(savePath => {
        if (savePath)
            sendMsgEx(msg, { imagePath: savePath });
    }).catch(err => {
        log.error(err);
    }); */

}

export async function newsListBBS(msg: IMessageEx) {

    var type = 1, typeName = "公告";
    if (msg.content.includes("资讯")) type = 3, typeName = "资讯";
    if (msg.content.includes("活动")) type = 2, typeName = "活动";

    const data = await getNewsList(type, 5);
    if (!data) return;

    var datas = data.list;
    if (datas.length == 0) {
        return true;
    }

    datas.forEach(element => {
        (element.post as any).created_at = new Date(element.post.created_at * 1000).toLocaleString();
    });

    await render({
        app: "announcement",
        type: "announcementList",
        imgType: "jpeg",
        render: { saveId: msg.author.id },
        data: {
            datas,
            typeName
        }
    }).then(savePath => {
        if (savePath) msg.sendMsgEx({ imagePath: savePath });
    }).catch(err => {
        log.error(err);
    });

}

async function detalData(data: PostFullPost) {
    var json;
    try {
        json = JSON.parse(data.post.content);
    } catch (error) {

    }
    if (typeof json == "object") {
        if (json.imgs && json.imgs.length > 0) {
            for (const val of json.imgs) {
                data.post.content = ` <div class="ql-image-box"><img src="${val}?x-oss-process=image//resize,s_600/quality,q_80/auto-orient,0/interlace,1/format,png"></div>`;
            }
        }
    } else {
        for (const img of data.post.images) {
            data.post.content = data.post.content.replace(img, img + "?x-oss-process=image//resize,s_600/quality,q_80/auto-orient,0/interlace,1/format,jpg");
        }
        if (!emoticon) {
            emoticon = await mysEmoticon();
        }
        data.post.content = data.post.content.replace(/_\([^)]*\)/g, function (t, e) {
            t = t.replace(/_\(|\)/g, "");
            if (emoticon?.has(t)) {
                return `<img class="emoticon-image" src="${emoticon.get(t)}"/>`;
            } else {
                return "";
            }
        });
        var arrEntities: { [key: string]: string } = { 'lt': '<', 'gt': '>', 'nbsp': ' ', 'amp': '&', 'quot': '"' };
        data.post.content = data.post.content.replace(/&(lt|gt|nbsp|amp|quot);/ig, function (all, t) {
            return arrEntities[t];
        });
    }
    (data.post as any).created_time = new Date(data.post.created_at * 1000).toLocaleString();
    for (const i in data.stat) {
        (data as any).stat[i] = data.stat[i] > 10000 ? (data.stat[i] / 10000).toFixed(2) + "万" : data.stat[i];
    }

    return data;
}

async function mysEmoticon() {
    const emp = new Map();
    const res = await getEmoticon();
    if (!res) return null;
    for (const val of res.list) {
        if (!val.icon) continue;
        for (const list of val.list) {
            if (!list.icon) continue;
            emp.set(list.name, list.icon);
        }
    }
    return emp;
}

async function getNewsList(type: number, pageSize = 10) {
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

async function getPostFull(postId: string) {
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

async function getEmoticon() {
    return fetch(`https://bbs-api-static.mihoyo.com/misc/api/emoticon_set?gids=2`).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<Emoticon>) => {
        if (json.data) return json.data;
        else throw new Error("not found data");
    }).catch(err => {
        log.error(err);
    });
}


function getApiBBS(type: string, data: { [keys: string]: number }) {
    var host = "";
    const param: string[] = [];
    lodash.forEach(data, (v, i) => param.push(`${i}=${v}`));

    switch (type) {
        case "searchPosts"://搜索
            host += "post/wapi/searchPosts?";
            break;
    }
    return host + param.join('&');
    //fetch(`https://bbs-api.mihoyo.com/${type}?${param.join("&")}`);
}


interface PostFull {
    post: PostFullPost;
}

interface PostFullPost {
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

interface PostList {
    list: {
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
    }[];
    last_id: number;
    is_last: boolean;
};

interface Emoticon {
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