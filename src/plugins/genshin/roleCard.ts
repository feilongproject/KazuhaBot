import lodash from "lodash";
import fetch from "node-fetch";
import { getHeaders } from "../components/getHeader";
import { render } from "../components/render";
import { roleToElement, roleToRole, roleToTalent, shortName, weekToTalent } from "../components/roleConver";
import { sleep } from "../system/common";
import { IMessageEx } from "../system/IMessageEx";
import log from "../system/logger";


var areaName = ["", "", "", "雪山", "", "", "层岩巨渊", "层岩地下"];

export async function roleCard1(msg: IMessageEx) {
    const anotherUid = msg.content.match(/[0-9]{1,9}/g);

    const cookie = await global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie");
    const uid = anotherUid ? anotherUid[0] : await global.redis.hGet(`genshin:config:${msg.author.id}`, "uid");
    const region = await global.redis.hGet(`genshin:config:${msg.author.id}`, "region");


    //log.debug(cookie, uid, region);
    if (!cookie || !uid || !region) {
        msg.sendMsgEx({ content: `尚未绑定cookie，无法查询` });
        return true;
    }

    const recordIndex = await getRecordIndex(uid, region, cookie);
    const recordCharacter = await getRecordCharacters(uid, region, cookie);
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
    var homes_level = 0;
    var homes_item = 0;
    if (recordIndex.homes && recordIndex.homes.length > 0) {
        homes_level = recordIndex.homes[0].level;
        homes_item = recordIndex.homes[0].item_num;
    }
    //世界探索
    recordIndex.world_explorations = lodash.orderBy(recordIndex.world_explorations, ["id"], ["desc"]);
    var explor = [], explor2 = [];

    for (const val of recordIndex.world_explorations) {
        val.name = areaName[val.id] ? areaName[val.id] : lodash.truncate(val.name, { length: 6 });
        var tmp = { lable: val.name, num: `${val.exploration_percentage / 10}%` };
        if ([6, 5, 4, 3].includes(val.id)) explor.push(tmp);
        if ([1, 2].includes(val.id)) explor2.push(tmp);
    }
    //强制补上没有的
    if (!lodash.find(explor, (o) => { return o.lable == '渊下宫' })) {
        explor.unshift({ lable: '渊下宫', num: '0%' });
    }
    if (!lodash.find(explor, (o) => { return o.lable == '层岩巨渊' })) {
        explor.unshift({ lable: '层岩巨渊', num: '0%' });
    }
    if (!lodash.find(explor, (o) => { return o.lable == '雪山' })) {
        explor.unshift({ lable: '雪山', num: '0%' });
    }
    explor2 = explor2.concat([
        { lable: "家园等级", num: homes_level.toString() },
        { lable: "获得摆设", num: homes_item.toString() },
    ]);
    line.push(explor);
    line.push(explor2);


    //角色
    /* var avatars = recordIndex.avatars; */
    var avatars: {
        constellationNum: number,
        star: number,
        name: string,
        skin: string,
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
    var i = 0;
    for (const avatar of recordIndex.avatars) {
        ++i;
        var skin = "";
        var weapon = { name: "", showName: "", lv: 0, affixLv: 0, };
        for (const searchAvatar of recordCharacter.avatars) {
            if (searchAvatar.name == avatar.name) {
                //log.debug(searchAvatar.weapon);
                /* if (searchAvatar.costumes.length > 0) skin = "2"; */
                weapon.name = searchAvatar.weapon.name;
                weapon.showName = shortName(weapon.name) || weapon.name;
                weapon.lv = searchAvatar.weapon.level;
                weapon.affixLv = searchAvatar.weapon.affix_level;
                break;
            };
        }
        avatars.push({
            constellationNum: avatar.actived_constellation_num,
            star: avatar.rarity,
            name: avatar.name,
            skin,
            skinUrl: avatar.image,
            lv: avatar.level,
            fetter: avatar.fetter,
            weapon
        });
        if (i == 8) break;
    }

    render({
        app: "genshin",
        type: "roleCard1",
        imgType: "jpeg",
        render: { saveId: msg.author.id },
        data: {
            uid,
            activeDay: recordIndex.stats.active_day_number,
            avatars,
            line,
            /* abyss: await abyssAll(recordCharacter.avatars, uid, region, cookie), */
            bg: lodash.random(1, 6),
            //msg: e.isSelfCookie ? "" : `UID:${uid} 尚未绑定Cookie，展示信息可能不完全`,

        }
    }).then(imgPath => {
        if (imgPath) msg.sendMsgEx({ imagePath: imgPath });
        else {
            throw new Error("not found imgPath");
        }
    }).catch(err => {
        log.error(err);
    });


}

export async function roleCard2(msg: IMessageEx) {
    const cookie = await global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie");
    const uid = await global.redis.hGet(`genshin:config:${msg.author.id}`, "uid");
    const region = await global.redis.hGet(`genshin:config:${msg.author.id}`, "region");
    if (!cookie || !uid || !region) {
        msg.sendMsgEx({ content: `尚未绑定cookie，无法查询` });
        return true;
    }
    const recordIndex = await getRecordIndex(uid, region, cookie);
    if (!recordIndex) return;

    var stats = recordIndex.stats;
    var line = [
        [
            { lable: "成就", num: stats.achievement_number },
            { lable: "角色数", num: stats.avatar_number },
            {
                lable: "总宝箱",
                num: stats.precious_chest_number +
                    stats.luxurious_chest_number +
                    stats.exquisite_chest_number +
                    stats.common_chest_number +
                    stats.magic_chest_number,
            },
            { lable: "深境螺旋", num: stats.spiral_abyss },
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
            { lable: "传送点", num: stats.way_point_number },
        ],
    ];
    //尘歌壶
    if (recordIndex.homes && recordIndex.homes.length > 0) {
        line.push([
            { lable: "家园等级", num: recordIndex.homes[0].level },
            { lable: "最高仙力", num: recordIndex.homes[0].comfort_num },
            { lable: "获得摆设", num: recordIndex.homes[0].item_num },
            { lable: "历史访客", num: recordIndex.homes[0].visit_num },
        ]);
    }

    recordIndex.world_explorations = lodash.orderBy(recordIndex.world_explorations, ["id"], ["desc"]);

    var explor = [];
    for (const val of recordIndex.world_explorations) {
        if (val.id == 7) continue;
        val.name = areaName[val.id] ? areaName[val.id] : lodash.truncate(val.name, { length: 6 });
        var tmp = { name: val.name, line: [{ name: val.name, text: `${val.exploration_percentage / 10}%`, }], };
        if (["蒙德", "璃月", "稻妻", "须弥"].includes(val.name)) tmp.line.push({ name: "声望", text: `${val.level}级`, });
        if (val.id == 6) {
            var underground = lodash.find(recordIndex.world_explorations, function (o) {
                return o.id == 7;
            });
            if (underground) {
                tmp.line.push({
                    name: areaName[underground.id],
                    text: `${underground.exploration_percentage / 10}%`,
                });
            }
        }
        if (["雪山", "稻妻", "层岩巨渊"].includes(val.name)) {
            if (val.offerings[0].name.includes("流明石")) val.offerings[0].name = "流明石";
            tmp.line.push({ name: val.offerings[0].name, text: `${val.offerings[0].level}级`, });
        }
        explor.push(tmp);
    }


    render({
        app: "genshin",
        type: "roleCard2",
        imgType: "jpeg",
        render: { saveId: msg.author.id },
        data: {
            uid,
            activeDay: recordIndex.stats.active_day_number,
            line,
            explor,
            /* abyss: await abyssAll(recordCharacter.avatars, uid, region, cookie), */
            bg: lodash.random(1, 6),
            //msg: e.isSelfCookie ? "" : `UID:${uid} 尚未绑定Cookie，展示信息可能不完全`,
        }
    }).then(imgPath => {
        if (imgPath) msg.sendMsgEx({ imagePath: imgPath });
        else {
            throw new Error("not found imgPath");
        }
    }).catch(err => {
        log.error(err);
    });


}

export async function roleCard3(msg: IMessageEx) {
    const cookie = await global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie");
    const uid = await global.redis.hGet(`genshin:config:${msg.author.id}`, "uid");
    const region = await global.redis.hGet(`genshin:config:${msg.author.id}`, "region");
    if (!cookie || !uid || !region) {
        msg.sendMsgEx({ content: `尚未绑定cookie，无法查询` });
        return true;
    }
    const recordIndex = await getRecordIndex(uid, region, cookie);
    if (!recordIndex) return;

    let stats = recordIndex.stats;
    let line: { lable: string, num: number | string }[][] = [[
        { lable: "活跃天数", num: stats.active_day_number },
        { lable: "成就", num: stats.achievement_number },
        { lable: "角色数", num: stats.avatar_number },
        {
            lable: "总宝箱",
            num: stats.precious_chest_number +
                stats.luxurious_chest_number +
                stats.exquisite_chest_number +
                stats.common_chest_number +
                stats.magic_chest_number,
        },
        { lable: "深境螺旋", num: stats.spiral_abyss },
    ], [
        { lable: "华丽宝箱", num: stats.luxurious_chest_number },
        { lable: "珍贵宝箱", num: stats.precious_chest_number },
        { lable: "精致宝箱", num: stats.exquisite_chest_number },
        { lable: "普通宝箱", num: stats.common_chest_number },
        { lable: "奇馈宝箱", num: stats.magic_chest_number },
    ]];
    var explor1 = [];
    var explor2: { lable: string, num: number | string }[] = [];
    recordIndex.world_explorations = lodash.orderBy(recordIndex.world_explorations, ["id"], ["desc"]);
    for (const val of recordIndex.world_explorations) {
        val.name = areaName[val.id] ? areaName[val.id] : lodash.truncate(val.name, { length: 6 });
        var tmp = { lable: val.name, num: `${val.exploration_percentage / 10}%` };
        if (explor1.length < 5) explor1.push(tmp);
        else explor2.push(tmp);
    }
    explor2 = explor2.concat([
        { lable: "雷神瞳", num: stats.electroculus_number },
        { lable: "岩神瞳", num: stats.geoculus_number },
        { lable: "风神瞳", num: stats.anemoculus_number },
    ]);
    line.push(explor1);
    line.push(explor2.slice(0, 5));
    var avatars = recordIndex.avatars;
    avatars = avatars.slice(0, 8);
    for (const i in avatars) {
        if (avatars[i].id == 10000005) avatars[i].name = "空";
        if (avatars[i].id == 10000007) avatars[i].name = "荧";
        avatars[i].element = roleToElement(avatars[i].name) || "";
    }

    render({
        app: "genshin",
        type: "roleCard3",
        imgType: "jpeg",
        render: { saveId: msg.author.id },
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
        if (imgPath) msg.sendMsgEx({ imagePath: imgPath });
        else {
            throw new Error("not found imgPath");
        }
    }).catch(err => {
        log.error(err);
    });


}

export async function roleCardLife(msg: IMessageEx) {
    const cookie = await global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie");
    const uid = await global.redis.hGet(`genshin:config:${msg.author.id}`, "uid");
    const region = await global.redis.hGet(`genshin:config:${msg.author.id}`, "region");
    const queryStar = /(四|4)/.test(msg.content) ? 4 : (/(五|5)/.test(msg.content) ? 5 : 0);
    if (!cookie || !uid || !region) {
        msg.sendMsgEx({ content: `尚未绑定cookie，无法查询` });
        return true;
    }
    const recordCharacter = await getRecordCharacters(uid, region, cookie);
    if (!recordCharacter) return;

    var avatars: {
        constellationNum: number,
        star: number,
        name: string,
        skinUrl: string,
        lv: number,
        fetter: number,
        weapon: { name: string, showName: string, lv: number, affixLv: number }
    }[] = [];

    for (const searchAvatar of recordCharacter.avatars) {
        if (queryStar == 0 || (queryStar == searchAvatar.rarity))
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
    }

    render({
        app: "genshin",
        type: "roleCardLife",
        imgType: "jpeg",
        render: { saveId: msg.author.id },
        data: {
            uid,
            avatars,
        }
    }).then(imgPath => {
        if (imgPath) msg.sendMsgEx({ imagePath: imgPath });
        else {
            throw new Error("not found imgPath");
        }
    }).catch(err => {
        log.error(err);
    });

}

export async function roleCardWeapon(msg: IMessageEx) {
    const cookie = await global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie");
    const uid = await global.redis.hGet(`genshin:config:${msg.author.id}`, "uid");
    const region = await global.redis.hGet(`genshin:config:${msg.author.id}`, "region");
    if (!cookie || !uid || !region) {
        msg.sendMsgEx({ content: `尚未绑定cookie，无法查询` });
        return true;
    }
    const recordCharacter = await getRecordCharacters(uid, region, cookie);
    if (!recordCharacter) return;

    var weapons: {
        constellationNum: number,
        star: number,
        name: string,
        skinUrl: string,
        lv: number,
        fetter: number,
        weapon: { name: string, showName: string, lv: number, affixLv: number, star: number }
    }[] = [];

    for (const searchAvatar of recordCharacter.avatars) {

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
    }

    weapons = weapons.sort((v1, v2) => { return v2.weapon.star - v1.weapon.star });
    render({
        app: "genshin",
        type: "roleCardWeapon",
        imgType: "jpeg",
        render: { saveId: msg.author.id },
        data: {
            uid,
            weapons,
        }
    }).then(imgPath => {
        if (imgPath) msg.sendMsgEx({ imagePath: imgPath });
        else {
            throw new Error("not found imgPath");
        }
    }).catch(err => {
        log.error(err);
    });

}

export async function talentList(msg: IMessageEx) {

    const cookie = await global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie");
    const uid = await global.redis.hGet(`genshin:config:${msg.author.id}`, "uid");
    const region = await global.redis.hGet(`genshin:config:${msg.author.id}`, "region");
    const displayMode = /(角色|武器|练度)/.test(msg.content) ? "weapon" : "talent";
    const queryStar = /(四|4)/.test(msg.content) ? 4 : (/(五|5)/.test(msg.content) ? 5 : 0);
    if (!cookie || !uid || !region) {
        msg.sendMsgEx({ content: `尚未绑定cookie，无法查询` });
        return true;
    }



    const recordCharacter: RecordCharactersData | null = await getRecordCharacters(uid, region, cookie);
    if (!recordCharacter) return;

    const searchAvatars: Avatars[] = [];
    for (const avatar of recordCharacter.avatars) {
        if (queryStar == 0 || (avatar.rarity == queryStar)) searchAvatars.push(avatar);
    }

    const avatars: OrganizedAvatar[] = [];
    const avatarPart = lodash.chunk(searchAvatars, 10);
    for (const val of avatarPart) {
        var skillQueue: Promise<OrganizedAvatar>[] = [];
        for (const avatar of val) skillQueue.push(getCharacterInfo(uid, region, cookie, displayMode, avatar));
        var skillRet = await Promise.all(skillQueue);
        avatars.push(...(skillRet.filter(item => item.skill.a >= 0)));
        await sleep(500);
    }

    render({
        app: "genshin",
        type: "talentList",
        imgType: "jpeg",
        render: { saveId: msg.author.id },
        data: {
            uid,
            avatars,
            bgType: Math.ceil(Math.random() * 3),
            //abbr: genshin.abbr,
            displayMode,
            //isSelf: e.isSelf,
            nowWeek: new Date().getDay(),
            talentNotice: `技能列表每12小时更新一次`,
        },
    }).then(imgPath => {
        if (imgPath) msg.sendMsgEx({ imagePath: imgPath });
        else {
            throw new Error("not found imgPath");
        }
    }).catch(err => {
        log.error(err);
    });




}

export async function todayQuery(msg: IMessageEx) {

    const uid = await global.redis.hGet(`genshin:config:${msg.author.id}`, "uid");
    const region = await global.redis.hGet(`genshin:config:${msg.author.id}`, "region");
    const cookie = await global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie");
    if (!region || !uid || !cookie) return;

    let res = await getRecordCharacters(uid, region, cookie);
    if (!res) return true;

    const avatars = res.avatars;

    var week = new Date().getDay() || 7;
    if (new Date().getHours() < 4) week--;

    if (week == 0 || week == 7) {
        msg.sendMsgEx({ content: "今日全部素材都可以刷" });
        return true;
    }

    const todayTalent = weekToTalent(week);

    var todayData: {
        area: string,
        material: { name: string; }
        roles?: { lv: number, icon: string; star: number; life: number; }[]
        weapons?: { lv: number, icon: string; star: number; life: number; avatarIcon: string }[]
    }[] = [];

    for (const role of todayTalent.role) {
        var _avtars: { lv: number, icon: string; star: number; life: number; }[] = [];

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
        var _weapons: { lv: number, icon: string; star: number; life: number; avatarIcon: string }[] = [];
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
    //log.debug(todayData);

    render({
        app: "genshin",
        type: "today",
        imgType: "jpeg",
        render: { saveId: msg.author.id },
        data: {
            uid,
            todayData,
        }
    }).then(imgPath => {
        if (imgPath) msg.sendMsgEx({ imagePath: imgPath });
        else {
            throw new Error("not found imgPath");
        }
    }).catch(err => {
        log.error(err);
    });


    return true; //事件结束不再往下
}

async function getCharacterInfo(uid: string, server: string, cookie: string, displayMode: "weapon" | "talent", avatar: Avatars): Promise<OrganizedAvatar> {
    var detailRes: AvatarDetailData | null;
    const cacheCharacterInfo = await cache("r", `cache:talent:${uid}`, `avatar:${avatar.id}`);
    if (cacheCharacterInfo) detailRes = JSON.parse(cacheCharacterInfo);
    else {
        const headers = getHeaders(`uid=${uid}&region=${server}&avatar_id=${avatar.id}`) as any;
        headers.Cookie = cookie;
        detailRes = await fetch(`https://api-takumi.mihoyo.com/event/e20200928calculate/v1/sync/avatar/detail?` +
            `uid=${uid}&region=${server}&avatar_id=${avatar.id}`, {
            method: "GET", headers
        }).then(res => {
            return res.json();
        }).then((json: MihoyoAPI<AvatarDetailData>) => {
            //log.debug(json);
            if (json.data) {
                cache("w", `cache:talent:${uid}`, `avatar:${avatar.id}`, JSON.stringify(json.data));
                return json.data;
            }
            else throw json;
        }).catch(err => {
            log.error(err);
            return null;
        });
    }

    const skill = detailRes ? {
        a: detailRes.skill_list[0].level_current,
        e: detailRes.skill_list[1].level_current,
        //e_plus: detailRes.skill_list[1].level_current > detailRes.skill_list[1].level_original,
        q: detailRes.skill_list[2].level_current
    } : { a: -1, e: -1, q: -1 };

    var weapon: {
        name: string,
        lv: number,
        alv: number,
        star: number,
        icon: string,
    } | null = null;
    var talent: { week: number, name: string; area: string; act: string[]; } | null = null;
    if (displayMode == "weapon") {
        weapon = {
            name: shortName(avatar.weapon.name) || avatar.weapon.name,
            lv: avatar.weapon.level,
            alv: avatar.weapon.affix_level,
            star: avatar.weapon.rarity,
            icon: avatar.weapon.icon
        }
    } else if (displayMode == "talent") {
        talent = roleToTalent(avatar.name);
    }

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

/* async function abyssAll(roleArr: Avatars[], uid: string, server: string, cookie: string) {


    const headers = getHeaders(`role_id=${uid}&schedule_type=1&server=${server}`) as any;
    headers.Cookie = cookie;

    const resAbyss = await fetch(`https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/spiralAbyss?` +
        `role_id=${uid}&schedule_type=1&server=${server}`, {
        headers
    }).then(res => {
        return res.json();
    }).then((json: MihoyoAPI<AbyssData>) => {
        return json.data;
        //log.debug(json);
    });

    var abyss = {};

    if (roleArr.length <= 0) { return abyss; }
    if (resAbyss.total_battle_times <= 0) { return abyss; }
    if (resAbyss.reveal_rank.length <= 0) { return abyss; }
    //打了三层才放出来
    if (resAbyss.floors.length <= 2) { return abyss; }

    var start_time = new Date(parseInt(resAbyss.start_time) * 1000);
    var time = (start_time.getMonth() + 1).toString();
    if (start_time.getDate() >= 15) { time = time + "月下"; }
    else { time = time + "月上"; }

    var total_star: number | string = 0;
    var star = [];
    for (var val of resAbyss.floors) {
        if (val.index < 9) continue;
        total_star += val.star;
        star.push(val.star);
    }
    total_star = total_star + "（" + star.join("-") + "）";

    var dataName = ["damage", "take_damage", "defeat", "normal_skill", "energy_skill"];
    var data: any = [];
    var tmpRole:any = [];
    for (const val of dataName) {
        if (resAbyss[`${val}_rank`].length <= 0) {
            resAbyss[`${val}_rank`] = [
                {
                    value: 0,
                    avatar_id: 10000007,
                },
            ];
        }
        data[val] = {
            num: resAbyss[`${val}_rank`][0].value,
            name: roleIdToName(resAbyss[`${val}_rank`][0].avatar_id, true),
        };

        if (data[val].num > 1000) {
            data[val].num = (data[val].num / 10000).toFixed(1);
            data[val].num += " w";
        }

        if (tmpRole.length < 4 && !tmpRole.includes(resAbyss[`${val}_rank`][0].avatar_id)) {
            tmpRole.push(resAbyss[`${val}_rank`][0].avatar_id);
        }
    }

    var list = [];

    var avatar = lodash.keyBy(roleArr, "id");

    for (var val of resAbyss.reveal_rank) {
        if (avatar[val.avatar_id]) {
            val.life = avatar[val.avatar_id].actived_constellation_num;
        } else {
            val.life = 0;
        }
        val.name = roleToRole(val.avatar_id);
        list.push(val);
    }

    return {
        time,
        max_floor: resAbyss.max_floor,
        total_star,
        list,
        total_battle_times: resAbyss.total_battle_times,
        ...data,
    };
} */



async function getRecordIndex(uid: string, region: string, cookie: string): Promise<RecordIndexData | null> {
    const cacheIndex = await cache("r", `cache:talent:${uid}`, "index");
    if (cacheIndex) return JSON.parse(cacheIndex);

    const headers = getHeaders(`role_id=${uid}&server=${region}`) as any;
    headers.Cookie = cookie;
    return fetch(`https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/index?role_id=${uid}&server=${region}`, {
        method: "GET",
        headers
    }).then(res => {
        return res.json();
        //return res.json();
    }).then((json: MihoyoAPI<RecordIndexData>) => {
        if (json.retcode == 0) {
            cache("w", `cache:talent:${uid}`, "index", JSON.stringify(json.data));
            return json.data;
        }
        else throw json;
    }).catch(err => {
        log.error(err);
        return null;
    });
}

async function getRecordCharacters(uid: string, region: string, cookie: string): Promise<RecordCharactersData | null> {
    const cacheCharacters = await cache("r", `cache:talent:${uid}`, `characters`);
    if (cacheCharacters) return JSON.parse(cacheCharacters);

    const headers = getHeaders(``, `{"role_id":"${uid}","server":"${region}"}`) as any;
    headers.Cookie = cookie;
    return fetch(`https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/character`, {
        method: "POST",
        body: `{"role_id":"${uid}","server":"${region}"}`,
        headers
    }).then(res => {
        return res.json();
        //return res.json();
    }).then((json: MihoyoAPI<RecordCharactersData>) => {
        //log.debug(json);
        if (json.retcode == 0) {
            cache("w", `cache:talent:${uid}`, "characters", JSON.stringify(json.data));
            return json.data;
        }
        else throw json;
    }).catch(err => {
        log.error(err);
        return null;
    });
}

async function cache(type: "r" | "w", key: string, field: string, data?: string) {
    if (type == "r") {
        // const value = ;
        // if (value) return value;
        return await global.redis.hGet(key, field) || null;
    };
    if (type == "w") {
        global.redis.hSet(key, field, data!);
        global.redis.expire(key, 3600 * 12);
    }
    return null;
}

interface OrganizedAvatar {
    star: number;
    name: string;
    icon: string;
    lv: number;
    fetter: number;
    life: number;
    skill: {
        a: number;
        e: number;
        q: number;
    };
    weapon: { name: string, lv: number, alv: number; star: number, icon: string, } | null;
    talent: { week: number, name: string; area: string; act: string[]; } | null;
}

interface AvatarDetailData {
    skill_list: {
        id: number;
        group_id: number;
        name: string;
        icon: string;
        max_level: number;
        level_current: number;
    }[];
    weapon: {
        id: number;
        name: string;
        icon: string;
        weapon_cat_id: number;
        weapon_level: number;
        max_level: number;
        level_current: number;
    };
    reliquary_list: {
        id: number;
        name: string;
        icon: string;
        reliquary_cat_id: number;
        reliquary_level: number;
        level_current: number;
        max_level: number;
    }[];
}

interface RecordIndexData {
    role: {
        AvatarUrl: string;
        nickname: string;
        region: string;
        level: number;
    };
    avatars: {
        id: number;
        image: string;
        name: string;
        element: string;
        fetter: number;
        level: number;
        rarity: number;
        actived_constellation_num: number;
        card_image: string;
        is_chosen: boolean;
    }[];
    stats: {
        active_day_number: number;
        achievement_number: number;
        anemoculus_number: number;
        geoculus_number: number;
        avatar_number: number;
        way_point_number: number;
        domain_number: number;
        spiral_abyss: string;
        precious_chest_number: number;
        luxurious_chest_number: number;
        exquisite_chest_number: number;
        common_chest_number: number;
        electroculus_number: number;
        magic_chest_number: number;
    };
    city_explorations: any[];
    world_explorations: {
        level: number;
        exploration_percentage: number;
        icon: string;
        name: string;
        type: string;
        offerings: {
            name: string;
            level: number;
            icon: string;
        }[];
        id: number;
        parent_id: number;
        map_url: string;
        strategy_url: string;
        background_image: string;
        inner_icon: string;
        cover: string;
    }[];
    homes: {
        level: number;
        visit_num: number;
        comfort_num: number;
        item_num: number;
        name: string;
        icon: string;
        comfort_level_name: string;
        comfort_level_icon: string;
    }[];
}

interface RecordCharactersData {
    avatars: Avatars[];
    role: {
        AvatarUrl: string;
        nickname: string;
        region: string;
        level: number;
    };
};

interface Avatars {
    id: number;
    image: string;
    icon: string;
    name: string;
    element: string;
    fetter: number;
    level: number;
    rarity: number;
    weapon: {
        id: number;
        name: string;
        icon: string;
        type: number;
        rarity: number;
        level: number;
        promote_level: number;
        type_name: string;
        desc: string;
        affix_level: number;
    };
    reliquaries: {
        id: number;
        name: string;
        icon: string;
        pos: number;
        rarity: number;
        level: number;
        set: {
            id: number;
            name: string;
            affixes: {
                activation_number: number;
                effect: string;
            }[];
        };
        pos_name: string;
    }[];
    constellations: {
        id: number;
        name: string;
        icon: string;
        effect: string;
        is_actived: boolean;
        pos: number;
    }[];
    actived_constellation_num: number;
    costumes: {
        id: number;
        name: string;
        icon: string;
    }[];
    external?: any;
}

interface AbyssData {
    schedule_id: number;
    start_time: string;
    end_time: string;
    total_battle_times: number;
    total_win_times: number;
    max_floor: string;
    reveal_rank: any[];
    defeat_rank: any[];
    damage_rank: any[];
    take_damage_rank: any[];
    normal_skill_rank: any[];
    energy_skill_rank: any[];
    floors: any[];
    total_star: number;
    is_unlock: boolean;
}


