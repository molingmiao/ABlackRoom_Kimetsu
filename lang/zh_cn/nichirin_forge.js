(function() {
  var forms={water:'水',flame:'炎',thunder:'雷',beast:'兽',insect:'虫',sound:'音',mist:'霞',wind:'风',stone:'岩',flower:'花',love:'恋',serpent:'蛇',sun:'日',moon:'月'}, labels={};
  Object.keys(forms).forEach(function(id) {
    labels['nichirin blade '+id]='日轮刀·'+forms[id]+'之呼吸'+(id==='moon'?'剑谱拟式':'');
    labels['supreme nichirin blade '+id]='极日轮刀·'+forms[id]+'之呼吸'+(id==='moon'?'剑谱拟式':'');
  });
  labels['flame form needs a nichirin katana, nichirin spear or flame blade to leave deep cuts.'] = '炎之流派需要装备并携带日轮刀、日轮枪、炎刃或任意锻造日轮刀，才能留下深创。';
  labels['flame style mechanics'] = '日轮刀、日轮枪、炎刃或任意锻造日轮刀命中留下斩痕，每秒造成该次实际伤害的 {0}%，持续 3 秒；刷新，不叠计时器。';
  labels['land a nichirin weapon hit to open a deep cut.'] = '日轮刀、日轮枪、炎刃或任意锻造日轮刀命中后留下斩痕。';
  labels['nichirin katana, nichirin spear and flame blade hits leave a deep cut: 18% of actual damage each second for 3 seconds. new cuts refresh, not stack.'] = '日轮刀、日轮枪、炎刃或任意锻造日轮刀命中后留下深切斩痕：每秒造成此次实际伤害的 18%，持续 3 秒；再次命中刷新斩痕，不叠层。';
  labels['Nichirin katana, spear or flame blade hits leave a cut: {0}% actual hit damage each second for 3s. Refreshes, never stacks timers.'] = '日轮刀、日轮枪、炎刃或任意锻造日轮刀命中留下斩痕：每秒造成实际伤害的 {0}%，持续 3 秒；刷新但不叠层。';
  _.addTranslation(labels);
})();
