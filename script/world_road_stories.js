/** Non-blocking original roadside vignettes. Active notes never enter a save. */
var WorldRoadStories = {
  _run: null,
  entries: [
    {id:'near_rope',zone:0,title:'补好的绳结',text:'山脚的送货人把断绳重新接好，特意留出一个让伤手也能握住的圈。他说，送到山上的不只有粮食，还有让人愿意继续等下去的消息。'},
    {id:'near_crow',zone:0,title:'鎹鸦没有催促',text:'鎹鸦落在低枝上，等走得最慢的人过了岔口才再次振翅。队伍沿着它留下的方向聚拢，没有谁因落后几步就被忘在雾里。'},
    {id:'near_cloth',zone:0,title:'留在枝头的布条',text:'岔口的布条已经褪色，结却仍绑得牢。路过的队士扶正枝条，露出朝向归路的一端：有人来过，也有人记得替后来的人留一条路。'},
    {id:'middle_list',zone:1,title:'名单的空白处',text:'隐在路边核对送往庄园的名单。一个名字旁还没有回应，他便把那一栏留着，不急着落笔；活着的人值得多等一次确切的消息。'},
    {id:'middle_bowl',zone:1,title:'多摆的一只碗',text:'废弃市镇的门廊下，有人替晚归的送药人多摆了一只碗。柴火已经很小，守门人却仍把饭盖好。他不知道对方几时到，只想让到家的人能吃口热的。'},
    {id:'middle_wheels',zone:1,title:'车辙旁的脚印',text:'一段车辙在泥里陷得很深，旁边却多了好几双脚印。推车的人早已离开，只留下垫在坑里的木板；一次没有写进战报的援手，也让路继续向前。'},
    {id:'far_smith',zone:2,title:'裹好的刀匠包',text:'转运的包裹外缠着旧衣，里面的刀匠工具没有碰出一点响声。护送人说，修好一把刀之前，要先让握锤的那双手平安抵达。'},
    {id:'far_letter',zone:2,title:'没有战果的来信',text:'鎹鸦衔来的信没有写斩下多少鬼，只写着“伤者已送到，饭还有热的”。读信的队士把纸折得很小，放在最不容易被雨淋湿的地方。'},
    {id:'far_bridge',zone:2,title:'桥上的最后一盏灯',text:'山谷的桥头只剩一盏灯。值守的人数着通过的脚步，直到最后一声回应传来，才收起松动的木板。黑暗还在，归路却没有因此断掉。'}
  ],
  begin: function() {
    WorldRoadStories._run = {state:World.state,visited:{},steps:0,lastAt:0,notes:[]};
  },
  current: function() {
    var run = WorldRoadStories._run;
    return run && World.state && run.state === World.state ? run : null;
  },
  ids: function(values) {
    return Array.isArray(values) ? WorldRoadStories.entries.filter(function(entry){return values.indexOf(entry.id) >= 0;}).map(function(entry){return entry.id;}) : [];
  },
  notes: function() {
    var run = WorldRoadStories.current();
    return run ? run.notes.slice() : [];
  },
  onMove: function() {
    var api = WorldRoadStories, run = api.current();
    if (!run || Engine.activeModule !== World || World.dead || Engine.keyLock || Events.activeEvent()
      || World.starvation || World.thirst || World.health <= World.getMaxHealth() * 0.25 || run.notes.length >= 3) return false;
    var tile = World.state.map[World.curPos[0]][World.curPos[1]];
    if (!World.isTerrain(tile) && tile !== World.TILE.ROAD) return false;
    var cell = World.curPos.join(',');
    if (run.visited[cell]) return false;
    run.visited[cell] = true;
    run.steps++;
    if (run.steps - run.lastAt < 6) return false;
    var distance = World.getDistance(), zone = distance < 10 ? 0 : distance < 20 ? 1 : 2;
    var candidates = api.entries.filter(function(entry){return entry.zone === zone && run.notes.indexOf(entry.id) < 0;});
    if (!candidates.length) return false;
    var saved = api.ids($SM.get('game.roadsideSeen'));
    var unseen = candidates.filter(function(entry){return saved.indexOf(entry.id) < 0;});
    var pool = unseen.length ? unseen : candidates, entry = pool[Math.floor(Math.random() * pool.length)];
    run.notes.push(entry.id);run.lastAt = run.steps;
    Notifications.notify(World,'沿途见闻 · ' + entry.title + '：' + entry.text);
    return true;
  },
  commit: function() {
    var api = WorldRoadStories, run = api.current();
    if (!run || Engine.activeModule !== World || World.dead || $SM.get('game.world.map') !== World.state.map) return false;
    var before = api.ids($SM.get('game.roadsideSeen')), after = api.ids(before.concat(run.notes));
    if (before.length === after.length) return false;
    $SM.set('game.roadsideSeen',after,true);
    return true;
  },
  reset: function() {WorldRoadStories._run = null;}
};
