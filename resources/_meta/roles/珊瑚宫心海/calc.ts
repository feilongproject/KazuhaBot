import lodash from "lodash";

export const details = [{
  check: ({ cons }: any): any => cons < 2,
  title: "水母每跳治疗",
  dmg: ({ attr, talent, calc }: any, { heal }: any): any => {
    let t = talent.e['治疗量2'], hp = calc(attr.hp);
    return heal(hp * t[0] / 100 + t[1] * 1);
  }
}, {
  cons: 2,
  title: "半血水母每跳治疗",
  dmg: ({ attr, talent, calc }: any, { heal }: any): any => {
    let t = talent.e['治疗量2'], hp = calc(attr.hp);
    return heal(hp * t[0] / 100 + t[1] * 1 + hp * 0.045);
  }
}, {
  title: "开Q普攻三段伤害",
  dmg: ({ attr, talent }: any, dmg: any): any => dmg(talent.a['三段伤害'], 'a')
}, {
  title: "开Q重击伤害",
  dmg: ({ attr, talent }: any, dmg: any): any => dmg(talent.a['重击伤害'], 'a2')
}, {
  title: "开Q普攻三段总伤",
  dmg: ({ attr, talent, cons, calc }: any, dmg: any): any => {
    let ret = { dmg: 0, avg: 0 };
    lodash.forEach('一二三'.split(""), (num) => {
      let dmgRet = dmg(talent.a[`${num}段伤害`], 'a');
      ret.dmg += dmgRet.dmg;
      ret.avg += dmgRet.avg;
    });
    if (cons > 0) {
      let dmgRet = dmg.basic(calc(attr.hp) * 0.3);
      ret.dmg += dmgRet.dmg;
      ret.avg += dmgRet.avg;
    }
    return ret;
  }
}];

export const defDmgIdx = 2;
export const mainAttr = "hp,atk";


export const buffs = [{
  title: "心海被动：治疗加成提高25%",
}, {
  title: "心海被动：开Q后重击伤害基于治疗加成提高[aPlus]",
  data: {
    aPlus: ({ attr, calc }: any): any => calc(attr.hp) * calc(attr.heal) * 0.15 / 100,
    a2Plus: ({ attr, calc }: any): any => calc(attr.hp) * calc(attr.heal) * 0.15 / 100
  }
}, {
  title: "海人化羽：开Q后普攻伤害提高[aPlus]",
  data: {
    aPlus: ({ attr, talent, calc }: any): any => calc(attr.hp) * talent.q['普通攻击伤害提升'] / 100
  }
}, {
  title: "海人化羽：开Q后重击伤害提高[a2Plus]",
  data: {
    a2Plus: ({ attr, talent, calc }: any): any => calc(attr.hp) * talent.q['重击伤害提升'] / 100
  }
}, {
  title: "心海1命：开Q后第三段普攻额外释放一只游鱼，造成生命值上限30%的水元素伤害",
  cons: 1
}, {
  title: "心海6命：开Q攻击获得治疗后，获得40%水伤加成",
  cons: 6,
  data: {
    dmg: 40
  }
}];