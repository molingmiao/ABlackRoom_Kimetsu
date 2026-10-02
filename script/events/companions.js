/** Local-time, chapter-aware letters and small visits. Never interrupt a journey. */
Events.Companions = {
  COOLDOWN: 12 * 60 * 1000,
  ENTRY_COOLDOWN: 60 * 60 * 1000,
  _session: null,
  now: function() {return Date.now();},
  period: function(date) {
    var hour = (date || new Date()).getHours();
    return hour >= 5 && hour < 10 ? 'morning' : hour >= 10 && hour < 17 ? 'day' : hour >= 17 && hour < 21 ? 'dusk' : 'night';
  },
  periodName: function(period) {
    return {morning:'清晨',day:'白天',dusk:'黄昏',night:'夜晚'}[period] || '未知时段';
  },
  stage: function() {
    if ($SM.get('game.yoshiwaraDone') || $SM.get('game.swordsmithVillageDone')
      || $SM.get('game.pillarConvocationDone') || $SM.get('features.location.spaceShip')) return 2;
    if ($SM.get('game.world.mugentrain')) return 1;
    return 0;
  },
  safeAtHome: function(ownEvent) {
    if (Engine.activeModule !== Room && Engine.activeModule !== Outside) return false;
    var active = Events.activeEvent();
    if (active && (!ownEvent || active !== Events.Companions.event)) return false;
    if (!ownEvent && Engine.keyLock) return false;
    if (typeof document !== 'undefined' && document.querySelector) {
      if (document.querySelector('[role="dialog"], #loadoutEditorOverlay, #scrapQuantityOverlay, #buyQuantityOverlay, #updateNotesOverlay, #castleReportOverlay, #expeditionReportOverlay, #achievementsOverlay')) return false;
      if (!ownEvent && document.querySelector('.eventPanel')) return false;
    }
    if (Room._buyDialog || Room._scrapDialog) return false;
    if (typeof LoadoutEditor !== 'undefined' && LoadoutEditor._dialog) return false;
    return true;
  },
  elapsed: function(last, interval, now) {
    // A changed local clock cannot lock an interaction out forever.
    return !Number.isFinite(last) || last <= 0 || now < last || now - last >= interval;
  },
  candidates: function(now, period) {
    var stage = Events.Companions.stage(), history = $SM.get('game.companionInteractions.entries') || {};
    return Events.Companions.entries.filter(function(entry) {
      var seen = history[entry.id] || {};
      return entry.stage === stage && entry.period === period
        && Events.Companions.elapsed(seen.lastAt, Events.Companions.ENTRY_COOLDOWN, now);
    });
  },
  isAvailable: function() {
    if (!Events.Companions.safeAtHome(false) || !$SM.get('game.prologue.done') || !$SM.get('features.location.path')) return false;
    // The trio meets during rehabilitation after the mountain, not in the opening cabin.
    if (!$SM.get('game.butterflyEstateDone') && !(typeof EarlyGame !== 'undefined' && EarlyGame.worldChapterCleared('M'))
      && !Events.Companions.stage() && !$SM.get('features.location.spaceShip')) return false;
    var now = Events.Companions.now();
    if (!Events.Companions.elapsed($SM.get('game.companionInteractions.lastAt'),Events.Companions.COOLDOWN,now)) return false;
    return Events.Companions.candidates(now,Events.Companions.period()).length > 0;
  },
  rewardText: function(reward) {
    return Object.keys(reward).map(function(id) {return _(id) + ' ×' + reward[id];}).join('、');
  },
  begin: function() {
    var api = Events.Companions, scene = api.event.scenes.start;
    scene.text = ['暂无适合当前时段的来信。日常互动只在庄园与院落出现，不会打断远征或战斗。'];
    scene.buttons = {leave:{text:'回去整备',nextScene:'end'}};
    api._session = null;
    if (!api.safeAtHome(true) || Events.activeEvent() !== api.event || Events.activeScene !== 'start') return false;
    var now = api.now(), period = api.period(), choices = api.candidates(now,period);
    if (!choices.length || !api.elapsed($SM.get('game.companionInteractions.lastAt'),api.COOLDOWN,now)) return false;
    // Prefer an unseen episode so the same clock period still has meaningful progress.
    var unseen = choices.filter(function(entry) {return !$SM.get('game.companionInteractions.entries.' + entry.id + '.seen');});
    var pool = unseen.length ? unseen : choices, entry = pool[Math.floor(Math.random() * pool.length)];
    api._session = {entry:entry,finished:false,period:period};
    $SM.set('game.companionInteractions.lastAt',now,true);
    $SM.set('game.companionInteractions.entries.' + entry.id + '.lastAt',now,true);
    $SM.set('game.companionInteractions.entries.' + entry.id + '.seen',true,true);
    scene.text = ['本地时段：' + api.periodName(period) + '。时段按你设备的时钟划分，不代表剧情中的连续日历。',entry.title]
      .concat(typeof entry.text === 'function' ? entry.text() : entry.text);
    scene.text.push('两种回应都能完成交流。每段日常只在首次完成时赠送少量补给；重复交流不再发奖，也不会改变主线完成状态。');
    scene.buttons = {};
    entry.choices.forEach(function(choice,index) {
      var claimed = $SM.get('game.companionInteractions.entries.' + entry.id + '.claimed');
      scene.buttons['reply' + index] = {
        text:choice.text + (claimed ? '（已领过补给，仅交流）' : '（首次：' + api.rewardText(choice.reward) + '）'),
        nextScene:'reply' + index
      };
    });
    scene.buttons.leave = {text:'这次先不回应，继续整备',nextScene:'end'};
    Engine.saveGame();
    return true;
  },
  complete: function(index) {
    var api = Events.Companions, session = api._session, scene = api.event.scenes['reply' + index];
    if (index !== 0 && index !== 1) return false;
    scene.text = ['这段来信已经处理，继续回庄园整备。'];
    if (!session || session.finished || !api.safeAtHome(true) || Events.activeEvent() !== api.event
      || Events.activeScene !== 'reply' + index || !session.entry.choices[index]) return false;
    session.finished = true;
    var choice = session.entry.choices[index], prefix = 'game.companionInteractions.entries.' + session.entry.id;
    scene.text = [choice.result];
    if (!$SM.get(prefix + '.claimed')) {
      // Mark before inventory publication: reentrant load/clicks cannot grant twice.
      $SM.set(prefix + '.claimed',true,true);
      $SM.set(prefix + '.choice',index,true);
      $SM.addM('stores',choice.reward,true);
      Engine.saveGame();
      $SM.fireUpdate('stores');
      scene.text.push('首次交流补给已放入庄园仓库：' + api.rewardText(choice.reward) + '。同一段日常以后不会重复发奖。');
    } else {
      scene.text.push('这是一次新的交流；这段日常的首次补给已经领取，不重复发奖。');
    }
    return true;
  },
  entries: [
    {id:'rehabMorning',stage:0,period:'morning',title:'蝶屋来信 · 清晨的葫芦',
      text:['炭治郎把康复训练中吹葫芦的方法画在纸上。善逸在旁边写了“先照顾受伤的腿”，伊之助则画了一个被捏瘪的葫芦。',
        '信里没有催你逞强：从平稳的吐气开始，遇到疼痛就停下。你可以练习节奏，也可以把休息时用的软垫整理好。'],
      choices:[
        {text:'按炭治郎的图示练习吐气',reward:{cloth:4},result:'你没有急着吹裂葫芦，而是记下每轮呼吸。炭治郎托隐送来几条用于训练的布带：先把身体养好，下一次出发才能稳。'},
        {text:'替康复中的队士整理软垫',reward:{medicine:1},result:'你把能晒干的垫子分开。善逸的回信终于不再只写着害怕，蝶屋也匀出一份急救药剂，让你出门时带好。'}]},
    {id:'rehabDay',stage:0,period:'day',title:'蝶屋来信 · 善逸的听力',
      text:['善逸把院子里几种脚步声写得非常细：端药的步子轻，受伤队士会避开一只脚，伊之助总嫌走廊太窄。',
        '他说自己很容易先听见危险，却不总知道该怎么告诉别人。你可以帮他把提示写得更清楚，也可以安排更安静的休息角落。'],
      choices:[
        {text:'把“可疑脚步”整理成清晰的警戒笔记',reward:{wood:12},result:'你们把模糊的“很可怕”改成了“方向、距离、需要谁来接应”。整理警戒牌剩下的木材送回仓库，下次整备时能用得上。'},
        {text:'为伤员留一处不被打扰的休息角落',reward:{'cured meat':3},result:'善逸承认自己也需要安静。伤员的床位和换药时间被重新安排，蝶屋送来几份已备好的口粮，谢谢你没有逼着每个人立刻上路。'}]},
    {id:'rehabDusk',stage:0,period:'dusk',title:'蝶屋来信 · 伊之助的挑战书',
      text:['伊之助写来一封字迹歪斜的挑战书，声称恢复以后谁都别想在搬运上赢过他。炭治郎补了一句：现在先遵医嘱，不比蛮力。',
        '你决定把挑战改成一件真正有用的小事：比清点准确，或比谁能把物资码得更容易拿。'],
      choices:[
        {text:'挑战清点准确，不挑战伤口',reward:{meat:4},result:'伊之助嘴上不服，还是把重复数过的包袱重新标了一遍。你们找回了几份没有登记的鲜肉，没有人为了胜负扯开伤口。'},
        {text:'把重物放低，留出搬运通道',reward:{wood:12},result:'一条不挡门的搬运路线终于排好。伊之助在纸上画了一头大山猪作为“胜利标记”，你把拆下的木架材料收回庄园。'}]},
    {id:'rehabNight',stage:0,period:'night',title:'蝶屋来信 · 不必一个人熬夜',
      text:['夜里的来信很短。炭治郎提醒你检查门闩，善逸反复确认藤花标记，伊之助写着“发现动静先叫醒别人”。',
        '三个人的说法不同，却都指向同一件事：守夜不是一个人硬撑到天亮。'],
      choices:[
        {text:'按门闩与撤离路线检查一次',reward:{torch:1},result:'你确认门闩、火把和离院的路，留下简明的交接纸。三人随信送来的备用火把已经入库；今夜不需要再反复巡同一圈。'},
        {text:'把守夜与休息时间写成交接表',reward:{'cured meat':3},result:'每个人都知道该何时接班，也知道何时能放心睡下。你收到几份便携口粮，给真正需要出门的人留好。'}]},
    {id:'trainMorning',stage:1,period:'morning',title:'列车之后 · 留给黎明的话',
      text:['列车的报告已经安全送回。炭治郎请鎹鸦带来炎柱的嘱托，纸边还有泪水干后的痕迹。',
        '你们不把伤痛当成必须立刻变强的命令。可以整理获救者的名单，也可以给下一次支援留一份可靠的行前清单。'],
      choices:[
        {text:'核对获救乘客的姓名与去向',reward:{cloth:5},result:'名单里的人都有了明确的安置处。炭治郎在回信中认真道谢：大家活着，不是抽象的数字；救援余下的包扎布送回仓库。'},
        {text:'写下下一次救援需要的整备清单',reward:{medicine:1},result:'武器、治疗、口粮和返程路线被分开列出。你把一份急救药剂收入仓库，不再靠临出发时想起什么就带什么。'}]},
    {id:'trainDay',stage:1,period:'day',title:'列车之后 · 善逸的细响',
      text:['善逸来信说，车厢里最需要被听见的不是吵闹，而是藏在座椅下面呼救的人。害怕并不妨碍把方向告诉同伴。',
        '你请他把不同声响变成容易传递的口令，或者先把接应伤员的次序练一遍。'],
      choices:[
        {text:'用“方向—人数—危险”整理呼救口令',reward:{cloth:5},result:'“有声音”变成了能用的三条信息，炭治郎也补上了不漏下孩子的检查顺序。打包剩余的布料随后送到庄园。'},
        {text:'练习先安抚再接应，不催伤员奔跑',reward:{'cured meat':4},result:'善逸终于能把害怕的说话声听完，而不是一边解释一边大叫。接应清单随四份便携口粮一起交到你手里。'}]},
    {id:'trainDusk',stage:1,period:'dusk',title:'列车之后 · 伊之助不肯丢下的包袱',
      text:['伊之助说自己才不会替谁保管行李，却还是把落在救援路上的小包一个个带了回来。炭治郎为包裹补上失主的名字。',
        '你可以协助归还遗失物，也可以把沉重包袱改成更容易背负的分装。'],
      choices:[
        {text:'按姓名归还包裹，别只看外表',reward:{leather:3},result:'最后一个没有名字的小包也找到了家人。修补包裹剩下的皮革送回仓库；伊之助坚持说这只是顺手。'},
        {text:'把救援包分成能独自背回的重量',reward:{'cured meat':4},result:'你们把备药和口粮分开，留出双手抬人的空间。伊之助终于承认轻一点的包更好跑，几份备用口粮也寄了过来。'}]},
    {id:'trainNight',stage:1,period:'night',title:'列车之后 · 三人三种整备',
      text:['炭治郎认真检查刀刃，善逸把急救袋放在伸手能碰到的地方，伊之助反复确认两把刀不会卡住背带。',
        '三封信合在一起，恰好是一份完整的行前提醒。你不需要模仿所有人，只要先处理这次出发最明显的缺口。'],
      choices:[
        {text:'先整理治疗袋与使用顺序',reward:{medicine:1},result:'最常用的药在上层，紧急处理用品单独标好。善逸的回信没有再重复十遍“千万带药”，额外那份急救药已放入仓库。'},
        {text:'先检查刀具与照明是否能及时取出',reward:{torch:1},result:'你把会绊住手的带子收好，并给备用照明留出固定位置。伊之助画的箭头歪歪扭扭，却很有用；备用火把已经入库。'}]},
    {id:'districtMorning',stage:2,period:'morning',title:'花街之后 · 炭治郎的磨刀笔记',
      text:function() {return $SM.get('game.swordsmithVillageDone') ? [
        '刀匠村的支援已安全交付。炭治郎写来刀具保养的笔记：日轮刀不是永远不会折损，守护它也是尊重替你锻刀的人。',
        '善逸与伊之助在各自的训练处补上收纳提醒，三人的信在庄园汇合，而不是把他们错写成村中参战者。'
      ] : ['游郭之后，炭治郎在恢复期间写来一页刀具检查笔记，提起日轮刀与替队士锻刀的人。',
        '善逸与伊之助正在别处执行任务或恢复训练。你们只能通过信件交换清单，不会一起闯进仍需保密的刀匠村。'];},
      choices:[
        {text:'整理刀刃保养与送修记录',reward:{steel:3},result:'你把受损原因和需要的修整分开记清。刀匠回收余料时匀出一点钢材：有记录的委托，比只说“再给我一把”更容易处理。'},
        {text:'整理送给前后方队士的备用绑带',reward:{cloth:6},result:'三份回信里需要的尺寸各不相同，你没有做成一大堆谁都用不上的绑带。多出的布料入库，留给下一次真正需要它的人。'}]},
    {id:'districtDay',stage:2,period:'day',title:'花街之后 · 善逸的邮袋',
      text:['鎹鸦送来善逸的便笺：他想知道炭治郎是否好好吃饭，也想知道伊之助有没有又把康复练成比赛。',
        '没有人要求你跨越正在进行的任务把三人硬凑在一处。你可以替他传递简短的平安消息，或整理各人的补给需求。'],
      choices:[
        {text:'只传递已确认的平安消息',reward:{'cured meat':5},result:'你没有把未经确认的传闻写进去。三人的回信逐一落下名字，附来的几份口粮已入库；知道同伴平安，不需要夸张的战报。'},
        {text:'把补给需求分开，不寄错训练用品',reward:{medicine:1},result:'炭治郎的刀具、善逸的急救袋和伊之助的绑带分别打包。蝶屋随信附来一份急救药，不再让所有人的需要混在同一张单子上。'}]},
    {id:'districtDusk',stage:2,period:'dusk',title:'花街之后 · 伊之助的新比法',
      text:['伊之助的新挑战书寄到了庄园：下一次训练要比谁先把队友带回安全地方。字旁边画了两个急着往前跑的人和一个没拿稳的包。',
        '炭治郎在旁边补充“所有人都到才算结束”。善逸则要求把返程路也算进去。'],
      choices:[
        {text:'把挑战改为全员到达，不比独自冲刺',reward:{leather:4},result:'你在挑战书上画了一条所有人都能走完的路线。伊之助不肯说喜欢，却把“丢下同伴不算赢”圈了起来，修补背带的皮革也寄到仓库。'},
        {text:'分工清点口粮、药品与返程照明',reward:{torch:2},result:'三人各管一项，最后再互相检查。备用的两支火把已经入库；比赛的终点改成了每个人都平安回来。'}]},
    {id:'districtNight',stage:2,period:'night',title:'花街之后 · 今夜的三封信',
      text:function() {return $SM.get('game.swordsmithVillageDone') ? [
        '刀匠村的紧急消息过去之后，三封短笺终于都到齐。炭治郎记挂受伤的人，善逸在训练处整理新的口令，伊之助仍把别人的名字写得歪歪扭扭。',
        '你读到的是不同地点传来的近况，不是三人同时出现在村中的虚构战斗。今晚可以回信，也可以把下一次支援的交接补全。'
      ] : ['花街的战后名册已安全送回。炭治郎、善逸与伊之助分别传来恢复与训练的近况，没有新的战斗需要你立刻奔赴。',
        '夜晚适合把交接写清，也适合告诉仍在等待的人：今天已有谁的消息被确认。'];},
      choices:[
        {text:'回信约定下次训练的接应信号',reward:{'wisteria charm':1},result:'你们约定“先示警，再接应”，不拿同伴的安全赌默契。隐送来一枚备用藤花符，已放入庄园仓库；这不是新的主线通关奖励。'},
        {text:'补完战后交接，把伤员需要留给白天',reward:{medicine:2},result:'你把仍需换药的人与已经离开的队士分开登记。两份备用药剂由后方送到仓库，今夜终于可以停下不必要的反复清点。'}]}
  ]
};

Events.Companions.event = {
  title:'三人组 · 来信与日常',
  storySupply:true,
  isAvailable:Events.Companions.isAvailable,
  scenes:{
    start:{text:[],onLoad:Events.Companions.begin,buttons:{leave:{text:'继续整备',nextScene:'end'}}},
    reply0:{text:[],onLoad:function(){Events.Companions.complete(0);},buttons:{leave:{text:'交流结束，继续整备',nextScene:'end'}}},
    reply1:{text:[],onLoad:function(){Events.Companions.complete(1);},buttons:{leave:{text:'交流结束，继续整备',nextScene:'end'}}}
  }
};
// Register one weighted entry before Events.init concatenates the global pool.
Events.Global.push(Events.Companions.event);
