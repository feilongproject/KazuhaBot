import roles from "../../data/role.json";
import shortNames from "../../data/shortName.json";
import daily from "../../data/daily.json";
import log from "../lib/logger";

export function roleToId(name: string): number | null {
    if (!name) return null;
    for (const role of roles) {
        for (const roleName of role.name) {
            if (name == roleName)
                return role.id;
        }
    }
    return null;
}

export function roleToRole(name: string): string | null {
    for (const role of roles) {
        for (const roleName of role.name) {
            if (name == roleName)
                return role.name[0];
        }
    }
    return null;
}

export function idToRole(id: number): string | null {
    for (const role of roles) {
        if (role.id == id) {
            return role.name[0];
        }
    }
    return null;
}

export function shortName(name: string): string | null {
    for (const obj of shortNames) {
        if (obj.source == name)
            return obj.conver;
    }
    return null;
}

export function roleToElement(name: string): string | null {
    for (const role of roles) {
        if (role.name[0] == name) {
            return role.element;
        }
    }
    return null;
}

export function roleToTalent(name: string): { week: number, name: string; area: string; act: string[]; } | null {
    for (const [index, material] of daily.roleMaterial.entries()) {
        for (const roleName of material.act) {
            if (name == roleName) return Object.assign(material, { week: (index % 4) + 1 });
        }
    }
    return null;
}

export function weekToTalent(week: number) {
    week--;
    var _talents: {
        role: { name: string; area: string; act: string[]; }[],
        weapon: { name: string; area: string; act: string[]; }[],
    } = { role: [], weapon: [] };
    for (const [index, material] of daily.roleMaterial.entries()) {
        if (index % 3 == week % 3) _talents.role.push(material);
    }
    for (const [index, material] of daily.weaponMaterial.entries()) {
        if (index % 3 == week % 3) _talents.weapon.push(material);
    }
    return _talents;
}

export function findRoleName(content: string) {
    for (const role of roles) {
        for (const name of role.name) {
            if (content.includes(name))
                return role;
        }
    }
    return null;
}