// @ts-nocheck
export const details = [{
  title: "锅巴单口伤害",
  dmg: ({ talent }, dmg) => dmg(talent.e['喷火伤害'], 'e')
}, {
  title: "锅巴单口蒸发",
  dmg: ({ talent }, dmg) => dmg(talent.e['喷火伤害'], 'e', 'zf')
}, {
  title: "旋火轮单次伤害",
  dmg: ({ talent, }, dmg) => dmg(talent.q['旋火轮伤害'], 'q')
}, {
  title: "旋火轮单次蒸发",
  dmg: ({ talent, }, dmg) => dmg(talent.q['旋火轮伤害'], 'q', 'zf')
}];

export const mainAttr = "atk,cpct,cdmg";

export const buffs = [{
  cons: 1,
  title: "香菱1命：锅巴降低敌人火抗15",
  data: {
    kx: 15
  }
}, {
  title: "元素精通：蒸发融化伤害提高[zf]%",
  mastery: "zf,rh"
}]
