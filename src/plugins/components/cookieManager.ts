import fetch from "node-fetch"
import { IMessageEx } from "../system/IMessageEx";
import log from "../system/logger"

export async function bingCookie(msg: IMessageEx) {

    var param = msg.content.match(/ltoken=([^;]+;)|ltuid=(\w{0,9})|cookie_token=([^;]+;)|login_ticket=([^;]+;)/g);
    //log.debug(param);
    var cookie = ``;
    param?.forEach(p => {
        if (!p.endsWith(";")) p += `;`;
        if (p.startsWith(`ltuid=`)) {
            const accId = /[0-9]+/.exec(p)![0];
            cookie += `account_id=${accId};`;
        }
        cookie += p;
    });

    //log.debug(cookie);

    fetch(`https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie?game_biz=hk4e_cn`, {
        method: "GET",
        headers: { Cookie: cookie, }
    }
    ).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<CookieData>) => {
        //log.debug(json);

        if (json.retcode == 0) {

            if (json.data && json.data.list.length > 0) {
                global.redis.hSet(`genshin:config:${msg.author.id}`, "cookie", cookie);
                global.redis.hSet(`genshin:config:${msg.author.id}`, "uid", json.data.list[0].game_uid);
                global.redis.hSet(`genshin:config:${msg.author.id}`, "region", json.data.list[0].region);


                // sendDirectMsg(msg.guild_id, msg.id, `cookie配置成功\n通过命令【#uid】查看已绑定的uid列表`);
                var helpMsg =
                    `cookie配置成功` +
                    `\n使用cookie的命令有：` +
                    `\n【#删除ck】删除当前cookie` +
                    `\n【#体力】查询当前树脂` +
                    `\n【#开启推送】开启体力大于120时推送` +
                    `\n【#关闭推送】关闭体力推送`;
                if (cookie.includes("cookie_token")) {
                    helpMsg += `\n【#签到】原神米游社签到`;
                    helpMsg += `\n【#关闭签到】关闭自动签到`;
                    helpMsg += `\n【#原石】查看原石札记`;
                    helpMsg += `\n【#原石统计】统计原石数据`;
                    helpMsg += `\n【#练度统计】可以查看更多数据`;
                    helpMsg += `\n注意：退出米游社登录cookie将会失效！`;
                } else {
                    helpMsg +=
                        `\n【cookie不完整】仅支持查询【体力】` +
                        `\n退出米游社重登，刷新获取完整cookie再发送`;
                }
                msg.sendMsgEx({ content: helpMsg });

            } else {
                msg.sendMsgEx({ content: `米游社账号未绑定原神角色！` });
            }

        } else {
            msg.sendMsgEx({ content: `复制cookie错误\n正确例子：ltoken=***;ltuid=***;` });
        }
    }).catch(err => {
        log.error(err);
    });
}

export async function deleteCookie(msg: IMessageEx) {
    global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie").then(cookie => {
        if (cookie) {
            global.redis.hDel(`genshin:config:${msg.author.id}`, "cookie").then(() => {
                msg.sendMsgEx({ content: `已删除当前cookie` });
            });
        } else msg.sendMsgEx({ content: `未找到cookie，无法删除` });
    });
}

export async function queryCookie(msg: IMessageEx) {
    global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie").then(cookie => {
        if (cookie) {
            msg.sendMsgEx({ content: `当前绑定的cookie:\n${cookie}` });
        } else {
            msg.sendMsgEx({ content: `未找到cookie` });
        }
    });
}

export async function checkCookie(msg: IMessageEx) {
    global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie").then(cookie => {
        if (!cookie) return msg.sendMsgEx({ content: `未找到cookie，停止检查` });
        return fetch(`https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie?game_biz=hk4e_cn`, {
            method: "GET",
            headers: { Cookie: cookie, }
        }).then(res => {
            return res.json();
        }).then((json: MihoyoAPI<CookieData>) => {
            if (json.data) return msg.sendMsgEx({ content: `检查完成，cookie正确` });
            else return msg.sendMsgEx({ content: `cookie失效，错误信息：${json.message}` });
        });
    }).catch(err => {
        log.error(err);
    });
}

interface CookieData {
    list: {
        game_biz: string;
        region: string;
        game_uid: string;
        nickname: string;
        level: number;
        is_chosen: boolean;
        region_name: string;
        is_official: number;
    }[];

}