/** Read-only preparation journal. No active expedition or unearned chapter is opened here. */
var LongQuestJournal = {
  canShow: function() {
    if (window.UIContext) return UIContext.canInspect();
    return [Room,Path,Ship].indexOf(Engine.activeModule) >= 0 && !Engine.keyLock && !Events.activeEvent()
      && !document.querySelector('[role="dialog"],#loadoutEditorOverlay,#scrapQuantityOverlay,#buyQuantityOverlay,#nichirinForgeOverlay,#achievementsOverlay');
  },
  model: function() {
    var data = LongQuests.saved(), preview = LongQuests.travelPreview();
    return {stage:data.npc.stage,branch:data.npc.branch,preview:preview,
      history:LongQuests.stages.slice(0,data.npc.stage).map(function(stage,index){
        return {title:(index+1) + ' · ' + stage.title,place:stage.place,
          paragraphs:[stage.intro,stage.a,stage.b,data.npc.branch === 'mercy' ? stage.mercy : stage.slay]};
      }),corners:LongQuests.corners.map(function(c){return c.name + (data.corners.indexOf(c.tile) >= 0 ? '：已交付' : '：尚未交付');}),
      cornerEntry:data.cornerEntry,echo:data.echo,archive:data.archive,
      notes:window.WorldRoadStories ? WorldRoadStories.entries.filter(function(entry){return WorldRoadStories.ids($SM.get('game.roadsideSeen')).indexOf(entry.id) >= 0;}).map(function(entry){return {title:entry.title,text:entry.text};}) : []};
  },
  show: function() {
    if (!LongQuestJournal.canShow()) return false;
    var model = LongQuestJournal.model();
    Events.startEvent({title:'长线任务册 · 出发前查阅',scenes:{start:{text:[],buttons:{closeLongQuestJournal:{text:'收好任务册，继续整备',nextScene:'end'}}}}},{width:'620px'});
    var panel = Events.eventPanel().addClass('expeditionReport longQuestReport'), desc = panel.find('#description').empty();
    var section = function(title){var card=$('<section>').addClass('expeditionSection').appendTo(desc);$('<h3>').text(title).appendTo(card);return card;};
    var current = section('失名的引路人 · 已交付 ' + model.stage + '/10');
    $('<strong>').text(model.branch ? '已锁定路线：' + (model.branch === 'mercy' ? '封缚查证' : '击杀追查') : '从无名渡口 N 开始；通常距庄园约 9 格，首次选择安全交付后锁定。').appendTo(current);
    if (model.preview) {
      $('<p>').append($('<strong>').text('下一站：' + model.preview.destination)).appendTo(current);
      $('<p>').text(model.preview.text).appendTo(current);
      if (model.preview.warning) $('<p>').addClass('longQuestTravelWarning').text(model.preview.warning).appendTo(current);
    } else $('<p>').text('调查已结案。下方可回读本路线已交付的全部记录，结局奖励不会重复领取。').appendTo(current);
    $('<p>').text('地图中先关闭当地普通事件，再展开“剧情地点与见闻 → 长线任务与秘闻”处理调查。阶段成果安全回家后保存。').appendTo(current);
    var eggs = section('地图秘闻');
    model.corners.forEach(function(text){$('<p>').text(text).appendTo(eggs);});
    $('<p>').append($('<strong>').text(model.cornerEntry ? '四方灯火：已完成入城共鸣。' : '四角全部交付后，下一次真实进入无限城触发成就；旧队士同样适用。')).appendTo(eggs);
    $('<p>').text('归路的回声：' + (model.echo ? '已交付。' : '同一趟按 Q → G → J 拜访后安全返回。')).appendTo(eggs);
    $('<p>').text('九封无名来信：' + (model.archive ? '合订本已交付。' : '见闻已收录 ' + model.notes.length + '/9；集齐后到藤之家 J 寻找执笔人，再安全交付。')).appendTo(eggs);
    var history = section('已交付调查记录 · ' + model.history.length + ' 篇');
    if (!model.history.length) $('<p>').text('尚无已交付章节。调查途中获得的新线索需安全返回后才能在这里回读。').appendTo(history);
    model.history.forEach(function(entry){
      var fold=$('<details>').addClass('longQuestHistoryCard').appendTo(history);
      $('<summary>').text(entry.title).appendTo(fold);$('<strong>').text(entry.place).appendTo(fold);
      entry.paragraphs.forEach(function(text){$('<p>').text(text).appendTo(fold);});
    });
    var notes=section('已收录沿途见闻 · ' + model.notes.length + '/9');
    if (!model.notes.length) $('<p>').text('准备好补给后探索普通路段，安全返程即可收录沿途见闻。').appendTo(notes);
    model.notes.forEach(function(entry){var fold=$('<details>').addClass('longQuestHistoryCard').appendTo(notes);$('<summary>').text(entry.title).appendTo(fold);$('<p>').text(entry.text).appendTo(fold);});
    return true;
  }
};
