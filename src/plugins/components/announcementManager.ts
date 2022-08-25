import lodash from "lodash";
import fetch from "node-fetch";
import { IMessageEx } from "../system/IMessageEx";
import log from "../system/logger";
import { miGetEmoticon, miGetNewsList, miGetPostFull, PostFullPost } from "./mihoyoAPI";
import { render, renderURL } from "./render";


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
