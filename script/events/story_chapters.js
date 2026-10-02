/** Local chapter choices never resume an expedition. Victory is committed at home. */
Events.StoryChapters = {
  swordsmithBlueprint: 'wisteria oil',
  definitions: {
    butterfly: {tile:'E',flag:'game.butterflyEstateDone',name:'蝶屋康复',
      required:['tanjiro','zenitsu','inosuke','escort'],perk:'total concentration'},
    swordsmith: {tile:'K',flag:'game.swordsmithChapterDone',legacyFlag:'game.swordsmithVillageDone',name:'锻刀村支援',
      required:['forge','kotetsu','letters','fish','gale','wood'],perk:'mikiri',reward:{'nichirin katana':1}}
  },
  reset: function(id) {
    if (!Events.StoryChapters._progress) Events.StoryChapters._progress = {};
    Events.StoryChapters._progress[id] = {state:World.state,choices:{}};
  },
  mark: function(id,key) {
    var progress = (Events.StoryChapters._progress || {})[id];
    if (progress && progress.state === World.state) progress.choices[key] = true;
  },
  has: function(id,key) {
    var progress = (Events.StoryChapters._progress || {})[id];
    return !!(progress && progress.state === World.state && progress.choices[key]);
  },
  complete: function(id) {
    var definition = Events.StoryChapters.definitions[id];
    return !!definition && definition.required.every(function(key) {return Events.StoryChapters.has(id,key);});
  },
  ready: function(id) {
    var definition = Events.StoryChapters.definitions[id];
    return !!definition && !!World.state && Engine.activeModule === World && !World.dead
      && !World.state[id] && !$SM.get(definition.flag)
      && ((definition.legacyFlag && $SM.get(definition.legacyFlag)) || !window.EarlyGame
        || EarlyGame.storyPrerequisite(id === 'swordsmith' ? 'smiths' : id));
  },
  finish: function(id) {
    var definition = Events.StoryChapters.definitions[id];
    if (!Events.StoryChapters.ready(id) || !Events.StoryChapters.complete(id) || !World.curPos) return false;
    var row = World.state.map && World.state.map[World.curPos[0]];
    if (!row || row[World.curPos[1]] !== definition.tile) return false;
    World.state[id] = true;
    World.markVisited(World.curPos[0],World.curPos[1]);
    return true;
  },
  swordsmithBlueprintPending: function() {
    var blueprints = $SM.get('character.blueprints') || {};
    var hasAnyBlueprint = Object.keys(blueprints).some(function(key) {return !!blueprints[key];});
    return !!($SM.get('game.swordsmithVillageDone') || $SM.get('game.swordsmithChapterDone'))
      && !$SM.get('game.swordsmithBlueprintGranted')
      && !hasAnyBlueprint;
  },
  grantSwordsmithBlueprint: function() {
    var atHome = Engine.activeModule === Room && !(Events.activeEvent && Events.activeEvent());
    var safeChapterReturn = Engine.activeModule === World && !World.dead && !!World.state
      && World.state.swordsmith && $SM.get('game.world.map') === World.state.map;
    if ((!atHome && !safeChapterReturn)
      || !($SM.get('game.swordsmithVillageDone') || $SM.get('game.swordsmithChapterDone'))
      || $SM.get('game.swordsmithBlueprintGranted')) return false;
    // Mark first: inventory listeners or repeated return callbacks cannot issue this reward twice.
    $SM.set('game.swordsmithBlueprintGranted',true,true);
    var key = 'character.blueprints["' + Events.StoryChapters.swordsmithBlueprint + '"]';
    if (!$SM.get(key)) $SM.set(key,true,true);
    return true;
  },
  commit: function() {
    // Only called by the safe-return path, after it publishes this very map.
    if (Engine.activeModule !== World || World.dead || !World.state
      || $SM.get('game.world.map') !== World.state.map) return false;
    var changed = false;
    Object.keys(Events.StoryChapters.definitions).forEach(function(id) {
      var definition = Events.StoryChapters.definitions[id];
      if (!World.state[id] || $SM.get(definition.flag)) return;
      var legacyCompleted = definition.legacyFlag && $SM.get(definition.legacyFlag);
      $SM.set(definition.flag,true,true);
      if (definition.legacyFlag) $SM.set(definition.legacyFlag,true,true);
      if (!$SM.hasPerk(definition.perk)) $SM.addPerk(definition.perk);
      if (definition.reward && !legacyCompleted) $SM.addM('stores',definition.reward,true);
      if (id === 'swordsmith' && Events.StoryChapters.grantSwordsmithBlueprint()) {
        Notifications.notify(null,'锻刀村的藤花精油制造图纸已送达庄园；回大厅可迎接柱合议，仍需实际完成训练。');
      }
      Notifications.notify(null,definition.name + '已安全交付，章节与训练已保存；阶段奖励可在庄园领取。');
      changed = true;
    });
    if (changed) $SM.fireUpdate('stores');
    return changed;
  }
};

Events.Setpieces.butterflyEstate = {
  title:'蝶屋 · 与三位伙伴重新站起来',
  storySupply:true,
  scenes:{
    start:{
      text:[
        '藤花环绕的院落里，药草在竹架上晾着。蝶屋 E 是地图上唯一的康复地点；本篇回看那田蜘蛛山之后、无限列车之前的恢复时光。',
        '炭治郎、善逸和伊之助都在这里接受治疗。你以支援队士的身份协助康复，不替他们赢下原作的训练，也不催促伤者立即回到战场。',
        '训练包含三人的协作和一次林道护送实战。先完成蜘蛛山并安全返回；完成本篇之后也必须安全回家，才会保存训练与领取一次性奖励。'
      ],
      onLoad:function(){Events.StoryChapters.reset('butterfly');},
      buttons:{enter:{text:'拜访蝶屋，协助康复',available:function(){return Events.StoryChapters.ready('butterfly');},nextScene:'aoi'},
        leave:{text:'暂不拜访，返回地图',nextScene:'end'}}
    },
    aoi:{
      text:[
        '神崎葵把洗好的绷带收进篮子，先问你有没有把伤口藏在制服下面。她让所有人遵守用药时间，谁也不能靠喊得响来代替休息。',
        '小清、小澄和小菜穗正为训练场整理水盆。你先替她们准备今天的餐食，再去见还不敢相信自己活下来的伙伴。'
      ],
      buttons:{meal:{text:'准备 2 份熏肉，陪伤者吃饭',cost:{'cured meat':2},nextScene:'meal'},
        help:{text:'帮助整理餐具与绷带，不消耗物资',nextScene:'meal'},
        leave:{text:'返回地图，本次训练未完成',nextScene:'end'}}
    },
    meal:{
      text:[
        '善逸看着药碗抱怨苦味，伊之助隔着绷带仍想抢第一口饭。炭治郎将餐盘扶稳，再把祢豆子的木箱挪到阴凉处。',
        '你替伊之助把碗递近一些，提醒善逸先把药喝完。他们的争吵终于又像活着的人，而不是林间传回来的名单。'
      ],
      buttons:{listen:{text:'听忍说明康复安排',nextScene:'shinobu'}}
    },
    shinobu:{
      text:[
        '蝴蝶忍没有把恢复说成新的奇迹。稳定呼吸、伸展筋骨、追回注意力，一项都要慢慢做；好胜不能盖过身体发出的警告。',
        '你会分别与三位伙伴完成协作。可自行选择顺序，全部完成之后再护送药材队走过附近林道。'
      ],
      buttons:{train:{text:'进入康复训练场',nextScene:'training'}}
    },
    training:{
      text:['院子里，水盆、反应练习用的杯子和折返路线已经摆好。每个人都有擅长的事，也有正在重新学会的事。','完成三种协作后，才有资格接下需要照应队友的林道护送。'],
      buttons:{
        tanjiro:{text:'与炭治郎练习呼吸与反应',available:function(){return !Events.StoryChapters.has('butterfly','tanjiro');},nextScene:'tanjiro'},
        zenitsu:{text:'和善逸辨认声音里的节奏',available:function(){return !Events.StoryChapters.has('butterfly','zenitsu');},nextScene:'zenitsu'},
        inosuke:{text:'陪伊之助练习协作与停手',available:function(){return !Events.StoryChapters.has('butterfly','inosuke');},nextScene:'inosuke'},
        report:{text:'完成三人的协作，汇报训练',available:function(){return ['tanjiro','zenitsu','inosuke'].every(function(id){return Events.StoryChapters.has('butterfly',id);});},nextScene:'kanao'},
        leave:{text:'返回地图，本次训练未完成',nextScene:'end'}
      }
    },
    tanjiro:{
      text:[
        '炭治郎没有掩饰自己一次次跟不上香奈乎。他把杯子放回原位，请你一起数呼吸，先把散乱的节奏重新连起来。',
        '你们轮流留意对方抬手之前的变化。不是抢在每个人前面，而是看清该动与不该动的那一瞬间。'
      ],
      buttons:{steady:{text:'稳住呼吸，在对方停顿时出手',nextScene:'tanjiroResult'},patient:{text:'先观察完整一轮，再同步节奏',nextScene:'tanjiroResult'}}
    },
    tanjiroResult:{
      text:['杯中的水没有洒出去。炭治郎笑着记下你发现的停顿，又认真地把今天仍然失败的地方写在旁边。','你的呼吸协作已完成；这里没有可反复领取的永久伤害奖励，训练的成果会随本篇安全交付。'],
      onLoad:function(){Events.StoryChapters.mark('butterfly','tanjiro');},
      buttons:{back:{text:'带着新的节奏回训练场',nextScene:'training'}}
    },
    zenitsu:{
      text:[
        '善逸听见你脚步里不均匀的一拍，立刻问伤口是不是又疼了。说起声音时，他的注意力比抱怨药味时集中得多。',
        '你蒙上眼，让他敲响院落两边的竹筒。先分辨方向，再确认来者，不能把每一个突然的响声都当作鬼。'
      ],
      buttons:{listen:{text:'区分竹筒的回声与脚步',nextScene:'zenitsuResult'},reassure:{text:'和善逸约定护送时的示警信号',nextScene:'zenitsuResult'}}
    },
    zenitsuResult:{
      text:['善逸还是说自己绝不会主动走进黑暗，却已经给你的护送路线指出两处声音会被山壁遮住的拐角。','你记住他的示警方法，也答应不把害怕的人独自留在最后。听觉协作完成。'],
      onLoad:function(){Events.StoryChapters.mark('butterfly','zenitsu');},
      buttons:{back:{text:'记住示警信号，回训练场',nextScene:'training'}}
    },
    inosuke:{
      text:[
        '伊之助一上来就要求比谁先跑完。他的嗓子仍未恢复，喊出来的声音却比谁都想赢。葵隔着院子提醒：不是比赛谁先把伤口崩开。',
        '你提议两人一起搬运空担架：前面的人决定路线，后面的人提醒障碍。到达终点时，两个人都还在，才算完成。'
      ],
      buttons:{lead:{text:'让伊之助探路，约定到岔口必须等人',nextScene:'inosukeResult'},follow:{text:'自己引路，请伊之助保护后侧',nextScene:'inosukeResult'}}
    },
    inosukeResult:{
      text:['伊之助在第二个岔口忍住了独自冲出去的念头，回头确认你还扶着担架。他把这叫作新的比试：谁先发现队友需要帮助。','护送协作完成。你们把担架放回原处，没有拿伤势去换输赢。'],
      onLoad:function(){Events.StoryChapters.mark('butterfly','inosuke');},
      buttons:{back:{text:'完成协作，回训练场',nextScene:'training'}}
    },
    kanao:{
      text:[
        '香奈乎看着你们把器材归位，没有说今天谁更强。炭治郎郑重地向她道谢，又问明天可否继续。',
        '三位伙伴仍要留在蝶屋完成疗养。你接下附近林道的药材护送：善逸提供声响标记，伊之助画出岔路，炭治郎提醒先确认所有人都到了再走。'
      ],
      buttons:{pack:{text:'和葵整理药材队的装备',nextScene:'supplies'}}
    },
    supplies:{
      text:['药材队准备出发。一只火把能让山壁后的同伴看见你；没有成品时，也可以先使用庄园补料完成制作，再继续互动。','若不想消耗物资，按白日路线护送也能完成本篇，两种选择都需要守住队伍。'],
      buttons:{torch:{text:'交出 1 支火把，标记林道转弯处',cost:{torch:1},nextScene:'lanternRoute'},day:{text:'选择白日路线，安排队伍成对前进',nextScene:'dayRoute'},leave:{text:'暂不护送，返回地图',nextScene:'end'}}
    },
    lanternRoute:{
      text:['火把挂在转弯处，前后队伍能互相看见。你按善逸约定的声音信号点名，没有把孤身的采药人留在崖壁后。','林间还是出现了不属于队伍的脚步。你把药材队带到有藤花的开阔地，独自守住来路。'],
      buttons:{guard:{text:'守住药材队后方',nextScene:'escort'}}
    },
    dayRoute:{
      text:['白日里，你用伊之助画下的岔路提醒队伍绕开险坡。没有人被催着带伤赶路，后方的人始终在视线里。','一段深林遮住了阳光，追着药材气味的鬼从阴影里出现。你将队伍引到开阔地，守住它扑来的方向。'],
      buttons:{guard:{text:'挡住林间追来的鬼',nextScene:'escort'}}
    },
    escort:{
      combat:true,enemy:'butterfly herb road demon',enemyName:'深林中的袭队鬼',chara:'林',health:26,damage:4,hit:0.82,attackDelay:2.7,
      notification:'采药人已经退到藤花旁，你必须守住回蝶屋的道路。',deathMessage:'鬼在林间倒下。你先确认队伍平安，再检查药材是否散落。',
      loot:{cloth:{min:2,max:4,chance:1},medicine:{min:1,max:2,chance:0.8}},
      buttons:{check:{text:'清点队伍，护送药材返回',cooldown:Events._LEAVE_COOLDOWN,nextScene:'return'}}
    },
    return:{
      text:['你照着名单点完最后一个名字，采药队才重新启程。杀死一只鬼不是唯一的目标：没有人走失、没有伤者被遗忘，才算守住这条路。','葵接过药篮，把你的护送记录摊在三位伙伴面前。他们各自留下的提醒，终于在同一趟任务里连成了完整的协作。'],
      onLoad:function(){Events.StoryChapters.mark('butterfly','escort');},
      buttons:{rest:{text:'听忍讲解全集中的持续训练',nextScene:'concentration'}}
    },
    concentration:{
      text:['忍提醒你，全集中不是只在挥刀那一刻才想起呼吸。把节奏带进寻常行动、休息与守护同伴，才不会在危险到来时突然耗尽力量。','本篇安全交付后，会获得一次“全集中”训练资格：战斗中濒危时每场最多一次应急恢复。已经学会的人不会叠加次数或重复领取属性。'],
      buttons:{friends:{text:'和三位伙伴约定下一次再见',nextScene:'farewell'}}
    },
    farewell:{
      text:['炭治郎把感谢写进护送记录，善逸叮嘱别忘了那两个拐角，伊之助则要求下次比谁能更快发现队友需要帮助。','他们的伤还没有完全好，前面的任务也不会轻松。你收好这段同行的记忆，独自把药材交付的报告带回庄园。'],
      buttons:{finish:{text:'结束康复支援，准备安全返程',nextScene:'final'}}
    },
    final:{
      text:['蝶屋康复与护送已完成，仍只记在本次远征里。请安全返回庄园，保存本篇并领取一次性阶段奖励；失败不会保存这次章节进展。'],
      onLoad:function(){Events.StoryChapters.finish('butterfly');},
      buttons:{leave:{text:'回地图，安全返回庄园',nextScene:'end'}}
    }
  },
  audio:AudioLibrary.LANDMARK_FRIENDLY_OUTPOST
};

Events.Setpieces.swordsmithVillage = {
  title:'锻刀村 · 守住仍在响起的锤声',
  storySupply:true,
  scenes:{
    start:{
      text:[
        '隐在山路上逐段接应，把你带到锻刀村 K。这里不是散落在地图上的 Y 废城，而是游郭之后新开放的唯一村落章节。',
        '炭治郎为修复损坏的日轮刀来到村中。善逸与伊之助此时在别处执行任务，本篇会通过他们的前后方来信保持联动，不让他们出现在原作未参加的战场。',
        '你将协助刀匠、霞柱、恋柱和玄弥，经历三场支援实战。上弦的正篇斩首仍由主角与柱完成；本篇必须连续推进，并安全返回庄园才保存。'
      ],
      onLoad:function(){Events.StoryChapters.reset('swordsmith');},
      buttons:{enter:{text:'接下刀匠村的支援委托',available:function(){return Events.StoryChapters.ready('swordsmith');},nextScene:'greeting'},leave:{text:'暂不接下任务，返回地图',nextScene:'end'}}
    },
    greeting:{
      text:['村长铁地河原铁珍先确认你的身份，再让隐带你认识撤离路线。这里每个人锻造的，不只是刀，也是一名队士下次回来的机会。','炭治郎正在向钢铁冢解释损坏的刀。蜜璃笑着说，别只盯着自己需要的武器，也要看看谁为了这把刀彻夜不眠。'],
      buttons:{visit:{text:'协助村落，收集三处支援信息',nextScene:'visit'}}
    },
    visit:{
      text:['炭治郎指向村落里的三处地方：忙碌的锻造小屋、小铁看守的训练区域，以及隐送来书信的入口。','先了解这里的人和撤离路线，危急时才不会把刀匠、孩子和援军留在不同的岔路里。'],
      buttons:{
        forge:{text:'协助钢铁冢与铁穴森整理锻造小屋',available:function(){return !Events.StoryChapters.has('swordsmith','forge');},nextScene:'forge'},
        kotetsu:{text:'陪炭治郎拜访小铁与缘壹零式',available:function(){return !Events.StoryChapters.has('swordsmith','kotetsu');},nextScene:'kotetsu'},
        letters:{text:'阅读善逸与伊之助送来的支援信',available:function(){return !Events.StoryChapters.has('swordsmith','letters');},nextScene:'letters'},
        ready:{text:'整理三份支援信息，留意村中动静',available:function(){return ['forge','kotetsu','letters'].every(function(key){return Events.StoryChapters.has('swordsmith',key);});},nextScene:'alarm'},
        leave:{text:'返回地图，本次支援未完成',nextScene:'end'}
      }
    },
    forge:{
      text:['钢铁冢把你伸向旧刀的手拍开：这不是谁捡走就能变强的战利品。铁穴森则请你先清理炉边的木屑，把撤离时可能绊倒人的器具移开。','两种整理办法都能帮上忙。你可以交出一支火把照亮小屋后侧，也可以把窗边的遮挡搬开；不会因缺少成品而被迫放弃整个章节。'],
      buttons:{torch:{text:'提供 1 支火把，照清锻造小屋后侧',cost:{torch:1},nextScene:'forgeReady'},window:{text:'搬开遮挡，整理通向后门的通道',nextScene:'forgeReady'}}
    },
    forgeReady:{
      text:['锤声重新压过杂乱的脚步。炭治郎帮你扶好滑落的工具箱，钢铁冢只抬头看了一眼，又把注意力放回尚未磨好的刀。','你记住后门和储水处的位置。危险来临时，必须先守住锻造小屋里的人，而不是抢走一把看起来更强的刀。'],
      onLoad:function(){Events.StoryChapters.mark('swordsmith','forge');},
      buttons:{back:{text:'记下锻造小屋的位置，继续协助',nextScene:'visit'}}
    },
    kotetsu:{
      text:['小铁紧紧握着训练机关的钥匙。炭治郎挡在他身前，试着把无一郎急着拿刀的理由与小铁不愿损坏珍贵机关的心情说清楚。','你不替任何人抢下钥匙，只帮小铁搬开训练区周围会绊倒人的石块。他告诉你，缘壹零式模仿的是曾经真实存在的剑士。'],
      buttons:{observe:{text:'观察机关动作，和炭治郎整理节奏',nextScene:'zeroshiki'}}
    },
    zeroshiki:{
      text:['机关的手臂连成密集的刀路。炭治郎在反复的练习里寻找下一次动作的空隙，你则和小铁记录不能靠蛮力躲过去的转折。','这里不会把机关变成可无限刷取永久属性的训练木桩。你拿到的是支援记录：孩子藏在哪里、哪些道路能通到锻造小屋。'],
      onLoad:function(){Events.StoryChapters.mark('swordsmith','kotetsu');},
      buttons:{back:{text:'收好小铁的路线，继续协助',nextScene:'visit'}}
    },
    letters:{
      text:['隐带来两封信。善逸和伊之助都在别处执行任务，村中的隐秘位置没有写在信上，回信仍会经由鎹鸦与隐转送。','炭治郎把信递给你：有人在不同的路上做着相同的准备，支援不一定意味着所有人都挤进同一个战场。'],
      buttons:{read:{text:'先读善逸写下的声音提醒',nextScene:'zenitsuLetter'}}
    },
    zenitsuLetter:{
      text:['善逸用挤得很密的字说明：怪异的响声如果一直从同一处重复，未必是敌人自己站在那里。救人时先听清是否还有别人的呼吸。','他在末尾抱怨任务危险，却又叮嘱炭治郎不要因为抢着修刀而忘记吃饭。你记住这句不太像作战命令的关心。'],
      buttons:{next:{text:'再看伊之助画来的支援路线',nextScene:'inosukeLetter'}}
    },
    inosukeLetter:{
      text:['伊之助把“不要被敌人领着跑”写得比署名还大，旁边的图歪歪斜斜：一条路冲向最响的地方，另一条路绕回受困的人。','炭治郎笑着把两封信叠好。你们决定警报响起时先确认刀匠和村民的位置，再沿前后方约定的信号互相接应。'],
      onLoad:function(){Events.StoryChapters.mark('swordsmith','letters');},
      buttons:{back:{text:'记住伙伴的提醒，继续协助',nextScene:'visit'}}
    },
    alarm:{
      text:['夜里，敲击声里混入了不该有的湿响。村道突然窜出玉壶放出的怪鱼，另一股鬼的气息则在炭治郎与无一郎所在的屋里分裂开来。','炭治郎示意你先保护村民；祢豆子与玄弥赶向分身。你没有追着最大的鬼影跑，而是来到小铁告诉你的窄巷。'],
      buttons:{guard:{text:'守住窄巷，拦截袭向刀匠的怪鱼',nextScene:'fish'},leave:{text:'撤回地图，本次支援未完成',nextScene:'end'}}
    },
    fish:{
      combat:true,enemy:'gyokko village fish',enemyName:'玉壶放出的壶中怪鱼',chara:'壶',health:50,damage:7,hit:0.86,attackDelay:2.7,
      notification:'怪鱼扑向搬运伤者的刀匠，你挡在窄巷中央。',deathMessage:'怪鱼倒下，你提醒村民避开散出的污血，沿已经清出的道路撤离。',
      loot:{scales:{min:6,max:10,chance:1},teeth:{min:4,max:7,chance:0.8}},
      buttons:{rescue:{text:'护送受困刀匠离开窄巷',cooldown:Events._LEAVE_COOLDOWN,nextScene:'smithRescue'}}
    },
    smithRescue:{
      text:['你逐项核对撤离名单，把受伤的人交给隐。怪鱼的声音仍在村中响起，不能因清理了这一条巷子就把整座村落当成安全。','蜜璃赶来救下铁珍与其他村民，随后接过更危险的正面战场。你让撤离队绕开她的刀路，继续向锻造小屋接应。'],
      onLoad:function(){Events.StoryChapters.mark('swordsmith','fish');},
      buttons:{cover:{text:'去锻造小屋，与霞柱的支援线会合',nextScene:'mist'}}
    },
    mist:{
      text:['无一郎在救人的选择里逐渐找回记忆。小铁与铁穴森把他引向锻造小屋，钢铁冢仍把注意力留在正在磨出的刀上。','你守住已经整理过的后门，把伤者带离玉壶的袭击方向。霞柱迎战上弦之伍的正面决胜，不需要你替他夺走这一战。','另一侧，半天狗分身掀起的冲击越过村道。你必须切开袭向撤离队的一股余波，才能把刀匠送到安全处。'],
      buttons:{cover:{text:'挡开分身袭向后方的风刃',nextScene:'gale'}}
    },
    gale:{
      combat:true,enemy:'hantengu village gale',enemyName:'半天狗分身逸出的风刃',chara:'风',health:64,damage:8,hit:0.88,attackDelay:2.8,ranged:true,
      notification:'风刃卷向后门，你在撤离队前守住这段通路。',deathMessage:'风刃散开。村民穿过后门，炭治郎也找到了与你会合的方向。',
      loot:{cloth:{min:5,max:9,chance:1},scales:{min:6,max:10,chance:1}},
      buttons:{meet:{text:'与炭治郎、玄弥会合，确认真正目标',cooldown:Events._LEAVE_COOLDOWN,nextScene:'genya'}}
    },
    genya:{
      text:['玄弥确认，击碎分身并没有让上弦之肆消失。炭治郎辨认气味，寻找逃窜的本体；祢豆子护住近旁的队士，不让新的攻击截断追踪。','玄弥用生硬的语气让你去守住撤离队。你把伙伴来信里“不要只追最响的地方”那句话告诉他，他没有答话，却给后方让出了位置。','霞柱已经斩下玉壶，另一边的战局仍未结束。憎珀天的木龙横过村道，你负责截断伸向民居的枝端。'],
      onLoad:function(){Events.StoryChapters.mark('swordsmith','gale');},
      buttons:{rear:{text:'保护后方，切断木龙伸向民居的枝端',nextScene:'wood'}}
    },
    wood:{
      combat:true,enemy:'zohakuten village wood',enemyName:'憎珀天木龙的延伸枝端',chara:'木',health:78,damage:9,hit:0.89,attackDelay:2.8,
      notification:'木龙的枝端掠向最后一队村民。你必须给他们留下通路。',deathMessage:'木龙枝端被切断。最后一队村民离开民居，隐发出了清点完成的信号。',
      loot:{wood:{min:15,max:25,chance:1},teeth:{min:7,max:11,chance:1},scales:{min:8,max:12,chance:1}},
      buttons:{signal:{text:'向恋柱发出后方撤离完成的信号',cooldown:Events._LEAVE_COOLDOWN,nextScene:'mitsuri'}}
    },
    mitsuri:{
      text:['蜜璃以柔韧的刀路牵住憎珀天，让炭治郎、祢豆子与玄弥有机会追赶真正的本体。你站在她守住的边缘，把最后的伤者交给隐。','天边开始发白。你没有把上弦的核心算作自己已经击败的怪物：正面队士仍在奔跑，后方需要你继续检查失散者。'],
      onLoad:function(){Events.StoryChapters.mark('swordsmith','wood');},
      buttons:{care:{text:'决定最后一批伤者的接应方式',nextScene:'dawnChoice'}}
    },
    dawnChoice:{
      text:['山坡边有人无法自行行走。藤花符可用来明确接应位置；背包中没有时，可以通过剧情补料从庄园调取现成符。藤花符没有制作配方，家中也没有库存时不能代制。','不消耗符也能把伤者逐个背到隐身旁。这里不会因缺少物品而堵死支援路径。'],
      buttons:{charm:{text:'交出 1 枚藤花符，标记伤者接应处',cost:{'wisteria charm':1},nextScene:'nezuko'},carry:{text:'逐个背起伤者，交给隐接应',nextScene:'nezuko'}}
    },
    nezuko:{
      text:['太阳终于照到山坡，炭治郎在祢豆子与村民之间承受着无法轻易选择的痛苦。祢豆子把他推向仍被追逐的人。','炭治郎追上半天狗的本体，终结了上弦之肆。你守着已经撤离的人，回头看见祢豆子站在阳光里，等待她的哥哥确认眼前并非幻觉。','这是这段战斗真正改变未来的一刻。你没有从中取得可买卖的“祢豆子材料”，只把见证的消息留给信得过的鎹鸦。'],
      buttons:{report:{text:'整理刀匠与队士的支援报告',nextScene:'report'}}
    },
    report:{
      text:['村里的锤声还会重新响起。铁穴森向你确认撤离名单，钢铁冢将注意力留给修复的刀；霞柱把这次看清敌人动作的经验交给你。','你替炭治郎把消息分别写给善逸与伊之助：他们不在这座村中，却留下了真正用得上的提醒。回信会经过隐与鎹鸦，不暴露村落的位置。','安全交付后，刀匠将日轮刀 1 把和藤花精油制造图纸送到庄园，霞柱的见切训练也会保存。图纸只解锁制作，不免费制造物品；回大厅后可迎接柱合议，仍须准备口粮、火把并完成训练。','已完成旧版刀匠村的队士保留成果，不会重新领取日轮刀；尚无任何已解锁图纸时，可在大厅主线栏一次性补领。'],
      buttons:{finish:{text:'完成锻刀村支援，准备安全返程',nextScene:'final'}}
    },
    final:{
      text:['锻刀村支援完成，尚未提交。请沿地图安全返回庄园，保存章节、收取藤花精油制造图纸和训练成果，再领取阶段奖励。途中失败不会保存本次完成状态、不会授予图纸，也不能暂停后下次续关。'],
      onLoad:function(){Events.StoryChapters.finish('swordsmith');},
      buttons:{leave:{text:'回地图，安全返回庄园',nextScene:'end'}}
    }
  },
  audio:AudioLibrary.LANDMARK_TOWN
};
