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
  objectiveLabels: {
    sagiri:{route:'确认山道',supplies:'完成送粮或修屋',rescue:'找回送货人'},
    drumRoad:{children:'安顿孩子',signals:'约定接应信号',guard:'守住撤离道路'},
    wisteriaHouse:{companions:'整理伙伴提醒',route:'确定夜路路线',escort:'护送送药人'},
    butterfly:{tanjiro:'炭治郎的协作',zenitsu:'善逸的协作',inosuke:'伊之助的协作',escort:'完成药材护送'},
    swordsmith:{forge:'协助刀匠',kotetsu:'小铁的训练',letters:'阅读伙伴来信',fish:'守住刀匠',gale:'打通撤离通道',wood:'掩护后方伤者'}
  },
  accessHint: function(site) {
    if (site.id === 'mugentrain' && window.EarlyGame && !EarlyGame.trainReady()) {
      var missing = [];
      [['iron mine','铁矿供应'],['coal mine','煤矿供应'],['steelworks','炼钢场']].forEach(function(item) {
        if (!$SM.get('game.buildings[' + JSON.stringify(item[0]) + ']',true)) missing.push(item[1]);
      });
      if (!EarlyGame.worldChapterCleared('M')) missing.push('蜘蛛山安全交付');
      return '尚缺：' + missing.join('、') + '。';
    }
    if (site.id === 'yoshiwara' && window.EarlyGame && !EarlyGame.storyPrerequisite('district')) return '尚缺：无限列车支援完成后安全回庄园。';
    var chapters = window.Events && Events.StoryChapters;
    if (chapters && chapters.definitions[site.id] && !chapters.ready(site.id)) {
      if (site.id === 'swordsmith') return '尚缺：游郭救援完成后安全回庄园。';
      if (site.id === 'butterfly') return '尚缺：蜘蛛山完成后安全回庄园；已有后续剧情资格的旧存档可直接进入。';
    }
    return '';
  },
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
      var access = !completed && !pending ? WorldStoryGuide.accessHint(site) : '';
      var labels = WorldStoryGuide.objectiveLabels[site.id], objectives = [];
      var chapters = window.Events && Events.StoryChapters;
      var progress = chapters && (chapters._progress || {})[site.id];
      if (!completed && labels && progress && progress.state === state) {
        Object.keys(labels).forEach(function(key){objectives.push((chapters.has(site.id,key) ? '✓ ' : '○ ') + labels[key]);});
      }
      if (position) {
        var dx = position[0] - World.curPos[0], dy = position[1] - World.curPos[1];
        if (dx) directions.push((dx > 0 ? '东' : '西') + Math.abs(dx) + ' 格');
        if (dy) directions.push((dy > 0 ? '南' : '北') + Math.abs(dy) + ' 格');
      }
      return {tile:site.tile,name:site.name,hint:site.hint,access:access,objectives:objectives,
        status:completed ? 'done' : pending ? 'pending' : position ? 'known' : 'unknown',
        statusText:completed ? '已安全交付' : pending ? '本次完成 · 待安全返程' : position ? (access ? '已发现 · 前置未齐' : '已发现 · 可进入') : '尚未发现',
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
        $('<p>').addClass('worldStoryAccess').appendTo(card);
        $('<p>').addClass('worldStoryObjectives').appendTo(card);
        $('<p>').addClass('worldStoryNote').appendTo(card);
      });
    }
    var done = entries.filter(function(entry){return entry.status === 'done';}).length;
    var pending = entries.filter(function(entry){return entry.status === 'pending';}).length;
    guide.show().children('summary').text('剧情地点与见闻 · 已交付 ' + done + '/' + entries.length + (pending ? ' · 待返程 ' + pending : '') + '（展开查看）');
    entries.forEach(function(entry) {
      var card = guide.find('[data-tile="' + entry.tile + '"]');
      card.attr('data-status',entry.status);
      card.find('.worldStoryStatus').text(entry.statusText);
      card.find('.worldStoryRoute').text(entry.route);
      card.find('.worldStoryAccess').text(entry.access).toggle(!!entry.access);
      card.find('.worldStoryObjectives').text(entry.objectives.length ? '本次尝试：' + entry.objectives.join('；') + '。整章交付前不保存，重新进入会重做。' : '').toggle(!!entry.objectives.length);
      card.find('.worldStoryNote').text(entry.note).toggle(!!entry.note);
    });
    WorldStoryGuide.updateJournal(guide);
    if (window.LongQuests) LongQuests.render(guide);
  },
  updateJournal: function(guide) {
    if (!window.WorldRoadStories) return;
    var api = WorldRoadStories, saved = api.ids($SM.get('game.roadsideSeen')), current = api.notes();
    var journal = guide.find('.worldRoadJournal');
    if (!journal.length) {
      journal = $('<details>').addClass('worldRoadJournal').appendTo(guide);
      $('<summary>').appendTo(journal);
      $('<p>').text('沿途见闻不打断操作、不送资源；平安经过 6 处不同普通路段后出现一段，每次远征最多 3 段。战斗、缺水、饥饿或濒危时不触发；安全返程后收录，途中失败不收录本次新篇。').appendTo(journal);
      $('<div>').addClass('worldRoadNotes').attr({tabindex:0,'aria-label':'已听到的沿途见闻'}).appendTo(journal);
    }
    journal.find('summary').text('沿途见闻册 · 已收录 ' + saved.length + '/' + api.entries.length + ' · 本次听到 ' + current.length);
    var signature = saved.join(',') + '/' + current.join(',');
    if (journal.data('notes-signature') === signature) return;
    journal.data('notes-signature',signature);
    var list = journal.find('.worldRoadNotes'), scroll = list.scrollTop();list.empty();
    api.entries.forEach(function(entry) {
      if (saved.indexOf(entry.id) < 0 && current.indexOf(entry.id) < 0) return;
      var card = $('<article>').addClass('worldStoryCard').appendTo(list);
      $('<strong>').text(entry.title + (saved.indexOf(entry.id) >= 0 ? ' · 已收录' : ' · 待安全返程')).appendTo(card);
      $('<p>').text(entry.text).appendTo(card);
    });
    if (!list.children().length) $('<p>').text('尚未听到沿途见闻；先准备好补给，再沿普通地形探索。').appendTo(list);
    list.scrollTop(scroll);
  }
};
