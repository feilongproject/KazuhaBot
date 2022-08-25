import fs from "fs";
import log from "../../system/logger";
import { eleMap } from "../calc/calc-meta";



const _path = process.cwd();

export function getCharacterInfo(name: string): CharacterInfo {
    var noFife = false;

    var a = fs.access(`${_path}/resources/_meta/roles/${name}/data.json`, fs.constants.F_OK, (err) => {
        if (err) log.error(err);
        else noFife = false;
    });
    if (noFife) throw new Error(`not found ${_path}/resources/_meta/roles/${name}/data.json`);

    const data = fs.readFileSync(`${_path}/resources/_meta/roles/${name}/data.json`, "utf-8");

    const ret = JSON.parse(data) as CharacterInfo;
    ret.weaponType = weaponTypeMap[(ret.weapon || '').toLowerCase()] || '';
    ret.elementType = eleMap[(ret.elem || '').toLowerCase()] || '';
    return ret;
}

const weaponTypeMap: { [weaponEn: string]: string } = {
    sword: '单手剑',
    catalyst: '法器',
    bow: '弓',
    claymore: '双手剑',
    polearm: '长柄武器'
}

export interface CharacterInfo {
    weaponType: string;
    elementType: string;
    name: string;
    abbr: string;
    id: string;
    title: string;
    star: number;
    elem: string;
    allegiance: string;
    weapon: string;
    britydah: string;
    astro: string;
    cncv: string;
    jpcv: string;
    desc: string;
    lvStat: {
        lvs: string[];
        stat: string[];
        detail: {
            [level: string]: string[];
        };
    };
    talent: {
        [talentName: string]: {
            name: string;
            icon: string;
            desc: string[];
            tables: {
                name: string;
                isSame: boolean;
                values: string[];
            }[];
            lvs: string[];
        };

    };
    passive: {
        icon: string;
        name: string;
        desc: string;
    }[];
    cons: {
        [cons: string]: {
            icon: string;
            name: string;
            desc: string;
        }
    };
    imgs: {
        face: string;
        side: string;
        gacha_card: string;
        gacha_splash: string;
        profile: string;
        party: string;
    };
}