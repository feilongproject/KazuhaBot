import fs from 'fs'
import lodash from 'lodash'
import { Format } from '../../../lib/common';
import log from '../../../lib/logger';
import { AnalyzeMain, AnalyzeArtifact } from "../../dashboardManager";
import { CharacterInfo, getCharacterInfo } from '../data/getCharacter';
import { attrMap, eleBaseDmg, eleMap, erType } from './calc-meta';

export async function calcData(profile: AnalyzeMain, char: CharacterInfo, enemyLv = 91, mode = 'profile', dmgIdx = 0) {
    const charCalcData = await getCharCalcRule(char.name);

    if (!charCalcData) {
        return false;
    }
    const talent = calcTalent(profile, char);

    const meta = {
        cons: profile.role.life,
        talent,
    };

    var { buffs, details, defParams, mainAttr, defDmgIdx, enemyName } = charCalcData;

    defParams = defParams || {};

    const originalAttr = attr(profile);

    const weaponBuffs = await weapon(profile.weapon!.name);
    const reliBuffs = await reliquaries(profile.artifacts);
    buffs = lodash.concat(buffs, weaponBuffs, reliBuffs)

    lodash.forEach(buffs, (buff) => {
        buff.sort = lodash.isUndefined(buff.sort) ? 1 : buff.sort
    })

    buffs = lodash.sortBy(buffs, ['sort'])

    const { msg } = calcAttr(originalAttr, buffs, meta, defParams || {});

    const ret: any[] = [];
    const detailMap: any[] = [];
    const dmgRet: { type: string; }[][] = [];
    var dmgDetail: any = {};

    lodash.forEach(details, (detail, detailSysIdx) => {
        if (lodash.isFunction(detail)) {
            const { attr } = calcAttr(originalAttr, buffs, meta);
            const ds = lodash.merge({ talent }, getDs(attr, meta));
            detail = detail({ ...ds, attr, profile });
        }
        const params = lodash.merge({}, defParams, detail.params || {});
        const { attr } = calcAttr(originalAttr, buffs, meta, params, undefined, undefined, detail.talent || '');
        if (detail.check && !detail.check(getDs(attr, meta, params))) {
            return;
        }
        if (detail.cons && meta.cons * 1 < detail.cons * 1) {
            return;
        }
        const ds = lodash.merge({ talent }, getDs(attr, meta, params));

        const dmg = getDmgFn(ds, attr, profile, enemyLv, detail.showDetail);


        if (detail.dmg) {
            //log.debug(JSON.stringify(ds), "\n", JSON.stringify(dmg));
            //log.debug(detail.dmg());
            //log.debug(dmg)
            const basicDmgRet = detail.dmg(ds, dmg)
            //log.debug(basicDmgRet);
            detail.userIdx = detailMap.length
            detailMap.push(detail)
            ret.push({
                title: detail.title,
                ...basicDmgRet
            })
        }
    })

    if (mode === 'dmg') {
        var detail: any;
        if (dmgIdx && detailMap[dmgIdx - 1]) {
            detail = detailMap[dmgIdx - 1]
        } else if (!lodash.isUndefined(defDmgIdx) && details[defDmgIdx]) {
            detail = details[defDmgIdx]
        } else {
            detail = detailMap[0]
        }

        dmgDetail = {
            title: detail.title,
            userIdx: detail.userIdx,
            basicRet: lodash.merge({}, ret[detail.userIdx]),
            attr: []
        }

        mainAttr = mainAttr.split(',') as any;
        const params = lodash.merge({}, defParams, detail.params || {})
        const basicDmg = dmgDetail.basicRet
        lodash.forEach(mainAttr, (reduceAttr) => {
            dmgDetail.attr.push(attrMap[reduceAttr])
            const rowData: { type: string; }[] = []
            lodash.forEach(mainAttr, (incAttr) => {
                if (incAttr === reduceAttr) {
                    rowData.push({ type: 'na' })
                    return
                }
                const { attr } = calcAttr(
                    originalAttr,
                    buffs,
                    meta,
                    params,
                    incAttr,
                    reduceAttr,
                    detail.talent || ''
                )
                const ds = lodash.merge({ talent }, getDs(attr, meta, params))
                const dmg = getDmgFn(ds, attr, profile, enemyLv)
                if (detail.dmg) {
                    const dmgCalcRet = detail.dmg(ds, dmg)
                    rowData.push({
                        type: dmgCalcRet.avg === basicDmg.avg ? 'avg' : (dmgCalcRet.avg > basicDmg.avg ? 'gt' : 'lt'),
                        ...dmgCalcRet
                    })
                }
            })
            dmgRet.push(rowData)
        })
    }

    return {
        ret,
        msg,
        dmgRet,
        enemyName,
        dmgCfg: dmgDetail
    }
}

async function getCharCalcRule(name: string) {
    const cfgPath = `${global._path}/resources/_meta/roles/${name}/calc`;
    var details;
    var buffs = [];
    var defParams = {};
    var defDmgIdx = -1;
    var mainAttr = 'atk,cpct,cdmg';
    var enemyName = '小宝';
    try {


        const fileData = await import(`${cfgPath}`);
        details = fileData.details || false;
        buffs = fileData.buffs || [];
        defParams = fileData.defParams || {};
        if (fileData.defDmgIdx) {
            defDmgIdx = fileData.defDmgIdx;
        }
        if (fileData.mainAttr) {
            mainAttr = fileData.mainAttr;
        }
        if (fileData.enemyName) {
            enemyName = fileData.enemyName;
        }

        if (details) {
            return { details, buffs, defParams, defDmgIdx, mainAttr, enemyName };
        }
        return false;
    } catch (err) {
        log.error(err);
        return false;
    }


}

// 获取基础属性
function attr(profile: AnalyzeMain) {
    const ret: { [key: string]: any } = {};
    const attr: { [key: string]: number } = profile.role.attr as any;
    //log.debug(profile.role.attr);
    //ret.dataSource = profile.dataSource || 'miao'

    // 基础属性
    lodash.forEach(["atk", "def", "hp"], (key) => {

        ret[key] = {
            base: attr[`${key}Base`] || 0,
            plus: attr[`${key}Total`] - attr[`${key}Base`] || 0,
            pct: 0,
        }
        //log.debug(ret[key]);
    });

    lodash.forEach(["mastery", "reCharge"], (key) => {
        ret[key] = {
            base: attr[key] || 0,
            plus: 0,
            pct: 0
        }
    });

    lodash.forEach({ cRate: 'cpct', cDmg: 'cdmg', hInc: 'heal' }, (val, key) => {
        ret[val] = {
            base: attr[key] || 0,
            plus: 0,
            pct: 0,
            inc: 0
        }
        //log.debug(attr);
    });

    lodash.forEach(["dmg", "phy"], (key) => {
        ret[key] = {
            base: attr[key + 'Bonus'] || 0,
            plus: 0,
            pct: 0
        }
    });

    // 技能属性记录
    lodash.forEach(["a", "a2", "a3", "e", "q"], (key) => {
        ret[key] = {
            pct: 0, // 倍率加成
            multi: 0, // 独立倍率乘区加成

            plus: 0, // 伤害值提高
            dmg: 0, // 伤害提高
            cpct: 0, // 暴击提高
            cdmg: 0, // 爆伤提高

            def: 0, // 防御降低
            ignore: 0 // 无视防御
        }
    });

    ret.enemy = {
        def: 0, // 降低防御
        ignore: 0, // 无视防御
        phy: 0 // 物理防御
    }

    ret.shield = {
        base: 100, // 基础
        plus: 0, // 护盾强效
        inc: 100 // 吸收倍率
    }

    const char = getCharacterInfo(profile.role.name);
    ret.weapon = profile.weapon;
    ret.weaponType = char.weaponType;
    ret.element = char.elementType;
    ret.refine = profile.weapon?.affix ? (profile.weapon.affix - 1) : 0;

    ret.multi = 0;
    ret.zf = 0;
    ret.rh = 0;
    ret.gd = 0;
    ret.ks = 0;
    ret.kx = 0;
    ret.fykx = 0;
    return ret;
}
// 获取天赋数据
function calcTalent(profile: AnalyzeMain, char: CharacterInfo) {
    const ret: {
        [key: string]: { [name: string]: any; };
    } = {};

    const talentData = profile.role.talentMap || {};

    lodash.forEach(['a', 'e', 'q'], (key) => {
        const lv = talentData[key];
        const map: { [name: string]: any } = {};

        lodash.forEach(char.talent[key].tables, (tr) => {
            var val = tr.values[lv - 1];
            val = val.replace(/[^\x00-\xff]/g, '').trim();
            const valArr: number[] = [];
            const valArr2: string[] = [];
            lodash.forEach(val.split('/'), (v, idx) => {
                var valNum = 0;
                lodash.forEach(v.split('+'), (v: any) => {
                    (v as any) = v.split('*');
                    const v1: any = v[0].replace('%', '').trim();
                    valNum += v1 * (v[1] || 1);
                    valArr2.push(v1);
                })
                valArr.push(valNum);
            })

            if (isNaN(valArr[0])) {
                map[tr.name] = false;
            } else if (valArr.length === 1) {
                map[tr.name] = valArr[0];
            } else {
                map[tr.name] = valArr;
            }
            map[tr.name + '2'] = valArr2;
        })
        ret[key] = map;
    })
    return ret;
}

function getDs(attr: { [key: string]: any; }, meta: any, params?: any) {
    return {
        ...meta,
        attr,
        params,
        refine: attr.refine,
        weaponType: attr.weaponType,
        weapon: attr.weapon,
        element: eleMap[attr.element] || attr.element,
        calc(ds: any) {
            return (ds.base || 0) + (ds.plus || 0) + ((ds.base || 0) * (ds.pct || 0) / 100)
        }
    }
}

function calcAttr(originalAttr: { [key: string]: any; }, buffs: any, meta: any, params = {}, incAttr = '', reduceAttr = '', talent = '') {
    const attr = lodash.merge({}, originalAttr)
    const msg: any[] = []

    if (incAttr && attrMap[incAttr]) {
        const aCfg = attrMap[incAttr];
        attr[incAttr][aCfg.type] += aCfg.val;
    }
    if (reduceAttr && attrMap[reduceAttr]) {
        const aCfg = attrMap[reduceAttr];
        attr[reduceAttr][aCfg.type] -= aCfg.val;
    }

    lodash.forEach(buffs, (buff) => {
        const ds = getDs(attr, meta, params);
        ds.currentTalent = talent;
        // 如果存在rule，则进行计算
        if (buff.check && !buff.check(ds)) {
            return;
        }
        if (buff.cons) {
            if (ds.cons * 1 < buff.cons * 1) {
                return;
            }
        }

        var title = buff.title;

        if (buff.mastery) {
            const mastery = Math.max(0, attr.mastery.base + attr.mastery.plus);
            // const masteryNum = 2.78 * mastery / (mastery + 1400) * 100;
            buff.data = buff.data || {};
            lodash.forEach(buff.mastery.split(','), (key) => {
                buff.data[key] = getMultiple(key, mastery);
                //  buff.data[key] = masteryNum;
            })
        }

        lodash.forEach(buff.data, (val, key) => {

            if (lodash.isFunction(val)) {
                //log.debug(ds);
                val = val(ds);
            }

            title = title.replace(`[${key}]`, Format.comma(val, 1));
            // 技能提高
            const tRet = /^(a|a2|a3|e|q)(Def|Ignore|Dmg|Plus|Pct|Cpct|Cdmg|Multi)$/.exec(key);
            if (tRet) {
                attr[tRet[1]][tRet[2].toLowerCase()] += val * 1 || 0;
                return;
            }
            const aRet = /^(hp|def|atk|mastery|cpct|cdmg|heal|reCharge|dmg|phy|shield)(Plus|Pct|Inc)?$/.exec(key);
            if (aRet) {
                //log.debug(attr, key, aRet);
                attr[aRet[1]][aRet[2] ? aRet[2].toLowerCase() : 'plus'] += val * 1 || 0;
                return;
            }
            if (key === 'enemyDef') {
                attr.enemy.def += val * 1 || 0;
                return;
            }

            if (['zf', 'rh', 'kx', 'gd', 'ks', 'fykx'].includes(key)) {
                attr[key] += val * 1 || 0;
            }
        })
        msg.push(title);
    })

    return {
        attr, msg
    }
}

async function weapon(weaponName: string) {
    const cfgPath = `${global._path}/resources/_meta/weapons/calc`;
    var weapons: { [name: string]: any } = {};
    if (fs.existsSync(`${cfgPath}.ts`)) {
        const fileData = await import(`${cfgPath}`);
        weapons = fileData.weapons || {};
    }

    var weaponCfg = weapons[weaponName] || [];
    if (lodash.isPlainObject(weaponCfg)) {
        weaponCfg = [weaponCfg];
    }

    lodash.forEach(weaponCfg, (ds) => {
        if (!/：/.test(ds.title)) {
            ds.title = `${weaponName}：${ds.title}`
        }
        if (ds.refine) {
            ds.data = ds.data || {};
            lodash.forEach(ds.refine, (r, key) => {
                ds.data[key] = ({ refine }: any) => r[refine] * (ds.buffCount || 1);
            })
        }
    })

    return weaponCfg
}

async function reliquaries(sets: AnalyzeArtifact[]) {
    const cfgPath = `${global._path}/resources/_meta/reliquaries/calc`
    var buffs: { [name: string]: any } = {};
    if (fs.existsSync(`${cfgPath}.ts`)) {
        const fileData = await import(`${cfgPath}`);
        buffs = fileData.buffs || {};
    }
    const setMap: { [name: string]: number } = {};
    lodash.forEach(sets, (set) => {
        if (set && set.setName) {
            const name = set.setName;
            setMap[name] = (setMap[name] || 0) + 1
        }
    })
    const retBuffs: any[] = [];
    lodash.forEach(setMap, (count, setName) => {
        if (count >= 2 && buffs[setName + 2]) {
            retBuffs.push(buffs[setName + 2]);
        }
        if (count >= 4 && buffs[setName + 4]) {
            retBuffs.push(buffs[setName + 4]);
        }
    })
    return retBuffs;
}

function getDmgFn(ds: any, attr: any, profile: any, enemyLv: number, showDetail = false) {
    const { calc } = ds;

    const dmgFn = function (pctNum = 0, talent = "", ele = "", basicNum = 0, mode = 'talent') {
        const { atk, dmg, phy, cdmg, cpct } = attr;
        // 攻击区
        const atkNum = calc(atk);
        // 倍率独立乘区
        var multiNum = attr.multi / 100;
        // 增伤区
        var dmgNum = (1 + dmg.base / 100 + dmg.plus / 100);

        if (ele === 'phy') dmgNum = (1 + phy.base / 100 + phy.plus / 100);

        // console.log({ base: Format.comma(dmg.base, 2), plus: Format.comma(dmg.plus, 2) })

        var cpctNum = cpct.base / 100 + cpct.plus / 100;

        // 爆伤区
        var cdmgNum = cdmg.base / 100 + cdmg.plus / 100;

        var enemyDef = attr.enemy.def / 100;
        var enemyIgnore = attr.enemy.ignore / 100;

        var plusNum = 0;

        if (talent && attr[talent]) {
            pctNum = pctNum / 100;

            const ds = attr[talent];
            //log.debug(ds);
            pctNum += ds.pct / 100;
            dmgNum += ds.dmg / 100;
            cpctNum += ds.cpct / 100;
            cdmgNum += ds.cdmg / 100;
            enemyDef += ds.def / 100;
            enemyIgnore += ds.ignore / 100;
            multiNum += ds.multi / 100;
            plusNum += ds.plus;
        }

        // 防御区
        const lv: number = parseInt(profile.role.lv);
        const defNum = (lv + 100) / ((lv + 100) + (enemyLv + 100) * (1 - enemyDef) * (1 - enemyIgnore));//defNum=NAN
        //console.log("defNum:", `${defNum} = (${lv} + 100) / ((${lv} + 100) + (${enemyLv} + 100) * (1 - ${enemyDef}) * (1 - ${enemyIgnore}))`);
        // 抗性区
        var kx = attr.kx;
        if (talent === 'fy') {
            kx = attr.fykx;
        }
        kx = 10 - (kx || 0);
        var kNum = 0.9;
        if (kx >= 0) {
            kNum = (100 - kx) / 100;
        } else {
            kNum = 1 - kx / 200;
        }

        // 反应区
        var eleNum = 1;
        var eleBase = 0;

        if (ele === 'ks' || ele === 'gd') {
            eleBase = eleBaseDmg[lv] || 0
        }

        if (ele === 'phy') {
            // do nothing
        } else if (ele) {
            eleNum = getBasePct(ele, attr.element)

            if (attr[ele]) {
                eleNum = eleNum * (1 + attr[ele] / 100)
            }
        }

        cpctNum = Math.max(0, Math.min(1, cpctNum))
        if (cpctNum === 0) {
            cdmgNum = 0
        }

        var ret = {}
        if (mode === 'basic') {
            ret = {
                dmg: basicNum * dmgNum * (1 + cdmgNum) * defNum * kNum * eleNum,
                avg: basicNum * dmgNum * (1 + cpctNum * cdmgNum) * defNum * kNum * eleNum
            }
        } else if (eleBase) {
            ret = { avg: eleBase * kNum * eleNum };
        } else {
            // 计算最终伤害
            ret = {
                dmg: (atkNum * pctNum * (1 + multiNum) + plusNum) * dmgNum * (1 + cdmgNum) * defNum * kNum * eleNum,
                avg: (atkNum * pctNum * (1 + multiNum) + plusNum) * dmgNum * (1 + cpctNum * cdmgNum) * defNum * kNum * eleNum
            }
        }

        if (showDetail) {
            console.log(attr, { atkNum, pctNum, multiNum, plusNum, dmgNum, cpctNum, cdmgNum, defNum, eleNum, kNum }, ret)
        }

        return ret
    }

    dmgFn.basic = function (basicNum = 0, talent = "", ele = "") {
        return dmgFn(0, talent, ele, basicNum, 'basic')
    }

    dmgFn.heal = function (num: number) {
        if (showDetail) {
            console.log(num, calc(attr.heal), attr.heal.inc)
        }
        return {
            avg: num * (1 + calc(attr.heal) / 100 + attr.heal.inc / 100)
        }
    }

    dmgFn.shield = function (num: number) {
        return {
            avg: num * (calc(attr.shield) / 100) * (attr.shield.inc / 100)
        }
    }
    dmgFn.ks = function () {
        return dmgFn(0, 'fy', 'ks')
    }

    return dmgFn
}



function getMultiple(type = 'zf', mastery = 0) {
    let typeCfg = erType[type]
    if (typeCfg.type === 'pct') {
        return 2.78 * mastery / (mastery + 1400) * 100
    } else if (typeCfg.type === 'fusion') {
        return (1 + mastery * 16) / (mastery + 2000) * 100
    }
    return 0
}
function getBasePct(type: string, element: string) {
    let typeCfg = erType[type];
    if (typeCfg) {
        return typeCfg.num({ element }) || 1;
    }
    return 1;
}