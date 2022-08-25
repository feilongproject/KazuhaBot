import { AvatarsSkillList, miGetAvatarDetail, miGetAvatarSkills, miGetAvatarCompute, miGetRecordCharacters, AvatarComputeConsume } from "../components/mihoyoAPI";
import { render } from "../components/render";
import { idToRole, roleToId, roleToRole } from "../components/roleConver";
import { IMessageEx } from "../system/IMessageEx";
import log from "../system/logger";


//五星
let roleId5 = [10000003, 10000005, 10000007, 10000016, 10000022, 10000026, 10000029, 10000030, 10000033, 10000035, 10000037, 10000038, 10000041, 10000042, 10000046, 10000047, 10000051, 10000002, 10000049, 10000052, 10000054, 10000062, 10000057, 10000058, 10000063, 10000066, 10000060, 10000100];
//四星
let roleId4 = [10000006, 10000014, 10000015, 10000020, 10000021, 10000023, 10000024, 10000025, 10000027, 10000031, 10000032, 10000034, 10000036, 10000039, 10000043, 10000044, 10000045, 10000048, 10000053, 10000056, 10000050, 10000055, 10000059, 10000064, 10000065, 10000101, 10000102];


export async function skillCalculator(msg: IMessageEx) {

    const cookie = await global.redis.hGet(`genshin:config:${msg.author.id}`, "cookie");
    const uid = await global.redis.hGet(`genshin:config:${msg.author.id}`, "uid");
    const region = await global.redis.hGet(`genshin:config:${msg.author.id}`, "region");

    if (!cookie || !uid || !region) {
        msg.sendMsgEx({ content: `尚未绑定米游社cookie，无法查询养成计算` });
        return true;
    }


    if (/^#角色(养成|计算|养成计算)$/.test(msg.content)) {
        msg.sendMsgEx({
            content: `#角色养成计算` +
                `\n指令：#绫华养成` +
                `\n示例：#绫华养成81 90 9 9 9` +
                `\n参数为角色、武器、技能等级`,
        });
        return true;
    }
    let defSetSkill = [90, 90, 10, 10, 10];

    const reg = /^#(.+)(养成|计算|培养)(,|，| )?([0-9]*)?(,|，| )?([0-9]*)?(,|，| )?([0-9]*)?(,|，| )?([0-9]*)?(,|，| )?([0-9]*)?(,|，| )?$/.exec(msg.content);
    if (!reg) return false;
    var roleName = reg[1];
    const roleId = roleToId(roleName);
    if (!roleName || !roleId) {
        return true;
    }
    roleName = roleToRole(roleName)!;

    if ([10000005, 10000007, 20000000].includes(roleId)) {
        msg.sendMsgEx({ content: "暂不支持旅行者养成计算" });
        return true;
    }
    defSetSkill[0] = parseInt(reg[4]) <= defSetSkill[0] ? parseInt(reg[4]) : defSetSkill[0];
    defSetSkill[1] = parseInt(reg[6]) <= defSetSkill[0] ? parseInt(reg[6]) : defSetSkill[1];
    defSetSkill[2] = parseInt(reg[8]) <= defSetSkill[0] ? parseInt(reg[8]) : defSetSkill[2];
    defSetSkill[3] = parseInt(reg[10]) <= defSetSkill[0] ? parseInt(reg[10]) : defSetSkill[3];
    defSetSkill[4] = parseInt(reg[12]) <= defSetSkill[0] ? parseInt(reg[12]) : defSetSkill[4];

    const characters = await miGetRecordCharacters(uid, region, cookie);
    if (!characters) return true;
    var char = characters.avatars.find((item) => item.id == roleId);

    var skillList: AvatarsSkillList[] = [];
    if (char) {
        const data = await miGetAvatarDetail(uid, region, cookie, char);
        if (!data) return true;
        skillList = data.skill_list;
        //var skillList=char.
    } else {
        const res = await miGetAvatarSkills(uid, region, cookie, roleId);
        if (!res) {
            msg.sendMsgEx({ content: '暂无角色数据,请稍后再试' });
            return true;
        }
        res.list.forEach((item) => { item.level_current = 1; });
        skillList = res.list;
        char = {
            level: 1,
            name: roleName,
            icon: `../../../../resources/genshin/logo/role/${roleName}.png`,
            rarity: roleId4.includes(roleId) ? 4 : 5,
        } as any;
    }


    if (!char) return;

    skillList = skillList.filter((item) => item.max_level != 1);

    const body = {
        avatar_id: roleId,
        avatar_level_current: char!.level,
        avatar_level_target: defSetSkill[0],
        skill_list: [{
            id: skillList[0].group_id,
            level_current: skillList[0].level_current,
            level_target: defSetSkill[2],
        }, {
            id: skillList[1].group_id,
            level_current: skillList[1].level_current,
            level_target: defSetSkill[3],
        }, {
            id: skillList[2].group_id,
            level_current: skillList[2].level_current,
            level_target: defSetSkill[4],
        }],
        weapon: {

        }
    };

    if (char.weapon) {
        if (char.weapon.rarity < 3) {
            defSetSkill[1] = 70;
        }
        body.weapon = {
            id: char.weapon.id,
            level_current: char.weapon.level,
            level_target: defSetSkill[1],
        };
    }

    const computes = await miGetAvatarCompute(uid, region, cookie, JSON.stringify(body)) as { [key: string]: AvatarComputeConsume[] } | null;
    if (!computes) return true;

    for (let i in computes) {
        for (let j in computes[i]) {
            computes[i][j].num = computes[i][j].num > 10000 ? (computes[i][j].num / 10000).toFixed(1) + " w" : computes[i][j].num as any;
            if (computes[i][j].name.includes("「")) {
                computes[i][j].isTalent = true;
            }
        }
    }

    render({
        app: "genshin",
        type: "skillCalculate",
        imgType: "jpeg",
        render: { saveId: msg.author.id },
        data: {
            uid,
            charInfo: char,
            setSkill: defSetSkill,
            skillList,
            computes,
        }
    }).then((saveFile) => {
        if (saveFile) msg.sendMsgEx({ imagePath: saveFile });
        else throw new Error("not found image");
    }).catch(err => {
        log.error(err);
    });

}
