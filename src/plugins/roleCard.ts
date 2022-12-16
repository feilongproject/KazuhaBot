import lodash from "lodash";
import { render } from "../lib/render";
import { IMessageDIRECT, IMessageGUILD } from "../lib/IMessageEx";
import { getAuthorConfig, redisCache, sleep } from "../lib/common";
//import { roleToElement, roleToTalent, shortName, weekToTalent } from "./roleConver";
import { roleToElement, roleToTalent, shortName, weekToTalent } from "../lib/roleConver";
import { miGetAvatarDetail, AvatarDetailData, Avatars, miGetRecordCharacters, miGetRecordIndex, OrganizedAvatar, RecordCharactersData } from "../lib/mihoyoAPI";

const area: { [key: string]: number } = { 蒙德: 1, 璃月: 2, 雪山: 3, 稻妻: 4, 渊下宫: 5, 层岩巨渊: 6, 层岩地下: 7, 须弥: 8 };
const areaName = lodash.invert(area);

export async function todayTalent(msg: IMessageGUILD | IMessageDIRECT) {

    const { uid, region, cookie } = await getAuthorConfig(msg.author.id, ["uid", "region", "cookie"]);

    const myAvatars = await miGetRecordCharacters(uid, region, cookie).catch(err => {
        log.error(err);
        return `获取信息出错: ${JSON.stringify(err)}`;
    });
    if (typeof myAvatars == "string") return msg.sendMsgEx({ content: myAvatars });

    var week = new Date().getDay() || 7;
    if (new Date().getHours() < 4) week--;
    if (week == 0 || week == 7) {
        msg.sendMsgEx({ content: "今日全部素材都可以刷" });
        return true;
    }

    const avatars = myAvatars.avatars;
    const todayTalent = weekToTalent(week);
    const todayData: {
        area: string,
        material: { name: string; }
        roles?: { lv: number, icon: string; star: number; life: number; }[]
        weapons?: { lv: number, icon: string; star: number; life: number; avatarIcon: string }[]
    }[] = [];

    for (const role of todayTalent.role) {
        const _avtars: { lv: number, icon: string; star: number; life: number; }[] = [];
        const a = lodash.intersectionWith(avatars, role.act, (v1, v2) => v1.name == v2);
        for (const _a of a) _avtars.push({
            lv: _a.level,
            icon: _a.icon,
            star: _a.rarity,
            life: _a.actived_constellation_num,
        });
        if (_avtars.length != 0)
            todayData.push({
                area: role.area,
                material: { name: role.name },
                roles: _avtars
            });
    }

    for (const weapon of todayTalent.weapon) {
        const _weapons: { lv: number, icon: string; star: number; life: number; avatarIcon: string }[] = [];
        const a = lodash.intersectionWith(avatars, weapon.act, (v1, v2) => v1.weapon.name == v2);
        for (const _a of a) _weapons.push({
            lv: _a.weapon.level,
            icon: _a.weapon.icon,
            star: _a.weapon.rarity,
            life: _a.weapon.affix_level,
            avatarIcon: _a.icon,
        });
        if (_weapons.length != 0)
            todayData.push({
                area: weapon.area,
                material: { name: weapon.name },
                weapons: _weapons
            });
    }

    return render({
        app: "todayTalent",
        saveId: msg.author.id,
        data: { uid, todayData }
    }).then(imgPath => {
        if (imgPath) return msg.sendMsgEx({ imagePath: imgPath });
        else throw "not found imgPath";
    }).catch(err => {
        log.error(err);
    });
}

export async function roleCard(msg: IMessageGUILD | IMessageDIRECT) {

    const { uid, region, cookie } = await getAuthorConfig(msg.author.id, ["uid", "region", "cookie"]);

    const recordIndex = await miGetRecordIndex(uid, region, cookie);
    const recordCharacter = await miGetRecordCharacters(uid, region, cookie);
    if (!recordIndex || !recordCharacter) { return; }

    //描述
    const line = [
        [
            { lable: "成就", num: recordIndex.stats.achievement_number },
            { lable: "角色数", num: recordIndex.stats.avatar_number },
            {
                lable: "总宝箱",
                num: recordIndex.stats.precious_chest_number +
                    recordIndex.stats.luxurious_chest_number +
                    recordIndex.stats.exquisite_chest_number +
                    recordIndex.stats.common_chest_number +
                    recordIndex.stats.magic_chest_number,
            },
            { lable: "深境螺旋", num: recordIndex.stats.spiral_abyss },
        ],
        [
            { lable: "华丽宝箱", num: recordIndex.stats.luxurious_chest_number },
            { lable: "珍贵宝箱", num: recordIndex.stats.precious_chest_number },
            { lable: "精致宝箱", num: recordIndex.stats.exquisite_chest_number },
            { lable: "普通宝箱", num: recordIndex.stats.common_chest_number },
        ],
    ];

    //尘歌壶
    var homesLevel = 0;
    if (recordIndex.homes && recordIndex.homes.length > 0) homesLevel = recordIndex.homes[0].level;

    //世界探索
    const worldExplorations = lodash.keyBy(recordIndex.world_explorations, 'id');
    const explor = [], explor2 = [];
    const expArr = ['须弥', '层岩巨渊', '渊下宫', '稻妻'], expArr2 = ['雪山', '璃月', '蒙德'];

    for (const val of expArr) {
        const tmp = { lable: val, num: `${(worldExplorations[area[val]]?.exploration_percentage ?? 0) / 10}%` };
        explor.push(tmp);
    }
    for (const val of expArr2) {
        const tmp = { lable: val, num: `${(worldExplorations[area[val]]?.exploration_percentage ?? 0) / 10}%` };
        explor2.push(tmp);
    }

    explor2.push({ lable: '家园等级', num: homesLevel });
    line.push(explor);
    line.push(explor2);

    //角色
    const avatars: {
        constellationNum: number,
        star: number,
        name: string,
        skinUrl: string,
        lv: number,
        fetter: number,
        weapon: {
            name: string,
            showName: string,
            lv: number,
            affixLv: number,
        }
    }[] = [];
    for (const [i, avatar] of recordIndex.avatars.entries()) {
        const weapon = { name: "", showName: "", lv: 0, affixLv: 0 };
        for (const searchAvatar of recordCharacter.avatars)
            if (searchAvatar.name == avatar.name) {
                weapon.name = searchAvatar.weapon.name;
                weapon.showName = shortName(weapon.name) || weapon.name;
                weapon.lv = searchAvatar.weapon.level;
                weapon.affixLv = searchAvatar.weapon.affix_level;
                break;
            }
        avatars.push({
            constellationNum: avatar.actived_constellation_num,
            star: avatar.rarity,
            name: avatar.name,
            skinUrl: avatar.image,
            lv: avatar.level,
            fetter: avatar.fetter,
            weapon
        });
        if (i == 7) break;
    }

    return render({
        app: "roleCard",
        saveId: msg.author.id,
        data: {
            uid,
            line,
            avatars,
            activeDay: recordIndex.stats.active_day_number,
            // abyss: await abyssAll(recordCharacter.avatars, uid, region, cookie),
            bg: lodash.random(1, 6),
        }
    }).then(imgPath => {
        if (imgPath) return msg.sendMsgEx({ imagePath: imgPath });
        else throw "not found imgPath";
    }).catch(err => {
        log.error(err);
    });


}

export async function roleCardExplore(msg: IMessageGUILD | IMessageDIRECT) {
    const { uid, region, cookie } = await getAuthorConfig(msg.author.id, ["uid", "region", "cookie"]);
    const recordIndex = await miGetRecordIndex(uid, region, cookie);
    if (!recordIndex) return;

    const stats = recordIndex.stats;
    const line = [
        [
            { lable: "成就", num: stats.achievement_number },
            { lable: "角色数", num: stats.avatar_number },
            { lable: "等级", num: recordIndex.role.level },
            {
                lable: "总宝箱",
                num: stats.precious_chest_number +
                    stats.luxurious_chest_number +
                    stats.exquisite_chest_number +
                    stats.common_chest_number +
                    stats.magic_chest_number,
            },
        ],
        [
            { lable: "华丽宝箱", num: stats.luxurious_chest_number },
            { lable: "珍贵宝箱", num: stats.precious_chest_number },
            { lable: "精致宝箱", num: stats.exquisite_chest_number },
            { lable: "普通宝箱", num: stats.common_chest_number },
        ],
        [
            { lable: "风神瞳", num: stats.anemoculus_number },
            { lable: "岩神瞳", num: stats.geoculus_number },
            { lable: "雷神瞳", num: stats.electroculus_number },
            { lable: "草神瞳", num: stats.dendroculus_number },
        ],
    ];

    //尘歌壶
    if (recordIndex.homes && recordIndex.homes.length > 0)
        line.push([
            { lable: "家园等级", num: recordIndex.homes[0].level },
            { lable: "最高仙力", num: recordIndex.homes[0].comfort_num },
            { lable: "获得摆设", num: recordIndex.homes[0].item_num },
            { lable: "历史访客", num: recordIndex.homes[0].visit_num },
        ]);

    recordIndex.world_explorations = lodash.orderBy(recordIndex.world_explorations, ["id"], ["desc"]);

    const explor = [];
    for (const val of recordIndex.world_explorations) {
        if (val.id == 7) continue;
        val.name = areaName[val.id] ? areaName[val.id] : lodash.truncate(val.name, { length: 6 });
        const tmp = { name: val.name, line: [{ name: val.name, text: `${val.exploration_percentage / 10}%` }] };
        if (["蒙德", "璃月", "稻妻", "须弥"].includes(val.name)) tmp.line.push({ name: "声望", text: `${val.level}级` });
        if (val.id == 6) {
            const underground = lodash.find(recordIndex.world_explorations, o => o.id == 7);
            if (underground) {
                tmp.line.push({
                    name: areaName[underground.id],
                    text: `${underground.exploration_percentage / 10}%`,
                });
            }
        }
        if (["雪山", "稻妻", "层岩巨渊", "须弥"].includes(val.name)) {
            if (val.offerings[0].name.includes("流明石")) val.offerings[0].name = "流明石";
            if (val.offerings[0].name == '恒那兰那的梦之树') val.offerings[0].name = '梦之树';
            tmp.line.push({ name: val.offerings[0].name, text: `${val.offerings[0].level}级` });
        }
        explor.push(tmp);
    }

    return render({
        app: "roleCardExplore",
        saveId: msg.author.id,
        data: {
            uid,
            line,
            explor,
            bg: lodash.random(1, 6),
            activeDay: recordIndex.stats.active_day_number,
            // abyss: await abyssAll(recordCharacter.avatars, uid, region, cookie), 
            //msg: e.isSelfCookie ? "" : `UID:${uid} 尚未绑定Cookie，展示信息可能不完全`,
        }
    }).then(imgPath => {
        if (imgPath) return msg.sendMsgEx({ imagePath: imgPath });
        else throw "not found imgPath";
    }).catch(err => {
        log.error(err);
    });


}

export async function roleCardTransverse(msg: IMessageGUILD | IMessageDIRECT) {
    const { uid, region, cookie } = await getAuthorConfig(msg.author.id, ["uid", "region", "cookie"]);
    const recordIndex = await miGetRecordIndex(uid, region, cookie);
    if (!recordIndex) return;

    const stats = recordIndex.stats;
    const line: { lable: string, num: number | string }[][] = [[
        { lable: "活跃天数", num: stats.active_day_number },
        { lable: "成就", num: stats.achievement_number },
        { lable: "角色数", num: stats.avatar_number },
        { lable: '等级', num: recordIndex.role.level },
        {
            lable: "总宝箱",
            num: stats.precious_chest_number +
                stats.luxurious_chest_number +
                stats.exquisite_chest_number +
                stats.common_chest_number +
                stats.magic_chest_number,
        },
    ], [
        { lable: "华丽宝箱", num: stats.luxurious_chest_number },
        { lable: "珍贵宝箱", num: stats.precious_chest_number },
        { lable: "精致宝箱", num: stats.exquisite_chest_number },
        { lable: "普通宝箱", num: stats.common_chest_number },
        { lable: "奇馈宝箱", num: stats.magic_chest_number },
    ]];

    const explor1 = [], explor2 = [];
    recordIndex.world_explorations = lodash.orderBy(recordIndex.world_explorations, ["id"], ["desc"]);
    for (const val of recordIndex.world_explorations) {
        val.name = areaName[val.id] ? areaName[val.id] : lodash.truncate(val.name, { length: 6 });
        const tmp = { lable: val.name, num: `${val.exploration_percentage / 10}%` };
        if (explor1.length < 5) explor1.push(tmp);
        else explor2.push(tmp);
    }

    explor2.push(
        { lable: "雷神瞳", num: stats.electroculus_number },
        { lable: "岩神瞳", num: stats.geoculus_number },
        { lable: "风神瞳", num: stats.anemoculus_number }
    );
    line.push(explor1);
    line.push(explor2.slice(0, 5));
    const avatars = recordIndex.avatars.slice(0, 8);

    for (const i in avatars) {
        if (avatars[i].id == 10000005) avatars[i].name = "空";
        if (avatars[i].id == 10000007) avatars[i].name = "荧";
        avatars[i].element = roleToElement(avatars[i].name) || "";
    }

    return render({
        app: "roleCardTransverse",
        saveId: msg.author.id,
        data: {
            uid,
            name: msg.author.username,
            userAvatar: msg.author.avatar,
            line,
            avatars,
            bg: lodash.random(1, 3),
            //msg: e.isSelfCookie ? "" : `UID:${uid} 尚未绑定Cookie，展示信息可能不完全`,
        }
    }).then(imgPath => {
        if (imgPath) return msg.sendMsgEx({ imagePath: imgPath });
        else throw "not found imgPath";
    }).catch(err => {
        log.error(err);
    });


}

export async function roleCardLife(msg: IMessageGUILD | IMessageDIRECT) {
    const { uid, region, cookie } = await getAuthorConfig(msg.author.id, ["uid", "region", "cookie"]);
    const recordCharacter = await miGetRecordCharacters(uid, region, cookie);
    if (!recordCharacter) return;

    const queryStar = /(四|4)/.test(msg.content) ? 4 : (/(五|5)/.test(msg.content) ? 5 : 0);
    const avatars: {
        constellationNum: number,
        star: number,
        name: string,
        skinUrl: string,
        lv: number,
        fetter: number,
        weapon: { name: string, showName: string, lv: number, affixLv: number },
    }[] = [];

    for (const searchAvatar of recordCharacter.avatars)
        if ((queryStar == 0) || (queryStar == searchAvatar.rarity))
            avatars.push({
                constellationNum: searchAvatar.actived_constellation_num,
                star: searchAvatar.rarity,
                name: searchAvatar.name,
                skinUrl: searchAvatar.icon,
                lv: searchAvatar.level,
                fetter: searchAvatar.fetter,
                weapon: {
                    name: searchAvatar.weapon.name,
                    showName: shortName(searchAvatar.weapon.name) || searchAvatar.weapon.name,
                    lv: searchAvatar.weapon.level,
                    affixLv: searchAvatar.weapon.affix_level,
                }
            });

    return render({
        app: "roleCardLife",
        saveId: msg.author.id,
        data: { uid, avatars },
    }).then(imgPath => {
        if (imgPath) return msg.sendMsgEx({ imagePath: imgPath });
        else throw "not found imgPath";
    }).catch(err => {
        log.error(err);
    });

}

export async function roleCardWeapon(msg: IMessageGUILD | IMessageDIRECT) {
    const { uid, region, cookie } = await getAuthorConfig(msg.author.id, ["uid", "region", "cookie"]);
    const recordCharacter = await miGetRecordCharacters(uid, region, cookie);
    if (!recordCharacter) return;

    const weapons: {
        constellationNum: number,
        star: number,
        name: string,
        skinUrl: string,
        lv: number,
        fetter: number,
        weapon: { name: string, showName: string, lv: number, affixLv: number, star: number }
    }[] = [];

    for (const searchAvatar of recordCharacter.avatars)
        weapons.push({
            constellationNum: searchAvatar.actived_constellation_num,
            star: searchAvatar.rarity,
            name: searchAvatar.name,
            skinUrl: searchAvatar.icon,
            lv: searchAvatar.level,
            fetter: searchAvatar.fetter,
            weapon: {
                name: searchAvatar.weapon.name,
                showName: shortName(searchAvatar.weapon.name) || searchAvatar.weapon.name,
                lv: searchAvatar.weapon.level,
                affixLv: searchAvatar.weapon.affix_level,
                star: searchAvatar.weapon.rarity,
            }
        });
    weapons.sort((v1, v2) => v2.weapon.star - v1.weapon.star);

    return render({
        app: "roleCardWeapon",
        saveId: msg.author.id,
        data: { uid, weapons },
    }).then(imgPath => {
        if (imgPath) return msg.sendMsgEx({ imagePath: imgPath });
        else throw "not found imgPath";
    }).catch(err => {
        log.error(err);
    });

}

export async function talentList(msg: IMessageGUILD | IMessageDIRECT) {

    const { uid, region, cookie } = await getAuthorConfig(msg.author.id, ["uid", "region", "cookie"]);
    const recordCharacter = await miGetRecordCharacters(uid, region, cookie);
    if (!recordCharacter) return;

    const searchAvatars: Avatars[] = [];
    const displayMode = /(角色|武器|练度)/.test(msg.content) ? "weapon" : "talent";
    const queryStar = /(四|4)/.test(msg.content) ? 4 : (/(五|5)/.test(msg.content) ? 5 : 0);
    for (const avatar of recordCharacter.avatars)
        if (queryStar == 0 || (avatar.rarity == queryStar)) searchAvatars.push(avatar);

    const avatars: OrganizedAvatar[] = [];
    const avatarPart = lodash.chunk(searchAvatars, 10);
    for (const val of avatarPart) {
        var skillQueue: Promise<OrganizedAvatar>[] = [];
        for (const avatar of val) skillQueue.push(getCharacterInfo(uid, region, cookie, displayMode, avatar));
        var skillRet = await Promise.all(skillQueue);
        avatars.push(...(skillRet.filter(item => item.skill.a >= 0)));
        await sleep(500);
    }

    return render({
        app: "talentList",
        saveId: msg.author.id,
        data: {
            uid,
            avatars,
            displayMode,
            nowWeek: new Date().getDay(),
            bgType: Math.ceil(Math.random() * 3),
            talentNotice: `技能列表每12小时更新一次`,
            //isSelf: e.isSelf,
            //abbr: genshin.abbr,
        },
    }).then(imgPath => {
        if (imgPath) return msg.sendMsgEx({ imagePath: imgPath });
        else throw "not found imgPath";
    }).catch(err => {
        log.error(err);
    });
}


export async function getCharacterInfo(uid: string, server: string, cookie: string, displayMode: "weapon" | "talent", avatar: Avatars): Promise<OrganizedAvatar> {
    const detailRes = await miGetAvatarDetail(uid, server, cookie, avatar);
    const skill = detailRes ? {
        a: detailRes.skill_list[0].level_current,
        e: detailRes.skill_list[1].level_current,
        //e_plus: detailRes.skill_list[1].level_current > detailRes.skill_list[1].level_original,
        q: detailRes.skill_list[2].level_current
    } : { a: -1, e: -1, q: -1 };

    var weapon: { name: string, lv: number, alv: number, star: number, icon: string } | null = null;
    var talent: { week: number, name: string; area: string; act: string[]; } | null = null;
    if (displayMode == "weapon")
        weapon = {
            name: shortName(avatar.weapon.name) || avatar.weapon.name,
            lv: avatar.weapon.level,
            alv: avatar.weapon.affix_level,
            star: avatar.weapon.rarity,
            icon: avatar.weapon.icon
        };
    else if (displayMode == "talent") talent = roleToTalent(avatar.name);

    return {
        star: avatar.rarity,
        name: shortName(avatar.name) || avatar.name,
        icon: avatar.icon,
        lv: avatar.level,
        fetter: avatar.fetter,
        life: avatar.actived_constellation_num,
        skill,
        weapon,
        talent
    };
} 
