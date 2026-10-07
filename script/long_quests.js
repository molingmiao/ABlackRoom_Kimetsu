/** Original optional campaigns. Only safe returns publish overworld checkpoints. */
var LongQuests = {
  _run:null,
  corners:[
    {tile:'1',name:'西北 · 晨灯室',x:0,y:0,answer:'朝阳',wrong:'残月',clue:'碑文写着：长夜之后，先向升起的光致意。'},
    {tile:'2',name:'东北 · 风铃室',x:60,y:0,answer:'风铃',wrong:'铁鼓',clue:'碑文写着：风经过空屋，细小的铃声代你回答。'},
    {tile:'3',name:'西南 · 归水室',x:0,y:60,answer:'流水',wrong:'磐石',clue:'碑文写着：山间的水不留在原处，终会找到归路。'},
    {tile:'4',name:'东南 · 藤影室',x:60,y:60,answer:'藤花',wrong:'枯枝',clue:'碑文写着：门上的花纹，留给仍在夜路上的人。'}
  ],
  stages:[
    {tile:'N',place:'无名渡口 N（通常距庄园约 9 格）',title:'没有名字的求饶',
      intro:'一只受伤的鬼被旧绳索困在废弃渡口。它自称忘了名字，却紧握半张送药名单。你无法仅凭一句求饶就判断它是否仍会伤人。',
      a:'翻看名单：纸边有藤之家旧药袋的压痕，背面却沾着血。这里可能有失踪者，也可能是引诱队士的圈套。',
      b:'检查河岸：有人的脚印向镇外延伸，鬼的足迹却在渡口往返。它说有人拿走了另一半名单，但没法证明自己清白。',
      mercy:'你放过它，没有让它自由离开，而是交由隐封缚看守。它低声说出一个模糊的字：“槐”。这不是洗清罪责，只是留下继续查证的机会。',
      slay:'你斩断了眼前的威胁，也失去了唯一会回答问题的证人。隐收走半张名单：剩下的名字，必须从物证和幸存者口中找回来。'},
    {tile:'Q',place:'狭雾山旧道 Q',title:'山雾里的旧结',intro:'名单上的第一个记号像一枚绳结。你沿狭雾山的送货旧路，寻找曾经替药队引路的人。',
      a:'石阶旁留着两种绳结：一种固定货物，另一种提醒行人绕过机关。送货人记得有人将危险路段重新标记过。',
      b:'老人取出旧账页。一个被划去的名字旁，画着与渡口相同的槐叶。他只肯确认那个人曾经送过药，不肯替后来的事担保。',
      mercy:'被看守的鬼托隐传来一句话：第二个绳结是给受伤的人留的。你把它和老人证词分开记录，没有将悔意当作证据。',
      slay:'没有人能解释第二个绳结。你将实物拓印夹进账页，决定用不同来源的证词补上沉默。'},
    {tile:'D',place:'任意宿场旧街 D',title:'被涂掉的账页',intro:'宿场掌柜记得那支药队，却先把门关了一半。有人警告过他，不要再提消失的送货人。',
      a:'柜台下的货账比墙上多了一页。你找出三笔重复的药费，收货记号却指向城外，不是病人的住处。',
      b:'掌柜终于承认，失名的人曾替伤者垫付药钱，也在后来引来过追踪者。这两件事都是真的，不能用一件抹去另一件。',
      mercy:'隐带来槐的口述，与账页日期相符，但漏掉了追踪者。你把遗漏明确记下，请看守者继续核对。',
      slay:'你用两份货账还原路线，补上再也无人承认的那一次遗漏。掌柜给出了藤之家的接应暗号。'},
    {tile:'J',place:'藤之家 J',title:'屋檐下的空位',intro:'藤之家仍保留着当年的一套餐具。屋主愿意讲述失踪药队，却不愿听你先给任何人下结论。',
      a:'药袋内衬缝着几个孩子的名字。它们不是货号，而是等待长期用药的人；你将名单与宿场货账逐一核对。',
      b:'屋主记得槐在人类时期曾留在这里。变成鬼之后的一次送药，也让追踪者找到了门外。感激与恐惧同时留在这所屋子里。',
      mercy:'你没有要求屋主原谅。她只托你告诉被封缚的槐：若还记得这些名字，就把追踪者的路线说清楚。',
      slay:'屋主知道它已经死去，沉默了一会儿，把另一半药袋交给你。斩首没有让失踪者自动回来，支援仍要继续。'},
    {tile:'G',place:'鼓屋外围 G',title:'藏在鼓声之外',intro:'另一半名单被藏在鼓屋外围的废木箱里。一只循着药味而来的伏路鬼守住了箱子，必须先保证取证的人能平安离开。',
      a:'你确认了撤离路线，留下不会和普通居民混淆的接应记号。箱子的锁已经坏了，危险来自附近的脚步声。',
      b:'泥地里有两组脚印：一组靠近木箱，一组通向背风的小沟。缺少线索的人只能守住路口，不能贸然带着队伍冲进去。',
      mercy:'槐提供的小沟位置与实地吻合。你借这条路径取回名单，避开正面冲突；线索有用，却仍不抵消它曾造成的伤害。',
      slay:'证人的线索已经断了。你打退伏路鬼，掩护隐取回木箱，终于拼齐名单。',fight:'slay'},
    {tile:'E',place:'蝶屋 E',title:'药箱里的错配',intro:'名单送到蝶屋，药材的编号却对不上。你协助核对来源，不把伤者当作试药对象，也不擅自改变处方。',
      a:'你把药袋、货账和送货日期排开，发现被偷换的不是某一种神药，而是几份原本要送给村民的普通药材。',
      b:'隐找回了开裂的药箱。箱底刻着废弃市镇的仓号，记录表上却写了另一个地点，说明还有人在利用失踪药队运货。',
      mercy:'你把槐的口述交给医护者核对；有几处说对了，也有几处因记忆混乱而错。你留下能被物证支持的部分。',
      slay:'你用货账和药箱对应每一批物资，不依赖已经无法追问的口供。仓号终于指向同一处市镇。'},
    {tile:'R',place:'任意废弃市镇 R',title:'仓库墙后的回声',intro:'空仓里没有等待你领取的宝物，只有几盏熄灭的灯和逃离时掉下的鞋。你开始重新寻找名单上的人。',
      a:'墙后传来敲击。你先确认回应，发现两名躲藏的送货人，安排他们走向已标记的出口。',
      b:'幸存者描述了操纵运输的追踪鬼，也承认槐曾为它带路。名单不是无罪证明，而是找到受害者的线索。',
      mercy:'幸存者不愿见槐。你尊重这一点，将他们安置到别处；槐的后续证词只经由隐转交，不要求他们接受道歉。',
      slay:'幸存者听到斩首的消息，仍先问其他人有没有活下来。你把调查重心留在人身上，而不是夸大战果。'},
    {tile:'K',place:'锻刀村 K',title:'断刃上的名字',intro:'追踪鬼留下的断刃被送到刀匠面前。你协助查明它的流转，不替刀匠作出无凭的判断。',
      a:'刀匠指出修补痕迹来自不同时间：有人多次把报废工具重新投入运货，而不是为一场大战备刀。',
      b:'柄内藏着小小的收货牌。你将它与仓号拼在一起，得知最后一批失踪者曾被带往列车站外。',
      mercy:'槐认得牌上的缺口，补出站外的旧引水道。你安排隐先验证路线，再让护送队行动。',
      slay:'你根据牌上的修补编号查出旧引水道。没有口述可以捷径抵达，每一段路线都由隐先行核对。'},
    {tile:'T',place:'无限列车站台 T',title:'站外最后一班接应',intro:'引水道通向站外废棚。追踪鬼仍守着最后的失踪者；这场支线不改写列车正篇，你负责站外的人。',
      a:'你确认棚内的人数，把不能独自行走的人交给接应队。追踪鬼察觉了动静，开始朝出口逼近。',
      b:'你检查退路：正面狭窄，侧面有一段遮蔽。现在必须守住撤离，而不是只顾追逐敌人。',
      mercy:'经验证的引水道让伤者提前离开，敌人也在追赶中受创。你守住较短的战线，终结追踪。',
      slay:'没有及时的口述路线，你守住完整的正面战线，掩护隐打开出口。追踪鬼倒下时，最后一个名字终于得到回应。',fight:'both'},
    {tile:'N',place:'无名渡口 N',title:'把名字交还给人',intro:'你带着一路调查的记录回到渡口。结案不是把所有人写成同一种颜色，而是说明谁做过什么、谁仍需要帮助。',
      a:'你逐页核对获救者与物资去向，不用推测填补缺失的证词。幸存者可以选择不见任何涉事者。',
      b:'隐接下最后的记录。无论渡口的选择是什么，调查都不能复活死者，但可以让仍在等候的人得到确切消息。',
      mercy:'槐仍被封缚看守，不能自由接近人群。它交出的线索帮助救回了人，造成的伤害也被完整写下。你为这份有边界的宽恕留下记录。',
      slay:'渡口不再有那个会回答问题的声音。你将物证与幸存者的证词封存，没有假称它生前的一切都已查清。斩首的结果和未尽的责任一同留下。'}
  ],
  saved: function() {
    var value = $SM.get('game.longQuests') || {}, npc = value.npc || {};
    var branch = ['mercy','slay'].indexOf(npc.branch) >= 0 ? npc.branch : null;
    var stage = Number.isInteger(npc.stage) ? Math.max(0,Math.min(10,npc.stage)) : 0;
    var corners = Array.isArray(value.corners) ? value.corners : [];
    return {npc:{stage:branch ? stage : 0,branch:stage ? branch : null},
      corners:LongQuests.corners.filter(function(c){return corners.indexOf(c.tile) >= 0;}).map(function(c){return c.tile;}),
      echo:!!value.echo,archive:!!value.archive,cornerEntry:!!value.cornerEntry};
  },
  begin: function() {LongQuests._run = {state:World.state,data:LongQuests.saved(),before:LongQuests.saved(),route:0,lastTowns:{}};},
  run: function() {var run = LongQuests._run;return run && World.state && run.state === World.state ? run : null;},
  reset: function() {LongQuests._run = null;},
  report: function() {
    var run = LongQuests.run();if (!run) return [];
    var notes = [], data = run.data, before = run.before;
    if (data.npc.stage > before.npc.stage) notes.push('失名的引路人：交付至 ' + data.npc.stage + '/10（' + (data.npc.branch === 'mercy' ? '封缚查证' : '击杀追查') + '）');
    if (data.corners.length > before.corners.length) notes.push('四角机关：已交付 ' + data.corners.length + '/4');
    if (data.echo && !before.echo) notes.push('归路的回声：顺序线索交付');
    if (data.archive && !before.archive) notes.push('九封无名来信：合订本交付');
    return notes;
  },
  tile: function() {return World.state && World.curPos ? String(World.state.map[World.curPos[0]][World.curPos[1]]).charAt(0) : '';},
  target: function(stage) {
    var data = LongQuests.stages[stage], run = LongQuests.run();if (!data) return null;
    if (['D','R'].indexOf(data.tile) < 0 || !run) return data.tile;
    // Ordinary towns become P after clearing. Keep the current-site handoff,
    // and give fully cleared legacy maps a hub fallback rather than a dead end.
    var last = run.lastTowns[data.tile];
    if (last && LongQuests.tile() === 'P' && last[0] === World.curPos[0] && last[1] === World.curPos[1]) return 'P';
    var remains = World.state.map.some(function(row){return Array.isArray(row) && row.some(function(cell){return String(cell).charAt(0) === data.tile;});});
    return remains ? data.tile : 'N';
  },
  destination: function(stage) {
    var data = LongQuests.stages[stage];if (!data) return '调查已结案';
    var target = LongQuests.target(stage);
    return target === data.tile ? data.place : target === 'P' ? '原地调查（刚清理的' + data.place + '）' : '无名渡口 N（旧城镇已清理，隐转送调查记录）';
  },
  canOpen: function() {return !!LongQuests.run() && Engine.activeModule === World && !World.dead && !Engine.keyLock && !Events.activeEvent();},
  valid: function(session) {
    return !!LongQuests.run() && session.state === World.state && Engine.activeModule === World && !World.dead
      && Events.activeEvent() === session.event && LongQuests.tile() === session.tile;
  },
  visit: function(tile) {
    var run = LongQuests.run();tile = String(tile).charAt(0);
    if (!run || World.dead || Engine.activeModule !== World) return;
    if (['D','R'].indexOf(tile) >= 0) run.lastTowns[tile] = World.curPos.slice();
    if (run.data.echo || ['Q','G','J'].indexOf(tile) < 0) return;
    if (tile === 'Q') run.route = 1;
    else if (tile === 'G') run.route = run.route === 1 ? 2 : 0;
    else if (tile === 'J') {
      if (run.route === 2) {run.route = 3;run.data.echo = true;Notifications.notify(World,'雾、鼓声、藤花的回声连成一条归路。安全返程后可交付这个发现。');}
      else run.route = 0;
    }
  },
  configure: function() {
    World.LANDMARKS.N = {num:1,minRadius:9,maxRadius:9,scene:'longQuestHub',label:'无名渡口 · 长线支线'};
    LongQuests.corners.forEach(function(c){World.LANDMARKS[c.tile] = {num:0,minRadius:0,maxRadius:0,scene:'cornerRoom',label:c.name};});
  },
  ensureMap: function() {
    var original = $SM.get('game.world.map');if (!Array.isArray(original)) return false;
    var map = original.map(function(row){return Array.isArray(row) ? row.slice() : row;}), changed = false;
    [{tile:'N',x:21,y:30}].concat(LongQuests.corners).forEach(function(site) {
      if (map.some(function(row){return Array.isArray(row) && row.some(function(cell){return String(cell).charAt(0) === site.tile;});})) return;
      var candidates = [];
      map.forEach(function(row,x){if (Array.isArray(row)) row.forEach(function(cell,y) {
        if (!World.isTerrain(cell)) return;
        if (site.tile !== 'N' && ((site.x === 0 ? x > 14 : x < 46) || (site.y === 0 ? y > 14 : y < 46))) return;
        if (site.tile === 'N' && World.getDistance([x,y]) < 5) return;
        candidates.push({x:x,y:y,d:Math.abs(x-site.x)+Math.abs(y-site.y)});
      });});
      candidates.sort(function(a,b){return a.d-b.d || a.x-b.x || a.y-b.y;});
      if (candidates.length) {map[candidates[0].x][candidates[0].y] = site.tile;changed = true;}
    });
    if (changed) $SM.set('game.world.map',map,true);
    return changed;
  },
  openSite: function(tile) {
    tile = String(tile).charAt(0);
    if (tile === 'N') {LongQuests.openNpc(true);return true;}
    var corner = LongQuests.corners.find(function(c){return c.tile === tile;});
    if (corner) {LongQuests.openCorner(corner);return true;}
    return false;
  },
  openNpc: function(hub) {
    var api = LongQuests, run = api.run();if (!api.canOpen()) return false;
    var stage = run.data.npc.stage, data = api.stages[stage];
    if (!data || api.tile() !== api.target(stage)) {
      if (!hub || api.tile() !== 'N') return false;
      Events.startEvent({title:'无名渡口',scenes:{start:{text:[data ? '下一阶段：' + data.title + '。请前往' + api.destination(stage) + '，完成当地普通事件后，可在地图“长线任务与秘闻”中继续调查。' : '失名的引路人已经结案。你曾作出的选择与调查记录保留，不重复发放结局奖励。','本次阶段进展安全返程后保存；途中失败会退回上次已交付的阶段。'],buttons:{leave:{text:'返回地图',nextScene:'end'}}}}});return true;
    }
    var s = {state:World.state,tile:api.target(stage),stage:stage,clues:{},branch:run.data.npc.branch,event:null,authorized:false};
    var valid = function(){return api.valid(s) && api.run().data.npc.stage === s.stage;};
    var mark = function(key){if (valid() && Events.activeScene === 'investigate') s.clues[key] = true;};
    var ready = function(){return !!(valid() && s.clues.a && s.clues.b);};
    var choose = function(branch){if (ready() && Events.activeScene === 'decision') s.branch = branch;};
    var finish = function(){
      if (!ready() || !s.authorized || ['mercy','slay'].indexOf(s.branch) < 0) return false;
      api.run().data.npc = {stage:s.stage+1,branch:s.branch};return true;
    };
    var fight = stage === 0 || data.fight === 'both' || (data.fight === 'slay' && s.branch === 'slay');
    var event = {title:'失名的引路人 · ' + (stage+1) + '/10 · ' + data.title,storySupply:true,scenes:{
      start:{text:[data.intro,'这是一条原创、可选的十阶段支线。每阶段先收集两份线索，再确认行动；可在同一趟远征继续追查，也可安全回家保存已完成阶段。未交付进展在失败时丢失，不提供暂停续关。'],buttons:{begin:{text:'整理线索，开始调查',nextScene:'investigate'},leave:{text:'暂不调查，返回地图',nextScene:'end'}}},
      investigate:{text:['不要急着把一份证词当作全部答案。先核对物证，再听另一方的说法。'],buttons:{
        clueA:{text:'核对现场物证',available:function(){return valid() && !s.clues.a;},onChoose:function(){mark('a');},nextScene:'clueA'},
        clueB:{text:'询问并对照证词',available:function(){return valid() && !s.clues.b;},onChoose:function(){mark('b');},nextScene:'clueB'},
        decide:{text:'两份线索已齐，决定行动',available:ready,nextScene:'decision'},leave:{text:'返回地图，本阶段需重新调查',nextScene:'end'}}},
      clueA:{text:[data.a],buttons:{back:{text:'记下物证，继续核对',nextScene:'investigate'}}},
      clueB:{text:[data.b],buttons:{back:{text:'记下证词，继续核对',nextScene:'investigate'}}},
      decision:{text:[stage === 0 ? '你已知道这份名单不能证明清白。放过意味着封缚看守、继续取证；击杀需要一场真实战斗，之后将失去它的口述线索。两条路线都能完成支线，但战斗、证词和结局不同。' : (s.branch === 'mercy' ? data.mercy : data.slay),'阶段成果只有安全返回才保存；首次选择交付后锁定，后续不能切换路线。'],buttons:{}},
      confirm:{text:[stage === 0 ? '确认这次决定。放过不代表信任或解除看守；击杀不代表余下的受害者已经获救。' : '按核实过的记录继续行动。下一阶段会前往另一个地点，未交付的调查仍有丢失风险。'],buttons:{}},
      fight:{combat:true,enemy:stage === 0 ? '失名的鬼' : '追索药队的鬼',enemyName:stage === 0 ? '失名的鬼' : '追索药队的鬼',chara:'鬼',
        health:stage === 0 ? 60 : s.branch === 'mercy' ? 80 : 130,damage:stage === 0 ? 4 : s.branch === 'mercy' ? 3 : 5,hit:0.8,attackDelay:2.8,loot:{},
        deathMessage:'威胁倒下。先确认接应的人平安，再把经过完整记入调查。',
        buttons:{report:{text:'清点获救者，记录结果',cooldown:Events._LEAVE_COOLDOWN,onChoose:function(){if (ready() && Events.activeScene === 'fight' && Events.fought) s.authorized = true;},nextScene:'result'}}},
      result:{text:[],onLoad:function(){
        var success = finish();event.scenes.result.text = success ? [s.branch === 'mercy' ? data.mercy : data.slay,
          stage === 9 ? '十阶段调查结束。安全回家后锁定结局成就与一次性补给。' : '本阶段已完成，尚待安全交付。下一站：' + api.destination(stage+1) + ' · ' + api.stages[stage+1].title + '。到达后结束普通事件，在地图任务册继续调查。'] : ['本阶段尚未满足调查或战斗条件，没有推进、扣费或发放奖励。'];
      },buttons:{leave:{text:'返回地图，继续追查或安全返程',nextScene:'end'}}}
    }};
    s.event = event;
    if (s.tile !== data.tile) event.scenes.start.text.unshift(s.tile === 'N' ? '此类旧城镇已被清理。隐把幸存者与调查记录带到无名渡口，在此继续核对，不需要重建或重打城镇。' : '城镇刚刚清理为驿站。接应者仍在原地，你可以继续核对线索。');
    if (fight) event.scenes.confirm.text.push((stage === 0 ? '仅选择击杀时战斗：' : '本阶段需要战斗：')
      + '敌人生命 ' + event.scenes.fight.health + '、每 ' + event.scenes.fight.attackDelay + ' 秒攻击，基础伤害 ' + event.scenes.fight.damage + '。请备好武器与治疗用品；可先取消整备。');
    if (stage === 0) {
      event.scenes.decision.buttons.mercy = {text:'放过它：封缚观察，继续查证',onChoose:function(){choose('mercy');},nextScene:'confirm'};
      event.scenes.decision.buttons.slay = {text:'击杀它：保留物证，放弃口述线索',onChoose:function(){choose('slay');},nextScene:'confirm'};
    } else event.scenes.decision.buttons.continue = {text:fight ? '准备保护接应队（需要战斗）' : '按线索完成本段调查',available:ready,nextScene:'confirm'};
    event.scenes.decision.buttons.leave = {text:'暂不决定，返回地图',nextScene:'end'};
    event.scenes.confirm.buttons.act = {text:stage === 0 ? '确认选择并行动（击杀分支进入战斗）' : fight ? '进入支援战斗' : '确认调查结果',available:ready,onChoose:function(){
      if (ready() && Events.activeScene === 'confirm' && !(stage === 0 ? s.branch === 'slay' : fight)) s.authorized = true;
    },nextScene:stage === 0 ? 'resolveChoice' : fight ? 'fight' : 'result'};
    // A choice-dependent routing scene avoids constructing the fight from an unconfirmed branch.
    if (stage === 0) {
      event.scenes.resolveChoice = {text:['决定已确认；沿选定路线行动。'],buttons:{
        spare:{text:'将它交给隐看守，记录决定',available:function(){return ready() && s.branch === 'mercy' && s.authorized;},nextScene:'result'},
        battle:{text:'拔刀应战',available:function(){return ready() && s.branch === 'slay';},nextScene:'fight'},
        leave:{text:'撤回本次调查，返回地图',nextScene:'end'}}};
    }
    event.scenes.confirm.buttons.leave = {text:'取消本次行动，返回地图',nextScene:'end'};
    Events.startEvent(event);return true;
  },
  openCorner: function(corner) {
    var api = LongQuests;if (!api.canOpen() || api.tile() !== corner.tile) return false;
    var s = {state:World.state,tile:corner.tile,event:null,read:false,correct:false};
    var event = {title:corner.name,scenes:{
      start:{text:['这间旧房间不属于无限城。四角机关是一组留在地表的接应记号；四座都开启并安全交付后，下一次真实进入无限城会得到“四方灯火”成就。已进入过无限城的队士同样可以完成。',api.run().data.corners.indexOf(corner.tile) >= 0 ? '本室机关已经开启，不再重复记录。' : '墙上有两枚不同的刻纹。先阅读碑文，再选择机关。'],buttons:{read:{text:'阅读碑文',nextScene:'mechanism'},leave:{text:'返回地图',nextScene:'end'}}},
      mechanism:{text:[corner.clue],onLoad:function(){if (api.valid(s)) s.read = true;},buttons:{
        correct:{text:'按下“' + corner.answer + '”刻纹',onChoose:function(){if (api.valid(s) && s.read && Events.activeScene === 'mechanism') s.correct = true;},nextScene:'lit'},
        wrong:{text:'按下“' + corner.wrong + '”刻纹',nextScene:'wrong'},leave:{text:'暂不操作，返回地图',nextScene:'end'}}},
      wrong:{text:['机关没有响应，也没有消耗物资。碑文提示的是一种明确的意象，可以回去重新核对。'],buttons:{retry:{text:'重新阅读碑文',nextScene:'mechanism'},leave:{text:'返回地图',nextScene:'end'}}},
      lit:{text:['机关亮起。安全回到庄园后才保存本次开关；四角可以分多趟完成。'],onLoad:function(){
        if (api.valid(s) && s.correct && api.run().data.corners.indexOf(corner.tile) < 0) api.run().data.corners.push(corner.tile);
      },buttons:{leave:{text:'返回地图，记得安全交付',nextScene:'end'}}}
    }};s.event = event;Events.startEvent(event);return true;
  },
  openArchive: function() {
    var api = LongQuests;
    if (!api.canOpen() || api.tile() !== 'J' || api.run().data.archive || !window.WorldRoadStories || WorldRoadStories.ids($SM.get('game.roadsideSeen')).length < 9) return false;
    var s = {state:World.state,tile:'J',event:null,accepted:false};
    var event = {title:'九封没有署名的信',scenes:{
      start:{text:['你把九段已经安全收录的沿途见闻放在藤之家桌上。屋主没有认领它们，而是请来送货人、隐和守桥者：这些记录不是某一位英雄独自写完的。','大家在各自记得的地方补上一句，留下彼此的名字。最后一页仍空着，给那些尚未走到这里的人。'],buttons:{finish:{text:'补全署名，收好九段见闻',onChoose:function(){if (api.valid(s) && Events.activeScene === 'start') s.accepted = true;},nextScene:'ending'},leave:{text:'先不交付，返回地图',nextScene:'end'}}},
      ending:{text:['执笔人的名字已经补全。安全返程后解锁“替无名者落款”，不再重复奖励。'],onLoad:function(){if (api.valid(s) && s.accepted) api.run().data.archive = true;},buttons:{leave:{text:'带着合订本返回地图',nextScene:'end'}}}
    }};s.event = event;Events.startEvent(event);return true;
  },
  commit: function() {
    var api = LongQuests, run = api.run();
    if (!run || World.dead || Engine.activeModule !== World || $SM.get('game.world.map') !== World.state.map) return false;
    var before = api.saved(), next = run.data;
    next.corners.sort();
    if (JSON.stringify(before) === JSON.stringify(next)) return false;
    $SM.set('game.longQuests',JSON.parse(JSON.stringify(next)),true);
    Notifications.notify(null,'长线任务的本次调查与机关进展已安全交付。');
    api.checkAchievements();return true;
  },
  onCastleEntry: function() {
    var data = LongQuests.saved();
    if (Engine.activeModule !== Space || World.dead || Space.currentFloor !== 1 || Engine.options.testerMode || data.corners.length !== 4 || data.cornerEntry) return false;
    data.cornerEntry = true;$SM.set('game.longQuests',data,true);
    LongQuests.checkAchievements();return true;
  },
  checkAchievements: function() {
    if (window.Achievements && Achievements._byId) ['namelessMercy','namelessSlay','fourCornerLights','roadEcho','namelessArchive'].forEach(function(id){Achievements.check(id);});
  },
  render: function(parent) {
    var run = LongQuests.run();if (!run || Engine.activeModule !== World || World.dead) return;
    var api = LongQuests, data = run.data, saved = api.saved(), stage = api.stages[data.npc.stage];
    var box = parent.find('.longQuestJournal');
    if (!box.length) {
      box = $('<details>').addClass('longQuestJournal').appendTo(parent);
      $('<summary>').text('长线任务与秘闻（展开查看）').appendTo(box);
      $('<p>').text('进展需安全回庄园才保存；可跨多趟远征完成，但不能暂停或恢复本次探索。支线不阻挡主线。').appendTo(box);
      $('<p>').addClass('longQuestNpc').appendTo(box);
      $('<button>').attr('type','button').addClass('longQuestAction').text('处理当前位置的长线调查').on('click',function(){api.openNpc(false);api.render(parent);}).appendTo(box);
      $('<p>').addClass('longQuestCorners').appendTo(box);
      $('<p>').addClass('longQuestEcho').appendTo(box);
      $('<p>').addClass('longQuestArchive').appendTo(box);
      $('<button>').attr('type','button').addClass('longQuestArchiveAction').text('在藤之家寻找执笔人').on('click',function(){api.openArchive();api.render(parent);}).appendTo(box);
    }
    box.find('.longQuestNpc').text('失名的引路人：已交付 ' + saved.npc.stage + '/10' + (data.npc.stage > saved.npc.stage ? '，本趟推进至 ' + data.npc.stage + '/10' : '') + '。'
      + (data.npc.branch ? '路线：' + (data.npc.branch === 'mercy' ? '放过 · 封缚查证' : '击杀 · 物证追查') + '。' : '首次关键选择交付后锁定。')
      + (stage ? '下一步：' + api.destination(data.npc.stage) + ' · ' + stage.title + '。完成当地普通事件后再点调查。' : '调查已结束；未交付时请先安全返程。'));
    box.find('.longQuestAction').prop('disabled',!stage || api.target(data.npc.stage) !== api.tile() || !api.canOpen());
    box.find('.longQuestCorners').text('四方灯火：' + api.corners.map(function(c){return c.name + (data.corners.indexOf(c.tile) < 0 ? ' ○' : saved.corners.indexOf(c.tile) >= 0 ? ' ✓' : '（待交付）');}).join('；')
      + '。寻找地图四角的 1/2/3/4 房间；旧地标占位时移至同一角落最近的空地。全部交付后下一次入城获得成就，旧队士不失去资格。');
    box.find('.longQuestEcho').text('归路的回声：同一趟远征按“雾 → 鼓 → 藤”（Q → G → J）拜访，之后安全返回。进度：' + (saved.echo ? '已交付' : data.echo ? '已连通，待返程' : run.route + '/3') + '。其它路段不打断顺序；连通前重复或倒序拜访这三处会重新计起。');
    var count = window.WorldRoadStories ? WorldRoadStories.ids($SM.get('game.roadsideSeen')).length : 0;
    box.find('.longQuestArchive').text('九封无名来信：已收录沿途见闻 ' + count + '/9。集齐后到藤之家 J 寻找执笔人，再安全交付。' + (saved.archive ? '合订本已交付。' : data.archive ? '本趟已落款，待返程。' : ''));
    box.find('.longQuestArchiveAction').prop('disabled',count < 9 || data.archive || api.tile() !== 'J' || !api.canOpen());
  }
};

Achievements.List.push(
  {id:'namelessMercy',group:'path',title:'留下答案的人',desc:'以封缚查证路线安全交付十阶段结局；与击杀结局互斥，同一存档不要求两者全得。',condition:function(){var d=LongQuests.saved();return d.npc.stage===10&&d.npc.branch==='mercy';},progress:function(){return [LongQuests.saved().npc.stage,10];},reward:{medicine:8,cloth:40}},
  {id:'namelessSlay',group:'path',title:'沉默之后的证词',desc:'以击杀追查路线安全交付“失名的引路人”十阶段结局；与另一结局互斥。',condition:function(){var d=LongQuests.saved();return d.npc.stage===10&&d.npc.branch==='slay';},progress:function(){return [LongQuests.saved().npc.stage,10];},reward:{scales:25,steel:15}},
  {id:'fourCornerLights',group:'path',title:'四方灯火',desc:'四角机关全部安全交付后，第一次真实进入无限城；旧队士同样适用，测试模式不计。',condition:function(){var d=LongQuests.saved();return d.cornerEntry&&d.corners.length===4;},progress:function(){var d=LongQuests.saved();return [d.corners.length+(d.cornerEntry?1:0),5];},reward:{'solar crystal':5}},
  {id:'roadEcho',group:'path',title:'归路的回声',desc:'同一趟按 Q → G → J 拜访三处地点并安全返回。',condition:function(){return LongQuests.saved().echo;},reward:{'cured meat':15}},
  {id:'namelessArchive',group:'path',title:'替无名者落款',desc:'收录全部九段见闻，到藤之家寻找执笔人并安全交付。',condition:function(){return LongQuests.saved().archive;},progress:function(){return [(window.WorldRoadStories ? WorldRoadStories.ids($SM.get('game.roadsideSeen')).length : 0)+(LongQuests.saved().archive?1:0),10];},reward:{medicine:3}}
);
