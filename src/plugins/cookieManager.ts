import fetch from "node-fetch"
import { IMessageEx } from "../lib/IMessageEx";

export async function bingCookie(msg: IMessageEx) {
    var ck = msg.content.replace(/#|'|"/g, '');
    let _cookie: { [key: string]: string } = {};
    for (const c of ck.split(";")) {
        const _head = c.trim().split('=')[0];
        _cookie[_head] = c.trim().slice(_head.length + 1);
    }
    if (!_cookie.cookie_token && !_cookie.cookie_token_v2) return msg.sendMsgEx({ content: '发送cookie不完整\n请退出米游社【重新登录】，刷新完整cookie' });

    var cookie = `ltoken=${_cookie.ltoken};ltuid=${_cookie.ltuid || _cookie.login_uid};cookie_token=${_cookie.cookie_token || _cookie.cookie_token_v2}; account_id=${_cookie.ltuid || _cookie.login_uid};`;
    var flagV2 = false;
    if (_cookie.cookie_token_v2 && (_cookie.account_mid_v2 || _cookie.ltmid_v2)) {
        flagV2 = true;
        cookie = `account_mid_v2=${_cookie.account_mid_v2};cookie_token_v2=${_cookie.cookie_token_v2};ltoken_v2=${_cookie.ltoken_v2};ltmid_v2=${_cookie.ltmid_v2};`;
    }

    fetch(`https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie?game_biz=hk4e_cn`, {
        headers: { Cookie: cookie }
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<CookieData>) => {
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
                    `\n【#开启推送】开启体力定时推送` +
                    `\n【#关闭推送】关闭体力定时推送`;
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

export async function delCookie(msg: IMessageEx) {
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