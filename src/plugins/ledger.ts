import fetch from "node-fetch";
import { render } from "../lib/render";
import { getHeaders } from "../lib/mihoyoAPI";
import { IMessageEx } from "../lib/IMessageEx";


const color = ["#597ea0", "#bd9a5a", "#7a6da7", "#d56565", "#70b2b4", "#73a9c6", "#739970"];

export async function ledgerPart(msg: IMessageEx) {

    const cookie = await global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie");
    const uid = await global.redis.hGet(`genshin:config:${msg.author.id}`, "uid");
    const region = await global.redis.hGet(`genshin:config:${msg.author.id}`, "region");
    if (!cookie || !uid || !region) {
        msg.sendMsgEx({ content: `尚未绑定cookie，无法查询` });
        return true;
    }
    if (!cookie.includes("cookie_token")) {
        msg.sendMsgEx({ content: "配置cookie不完整，不支持札记查询\n请退出米游社重新登录获取完整cookie" });
        return true;
    }

    var _month: string = msg.content.replace(/#|原石|月|札记/g, "");
    var _monthData = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
    var month: number = new Date().getMonth() + 1;

    if (_month) {
        _monthData.forEach((m, v) => {
            if (m == _month) month = v + 1;
        });
    }
    let _m = _month.match(/\d{1,}/);
    if (_m) month = parseInt(_m[0]);


    //if (month < 1 || month > 12) month = new Date().getMonth() + 1;
    //
    let monthArr = [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].splice(new Date().getMonth(), 3);

    log.debug(`month${month}`);
    log.debug(monthArr);
    if (!monthArr.includes(month)) {
        msg.sendMsgEx({ content: "札记仅支持查询最近三个月的数据" });
        return true;
    }


    /**
     * TODO
     * 统一API后，getHeaders函数不导出，目前暂时使用
     */
    const headers = getHeaders(`month=${month}&bind_uid=${uid}&bind_region=${region}`) as any;
    headers.Cookie = cookie;
    const data = await getLedger(headers, month, uid, region).catch(err => {
        log.error(err);
    });

    var primogems = {
        nowMonth: { total: 0, gacha: 0 },
        lastMonth: { total: 0, gacha: 0 },
    }
    var mora = {
        nowMonth: { total: 0, content: `` },
        lastMonth: { total: 0, content: `` },
    }

    var groupBy: { action: string, color: string, percent: number, num: number }[] = [];

    if (data) {
        primogems.nowMonth.total = data.month_data.current_primogems;
        primogems.lastMonth.total = data.month_data.last_primogems;
        mora.nowMonth.total = data.month_data.current_mora;
        mora.lastMonth.total = data.month_data.last_mora;

        primogems.nowMonth.gacha = parseInt((data.month_data.current_primogems / 160).toFixed(0));
        primogems.lastMonth.gacha = parseInt((data.month_data.last_primogems / 160).toFixed(0));

        if (mora.nowMonth.total >= 10000) mora.nowMonth.content = `${(mora.nowMonth.total / 10000).toFixed(1)}w`;
        else mora.nowMonth.content = `${mora.nowMonth.total}`;
        if (mora.lastMonth.total >= 10000) mora.lastMonth.content = `${(mora.lastMonth.total / 10000).toFixed(1)}w`;
        else mora.lastMonth.content = `${mora.lastMonth.total}`;

        data.month_data.group_by.forEach((value, iv) => {
            groupBy.push({
                action: value.action,
                color: color[value.action_id],
                percent: value.percent,
                num: value.num,
            });
        });


        await render({
            app: "genshin",
            type: "ledger",
            imgType: "jpeg",
            render: { saveId: msg.author.id },
            data: {
                uid,
                month,
                primogems,
                mora,
                groupBy: JSON.stringify(groupBy),
                _groupBy: groupBy,

            },
        }).then(saveFile => {
            if (saveFile)
                return msg.sendMsgEx({ imagePath: saveFile });
        }).catch(err => {
            log.error(err);
        });
    }
}

export async function ledgerCount(msg: IMessageEx) {
    //获取cookie

    const cookie = await global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie");
    const uid = await global.redis.hGet(`genshin:config:${msg.author.id}`, "uid");
    const region = await global.redis.hGet(`genshin:config:${msg.author.id}`, "region");

    if (!cookie || !uid || !region) {
        msg.sendMsgEx({ content: `尚未绑定cookie，无法查询` });
        return true;
    }

    if (!cookie.includes("cookie_token")) {
        msg.sendMsgEx({ content: "配置cookie不完整，不支持札记查询\n请退出米游社重新登录获取完整cookie" });
        return true;
    }

    const nowMonth = new Date().getMonth();
    /**
     * TODO
     * 统一API后，getHeaders函数不导出，目前暂时使用
     */
    const headers = getHeaders(`month=${nowMonth}&bind_uid=${uid}&bind_region=${region}`) as any;
    headers.Cookie = cookie;


    var primogems = {
        total: 0,
        gachaTimes: 0,
        max: {
            month: 0, total: 0,
        },
        month: [
            { month: 0, total: 0, name: "" },
            { month: 0, total: 0, name: "" },
            { month: 0, total: 0, name: "" }
        ],

    };
    var mora = {
        total: 0,
        totalContent: "",
        max: {
            month: 0,
            total: 0,
            total1: { num: 0, action: "" },
            total2: { num: 0, action: "" },
        },
    };

    var groupBy: { action_id: number, action: string, num: number }[] = [];
    await Promise.all([
        getLedger(headers, nowMonth + 1, uid, region),
        getLedger(headers, nowMonth, uid, region),
        getLedger(headers, nowMonth - 1, uid, region),
    ]).then(datas => {

        for (const data of datas) {
            primogems.total += data.month_data.current_primogems;
            mora.total += data.month_data.current_mora;
            primogems.month[data.data_month - nowMonth + 1] = {
                month: data.data_month,
                total: data.month_data.current_primogems,
                name: "原石",
            }

            if (primogems.max.total < data.month_data.current_primogems) {
                primogems.max.month = data.data_month;
                primogems.max.total = data.month_data.current_primogems;
            }
            if (mora.max.total < data.month_data.current_mora) {
                mora.max.month = data.data_month;
                mora.max.total = data.month_data.current_mora;
            }
            data.month_data.group_by = data.month_data.group_by.sort((v1, v2) => {
                return v1.action_id - v2.action_id;
            });
            groupBy = groupBy.sort((v1, v2) => {
                return v1.action_id - v2.action_id;
            });
            const _tmp = data.month_data.group_by;
            if (groupBy.length == 0) {
                groupBy = _tmp;
            } else {
                groupBy.forEach((value, iv) => {
                    groupBy[iv] = {
                        action_id: groupBy[iv].action_id,
                        action: groupBy[iv].action,
                        num: groupBy[iv].num + _tmp[iv].num,
                    }
                });
            }
        }
        groupBy.sort((v1, v2) => {
            return v2.num - v1.num;
        });
        //log.debug(groupBy);
    }).catch(err => {
        log.error(err);
    });


    primogems.gachaTimes = parseInt((primogems.total / 160).toFixed(0));

    if (mora.total >= 10000) mora.totalContent = `${(mora.total / 10000).toFixed(0)}w`;
    else mora.totalContent = mora.total.toString();
    return await render({
        app: "genshin",
        type: "ledgerCount",
        imgType: "jpeg",
        render: {
            saveId: msg.author.id,
        },
        data: {
            uid,
            primogems,
            mora,
            groupBy,
            primogemsMonth: JSON.stringify(primogems.month),
            pieData: JSON.stringify(groupBy),
            //color: JSON.stringify(['#d62728', '#2ca02c', '#000000']),
        }
    }).then((saveFile) => {
        if (saveFile) msg.sendMsgEx({ imagePath: saveFile });
        else throw new Error("not found image");
    }).catch(err => {
        log.error(err);
    });


}

async function getLedger(headers: any, month: number, uid: string, region: string): Promise<LedgerData> {
    var cache = await global.redis.hGet(`cache:ledger:${uid}`, `m${month}`);
    if (cache) return JSON.parse(cache);

    return fetch(`https://hk4e-api.mihoyo.com/event/ys_ledger/monthInfo?month=${month}&bind_uid=${uid}&bind_region=${region}`, {
        method: "GET",
        headers,
    }).then(res => {
        return res.json();
    }).then(async (json: MihoyoAPI<LedgerData>) => {
        //log.debug(JSON.stringify(json));
        if (json.data) {
            await global.redis.hSet(`cache:ledger:${uid}`, `m${month}`, JSON.stringify(json.data));
            await global.redis.expire(`cache:ledger:${uid}`, 3600 * 24);
            return json.data;
        } else {
            throw new Error(JSON.stringify(json));
        }
    }).catch(err => {
        log.error(err);
        throw log;
    });

}


interface LedgerData {
    uid: number;
    region: string;
    account_id: number;
    nickname: string;
    date: string;
    month: number;
    optional_month: number[];
    data_month: number;
    data_last_month: number;
    day_data: {
        current_primogems: number;
        current_mora: number;
        last_primogems: number;
        last_mora: number;
    };
    month_data: {
        current_primogems: number;
        current_mora: number;
        last_primogems: number;
        last_mora: number;
        current_primogems_level: number;
        primogems_rate: number;
        mora_rate: number;
        group_by: {
            action_id: number;
            action: string;
            num: number;
            percent: number;
        }[];
    };
    lantern: false;
};

