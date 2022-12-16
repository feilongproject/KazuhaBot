import { render } from "../lib/render";
import { IMessageGUILD } from "../lib/IMessageEx";
import role from "../../data/role.json";
import weapon from "../../data/weapon.json";
import gachaPool from "../../data/gachaPool.json";
import { getAuthorConfig } from "../lib/common";

//五星基础概率(0-10000)
const chance5 = 60;
//四星基础概率
const chance4 = 510;

//五星角色
let role5 = ["刻晴", "莫娜", "七七", "迪卢克", "琴", "提纳里"];
//四星角色
let role4 = ["香菱", "辛焱", "迪奥娜", "班尼特", "凝光", "北斗", "行秋", "重云", "雷泽", "诺艾尔", "砂糖", "菲谢尔", "芭芭拉", "罗莎莉亚", "烟绯", "早柚", "托马", "九条裟罗", "五郎", "云堇", "柯莱", "多莉"];

//五星武器
let weapon5 = ["阿莫斯之弓", "天空之翼", "天空之卷", "天空之脊", "天空之傲", "天空之刃", "四风原典", "和璞鸢", "狼的末路", "风鹰剑"];
//四星武器
let weapon4 = ["弓藏", "祭礼弓", "绝弦", "西风猎弓", "昭心", "祭礼残章", "流浪乐章", "西风秘典", "西风长枪", "匣里灭辰", "雨裁", "祭礼大剑", "钟剑", "西风大剑", "匣里龙吟", "祭礼剑", "笛剑", "西风剑",];
//三星武器
let weapon3 = ["弹弓", "神射手之誓", "鸦羽弓", "翡玉法球", "讨龙英杰谭", "魔导绪论", "黑缨枪", "以理服人", "沐浴龙血的剑", "铁影阔剑", "飞天御剑", "黎明神剑", "冷刃",];


export async function gacha(msg: IMessageGUILD) {

    var userId = msg.author.id;
    var type: "weapon" | "role" = msg.content.includes("武器") ? "weapon" : "role";
    let end = getEnd();

    var upType: 1 | 2 | 3 = 1;//up卡池
    if (msg.content.indexOf("2") != -1) upType = 2;
    if (msg.content.indexOf("3") != -1) { upType = 3; type = "weapon"; }

    var weaponBing = await getAuthorConfig(msg.author.id, "weaponBing");

    global.redis.get(`genshin:gacha:${userId}`).then((_gachaData) => {
        if (_gachaData) {
            return JSON.parse(_gachaData);
        } else {
            return {
                total: 0,
                N: { star5: 0, star4: 0, weaponMust: false },
                today: { expire: 0, roleNum: 0, weaponNum: 0, },
                role: { star4: 0, star5: 0, },
                weapon: { star4: 0, star5: 0, },
            };
        }
    }).then((gachaData: GachaData) => {
        var _queue: RandQueue[] = [];
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

                if (type == "weapon" && gachaData.N.weaponMust) {
                    _queue.push(randStar(5, type, upType, weaponBing));
                    gachaData.N.weaponMust = false;
                } else {
                    if (type == "weapon") gachaData.N.weaponMust = true;
                    _queue.push(randStar(5, type, upType));
                }
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
            app: "gacha",
            saveId: userId,
            data: {
                saveId: userId,
                name: msg.author.username,
                info: `累计「${gachaData.total}抽」`,
                list: _queue,
                poolName,
                isWeapon: type == "weapon",
                bingWeapon: (type == "weapon" && weaponBing) ? getNowPool(3).weapon5[parseInt(weaponBing)] : undefined,
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

export async function gachaWeaponBing(msg: IMessageGUILD) {

    const weapon = getNowPool(3).weapon5;
    const configBing = await getAuthorConfig(msg.author.id, "weaponBing");
    switch (configBing) {
        case undefined:
        case null:
            await redis.hSet(`genshin:config:${msg.author.id}`, "weaponBing", "0");
            return msg.sendMsgEx({
                content:
                    `定轨成功\n` +
                    `[√] ${weapon[0]}\n` +
                    `[  ] ${weapon[1]}`
            });
        case "0":
            await redis.hSet(`genshin:config:${msg.author.id}`, "weaponBing", "1");
            return msg.sendMsgEx({
                content:
                    `定轨成功\n` +
                    `[  ] ${weapon[0]}\n` +
                    `[√] ${weapon[1]}`
            });
        case "1":
            await redis.hDel(`genshin:config:${msg.author.id}`, "weaponBing");
            return msg.sendMsgEx({ content: `定轨已取消` });
    }
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
        default:
            return {
                up4: end?.up4,
                up5: end?.up5,
                weapon4: end?.weapon4,
                weapon5: end?.weapon5,
            };
    }

}

function randStar(star: 5 | 4 | 3, _type: string, upType: 1 | 2 | 3, weaponBing?: string): RandQueue {

    var _pool: string[] = [];
    const upPool = getNowPool(upType);
    const searchPool = [...role, ...weapon];
    var type = (Math.random() > 0.5 || _type == "weapon") ? "weapon" : "role";

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

    if (weaponBing) _pool = [upPool.weapon5[parseInt(weaponBing)]];
    var id = getRandomInt(_pool.length);

    for (let iv = 0; iv < searchPool.length; iv++)
        if (searchPool[iv].name[0] == _pool[id]) return {
            name: searchPool[iv].name[0],
            star: star,
            id: searchPool[iv].id,
            type,
            element: searchPool[iv].element,
        }

    throw new Error(`not found role or weapon in searchPool |info: ${_pool[id]} ${star} ${_type} ${upType} ${weaponBing}`);
}

interface GachaData {
    total: number;
    N: {
        star5: number;
        star4: number;
        weaponMust: boolean;
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
}

interface RandQueue {
    name: string;
    star: 5 | 4 | 3;
    id: number;
    type: string;
    element: string;
}