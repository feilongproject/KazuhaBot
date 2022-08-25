import lodash from "lodash";
import { Format } from "../../system/common";
import log from "../../system/logger";
import { AnalyzeArtifact, ArtifactStat } from "../dashboardManager";
import { getCharacterInfo } from "../data/getCharacter";

const charCfg: {
    [name: string]: {
        weight: { [attr: string]: number; },
        mark: { [attr: string]: number; },
        titleMap: { [title: string]: number; },
        titleWeight: { [attr: string]: number; },
        maxMark: { [key: string]: number; }
    };
} = {};


export function getArtis(char: string, artisData: AnalyzeArtifact[]) {

    //console.log(`\nfuntion  getArtis("${char}", "${JSON.stringify(artisData)}")\n`);

    const charCfg = getCharCfg(char);
    const newScore = getArtisMark(char, artisData);
    var totalMark = 0;
    const artis: {
        name: string;
        set: string;
        level: number;
        mark: string;
        markClass: string;
        main: { title: string, val: string, mark: string };
        attrs: { title: string, val: string, mark: string }[];
    }[] = [];



    for (const [idx, arti] of artisData.entries()) {
        //const ds = arti;
        const mark = newScore[idx];
        totalMark += mark;
        //log.debug(artisData);
        //log.debug(idx, artis[idx]);

        //log.debug(idx, mark);
        const ds = {
            name: arti.name,
            set: arti.setName,
            level: arti.level,
            mark: Format.comma(mark, 1),
            markClass: getMarkClass(mark),
            main: formatArti(arti.mainStat, charCfg.mark, true) as any,
            attrs: formatArti(arti.subStat, charCfg.mark, false) as any,
        }
        //log.debug(ds);
        artis[idx] = ds;
    }


    return {
        artis,
        totalMark,
        totalMarkClass: getMarkClass(totalMark / 5),
        usefulMark: charCfg.titleWeight
    }
}



//////

export function getCharCfg(name: string): GetCharCfg {

    if (charCfg[name]) {
        return charCfg[name];
    }
    const attrWeight: { [attr: string]: number } = usefulAttr[name] || { atk: 75, cp: 100, cd: 100 };
    const attrMark: { [attr: string]: number; } = {};

    const char = getCharacterInfo(name);
    const baseAttr = char.lvStat.detail['90'];
    lodash.forEach(attrWeight, (weight, attr) => {
        attrMark[attr] = weight / attrValue[attr];
    })

    // const baseAttr = [400, 500, 300];
    if (attrMark.hp) {
        attrMark.hpPlus = attrMark.hp / parseInt(baseAttr[0]) * 100;
    }
    if (attrMark.atk) {
        // 以520作为武器白值均值计算
        attrMark.atkPlus = attrMark.atk / (parseInt(baseAttr[1]) * 1 + 520) * 100;
    }
    if (attrMark.def) {
        attrMark.defPlus = attrMark.def / parseInt(baseAttr[2]) * 100;
    }
    const maxMark = getMaxMark(attrWeight);
    const titleMark: { [title: string]: number } = {};
    const titleWeight: { [attr: string]: number; } = {};
    lodash.forEach(attrMark, (mark, attr) => {
        const aTitle = attrMap[attr].title;
        if (/小/.test(aTitle)) {
            return;
        }
        titleMark[aTitle] = mark;
        titleWeight[aTitle] = attrWeight[attr] || 0;
        if (/大/.test(aTitle)) {
            const sTitle = aTitle.replace('大', '小');
            titleWeight[sTitle] = titleWeight[aTitle];
        }
    });
    charCfg[name] = {
        weight: attrWeight,
        mark: attrMark,
        titleMap: titleMark,
        titleWeight: titleWeight,
        maxMark: maxMark
    };
    //console.debug(name, charCfg[name]);
    return charCfg[name];
}

function getMaxAttr(charAttr: { [attr: string]: number; } = {}, list2: string[] = [], maxLen = 1, banAttr = '') {
    var tmp: { attr: string; mark: number }[] = [];
    lodash.forEach(list2, (attr) => {
        if (attr === banAttr) return;
        if (!charAttr[attr]) return;
        tmp.push({ attr, mark: charAttr[attr] });
    });
    tmp = lodash.sortBy(tmp, 'mark');
    tmp = tmp.reverse();
    const ret: string[] = [];
    lodash.forEach(tmp, (ds) => ret.push(ds.attr));
    return ret.slice(0, maxLen);
}

function getMaxMark(attrWeight: { [attr: string]: number; }) {
    const ret: { [key: string]: number; } = {};
    for (var idx = 1; idx <= 5; idx++) {
        var totalMark = 0;
        var mMark = 0;
        var mAttr = '';
        if (idx === 1) {
            mAttr = 'hpPlus'
        } else if (idx === 2) {
            mAttr = 'atkPlus'
        } else if (idx >= 3) {
            mAttr = getMaxAttr(attrWeight, mainAttr[idx])[0]
            mMark = attrWeight[mAttr]
            totalMark += attrWeight[mAttr] * 2
        }

        const sAttr = getMaxAttr(attrWeight, subAttr, 4, mAttr);
        lodash.forEach(sAttr, (attr, aIdx) => {
            totalMark += attrWeight[attr] * (aIdx === 0 ? 6 : 1);
        })
        ret[idx] = totalMark;
        ret['m' + idx] = mMark;
    }
    return ret
}

function getAttr(ds: ArtifactStat) {
    const title = ds.id;
    var attr = attrNameMap[title]
    if (/元素伤害/.test(title)) {
        attr = 'dmg';
    } else if (/物理|物伤/.test(title)) {
        attr = 'phy';
    }
    return attr;
}

function getAttrMark(attrMark: { [attr: string]: number; }, ds: ArtifactStat) {
    if (!ds || !ds.value) {
        return 0;
    }
    const attr = getAttr(ds);
    const val = ds.value;
    return (attrMark[attr] || 0) * val;
}

function getMark(charCfg: GetCharCfg, posIdx: number, mainAttr: ArtifactStat, subAttr?: ArtifactStat[]) {
    var ret = 0;
    const { mark, maxMark, weight } = charCfg;
    const mAttr = getAttr(mainAttr);

    var fixPct = 1;
    if (posIdx >= 3) {
        fixPct = Math.max(0, Math.min(1, (weight[mAttr] || 0) / (maxMark['m' + posIdx])));
        ret += getAttrMark(mark, mainAttr) / 4;
    }

    lodash.forEach(subAttr, (ds) => {
        ret += getAttrMark(mark, ds);
    })

    return ret * (1 + fixPct) / 2 / maxMark[posIdx] * 66;
}

function getArtisMark(charName = '', artis: AnalyzeArtifact[]) {
    const charCfg = getCharCfg(charName);
    //log.debug(charCfg);
    const ret: { [idx: number]: number } = {};
    lodash.forEach(artis, (ds, idx) => {
        ret[idx] = getMark(charCfg, idx + 1, ds.mainStat, ds.subStat);
        //log.debug(idx + 1, ret[idx]);
    });
    return ret;
}

function getMarkClass(mark: number): string {
    const pct = mark;
    //const scoreMap = [['D', 10], ['C', 16.5], ['B', 23.1], ['A', 29.7], ['S', 36.3], ['SS', 42.9], ['SSS', 49.5], ['ACE', 56.1], ['ACE²', 66]];
    const scoreMap: { [mark: string]: number } = {
        'D': 10, 'C': 16.5, 'B': 23.1, 'A': 29.7,
        'S': 36.3, 'SS': 42.9, 'SSS': 49.5, 'ACE': 56.1, 'ACE²': 66
    }
    for (const idx in scoreMap) {
        if (pct < scoreMap[idx]) {
            return idx;
        }
    }
    return '-1';
}

/* function getSetByArti(name) {
    for (const idx in artisMap) {
        for (const idx2 in artisMap[idx].sets) {
            if (artisMap[idx].sets[idx2].name === name) {
                return artisMap[idx]
            }
        }
    }
    return false
} */

/* function getArtiBySet(name, idx = 1) {
    const set = artisMap[name]
    if (!set) {
        return ''
    }
    return set.sets[`arti${idx}`].name
} */

/* function getMeta() {
    return {
        attrMap
    }
} */

function formatArti(ds: ArtifactStat | ArtifactStat[], markCfg: { [key: string]: number }, isMain = false) {
    if (lodash.isArray(ds)) {
        const ret: { title: string; val: string; mark: string | number; }[] = [];
        lodash.forEach(ds, (d) => {
            const _____ = formatArti(d, markCfg, isMain);
            if (!lodash.isArray(_____))
                ret.push(_____);
        });
        return ret;
    }
    var title = ds.id;
    var key = '';
    var val: number | string = ds.value;
    var num = ds.value;
    if (!title || title === 'undefined') {
        return []
    }
    if (/伤害加成/.test(title) && val < 1) {
        val = Format.pct(val * 100);
        num = num * 100;
    } else if (/伤害加成|大|暴|充能|治疗/.test(title)) {
        val = Format.pct(val);
    } else {
        val = Format.comma(val, 1);
    }

    if (/元素伤害加成/.test(title)) {
        title = title.replace('元素伤害', '伤');
        key = 'dmg'
    } else if (title === '物理伤害加成') {
        title = '物伤加成';
        key = 'phy';
    }

    key = key || attrNameMap[title];

    var mark: number | string = markCfg[key] * num
    if (markCfg) {
        if (isMain) {
            mark = mark / 4 + 0.01
        }
        mark = Format.comma(mark || 0)
    }
    return { title, val, mark }
}



export const attrValue: { [attr: string]: number } = {
    cp: 3.89,
    cd: 7.77,
    mastery: 23.31,
    atk: 5.83,
    hp: 5.83,
    def: 7.29,
    reCharge: 6.48,
    dmg: 5.825,
    phy: 7.288,
    heal: 4.487
}
export const attrMap: {
    [attr: string]: { title: string; format: string; type: string; value?: number; text?: string; }
} = {
    atk: { title: '大攻击', format: 'pct', type: 'normal', value: 5.83, text: '5.83%' },
    atkPlus: { title: '小攻击', format: 'comma', type: 'plus' },
    def: { title: '大防御', format: 'pct', type: 'normal', value: 7.29, text: '7.29%' },
    defPlus: { title: '小防御', format: 'comma', type: 'plus' },
    hp: { title: '大生命', format: 'pct', type: 'normal', value: 5.83, text: '5.83%' },
    hpPlus: { title: '小生命', format: 'comma', type: 'plus' },
    cp: { title: '暴击率', format: 'pct', type: 'normal', value: 3.89, text: '3.89%' },
    cd: { title: '暴击伤害', format: 'pct', type: 'normal', value: 7.77, text: '7.77%' },
    mastery: { title: '元素精通', format: 'comma', type: 'normal', value: 23.31, text: '23.31' },
    reCharge: { title: '充能效率', format: 'pct', type: 'normal', value: 23.31, text: '23.31' },
    dmg: { title: '元素伤害', format: 'pct', type: 'normal', value: 5.825, text: '5.83%' },
    phy: { title: '物伤加成', format: 'pct', type: 'normal', value: 7.288, text: '7.29%' },
    heal: { title: '治疗加成', format: 'pct', type: 'normal', value: 4.487, text: '4.49%' }
}

const anMap: { [title: string]: string } = {};
for (const attr in attrMap) anMap[attrMap[attr].title] = attr;
const attrNameMap = anMap

export const mainAttr: { [lv: number]: string[] } = {
    3: ["atk", "def", "hp", "mastery", "reCharge"],
    4: ["atk", "def", "hp", "mastery", "dmg", "phy"],
    5: ["atk", "def", "hp", "mastery", "reCharge", "heal", "cp", "cd"]
}

export const subAttr = ["atk", "def", "hp", "mastery", "reCharge", "cp", "cd"];

export const usefulAttr: {
    [name: string]: {
        hp: number; atk: number; def: number; cp: number; cd: number;
        mastery: number; dmg: number; phy: number; reCharge: number; heal: number;
    }
} = {
    神里绫人: { hp: 50, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    八重神子: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    申鹤: { hp: 0, atk: 100, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    云堇: { hp: 0, atk: 0, def: 100, cp: 50, cd: 50, mastery: 0, dmg: 25, phy: 0, reCharge: 90, heal: 0 },
    荒泷一斗: { hp: 0, atk: 50, def: 100, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 30, heal: 0 },
    五郎: { hp: 0, atk: 50, def: 100, cp: 50, cd: 50, mastery: 0, dmg: 25, phy: 0, reCharge: 90, heal: 0 },
    班尼特: { hp: 100, atk: 50, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 70, phy: 0, reCharge: 55, heal: 100 },
    枫原万叶: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 100, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    雷电将军: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 75, phy: 0, reCharge: 90, heal: 0 },
    行秋: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 75, heal: 0 },
    钟离: { hp: 80, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 50, reCharge: 55, heal: 0 },
    '钟离-血牛': { hp: 100, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 75, phy: 0, reCharge: 55, heal: 0 },
    神里绫华: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    香菱: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    胡桃: { hp: 80, atk: 50, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    甘雨: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    '甘雨-永冻': { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    温迪: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    珊瑚宫心海: { hp: 100, atk: 50, def: 0, cp: 0, cd: 0, mastery: 0, dmg: 100, phy: 0, reCharge: 55, heal: 100 },
    莫娜: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 75, heal: 0 },
    阿贝多: { hp: 0, atk: 0, def: 100, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    迪奥娜: { hp: 100, atk: 50, def: 0, cp: 50, cd: 50, mastery: 0, dmg: 100, phy: 0, reCharge: 90, heal: 100 },
    优菈: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 40, phy: 100, reCharge: 55, heal: 0 },
    达达利亚: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    魈: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    宵宫: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    九条裟罗: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    琴: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 100, reCharge: 55, heal: 100 },
    菲谢尔: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 60, reCharge: 0, heal: 0 },
    罗莎莉亚: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 70, phy: 80, reCharge: 0, heal: 0 },
    可莉: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    凝光: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    北斗: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    刻晴: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 100, reCharge: 0, heal: 0 },
    托马: { hp: 100, atk: 50, def: 0, cp: 50, cd: 50, mastery: 0, dmg: 75, phy: 0, reCharge: 90, heal: 0 },
    迪卢克: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    芭芭拉: { hp: 100, atk: 50, def: 0, cp: 50, cd: 50, mastery: 0, dmg: 80, phy: 0, reCharge: 55, heal: 100 },
    '芭芭拉-暴力': { hp: 50, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 55, heal: 50 },
    诺艾尔: { hp: 0, atk: 50, def: 90, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 70, heal: 0 },
    旅行者: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    重云: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    七七: { hp: 0, atk: 100, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 60, phy: 70, reCharge: 55, heal: 100 },
    凯亚: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 100, reCharge: 0, heal: 0 },
    烟绯: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    早柚: { hp: 0, atk: 50, def: 0, cp: 50, cd: 50, mastery: 100, dmg: 80, phy: 0, reCharge: 55, heal: 100 },
    安柏: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 100, reCharge: 0, heal: 0 },
    丽莎: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    埃洛伊: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 0, heal: 0 },
    辛焱: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 50, phy: 100, reCharge: 0, heal: 0 },
    砂糖: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 100, dmg: 40, phy: 0, reCharge: 55, heal: 0 },
    雷泽: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 50, phy: 100, reCharge: 0, heal: 0 },
    夜兰: { hp: 80, atk: 0, def: 0, cp: 100, cd: 100, mastery: 0, dmg: 100, phy: 0, reCharge: 55, heal: 0 },
    久岐忍: { hp: 100, atk: 50, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 55, heal: 100 },
    鹿野院平藏: { hp: 0, atk: 75, def: 0, cp: 100, cd: 100, mastery: 75, dmg: 100, phy: 0, reCharge: 0, heal: 0 }
}

interface GetCharCfg {
    weight: {
        [attr: string]: number;
    };
    mark: {
        [attr: string]: number;
    };
    titleMap: {
        [title: string]: number;
    };
    titleWeight: {
        [attr: string]: number;
    };
    maxMark: {
        [key: string]: number;
    };
}