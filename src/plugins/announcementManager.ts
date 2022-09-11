import { render } from "../lib/render";
import { IMessageEx, sendImage } from "../lib/IMessageEx";
import { miGetEmoticon, miGetNewsList, miGetPostFull, miSearchPosts, PostFullPost } from "../lib/mihoyoAPI";


var emoticon: Map<any, any> | null = null;

export async function newsContentBBS(msg: IMessageEx) {
    var type = 1;
    if (msg.content.includes("资讯")) type = 3;
    if (msg.content.includes("活动")) type = 2;

    const pagesData = await miGetNewsList(type);
    const _page = msg.content.match(/[0-9]+/);
    const page = _page ? parseInt(_page[0]) : 1;
    if (!pagesData) return;

    if (page <= 0 || page > pagesData.list.length) {
        msg.sendMsgEx({ content: "目前只查前10条最新的公告，请输入1-10之间的整数。" });
        return true;
    }
    const postFull = await miGetPostFull(pagesData.list[page - 1].post.post_id);
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

}

export async function newsListBBS(msg: IMessageEx) {

    var type = 1, typeName = "公告";
    if (msg.content.includes("资讯")) type = 3, typeName = "资讯";
    if (msg.content.includes("活动")) type = 2, typeName = "活动";

    const data = await miGetNewsList(type, 5);
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

/*
bot无法接收url，无法使用
 */
export async function urlBBS(msg: IMessageEx) {

}

export async function seachBBS(msg: IMessageEx) {
    const reg = msg.content.match(/^#(米游社|mys)(.*)(\d$)?/);
    if (!reg) return true;
    const searchContent = reg[2];
    const searchPage = parseInt(reg[3]) * 1 || 0;
    if (!searchContent) {
        msg.sendMsgEx({ content: `请输入关键字，如#米游社七七攻略` });
        return true;
    }
    const searchDatas = await miSearchPosts(searchContent);
    if (!searchDatas) return true;
    //res.data.posts.length
    if (searchDatas.posts.length == 0) {
        msg.sendMsgEx({ content: `搜索不到您要的结果，请换关键词尝试` });
        return true;
    }

    const postFull = await miGetPostFull(searchDatas.posts[searchPage].post.post_id);
    if (!postFull) return true;
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

}

export async function changePushTask(msg: IMessageEx) {
    if (msg.messageType != "GUILD") return true;
    const value = msg.content.includes("开启") ? true : false;
    await global.redis.hSet("config:newsPush", parseInt(msg.channel_id), `${value}`).then((v) => {
        if (value) return msg.sendMsgEx({
            content: `原神米游社公告推送已开启` + `\n每30分钟自动检测一次是否存在新更新公告` + `\n如有更新自动发送公告内容至此。`
        });
        else {
            return msg.sendMsgEx({ content: `原神米游社公告推送已关闭` });
        }
    }).catch(err => {
        log.error(err);
    });
}

export async function taskPushNews() {
    const msgId = await global.redis.get("lastestMsgId");
    if (!msgId) return;

    const sendChannels: string[] = [];
    const _newsPushChannels = await global.redis.hGetAll("config:newsPush").catch(err => { log.error(err); });
    if (!_newsPushChannels) return;

    for (const channel in _newsPushChannels) {
        if (_newsPushChannels[channel] == "true")
            sendChannels.push(channel);
    }
    if (sendChannels.length == 0) return;

    log.mark(`官方公告检查中`);
    const ignoreReg = /冒险助力礼包|纪行|预下载|脚本外挂|集中反馈|作品展示|同人|已开奖|一图流|云·原神|招募|OST/;
    const pagesData = [{ type: "公告", list: (await miGetNewsList(1))?.list }, { type: "资讯", list: (await miGetNewsList(3))?.list }];
    const postIds: string[] = [];

    for (const pageData of pagesData) {
        if (!pageData.list) continue;
        for (const page of pageData.list) {
            if (ignoreReg.test(page.post.subject)) continue;
            if (new Date().getTime() / 1000 - page.post.created_at > 3600) continue;
            if (await global.redis.get(`mysNews:${page.post.post_id}`) == `${true}`) continue;
            await global.redis.set(`mysNews:${page.post.post_id}`, `${true}`, { EX: 3600 * 2 });
            postIds.push(page.post.post_id);
        }
    }
    for (const postId of postIds) {
        const postFull = await miGetPostFull(postId);
        if (!postFull) return;
        const data = await detalData(postFull.post);
        //log.debug(data);
        await render({
            app: "announcement",
            type: "announcement",
            imgType: "jpeg",
            render: { saveId: "system" },
            data: {
                dataConent: data.post.content,
                data,
            }
        }).then(savePath => {
            if (savePath) {
                const _sendQueue: Promise<any>[] = [];
                for (const sendChannel of sendChannels) {
                    _sendQueue.push(sendImage({
                        msgId,
                        imagePath: savePath,
                        channelId: sendChannel,
                        messageType: "GUILD"
                    }));
                }
                return Promise.all(_sendQueue).catch(err => {
                    log.error(err);
                });
            }
        }).catch(err => {
            log.error(err);
        });
    }

    log.mark(`官方公告检查完成`);
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
    const res = await miGetEmoticon();
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
