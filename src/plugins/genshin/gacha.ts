import { render } from "../components/render";
import lodash from "lodash";
import fs from "fs";
import log from "../system/logger";

import gachaPool from "../../../data/gachaPool.json";
import role from "../../../data/role.json";
import weapon from "../../../data/weapon.json";
import { IMessageEx } from "../system/IMessageEx";

//五星基础概率(0-10000)
const chance5 = 60;
//四星基础概率
const chance4 = 510;
//角色不歪的概率（0-100）
const wai = 45;
//五星武器基础概率
const chanceW5 = 70;
//四星武器基础概率
const chanceW4 = 600;


export const rule = {
    gacha: {
        reg: "^#*(10|[武器池]*[十]+|抽|单)[连抽卡奖][123武器池]*$",
        priority: 100,
        describe: "【十连，十连2，十连武器】模拟原神抽卡",
    },
    weaponBing: {
        reg: "^#*定轨$", //匹配的正则
        priority: 101, //优先级，越小优先度越高
        describe: "【定轨】武器池定轨", //描述说明
    },
};

//五星角色
let role5 = ["刻晴", "莫娜", "七七", "迪卢克", "琴"];
//四星角色
let role4 = ["香菱", "辛焱", "迪奥娜", "班尼特", "凝光", "北斗", "行秋", "重云", "雷泽", "诺艾尔", "砂糖", "菲谢尔", "芭芭拉", "罗莎莉亚", "烟绯", "早柚", "托马", "九条裟罗", "五郎", "云堇",];

//五星武器
let weapon5 = ["阿莫斯之弓", "天空之翼", "天空之卷", "天空之脊", "天空之傲", "天空之刃", "四风原典", "和璞鸢", "狼的末路", "风鹰剑"];
//四星武器
let weapon4 = ["弓藏", "祭礼弓", "绝弦", "西风猎弓", "昭心", "祭礼残章", "流浪乐章", "西风秘典", "西风长枪", "匣里灭辰", "雨裁", "祭礼大剑", "钟剑", "西风大剑", "匣里龙吟", "祭礼剑", "笛剑", "西风剑",];
//三星武器
let weapon3 = ["弹弓", "神射手之誓", "鸦羽弓", "翡玉法球", "讨龙英杰谭", "魔导绪论", "黑缨枪", "以理服人", "沐浴龙血的剑", "铁影阔剑", "飞天御剑", "黎明神剑", "冷刃",];


export async function gacha(msg: IMessageEx) {

    var userId = msg.author.id;
    var type: "weapon" | "role" = msg.content.includes("武器") ? "weapon" : "role";
    let end = getEnd();

    var upType: 1 | 2 | 3 = 1;//up卡池
    if (msg.content.indexOf("2") != -1) upType = 2;
    if (msg.content.indexOf("3") != -1) { upType = 3; type = "weapon"; }

    global.redis.get(`genshin:gacha:${userId}`).then((_gachaData) => {
        //var gachaData: GachaData;
        if (_gachaData) {
            return JSON.parse(_gachaData);
        } else {
            return {
                total: 0,
                N: { star5: 0, star4: 0, },
                today: { expire: 0, roleNum: 0, weaponNum: 0, },
                role: { star4: 0, star5: 0, },
                weapon: { star4: 0, star5: 0, },
            };
        }
    }).then((gachaData: GachaData) => {

        var _queue: RandQueue[] = [];

        //循环十次
        for (let i = 1; i <= 10; i++) {
            gachaData.total++;
            let tmpChance5 = chance5;

            if (gachaData.N.star5 >= 90) { //90次都没中五星
                tmpChance5 = 10000;
            } else if (gachaData.N.star5 >= 74) { //74抽后逐渐增加概率
                tmpChance5 = 590 + (gachaData.N.star5 - 74) * 530;
            } else if (gachaData.N.star5 >= 60) { //60抽后逐渐增加概率
                tmpChance5 = chance5 + (gachaData.N.star5 - 50) * 40;
            }


            if (getRandomInt(10000) <= tmpChance5) {//抽中五星
                gachaData.N.star5 = 0;
                gachaData.N.star4 = 0;
                _queue.push(randStar(5, type, upType));
            } else if (getRandomInt(10000) <= chance4 || gachaData.N.star4 == 9) { //抽中四星
                gachaData.N.star5++;
                gachaData.N.star4 = 0;
                _queue.push(randStar(4, type, upType));
            } else {
                gachaData.N.star5++;
                gachaData.N.star4++;
                _queue.push(randStar(3, type, upType));
            }

        }

        global.redis.set(`genshin:gacha:${userId}`, JSON.stringify(gachaData));
        var upPool = getNowPool(upType);
        var poolName;

        if (type == "role") poolName = `角色池：${upPool?.up5[0]}`;
        else poolName = `武器池：${upPool?.weapon5[0]}`;
        render({
            app: "genshin",
            type: "gacha",
            imgType: "jpeg",
            render: {
                saveId: userId,
            },
            data: {
                saveId: userId,
                name: msg.author.username,
                info: `累计「${gachaData.total}抽」`,
                list: _queue,
                poolName,
            },
        }).then(savePic => {
            if (typeof savePic == "string")
                return msg.sendMsgEx({ imagePath: savePic });
        }).catch(err => {
            log.error(err);
        });
    }).catch(err => {
        log.error(err);
    });
}


function getEnd() {
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();
    let dayEnd = 0;
    //每日数据-凌晨4点更新
    if (now.getHours() < 4) {
        dayEnd = new Date(year, month, day, 3, 59, 59).getTime();
    } else {
        dayEnd = new Date(year, month, day, 23, 59, 59).getTime() + 3600 * 4 * 1000;
    }

    //每周结束时间
    let weekEnd = dayEnd + 86400 * (7 - now.getDay()) * 1000;
    //redis过期时间
    let keyEnd = Math.ceil((dayEnd + 86400 * 5 * 1000 - now.getTime()) / 1000);

    return { dayEnd, weekEnd, keyEnd };
}

//返回随机整数
function getRandomInt(max = 10000) {
    return Math.floor(Math.random() * max);
}

function getNowPool(upType: number) {
    var end;

    for (let val of gachaPool) {
        //log.debug(new Date().getTime(), new Date(val.endTime).getTime());
        if (new Date().getTime() <= new Date(val.endTime).getTime()) {

            end = val;
            break;
        }
    }

    if (!end) end = gachaPool[gachaPool.length - 1];
    //log.debug(end);

    switch (upType) {
        case 1:
            return {
                up4: end?.up4,
                up5: end?.up5,
                weapon4: end?.weapon4,
                weapon5: end?.weapon5,
            };
        case 2:
            return {
                up4: end?.up4,
                up5: end?.up5_2,
                weapon4: end?.weapon4,
                weapon5: end?.weapon5,
            };
        case 3:
            return {
                up4: end?.up4,
                up5: end?.up5,
                weapon4: end?.weapon4,
                weapon5: end?.weapon5,
            };
    }

}

function randStar(star: 5 | 4 | 3, _type: string, upType: 1 | 2 | 3): RandQueue {

    var upPool = getNowPool(upType);

    var _pool: string[] = [];
    var searchPool = [...role, ...weapon];

    var type: "role" | "weapon";
    if (Math.random() > 0.5 || _type == "weapon") {
        type = "weapon";
    } else {
        type = "role";
    }

    switch (star) {
        case 5:
            if (upPool?.weapon5) _pool.push(...upPool.weapon5);

            if (type == "role") {
                _pool = role5;
                if (upPool?.up5) _pool.push(...upPool.up5);
            }
            else {
                _pool = weapon5;
                if (upPool?.weapon5) _pool.push(...upPool.weapon5);
            }
            break;
        case 4:
            if (upPool?.weapon4) _pool.push(...upPool.weapon4);

            if (type == "role") {
                _pool = role4;
                if (upPool?.up4) _pool.push(...upPool.up4);
            }
            else {
                _pool = weapon4;
                if (upPool?.weapon4) _pool.push(...upPool.weapon4);
            }
            break;
        case 3:
            type = "weapon";
            _pool = weapon3;
            break;
    }
    var id = getRandomInt(_pool.length);
    log.debug(id, _pool[id], type);

    for (let iv = 0; iv < searchPool.length; iv++) {
        //log.debug(searchPool[iv], _pool[id]);
        if (searchPool[iv].name[0] == _pool[id]) {
            return {
                name: searchPool[iv].name[0],
                star: star,
                id: searchPool[iv].id,
                type,
                element: searchPool[iv].element,
            }
        }
    }
    throw new Error("not found role or weapon in searchPool");
}

interface GachaData {
    total: number;
    N: {
        star5: number;
        star4: number;
    };
    today: {
        expire: number;
        roleNum: number;
        weaponNum: number;
    };
    role: {
        star4: number;
        star5: number;
    };
    weapon: {
        star4: number;
        star5: number;
    };
};

export interface RandQueue {
    name: string;
    star: 5 | 4 | 3;
    id: number;
    type: string;
    element: string;
}
