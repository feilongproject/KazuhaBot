export const details = [{
  title: "E点按伤害",
  dmg: ({ talent }: any, dmg: any) => dmg(talent.e['点按伤害'], 'e')
}, {
  title: "E长按伤害",
  dmg: ({ talent }: any, dmg: any) => dmg(talent.e['长按伤害'], 'e')
}, {
  title: "Q单段伤害",
  params: { q: true },
  dmg: ({ talent }: any, dmg: any) => {
    let basic = dmg(talent.q['持续伤害'], 'q');
    //暂时以物伤近似计算
    let fj = dmg(talent.q['附加元素伤害'], 'q', 'phy');
    return {
      dmg: basic.dmg + fj.dmg,
      avg: basic.avg + fj.avg
    }
  }
}, {
  title: "扩散反应伤害",
  dmg: ({ }: any, { ks }: any) => ks()
}];

export const mainAttr = "atk,cpct,cdmg";

export const buffs = [{
  title: "温迪2命：E降低12%风抗与物抗",
  cons: 2,
  data: {
    kx: 12
  }
}, {
  title: "温迪4命：温迪获取元素晶球或元素微粒后，获得25%风元素伤害加成",
  cons: 4,
  data: {
    dmg: 25
  }
}, {
  title: "温迪6命：Q降低20%风抗",
  cons: 6,
  data: {
    kx: ({ params }: any) => params.q ? 20 : 0
  }
}, {
  title: "元素精通：扩散伤害提高[ks]%",
  mastery: "ks"
}];