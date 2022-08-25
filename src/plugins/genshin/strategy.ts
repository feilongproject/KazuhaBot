import lodash from "lodash";
import fetch from "node-fetch";
import fs from "fs";
import { idToRole, roleToId } from "../components/roleConver";
import log from "../system/logger";
import { IMessageEx } from "../system/IMessageEx";
import { writeFileSyncEx } from "../system/common";


const collectionId = [
    [],
    [839176, 839179, 839181],//西风驿站
    [813033],//原神观测枢
    [341284],//派蒙喵喵屋
    [341523]//OH是姜姜呀(需特殊处理)
]

export async function strategy(msg: IMessageEx) {

    let reg = /^#?(更新)?(\S+)攻略([1-4])?$/.exec(msg.content);
    if (!reg) { return; }

    var isUpdate = msg.content.includes("更新") ? true : false;
    let role = reg[2];
    let group = reg[3] ? parseInt(reg[3]) : 1;

    log.debug(`isUpdate: ${isUpdate}, role: ${role}, group: ${group}`);

    const id = roleToId(role);
    if (id) {
        if ([10000000, 10000001, 10000002].includes(id)) {
            if (!["风主", "岩主", "雷主"].includes(role)) {
                msg.sendMsgEx({ content: `请选择：风主攻略、岩主攻略、雷主攻略` });
                return true;
            }
        } else role = idToRole(id)!;
    } else {
        msg.sendMsgEx({ content: `未找到${role}角色` });
        return true;
    }

    var savePath = `${process.cwd()}/generate/strategy/${role}-${group}.png`;
    if (fs.existsSync(savePath) && !isUpdate) {
        return msg.sendMsgEx({ imagePath: savePath }).then(() => {
            return true;
        });
    }

    var fetchs: Promise<MihoyoBBSPost[]>[] = [];
    collectionId[group].forEach(id => {
        const posts = fetch(`https://bbs-api.mihoyo.com/post/wapi/getPostFullInCollection?&gids=2&order_type=2&collection_id=${id}`).then(res => {
            return res.json();
        }).then((json: MihoyoAPI<MihoyoBBSPostsData>) => {
            if (json.data)
                return json.data.posts;
            else throw new Error("not found data");
        }).catch(err => {
            log.error(err);
            return [];
        });

        fetchs.push(posts);
    });

    const allPost = await Promise.all(fetchs).then(postss => {
        return lodash.flatten(postss);
    });


    var picUrl: string | null = null;
    for (const post of allPost) {
        //log.debug(`(${post.post.subject}).includes(${role})=${post.post.subject.includes(role)}`);
        if (group == 4) {
            if (post.post.structured_content.includes(role + '】')) {
                let content = post.post.structured_content.replace(/\\\/\{\}/g, "");
                let pattern = new RegExp(role + '】.*?image":"(.*?)"').exec(content);
                if (!pattern) break;
                let imgId = pattern[1];
                for (let image of post.image_list) {
                    if (image.image_id == imgId) {
                        picUrl = image.url;
                        break;
                    }
                }
                break;
            }
        } else {
            if (post.post.subject.includes(role)) {
                //log.debug(post);
                let max = 0;
                post.image_list.forEach((v, i) => {
                    if (Number(v.size) >= Number(post.image_list[max].size)) max = i;
                });
                picUrl = post.image_list[max].url;
                break;
            }

        }
    }
    //log.debug(picUrl);
    if (picUrl) {
        return fetch(picUrl + `?x-oss-process=image/quality,q_80/auto-orient,0/interlace,1/format,jpg`).then(res => {
            return res.buffer();
        }).then(buffer => {
            writeFileSyncEx(savePath, buffer,);

            /* return fs.writeFile((err) => {
                if (err) log.error(err);
                else msg.sendMsgEx({ imagePath: savePath });
            }); */
        });
    } else {
        msg.sendMsgEx({ content: `暂无${role}攻略` });
    }

}




interface MihoyoBBSPostsData {
    posts: MihoyoBBSPost[];
}

interface MihoyoBBSPost {
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
        height: number;
        width: number;
        format: string;
        size: string;
        crop: {
            x: number;
            y: number;
            w: number;
            h: number;
            url: string;
        };
        is_user_set_cover: boolean;
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
    collection: {
        prev_post_id: string;
        next_post_id: string;
        collection_id: string;
        cur: number;
        total: number;
        collection_title: string;
        prev_post_game_id: number;
        next_post_game_id: number;
        prev_post_view_type: number;
        next_post_view_type: number;
    };
    vod_list: {
        id: string;
        duration: number;
        cover: string;
        resolutions: {
            url: string;
            definition: string;
            height: number;
            width: number;
            bitrate: number;
            size: string;
            format: string;
            label: string;
        }[];
        view_num: number;
        transcoding_status: number;
        review_status: number;
    }[];
    is_block_on: boolean;
    forum_rank_info?: any;
    link_card_list: any[];
}