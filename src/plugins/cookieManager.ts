import { IMessageDIRECT } from "../lib/IMessageEx";
import { miGetUserGameRolesByCookie } from "../lib/mihoyoAPI";

export async function bingCookie(msg: IMessageDIRECT) {
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

    return miGetUserGameRolesByCookie(cookie).then(async data => {
        if (data) {
            if (data.list.length > 0) {
                await redis.hSet(`genshin:config:${msg.author.id}`, "cookie", cookie);
                await redis.hSet(`genshin:config:${msg.author.id}`, "uid", data.list[0].game_uid);
                await redis.hSet(`genshin:config:${msg.author.id}`, "region", data.list[0].region);
                return msg.sendMsgEx({
                    content: `cookie配置成功` +
                        `\n使用cookie的命令有：` +
                        `\n【#删除ck】删除当前cookie` +
                        `\n【#体力】查询当前树脂` +
                        `\n【#开启推送】开启体力定时推送` +
                        `\n【#关闭推送】关闭体力定时推送` +
                        `\n【#签到】原神米游社签到` +
                        `\n【#关闭签到】关闭自动签到` +
                        `\n【#原石】查看原石札记` +
                        `\n【#原石统计】统计原石数据` +
                        `\n【#练度统计】可以查看更多数据` +
                        `\n注意：退出米游社登录cookie将会失效！`
                });
            } else return msg.sendMsgEx({ content: `米游社账号未绑定原神角色！` });
        } else return msg.sendMsgEx({ content: `复制cookie错误\n正确例子：ltoken=***;ltuid=***;` });
    }).catch(err => {
        log.error(err);
    });;
}

export async function queryCookie(msg: IMessageDIRECT) {
    return redis.hGet(`genshin:config:${msg.author.id}`, "cookie").then(cookie => {
        if (cookie) {
            msg.sendMsgEx({ content: `当前绑定的cookie:\n${cookie}` });
        } else {
            msg.sendMsgEx({ content: `未找到cookie` });
        }
    });
}

export async function checkCookie(msg: IMessageDIRECT) {
    return redis.hGet(`genshin:config:${msg.author.id}`, "cookie").then(async cookie => {
        if (!cookie) return msg.sendMsgEx({ content: `未找到cookie` });
        return miGetUserGameRolesByCookie(cookie).then(data => {
            if (data) return msg.sendMsgEx({ content: `检查完成，cookie正确` });
        }).catch(err => {
            log.error(err);
            return msg.sendMsgEx({ content: `cookie失效，错误信息：${err}` });
        });
    }).catch(err => {
        log.error(err);
    });
}

export async function delCookie(msg: IMessageDIRECT) {
    return redis.hGet(`genshin:config:${msg.author.id}`, "cookie").then(cookie => {
        if (cookie) {
            return redis.hDel(`genshin:config:${msg.author.id}`, "cookie").then(() => {
                return msg.sendMsgEx({ content: `已删除当前cookie` });
            });
        } else return msg.sendMsgEx({ content: `未找到cookie，无法删除` });
    });
}