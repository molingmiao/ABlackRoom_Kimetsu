/** Read-only field notes. Never reveal fog or persist an active expedition. */
var WorldStoryGuide = {
  sites: [
    {tile:'Q',id:'sagiri',flag:'game.sagiriRoadDone',name:'狭雾山旧道',
      clue:'通常距庄园约 7 格；寻找山间的送货旧道。',hint:'可选见闻 · 辨路、送粮与救援，无章节战斗。'},
    {tile:'G',id:'drumRoad',flag:'game.drumRoadDone',name:'鼓屋外围',
      clue:'通常距庄园约 11 格；留意林中的鼓声与接应记号。',hint:'可选支援 · 三人组接应，1 场外围战斗。建议带武器与治疗用品。'},
    {tile:'J',id:'wisteriaHouse',flag:'game.wisteriaHouseDone',name:'藤之家',
      clue:'通常距庄园约 16 格；寻找挂着藤花家纹的屋舍。',hint:'可选护送 · 休养日常与夜路救援，1 场战斗。'},
    {tile:'E',id:'butterfly',flag:'game.butterflyEstateDone',name:'蝶屋',
      clue:'通常距庄园约 12 格；康复院落在藤花之间。',hint:'蜘蛛山安全交付后可康复训练；完成列车的旧队士保留原主线资格。'},
    {tile:'T',id:'mugentrain',flag:'game.world.mugentrain',name:'无限列车站台',
      clue:'通常距庄园约 18 格；沿铁道寻找支援站台。',hint:'主线支援 · 救援乘客、守住撤离通道。不是 P 补给驿站或 X 列车残骸。'},
    {tile:'O',id:'yoshiwara',flag:'game.yoshiwaraDone',name:'游郭',
      clue:'通常距庄园约 15 格；只有一处 O，D/R 是普通城镇。',hint:'主线支援 · 调查、带穴救援与居民撤离。'},
    {tile:'K',id:'swordsmith',flag:'game.swordsmithChapterDone',name:'锻刀村',
      clue:'通常距庄园约 22 格；寻找唯一的刀匠村落。',hint:'游郭交付后支援刀匠；完整通关并安全返程可获藤花精油图纸。'}
  ],
  entries: function() {
    if (Engine.activeModule !== World || World.dead || !World.state || !World.curPos) return [];
    var state = World.state, known = {};
    (state.mask || []).forEach(function(row,x) {
      if (!Array.isArray(row)) return;
      row.forEach(function(visible,y) {
        if (!visible) return; // Do not inspect or disclose hidden terrain.
        var cell = state.map && state.map[x] && state.map[x][y];
        if (typeof cell === 'string' && !known[cell.charAt(0)]) known[cell.charAt(0)] = [x,y];
      });
    });
    return WorldStoryGuide.sites.map(function(site) {
      var position = known[site.tile], completed = !!$SM.get(site.flag);
      var pending = !completed && !!state[site.id], directions = [];
      if (position) {
        var dx = position[0] - World.curPos[0], dy = position[1] - World.curPos[1];
        if (dx) directions.push((dx > 0 ? '东' : '西') + Math.abs(dx) + ' 格');
        if (dy) directions.push((dy > 0 ? '南' : '北') + Math.abs(dy) + ' 格');
      }
      return {tile:site.tile,name:site.name,hint:site.hint,
        status:completed ? 'done' : pending ? 'pending' : position ? 'known' : 'unknown',
        statusText:completed ? '已安全交付' : pending ? '本次完成 · 待安全返程' : position ? '已发现 · 待探索' : '尚未发现',
        route:position ? (directions.length ? '当前位置向' + directions.join('、') + '，不绕路至少 ' + World.getDistance(position,World.curPos) + ' 步。' : '你就在这里。') : site.clue,
        note:pending ? '请先安全回庄园；途中失败不保存本次完成进度。'
          : completed && ['Q','G','J'].indexOf(site.tile) >= 0 ? '可重访回顾；不重复战斗或发放补给。' : ''};
    });
  },
  update: function() {
    var entries = WorldStoryGuide.entries(), guide = $('#worldStoryGuide');
    if (!entries.length) {if (guide.length) guide.hide();return;}
    if (!guide.length) {
      if (!$('#map').length) return;
      guide = $('<details>').attr('id','worldStoryGuide').insertBefore('#map');
      $('<summary>').appendTo(guide);
      $('<p>').addClass('worldStoryIntro').text('Q / G / J 是可选支援见闻，不阻挡主线。方向仅标示已发现地点，不自动带路；备足返程补给，战斗仍有风险。').appendTo(guide);
      var list = $('<div>').addClass('worldStoryList').attr({tabindex:0,'aria-label':'剧情地点与探索线索'}).appendTo(guide);
      entries.forEach(function(entry) {
        var card = $('<article>').addClass('worldStoryCard').attr('data-tile',entry.tile).appendTo(list);
        $('<strong>').text(entry.tile + ' · ' + entry.name).appendTo(card);
        $('<span>').addClass('worldStoryStatus').appendTo(card);
        $('<p>').addClass('worldStoryRoute').appendTo(card);
        $('<p>').addClass('worldStoryHint').text(entry.hint).appendTo(card);
        $('<p>').addClass('worldStoryNote').appendTo(card);
      });
    }
    var done = entries.filter(function(entry){return entry.status === 'done';}).length;
    var pending = entries.filter(function(entry){return entry.status === 'pending';}).length;
    guide.show().find('summary').text('剧情地点与见闻 · 已交付 ' + done + '/' + entries.length + (pending ? ' · 待返程 ' + pending : '') + '（展开查看）');
    entries.forEach(function(entry) {
      var card = guide.find('[data-tile="' + entry.tile + '"]');
      card.attr('data-status',entry.status);
      card.find('.worldStoryStatus').text(entry.statusText);
      card.find('.worldStoryRoute').text(entry.route);
      card.find('.worldStoryNote').text(entry.note).toggle(!!entry.note);
    });
  }
};
