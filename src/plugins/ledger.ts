import { render } from "../lib/render";
import { miGetLedgerMonthInfo } from "../lib/mihoyoAPI";
import { IMessageDIRECT } from "../lib/IMessageEx";
import { getAuthorConfig } from "../lib/common";


const color = ["#597ea0", "#bd9a5a", "#7a6da7", "#d56565", "#70b2b4", "#73a9c6", "#739970"];

export async function ledgerPart(msg: IMessageDIRECT) {

    const { uid, region, cookie } = await getAuthorConfig(msg.author.id, ["uid", "region", "cookie"]);

    if (!cookie.includes("cookie_token")) return msg.sendMsgEx({ content: "配置cookie不完整，不支持札记查询\n请退出米游社重新登录获取完整cookie" });

    var _month: string = msg.content.replace(/#|原石|月|札记/g, "");
    var _monthData = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
    var month: number = new Date().getMonth() + 1;

    if (_month) for (const [v, m] of _monthData.entries()) {
        if (m == _month) month = v + 1;
    }

    const _m = _month.match(/\d{1,}/);
    if (_m) month = parseInt(_m[0]);

    const monthArr = [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].splice(new Date().getMonth(), 3);
    if (!monthArr.includes(month)) return msg.sendMsgEx({ content: "札记仅支持查询最近三个月的数据" });

    const ledgerData = await miGetLedgerMonthInfo(uid, region, cookie, month).catch(err => {
        log.error(err);
        return `获取札记信息出错:\n${JSON.stringify(err)}`;
    });
    if (typeof ledgerData == "string") return msg.sendMsgEx({ content: ledgerData });

    const primogems = {
        nowMonth: { total: 0, gacha: 0 },
        lastMonth: { total: 0, gacha: 0 },
    }
    const mora = {
        nowMonth: { total: 0, content: `` },
        lastMonth: { total: 0, content: `` },
    }

    const groupBy: { action: string, color: string, percent: number, num: number }[] = [];


    primogems.nowMonth.total = ledgerData.month_data.current_primogems;
    primogems.lastMonth.total = ledgerData.month_data.last_primogems;
    mora.nowMonth.total = ledgerData.month_data.current_mora;
    mora.lastMonth.total = ledgerData.month_data.last_mora;

    primogems.nowMonth.gacha = parseInt((ledgerData.month_data.current_primogems / 160).toFixed(0));
    primogems.lastMonth.gacha = parseInt((ledgerData.month_data.last_primogems / 160).toFixed(0));

    if (mora.nowMonth.total >= 10000) mora.nowMonth.content = `${(mora.nowMonth.total / 10000).toFixed(1)}w`;
    else mora.nowMonth.content = `${mora.nowMonth.total}`;
    if (mora.lastMonth.total >= 10000) mora.lastMonth.content = `${(mora.lastMonth.total / 10000).toFixed(1)}w`;
    else mora.lastMonth.content = `${mora.lastMonth.total}`;

    for (const value of ledgerData.month_data.group_by) {
        groupBy.push({
            action: value.action,
            color: color[value.action_id],
            percent: value.percent,
            num: value.num,
        });
    }

    return render({
        app: "ledger",
        saveId: msg.author.id,
        data: {
            uid,
            month,
            primogems,
            mora,
            groupBy: JSON.stringify(groupBy),
            _groupBy: groupBy,
        },
    }).then(saveFile => {
        if (saveFile) return msg.sendMsgEx({ imagePath: saveFile });
    }).catch(err => {
        log.error(err);
    });

}

export async function ledgerCount(msg: IMessageDIRECT) {

    const { uid, region, cookie } = await getAuthorConfig(msg.author.id, ["uid", "region", "cookie"]);

    if (!cookie.includes("cookie_token")) return msg.sendMsgEx({ content: "配置cookie不完整，不支持札记查询\n请退出米游社重新登录获取完整cookie" });

    const nowMonth = new Date().getMonth();
    const primogems = {
        total: 0,
        gachaTimes: 0,
        max: { month: 0, total: 0 },
        month: [
            { month: 0, total: 0, name: "" },
            { month: 0, total: 0, name: "" },
            { month: 0, total: 0, name: "" }
        ],

    };
    const mora = {
        total: 0,
        totalContent: "",
        max: {
            month: 0, total: 0,
            total1: { num: 0, action: "" },
            total2: { num: 0, action: "" },
        },
    };
    var groupBy: { action_id: number, action: string, num: number }[] = [];

    await Promise.all([
        miGetLedgerMonthInfo(uid, region, cookie, nowMonth + 1),
        miGetLedgerMonthInfo(uid, region, cookie, nowMonth),
        miGetLedgerMonthInfo(uid, region, cookie, nowMonth - 1),
    ]).then(datas => {
        for (const data of datas) {
            primogems.total += data.month_data.current_primogems;
            mora.total += data.month_data.current_mora;
            primogems.month[data.data_month - nowMonth + 1] = {
                month: data.data_month,
                total: data.month_data.current_primogems,
                name: "原石",
            };

            if (primogems.max.total < data.month_data.current_primogems) {
                primogems.max.month = data.data_month;
                primogems.max.total = data.month_data.current_primogems;
            }
            if (mora.max.total < data.month_data.current_mora) {
                mora.max.month = data.data_month;
                mora.max.total = data.month_data.current_mora;
            }
            data.month_data.group_by = data.month_data.group_by.sort((v1, v2) => v1.action_id - v2.action_id);
            groupBy = groupBy.sort((v1, v2) => v1.action_id - v2.action_id);
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
        groupBy.sort((v1, v2) => v2.num - v1.num);
    }).catch(err => {
        log.error(err);
    });

    primogems.gachaTimes = parseInt((primogems.total / 160).toFixed(0));
    if (mora.total >= 10000) mora.totalContent = `${(mora.total / 10000).toFixed(0)}w`;
    else mora.totalContent = mora.total.toString();
    return await render({
        app: "ledgerCount",
        saveId: msg.author.id,
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
        else throw "not found image";
    }).catch(err => {
        log.error(err);
    });


}

