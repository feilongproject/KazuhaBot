import lodash from "lodash";
import fetch from "node-fetch";
import moment from 'moment';
import log from "../lib/logger";
import { IMessageEx } from "../lib/IMessageEx";
import { cacheJson, Format } from "../lib/common";
import { render } from "../lib/render";
import { idToRole, roleToId } from "./roleConver";
import { getCharacterInfo } from "./components/data/getCharacter";
import { calcData } from "./components/calc/dmgCalculator";
import { attrMap, getArtis, getCharCfg } from "./components/calc/artifactsCalculator";
import { AvatarMetaInfo, EquipList, GameInfoData } from "../types/gameInfoData";
import roles from "../../data/role.json";
import hashMap from "../../data/meta/hashMap.json";
import artifactsMap from "../../data/meta/artifactsMap.json";

moment.locale('zh-cn');
const FIGHT_PROP_Map: { [id: string]: string } = {
    FIGHT_PROP_HP: '小生命',
    FIGHT_PROP_HP_PERCENT: '大生命',
    FIGHT_PROP_ATTACK: '小攻击',
    FIGHT_PROP_ATTACK_PERCENT: '大攻击',
    FIGHT_PROP_DEFENSE: '小防御',
    FIGHT_PROP_DEFENSE_PERCENT: '大防御',
    FIGHT_PROP_FIRE_ADD_HURT: '火元素伤害加成',
    FIGHT_PROP_ICE_ADD_HURT: '冰元素伤害加成',
    FIGHT_PROP_ROCK_ADD_HURT: '岩元素伤害加成',
    FIGHT_PROP_ELEC_ADD_HURT: '雷元素伤害加成',
    FIGHT_PROP_WIND_ADD_HURT: '风元素伤害加成',
    FIGHT_PROP_WATER_ADD_HURT: '水元素伤害加成',
    FIGHT_PROP_PHYSICAL_ADD_HURT: '物理伤害加成',
    FIGHT_PROP_HEAL_ADD: '治疗加成',
    FIGHT_PROP_ELEMENT_MASTERY: '元素精通',
    FIGHT_PROP_CRITICAL: '暴击率',
    FIGHT_PROP_CRITICAL_HURT: '暴击伤害',
    FIGHT_PROP_CHARGE_EFFICIENCY: '充能效率'
}
const artifactsIdx: { [id: string]: number } = {
    EQUIP_BRACER: 1,
    EQUIP_NECKLACE: 2,
    EQUIP_SHOES: 3,
    EQUIP_RING: 4,
    EQUIP_DRESS: 5,
}

lodash.forEach(artifactsMap, (ds) => {
    (artifactsMap as ArtifactsMap)[ds.name] = ds;
});

export async function dashboardHandle(msg: IMessageEx): Promise<boolean> {


    if (msg.content.includes("帮助")) {
        msg.sendMsgEx({ imagePath: `${global._path}/resources/dashboard/help.jpg` })
        return true;
    }

    const regEnemyLv = /^#(敌人|怪物)等级(\d{1,3})$/.exec(msg.content);
    if (regEnemyLv && regEnemyLv[2]) {
        await global.redis.hSet(`genshin:config:${msg.author.id}`, "enemyLv", regEnemyLv[2]);
        const lv = await global.redis.hGet(`genshin:config:${msg.author.id}`, "enemyLv") || "91";
        msg.sendMsgEx({ content: `敌人等级已经设置为${lv}` });
        return true;
    }

    var dmgIdx = 0;
    var mode = "";
    const uid = await global.redis.hGet(`genshin:config:${msg.author.id}`, "uid");
    if (!uid) {
        msg.sendMsgEx({ content: `未找到uid，请绑定cookie!` });
        return true;
    }
    const _reg = /^#(更新|录入)?(.*)(详细|详情|面板|面版|圣遗物|伤害[1-7]?)(更新)?$/.exec(msg.content.trim().split(" ")[0]);
    const _roleName = _reg ? _reg[2] : '';
    const roleId = roleToId(_roleName);

    if (msg.content.includes("更新")) {
        const data = await getUidData(uid, true);
        if (data && data.playerInfo.showAvatarInfoList.length > 0) msg.sendMsgEx({
            content: `获取角色面板数据成功！` +
                `\n本次获取成功角色：${sumAllAvatars(data).map((value) => value.name[0]).join("，")}` +
                `\n你可以使用 #角色名+面板 来查看详细角色面板属性了。`
        });
        else msg.sendMsgEx({ content: `本次更新未获取到任何角色数据，请打开游戏内角色展柜的【显示详情】后，等待5分钟重新获取面板` });
        return true;
    }

    const data = await getUidData(uid);
    if (!data || !data.avatarInfoList || data.avatarInfoList.length == 0) {
        msg.sendMsgEx({
            content: `尚未获取任何角色数据，请打开游戏内角色展柜的【显示详情】后，等待5分钟重新获取面板`,
            imagePath: `${global._path}/resources/dashboard/help.jpg`,
        });
        return true;
    }
    if (_roleName == '') {
        msg.sendMsgEx({
            content: `uid${uid} 已获取面板角色：${sumAllAvatars(data).map((value) => value.name[0]).join("，")}`
        });
        return true;
    }
    if (!roleId) {
        msg.sendMsgEx({ content: `未找到${_roleName}所对应角色，请更换名称后重试！` });
        return true;
    }

    var finalAvatar: AvatarMetaInfo | null = null;
    for (const avatar of data.avatarInfoList) {
        if (avatar.avatarId == roleId) {
            finalAvatar = avatar;
            break;
        }
    }
    if (!finalAvatar) {
        msg.sendMsgEx({ content: `请确认${_roleName}已展示在【游戏内】的角色展柜中，并打开了“显示角色详情”。然后请使用 #更新面板 命令来获取${_roleName}的面板详情` });
        return true;
    }


    if (/录入/.test(msg.content)) {
        mode = "input";
    } else if (/圣遗物/.test(msg.content)) {
        mode = "artis";
    } else if (/伤害(\d?)$/.test(msg.content)) {
        mode = "dmg";
        const reg = /伤害(\d?)$/.exec(msg.content);
        dmgIdx = reg ? parseInt(reg[1]) : dmgIdx;
    } else if (/(详细|详情|面板|面版)/.test(msg.content)) {
        mode = "profile";
    }


    if (mode === 'profile' || mode === 'dmg') {
        dashboardInfo(msg, { uid, roleId, data, finalAvatar, mode, dmgIdx, });
        return true;
    } else if (/* mode === 'refresh' || */ mode == 'input') {
        inputProfile(msg, { data, uid, roleId });
        return true;
    } else if (mode === 'artis') {
        profileArtis(msg, { finalAvatar, uid });
        return true;
    }
    return false;
}

async function inputProfile(msg: IMessageEx, opt: { data: GameInfoData; uid: string, roleId: number }) {
    const content = msg.content.replaceAll("爆", "暴");
    const { data, uid, roleId } = opt;
    const hitMap: { [key: string]: RegExp } = {
        hp: /(生命)(\d+)[\+＋](\d+)/,
        atk: /(攻击)(\d+)[\+＋]?(\d+)?/,
        def: /(防御)(\d+)[\+＋]?(\d+)?/,
        mastery: /(精通)(\d+)/,
        cRate: /(暴击率|暴率|暴击)(\d+)/,
        cDmg: /(暴伤|暴击伤害)(\d+)/,
        hInc: /(治疗)(\d+)/,
        reCharge: /(充能)(\d+)/,
        dmgBonus: /([火水雷草风岩冰素]伤|元素伤害)(\d+)/,
        phyBonus: /(物理|物伤)(\d+)/,
    }
    for (const [iv, finalAvatar] of data.avatarInfoList.entries()) {
        if (finalAvatar.avatarId != roleId) continue;
        const prop = finalAvatar.fightPropMap;
        for (const key in hitMap) {
            const reg = hitMap[key];
            const hit = reg.exec(content);
            if (!hit) continue;
            switch (key) {
                case "hp":
                    prop[1] = parseInt(hit[2]);
                    prop[2000] = parseInt(hit[3]) + prop[1];
                    break;
                case "atk":
                    prop[4] = parseInt(hit[2]);
                    prop[6] = 0;
                    prop[5] = parseInt(hit[3]);
                    break;
                case "def":
                    prop[7] = parseInt(hit[2]);
                    prop[2002] = parseInt(hit[3]) + prop[7];
                    break;
                case "mastery":
                    prop[28] = parseInt(hit[2]);
                    break;
                case "cRate":
                    prop[20] = parseInt(hit[2]) / 100;
                    break;
                case "cDmg":
                    prop[22] = parseInt(hit[2]) / 100;
                    break;
                case "reCharge":
                    prop[23] = parseInt(hit[2]) / 100;
                    break;
                case "hInc":
                    prop[26] = parseInt(hit[2]) / 100;
                    break;
                case "dmgBonus":
                    for (const key of [40, 41, 42, 43, 44, 45, 45, 46])
                        prop[key] = parseInt(hit[2]) / 100;
                    break;
                case "phyBonus":
                    prop[30] = parseInt(hit[2]) / 100;
                    break;
            }

        }
        data.avatarInfoList[iv].fightPropMap = prop;
        data.avatarInfoList[iv].dataSource = "input";
        break;
    }
    cacheJson("w", `gameData_${uid}`, data);
    msg.sendMsgEx({
        content: "夜兰信息手工录入完成，你可以使用 #角色名+面板 / #角色名+伤害 来查看详细角色面板属性了",
    });
}

export async function profileArtis(msg: IMessageEx, opt: { uid: string, finalAvatar: AvatarMetaInfo; }) {
    const { finalAvatar, uid } = opt;
    const profile = analyzeMain(finalAvatar);
    if (!profile) return;
    const char = getCharacterInfo(profile.role.name);
    if (!char) return;
    const charCfg = getCharCfg(profile.role.name);
    const { artis, totalMark, totalMarkClass, usefulMark } = getArtis(profile.role.name, profile.artifacts);
    if (!profile.artifacts || profile.artifacts.length === 0) {
        msg.sendMsgEx({ content: '未能获得圣遗物详情，请重新获取面板信息后查看' });
        return true;
    }

    render({
        app: "dashboard",
        type: "artisMark",
        imgType: "jpeg",
        render: { saveId: msg.author.id, },
        data: {
            elemLayout: `${global._path}/resources/dashboard/common/elem.html`,
            bodyClass: `char-${profile.role.name}`,
            sys: {
                scale: 1.3,
                copyright: `Created By Yunzai-Bot<span class="version">aaaaa</span> & Miao-Plugin<span class="version">bbbbb</span>`
            },
            uid,
            elem: char.elem,
            data: profile,
            artis,
            totalMark,
            totalMarkClass,
            usefulMark,
            attrMap,
            charCfg
        }
    }).then(picPath => {
        if (typeof picPath == "string")
            msg.sendMsgEx({ imagePath: picPath });
    }).catch(err => {
        log.error(err);
    });

}

async function dashboardInfo(msg: IMessageEx, opt: { uid: string; roleId: number; data: GameInfoData; finalAvatar: AvatarMetaInfo; mode: string; dmgIdx: number; }) {
    const { uid, roleId, data, finalAvatar, mode, dmgIdx } = opt;
    const profile = analyzeMain(finalAvatar);
    const a = profile.role.attr;
    const c = Format.comma;
    const p = Format.pct;
    const attr = {
        hp: c(a.hpTotal),
        hpPlus: c(a.hpTotal - a.hpBase),
        atk: c(a.atkTotal),
        atkPlus: c(a.atkTotal - a.atkBase),
        def: c(a.defTotal),
        defPlus: c(a.defTotal - a.defBase),
        cRate: p(a.cRate),
        cDmg: p(a.cDmg),
        mastery: c(a.mastery),
        reCharge: p(a.reCharge),
        dmgBonus: p(Math.max(a.dmgBonus * 1 || 0, a.phyBonus * 1 || 0)),
    }

    const { artis, totalMark, totalMarkClass, usefulMark } = getArtis(profile.role.name, profile.artifacts);
    //log.debug(artis, totalMark, totalMarkClass, usefulMark);

    const char = getCharacterInfo(profile.role.name);
    const enemyLv = await global.redis.hGet(`genshin:config:${msg.author.id}`, "enemyLv") || "91";
    const dmgMsg: string[] = [];
    const dmgData: any[] = [];
    const dmgCalc = await calcData(
        profile,
        char,
        parseInt(enemyLv),
        mode,
        dmgIdx
    );
    //log.debug(dmgCalc);
    if (dmgCalc && dmgCalc.ret) {
        //log.debug(dmgCalc);
        lodash.forEach(dmgCalc.ret, (ds) => {
            ds.dmg = Format.comma(ds.dmg, 0);
            ds.avg = Format.comma(ds.avg, 0);
            dmgData.push(ds);
        });
        lodash.forEach(dmgCalc.msg, (msg) => {
            msg.replace(':', '：');
            dmgMsg.push(msg.split('：'));
        });
    }

    if (dmgCalc && mode === 'dmg') {
        const basic = dmgCalc.dmgCfg.basicRet;
        lodash.forEach(dmgCalc.dmgRet, (row) => {
            lodash.forEach(row, (ds: any) => {
                ds.val = (ds.avg > basic.avg ? '+' : '') + Format.comma(ds.avg - basic.avg);
                ds.dmg = Format.comma(ds.dmg, 0);
                ds.avg = Format.comma(ds.avg, 0);
            })
        })
        basic.dmg = Format.comma(basic.dmg);
        basic.avg = Format.comma(basic.avg);
    }
    //log.debug(dmgData);
    render({
        app: "dashboard",
        type: "profile",
        imgType: "jpeg",
        render: { saveId: msg.author.id, },
        data: {
            mode,
            elemLayout: `${global._path}/resources/dashboard/common/elem.html`,
            bodyClass: `char-${profile.role.name}`,
            sys: {
                scale: 1.6,
                copyright: `Created By Yunzai-Bot<span class="version">aaaaa</span> & Miao-Plugin<span class="version">bbbbb</span>`
            },
            dataSource: finalAvatar.dataSource,
            uid,
            elem: char.elem,
            playerInfo: data.playerInfo,
            attr,
            ...profile,
            artis,
            totalMark: c(totalMark, 1),
            totalMarkClass,
            usefulMark,
            dmgData,
            enemyLv,
            enemyName: dmgCalc ? (dmgCalc.enemyName || '小宝') : '小宝',
            dmgRet: dmgCalc ? dmgCalc.dmgRet : undefined,
            dmgCfg: dmgCalc ? dmgCalc.dmgCfg : undefined,
            dmgMsg
        }
    }).then(picPath => {
        if (typeof picPath == "string")
            msg.sendMsgEx({ imagePath: picPath });
    }).catch(err => {
        log.error(err);
    });
}

function analyzeMain(data: AvatarMetaInfo): AnalyzeMain {

    return {
        role: analyzeRole(data),
        artifacts: analyzeArtifacts(data.equipList),
        weapon: analyzeWeapon(data.equipList),
        /*
        talent: Data.getTalent(char.id, data.skillLevelMap, data.proudSkillExtraLevelMap || {}) */
    }
}

function analyzeRole(data: AvatarMetaInfo): AnalyzeRole {

    var dmgBonus = 0;
    // 火40  水42 风44 岩45 冰46 雷46
    // 41 雷
    for (const key of [40, 41, 42, 43, 44, 45, 45, 46]) {
        dmgBonus = Math.max(data.fightPropMap[key], dmgBonus);
    }

    const talentMap: { [key: string]: number; } = {};
    const _map = ["a", "e", "q"];
    var iv = 0;
    lodash.forEach(data.skillLevelMap, (level, id) => {
        talentMap[_map[iv++]] = level;
    });
    //log.debug(talentMap);
    const attr = {
        hpBase: data.fightPropMap[1],//基础生命值
        hpTotal: data.fightPropMap[2000],//总生命值
        atkBase: data.fightPropMap[4],//基础攻击值
        atkTotal: data.fightPropMap[4] * (1 + data.fightPropMap[6]) + data.fightPropMap[5],//总攻击值
        defBase: data.fightPropMap[7],//基础防御值
        defTotal: data.fightPropMap[2002],//总防御值
        mastery: data.fightPropMap[28],//元素精通
        cRate: data.fightPropMap[20] * 100,//暴击率
        cDmg: data.fightPropMap[22] * 100,//暴击伤害
        reCharge: data.fightPropMap[23] * 100,//充能
        hInc: data.fightPropMap[26] * 100,
        dmgBonus: dmgBonus * 100,
        phyBonus: data.fightPropMap[30] * 100,
        _fix: false,
    }

    return {
        id: data.avatarId,
        name: idToRole(data.avatarId)!,
        lv: data.propMap[4001].val,
        //now: moment().format('YYYY-MM-DD HH:mm:ss'),
        fetter: data.fetterInfo.expLevel,
        life: data.talentIdList?.length || 0,
        maxLife: [1, 2, 3, 4, 5, 6],
        attr: analyzeDataFix(attr, data.avatarId),
        talentMap,
    }
}

function analyzeArtifacts(data: EquipList[]): AnalyzeArtifact[] {
    const artifacts: AnalyzeArtifact[] = [];
    for (const item of data) {
        if (item.flat.itemType != "ITEM_RELIQUARY") continue;
        if (!item.flat.setNameTextMapHash || !item.flat.reliquarySubstats || !item.flat.reliquaryMainstat) continue;
        //log.debug(item);
        const subStat: ArtifactStat[] = [];
        for (const sub of item.flat.reliquarySubstats) {
            subStat.push({
                id: FIGHT_PROP_Map[sub.appendPropId] || sub.appendPropId,
                value: sub.statValue,
            });
        }

        const setName = (hashMap as { [setId: string]: string })[item.flat.setNameTextMapHash];
        const artifactsName = (artifactsMap as ArtifactsMap)[setName].sets[`arti${artifactsIdx[item.flat.equipType!]}`];

        artifacts.push({
            name: artifactsName.name,
            level: item.reliquary?.level ? (item.reliquary?.level - 1) : -1,
            setName: setName,
            mainStat: {
                id: FIGHT_PROP_Map[item.flat.reliquaryMainstat.mainPropId],
                value: item.flat.reliquaryMainstat.statValue,
            },
            subStat
        });
    }
    //log.debug(artifacts);
    return artifacts;
}

function analyzeWeapon(data: EquipList[]): AnalyzeWeapon | null {

    for (const item of data) {
        if (item.flat.itemType != "ITEM_WEAPON") continue;
        if (!item.flat.weaponStats || !item.weapon) continue;

        const stat: ArtifactStat[] = [];
        for (const sub of item.flat.weaponStats) {

            stat.push({
                id: FIGHT_PROP_Map[sub.appendPropId],
                value: sub.statValue,
            });
        }
        var affix = 0;
        for (const affixId in item.weapon.affixMap) {
            affix = Math.max(item.weapon.affixMap[affixId] + 1, affix);
        }

        return {
            name: (hashMap as { [id: string]: string })[item.flat.nameTextMapHash] || item.flat.nameTextMapHash,
            id: item.itemId.toString(),
            level: item.weapon.level,
            star: item.flat.rankLevel,
            promote: item.weapon.promoteLevel,
            affix,
            stat,
        }
    }

    return null;
}

function sumAllAvatars(data: GameInfoData) {
    return lodash.intersectionWith(roles, data.playerInfo.showAvatarInfoList, (v1, v2) => v1.id == v2.avatarId);
}

async function getUidData(uid: string, force?: boolean): Promise<GameInfoData | null> {
    if (!force) {
        log.mark("使用缓存中");
        const cache = cacheJson<GameInfoData>("r", `gameData_${uid}`) as GameInfoData | null;
        return cache;
    }

    const data = await fetch(` https://enka.microgg.cn/u/${uid}/__data.json`, {
        headers: { 'User-Agent': 'Miao-Plugin/3.0' }
    }).then(res => {
        return res.json();
    }).then((json: GameInfoData) => {
        //log.debug(json);
        cacheJson("w", `gameData_${uid}`, json);
        return json;
    }).catch(err => {
        log.error(err);
    });
    if (!data) return null;
    else return data;
    // return getData(uid, data);
}

function analyzeDataFix(attr: AnalyzeRoleAttr, id: number) {

    if (attr._fix) {
        return attr;
    }

    id = id * 1
    switch (id) {
        case 10000052:
            // 雷神被动加成fix
            attr.dmgBonus = Math.max(0, attr.dmgBonus - (attr.reCharge - 100) * 0.4);
            break;
        case 10000041:
            // 莫娜被动fix
            attr.dmgBonus = Math.max(0, attr.dmgBonus - attr.reCharge * 0.2);
            break;
        /*
              case 10000060:
                // 夜兰被动fix
                attr.hp = attr.hp - attr.hpBase * 0.3
                break;
        */
    }
    attr._fix = true;
    return attr;

}

export interface AnalyzeMain {
    role: AnalyzeRole;
    artifacts: AnalyzeArtifact[];
    weapon: AnalyzeWeapon | null;
}
interface AnalyzeRole {
    id: number;
    name: string;
    lv: string;
    fetter: number;
    life: number;
    maxLife: number[];
    attr: AnalyzeRoleAttr;
    talentMap: { [key: string]: number; };
}
interface AnalyzeRoleAttr {
    hpBase: number;
    hpTotal: number;
    atkBase: number;
    atkTotal: number;
    defBase: number;
    defTotal: number;
    mastery: number;
    cRate: number;
    cDmg: number;
    reCharge: number;
    dmgBonus: number;
    phyBonus: number;
    _fix: boolean;
};
export interface AnalyzeArtifact {
    name: string;
    level: number;
    setName: string;
    mainStat: ArtifactStat;
    subStat: ArtifactStat[];
}
interface AnalyzeWeapon {
    name: string;
    id: string;
    level: number;
    star: number;
    promote: number;
    affix: number;
    stat: ArtifactStat[];
}
export interface ArtifactStat {
    id: string;
    value: number;
    mark?: number;
    markClass?: string;
}
interface ArtifactsMap {
    [setId: string]: {
        id: string;
        name: string;
        sets: {
            [setPart: string]: {
                id: string;
                name: string;
            }
        };
        effect: {
            [effectId: string]: string;
        };
    }
}




