import fs from "fs";
import { sleep } from "../lib/common";
import { render } from "../lib/render";
import { IMessageDIRECT, sendImage } from "../lib/IMessageEx";
import { miGetDailyNote, miGetSignRewardHome, miGetSignRewardInfo, miPostSignRewardSign } from "../lib/mihoyoAPI";


const pushDailyTime = 1000 * 60 * 60 * 10;

export async function onceDaily(msg: IMessageDIRECT) {

    return getDailyImage(msg.author.id).then(imagePath => {
        if (imagePath) return msg.sendMsgEx({ imagePath });
    }).catch(err => {
        log.error(err);
        return msg.sendMsgEx({ content: err });
    });
}

async function getDailyImage(aid: string) {
    const miUid = await global.redis.hGet(`genshin:config:${aid}`, "uid");
    const miRegion = await global.redis.hGet(`genshin:config:${aid}`, "region");
    const cookie = await global.redis.hGet(`genshin:config:${aid}`, "cookie");
    const template = await global.redis.hGet(`genshin:config:${aid}`, "template") || "default";

    if (!miRegion || !miUid || !cookie) throw `未找到cookie，请绑定cookie!`;

    const data = await miGetDailyNote(miUid, miRegion, cookie).catch(err => {
        return `获取信息出错，错误详情：\n${err}`;
    });
    if (!data || typeof data == "string") throw data;

    //log.debug(`将于${converTime(data.resin_recovery_time)}后回复`, data.resin_recovery_time);
    const resinTime = { max: data.max_resin, now: data.current_resin, content: "", }
    if (data.resin_recovery_time > 0) resinTime.content = `将于${converTime(data.resin_recovery_time)}后回复`;
    else resinTime.content = "树脂已完全回复";

    //洞天宝钱
    const homeCoin = { max: data.max_home_coin, now: data.current_home_coin, content: "" };
    if (data.home_coin_recovery_time > 0) homeCoin.content = `${converTime(data.home_coin_recovery_time)}后回复`;
    else homeCoin.content = `已完全恢复`;

    //委托
    const task = { finish: data.finished_task_num, total: data.total_task_num, received: data.is_extra_task_reward_received };

    //减半
    const cutHalf = { total: data.resin_discount_num_limit, now: data.remain_resin_discount_num };

    //参量质变仪
    const transformer = { has: data.transformer.obtained, content: "", reached: data.transformer.recovery_time.reached };
    if (!transformer.reached) {
        if (data.transformer.recovery_time.Day > 0)
            transformer.content += `${data.transformer.recovery_time.Day}天`;
        if (data.transformer.recovery_time.Hour > 0)
            transformer.content += `${data.transformer.recovery_time.Hour}小时`;
        if (data.transformer.recovery_time.Minute > 0)
            transformer.content += `${data.transformer.recovery_time.Minute}分钟`;
    }

    //探索
    const expeditions: { icon: string, content: string, remain: number, schedule: number }[] = [];
    const expedition = { finish: 0, total: 0, maxTime: 0, content: `派遣已完成` };
    for (const value of data.expeditions) {
        //log.debug(value.remained_time);
        expedition.total++;
        if (value.remained_time > 0) {
            expeditions.push({
                icon: value.avatar_side_icon,
                content: `剩余${converTime(value.remained_time)}`,
                remain: value.remained_time,
                schedule: 0,
            });
            expedition.content = `最晚将于${converTime(Math.max(expedition.maxTime, value.remained_time))}后完成`;
            expedition.maxTime = Math.max(expedition.maxTime, value.remained_time);
        } else {
            expeditions.push({
                icon: value.avatar_side_icon,
                content: ``,
                remain: value.remained_time,
                schedule: 100,
            });
            expedition.finish++;
        }
    }
    for (var i = 0; i < 5 - data.expeditions.length; i++) expeditions.push({ icon: "", content: "", remain: 0, schedule: 0 });

    return render({
        app: "dailyNote",
        saveId: aid,
        templateName: `template/${template}/index`,
        data: {
            template,
            uid: miUid,
            resinTime,
            homeCoin,
            task,
            cutHalf,
            transformer,
            expeditions,
            expedition,
            day: new Date().toLocaleTimeString(),
        }
    }).catch(err => {
        log.error(err);
        return null;
    });
}

export async function selectTemplate(msg: IMessageDIRECT) {

    var template: null | string = null;
    var templates = fs.readdirSync(`./resources/dailyNote/template/`);
    if (/列表/.test(msg.content)) {
        return msg.sendMsgEx({ content: `当前使用的模板为：${template || `default`}\n支持的模板有：\n${templates.join("\n")}` });
    } else {
        for (const t of templates) if (msg.content.includes(t)) template = t;

        if (template) return await global.redis.hSet(`genshin:config:${msg.author.id}`, "template", template).then(() => {
            return msg.sendMsgEx({ content: `已选择体力模板「${template}」` });
        });
        else return msg.sendMsgEx({ content: `未找到指定模板，可输入 【#体力模板列表】 查询当前支持的模板\n注意: 请区分大小写` });

    }
}

export async function helpDaily(msg: IMessageDIRECT) {
    return msg.sendMsgEx({
        content: `Cookie配置教程(扫码识别下方二维码获取教程)` +
            `\n获取Cookie后请私聊发送给Bot进行绑定`,
        imagePath: `${_path}/resources/help/cookieHelp.png`,
    });
}

export async function changeDaily(msg: IMessageDIRECT) {
    if (/开/.test(msg.content))
        return global.redis.hSet(`genshin:pushDaily`, msg.author.id, new Date().getTime()).then(() => {
            return msg.sendMsgEx({ content: `已开启体力推送服务` });
        }).catch(err => {
            log.error(err);
        });

    if (/关/.test(msg.content))
        return global.redis.hDel(`genshin:pushDaily`, msg.author.id).then(() => {
            return msg.sendMsgEx({ content: `已关闭体力推送服务` });
        }).catch(err => {
            log.error(err);
        });

}

export async function taskPushDaily() {
    log.mark(`体力推送检查中`);

    const msgId = await redis.get("lastestMsgId");
    if (!msgId) return;
    const pushUsers = await redis.hGetAll(`genshin:pushDaily`).catch(err => { return log.error(err) });
    if (!pushUsers) return;

    for (const userId in pushUsers) {
        const guildId = await redis.hGet(`genshin:config:${userId}`, "guildId");
        if (!guildId) continue;
        if (new Date().getTime() - Number(pushUsers[userId]) < pushDailyTime) continue;
        await getDailyImage(userId).then(imagePath => {
            if (!imagePath) throw "not generate";
            return sendImage({ imagePath, guildId, sendType: "DIRECT", msgId });
        }).then(() => {
            return redis.hSet(`genshin:pushDaily`, userId, new Date().getTime());
        }).catch(err => {
            log.error(err);
        });
        await sleep(500);
    }
    log.mark(`体力推送检查完成`);
}

/* export async function signOnce(msg?: IMessageDIRECT, task?: { uid: string; region: string; cookie: string; }) {

    const uid = task?.uid || await global.redis.hGet(`genshin:config:${msg?.author.id}`, "uid");
    const region = task?.region || await global.redis.hGet(`genshin:config:${msg?.author.id}`, "region");
    const cookie = task?.cookie || await global.redis.hGet(`genshin:config:${msg?.author.id}`, "cookie");

    if (!(uid && region && cookie)) return;
    const data = await miGetSignRewardInfo(uid, region, cookie);
    if (!data) return true;
    log.debug(data);

    const mouthInfo = await miGetSignRewardHome(uid, region, cookie).catch(err => {
        log.error(err);
        msg?.sendMsgEx({ content: `获取当月奖励出错:\n${JSON.stringify(err)}` });
    });
    if (!mouthInfo) return;

    const signInfo = await miPostSignRewardSign(uid, region, cookie).catch(err => {
        log.error(err);
        msg?.sendMsgEx({ content: `签到失败，原因：\n${JSON.stringify(err)}` });
    });
    //if (!signInfo) return;
    log.debug(mouthInfo.month, mouthInfo.awards[data.total_sign_day]);

    return msg?.sendMsgEx({ content: `今天已签到`, }); //`今天已签到\n第${isSigned}天奖励：${reward}`, });

}

export async function changeSign(msg: IMessageDIRECT) {

    const ststus = msg.content.includes("开") ? 1 : 0;
    return global.redis.hSet(`genshin:config:${msg.author.id}`, "signPush", ststus).then(() => {
        return signOnce(msg);
    }).then(() => {
        return msg.sendMsgEx({ content: `已${ststus ? "开启" : "关闭"}签到推送服务` });
    }).catch(err => {
        log.error(err);
    });
}

export async function taskPushSign() {

    log.mark(`签到推送准备中`);
    const userConfigs: string[] = await global.redis.keys(`genshin:config:*`).catch(err => {
        log.error(err);
        return ([] as string[]);
    });
    if (userConfigs.length == 0) {
        log.mark("签到推送失败：未找到任何用户设置信息");
        return;
    }

    const userInfos: { uid: string, guildId: string }[] = [];
    const hGetQueue: Promise<void>[] = [];
    for (const userConfig of userConfigs) {
        hGetQueue.push(global.redis.hmGet(userConfig, ["signPush", "guildId"]).then(value => {
            if ((value[0] == "1") && value[1]) userInfos.push({
                uid: userConfig.match(/\d.* /)![0],
                guildId: value[1],
            });
        }));
    }
    if (userInfos.length == 0) {
        log.mark("签到推送失败：用户尚未启用推送");
        return;
    }
    log.mark(`本次检查共有${userInfos.length}个用户使用签到推送`);

    setInterval(() => {
        signOnce
    }, 10 * 1000);

    var ttl = await global.redis.ttl("lastestMsgId");
    while (ttl <= 60 * 4) {
        await sleep(10);
        ttl = await global.redis.ttl("lastestMsgId");
    }

} */

function converTime(time: number) {
    var _d = 0, _h = 0, _m = 0, _s = 0;
    if (time >= 60) {
        _s = time % 60;
        time -= _s;
        time /= 60;
        if (time >= 60) {
            _m = time % 60;
            time -= _m;
            time /= 60;
            if (time >= 24) {
                _h = time % 24;
                time -= _h;
                time /= 24;
                if (time > 0) {
                    _d = time;
                }
            } else {
                _h = time;
            }
        } else {
            _m = time;
        }
    } else {
        return `不足一分钟`;
    }
    //log.debug(`${_d}d,${_h}h,${_m}m,${_s}s`);
    return (_d > 0 ? `${_d}天` : ``) +
        (_h > 0 ? `${_h}时` : ``) +
        (_m > 0 ? `${_m}分` : ``)/*  +
        (_s > 0 ? `${_s}秒` : ``) */;
}