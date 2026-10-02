/** World chapters commit only with the temporary map on a safe return. */
Events.Setpieces.mugenTrain = {
  title: '无限列车',
  storySupply: true,
  scenes: {
    start: {
      text: [
        '夜色里，列车停靠在临时站台。鎹鸦传来任务：协助炎柱保护车上的乘客。',
        '你负责后方支援，不独自迎战上弦。先打通铁矿、煤矿与炼钢供应，再完成那田蜘蛛山并安全返回，才可接下这次任务。',
        '本篇有一场实时战斗；备好武器和治疗物资。完成救援后仍须安全返回庄园，主线进展才会保存。'
      ],
      buttons: {
        board: {
          text: '登车支援',
          available: function() {
            return !!World.state && !World.state.mugentrain && EarlyGame.trainReady();
          },
          nextScene: 'dream'
        },
        leave: {text: '离开站台', nextScene: 'end'}
      }
    },
    dream: {
      text: [
        '车轮的节奏渐渐变成了熟悉的脚步声。已经逝去的人站在温暖的屋里，招呼你留下。',
        '这是血鬼术编织的梦。你记起仍在等待救援的乘客，稳住呼吸，抓住梦境里那一处不合常理的裂隙。',
        '惊醒时，血肉触手已经爬上车厢。炭治郎与伊之助向车头寻找要害，善逸在睡梦中仍护住祢豆子与近旁乘客；你必须守住后面的车厢。'
      ],
      buttons: {
        defend: {text: '守住乘客所在的车厢', nextScene: 'flesh'},
        coordinate: {text: '先与三人组对齐救援分工', nextScene: 'trioPlan'},
        leave: {text: '撤离车厢，放弃本次任务', nextScene: 'end'}
      }
    },
    trioPlan: {
      text: [
        '炭治郎把伤员所在车厢指给你，伊之助敲着车头方向的地板确认鬼的要害。善逸没有醒来，却已经挡住扑向近旁乘客的触手。',
        '不是所有人都该挤向车头。你可以先听清后方的呼救，也可以按炭治郎留下的标记包扎自己，再留下守住撤离通道。',
        '包扎只恢复你实际损失的生命，需要消耗 1 份药剂；没有药也能完成相同救援，不会跳过实时战斗。'
      ],
      buttons: {
        listen: {text:'按善逸守住的方向寻找呼救者',nextScene:'trioListening'},
        route: {text:'按伊之助标出的缺口安排撤离',nextScene:'trioRoute'},
        dress: {text:'按炭治郎的提示包扎伤口（药剂 ×1，恢复 10 生命）',cost:{medicine:1},
          available:function(){return World.health < World.getMaxHealth();},
          onChoose:function(){Events.restoreHealth(10,'medicine');},nextScene:'trioDressing'},
        leave: {text:'撤离车厢，放弃本次任务',nextScene:'end'}
      }
    },
    trioListening: {
      text: [
        '顺着善逸护住的一侧，你听到座椅下面微弱的呼救。你先叫出躲藏的人，再让能行走的乘客带上孩子。',
        '炭治郎与伊之助继续寻找车头的要害。你留在后方，让他们不必在追击时回头担心这节车厢。'
      ],
      buttons:{defend:{text:'守住刚找到的乘客',nextScene:'flesh'},leave:{text:'撤离车厢，放弃本次任务',nextScene:'end'}}
    },
    trioRoute: {
      text: [
        '伊之助撞开的狭窄缺口不适合所有乘客。你照着他留下的方向，撬开另一道能让伤员平稳通过的车门。',
        '三人的追击和你的救援并不争夺同一个终点：有人切断要害，也要有人守住那些无法奔跑的人。'
      ],
      buttons:{defend:{text:'守住伤员撤离的车门',nextScene:'flesh'},leave:{text:'撤离车厢，放弃本次任务',nextScene:'end'}}
    },
    trioDressing: {
      text: [
        '你按炭治郎的示意压住伤口，再把剩余绑带塞进容易拿到的位置。药剂已使用，治疗不会超过你的生命上限。',
        '善逸挡住前方回卷的触手，伊之助向车头跃去。你带着乘客退到下一节车厢，准备守住他们。'
      ],
      buttons:{defend:{text:'完成包扎，守住乘客',nextScene:'flesh'},leave:{text:'撤离车厢，放弃本次任务',nextScene:'end'}}
    },
    flesh: {
      combat: true,
      enemy: 'enmu flesh avatar',
      enemyName: '魇梦的血肉分身',
      chara: '梦',
      health: 40,
      damage: 6,
      attackDelay: 2.5,
      hit: 0.85,
      notification: '魇梦的血肉分身伸出触手，将你和乘客困在车厢里。',
      deathMessage: '你斩断了这节车厢的血肉触手。车头传来剧烈的震动：炭治郎和伊之助已经切断魇梦的要害。',
      loot: {
        scales: {min: 3, max: 6, chance: 1},
        cloth: {min: 3, max: 6, chance: 0.8},
        'cured meat': {min: 3, max: 6, chance: 1}
      },
      buttons: {
        rescue: {
          text: '继续救援乘客',
          cooldown: Events._LEAVE_COOLDOWN,
          nextScene: 'passengers'
        }
      }
    },
    passengers: {
      text: [
        '列车侧翻，蒸汽和尘土涌进车厢。你撬开变形的门，将受伤的乘客一个个带到路基外。',
        '炎柱早已守住其他车厢。没有乘客被血鬼术夺走性命，但伤者仍需要有人照看。',
        '你留下包扎伤口、清点人数。就在这时，林间落下一道更强的鬼影。'
      ],
      buttons: {
        stay: {text: '守着伤者，观察列车外的战况', nextScene: 'hashira'},
        leave: {text: '撤离现场，放弃本次任务', nextScene: 'end'}
      }
    },
    hashira: {
      text: [
        '上弦之叁·猗窝座出现在断裂的轨道旁。炎柱炼狱杏寿郎迎上去，将战场挡在乘客之外。',
        '这不是你能介入的对决。你按他的嘱托，把伤者带离余波，守住他拼尽全力保护的人。',
        '夜色逐渐变薄。猗窝座在日出前逃入林中，炎柱却留在了黎明里。'
      ],
      buttons: {
        listen: {text: '听完炎柱留下的嘱托', nextScene: 'dawn'},
        leave: {text: '撤离现场，放弃本次任务', nextScene: 'end'}
      }
    },
    dawn: {
      text: [
        '清晨的光落在获救的乘客身上。炎柱没有等到下一次任务，但他守护的人都活着。',
        '你记下伤者名单与列车上的战况，把他的嘱托交给鎹鸦：心要燃烧，脚步不能停下。',
        '无限列车支援已经完成。请沿地图安全返回庄园，保存本篇进展并领取阶段奖励；途中失败不会保存本次章节完成状态。'
      ],
      onLoad: function() {
        if (!World.state || World.state.mugentrain) return;
        World.state.mugentrain = true;
        World.markVisited(World.curPos[0], World.curPos[1]);
      },
      buttons: {
        leave: {text: '结束支援，返回地图', nextScene: 'end'}
      }
    }
  },
  audio: AudioLibrary.LANDMARK_TOWN
};

/** Unique, uninterrupted district rescue. Only a safe return commits the victory. */
Events.Yoshiwara = {
  ready: function() {
    return !!World.state && !World.state.yoshiwara && !$SM.get('game.yoshiwaraDone')
      && (!window.EarlyGame || EarlyGame.storyPrerequisite('district'));
  },
  resetSearch: function() {
    // Search choices are event-local, never a resumable expedition save.
    Events.Yoshiwara._intel = {};
  },
  found: function(id) {return !!(Events.Yoshiwara._intel || {})[id];},
  gather: function(id) {
    if (!Events.Yoshiwara._intel) Events.Yoshiwara._intel = {};
    Events.Yoshiwara._intel[id] = true;
  },
  searchedAll: function() {
    return ['makio','suma','hinatsuru'].every(Events.Yoshiwara.found);
  },
  finish: function() {
    if (!World.state || Engine.activeModule !== World || !World.curPos || !Events.Yoshiwara.searchedAll()) return false;
    var tile = World.state.map[World.curPos[0]][World.curPos[1]];
    if (tile !== World.TILE.TOWN || World.state.yoshiwara) return false;
    World.state.yoshiwara = true;
    World.markVisited(World.curPos[0],World.curPos[1]);
    return true;
  },
  commit: function() {
    if (!World.state || !World.state.yoshiwara || $SM.get('game.yoshiwaraDone')) return false;
    $SM.set('game.yoshiwaraDone',true,true);
    if (!$SM.hasPerk('kehai dansha')) $SM.addPerk('kehai dansha');
    Notifications.notify(null,'游郭救援已安全交付；音柱的气息断遮训练与章节奖励现在可以领取。');
    return true;
  }
};

// The remaining settlements keep their supplies and encounters, not district lore.
(function() {
  var generic = Events.Setpieces.town;
  if (!generic) return;
  var settlement = function(title,text,notice) {
    return Object.assign({},generic,{title:title,scenes:Object.assign({},generic.scenes,{
      start:Object.assign({},generic.scenes.start,{text:text,notification:notice})
    })});
  };
  Events.Setpieces.roadTown = settlement('宿场旧街',[
    '驿路绕进一段旧街。客栈的门牌歪斜着，搬走的人把最后一盏灯留在了檐下。',
    '这里曾替往来的行脚人准备食宿，如今只有诊所、仓房和游荡的鬼。清理旧街，可以把它变成返程的安全据点。'
  ],'你抵达宿场旧街 D；这里是补给支线，不是游郭。');
  Events.Setpieces.marketTown = settlement('废弃市镇',[
    '露天市集已经散去，货摊之间堆着破木箱。隔着倒塌的栅栏，还能看见旧学堂与药铺。',
    '搜寻可用的布匹、皮革和药剂，也要提防藏在废屋里的鬼。清理完成后，这里可以成为新的补给据点。'
  ],'你抵达废弃市镇 R；可以搜集物资，不会触发游郭主线。');
})();

Events.Setpieces.town = {
  title:'游郭 · 灯影下的救援',
  storySupply:true,
  scenes:{
    start:{
      text:[
        '游郭的灯笼照亮整条街，三味线声却盖不住一间间突然空下来的房屋。这里是地图上唯一的游郭 O，普通旧街 D、废弃市镇 R 都是别处。',
        '无限列车之后，音柱宇髓天元带队查探这处失踪案。三位潜入花楼的妻子已失去联络，你被安排协助后方侦查与救援，不独自取代队士迎战上弦。',
        '本篇会经历调查、带穴救援与连续战斗。先完成无限列车并安全返回，再接下救援；完成游郭后仍须走回庄园才能保存主线。'
      ],
      onLoad:Events.Yoshiwara.resetSearch,
      buttons:{
        enter:{text:'随音柱进入花街',available:Events.Yoshiwara.ready,nextScene:'briefing'},
        leave:{text:'暂不进入，回地图整备',nextScene:'end'}
      }
    },
    briefing:{
      text:[
        '宇髓将三处花楼的位置摊在案上。卷绪、须磨和雏鹤分别留下过暗号，如今联络同时中断，不能把其中任何一个人当成可放弃的线索。',
        '炭治郎他们负责正面潜入。你从后巷探查房屋与撤离路线，见到受困者就优先救人；遇到无法处理的鬼，立刻示警。',
        '你可以决定调查顺序，但必须找齐三人的去向，才能摸清血带真正藏人的地方。',
        '炭治郎请你留下能让获救者识别的方向；善逸约定听到异样先传位置；伊之助坚持找到地下入口就留记号。三人的手段不同，却都给你的后方救援留了接口。'
      ],
      buttons:{search:{text:'开始后巷调查',nextScene:'search'},leave:{text:'撤回地图，本次救援未完成',nextScene:'end'}}
    },
    search:{
      text:[
        '后巷的脚印在三个方向分开。花楼里的人记得来过谁，却总在提起失踪者时移开目光。',
        '不要急着追逐最显眼的鬼影：整理三妻的情报，才不会把藏在地下的人留在血带里。'
      ],
      buttons:{
        makio:{text:'追查卷绪留下的绳结',available:function(){return !Events.Yoshiwara.found('makio');},nextScene:'makio'},
        suma:{text:'询问须磨所在花楼的侍女',available:function(){return !Events.Yoshiwara.found('suma');},nextScene:'suma'},
        hinatsuru:{text:'沿药香寻找雏鹤的暗号',available:function(){return !Events.Yoshiwara.found('hinatsuru');},nextScene:'hinatsuru'},
        signals:{text:'核对三人组留下的接应暗号',nextScene:'trioSignals'},
        assemble:{text:'拼合三份线索，寻找带穴入口',available:Events.Yoshiwara.searchedAll,nextScene:'cellar'},
        leave:{text:'返回地图，本次救援未完成',nextScene:'end'}
      }
    },
    trioSignals:{
      text:[
        '你翻开出发前约好的暗号纸：炭治郎负责指出危险来自哪里，善逸负责把微弱的呼救带出墙外，伊之助负责标出地下能走的路。',
        '暗号只能帮助你判断撤离与接应，不能代替三妻的真实去向。你仍须亲自调查卷绪、须磨和雏鹤，才能打开带穴救援。'
      ],
      buttons:{
        smell:{text:'辨认炭治郎留在后巷的撤离箭头',nextScene:'trioTanjiro'},
        listen:{text:'核对善逸约定的“方向、人数、危险”口令',nextScene:'trioZenitsu'},
        passage:{text:'辨认伊之助标出的地下入口方向',nextScene:'trioInosuke'},
        back:{text:'收好暗号，继续三妻调查',nextScene:'search'},
        leave:{text:'返回地图，本次救援未完成',nextScene:'end'}
      }
    },
    trioTanjiro:{
      text:[
        '炭治郎没有让你循着他去追上弦，而是把通向外街的箭头留给走不快的人。你沿标记确认了门与后巷，知道获救者该往哪里去。',
        '判断气味是他的本领，守住一条每个人都能使用的撤离路，是你现在能完成的事。'
      ],
      buttons:{back:{text:'记住撤离方向，继续调查',nextScene:'search'},leave:{text:'返回地图，本次救援未完成',nextScene:'end'}}
    },
    trioZenitsu:{
      text:[
        '你把善逸留下的提示重新读了一遍：先报方向，再报人数，最后报是否有人无法行走。声音再小，也要有能接到它的人。',
        '你约好后方接应的回声，不把每一声动静都当成催促队友冲进危险的命令。'
      ],
      buttons:{back:{text:'留好接应口令，继续调查',nextScene:'search'},leave:{text:'返回地图，本次救援未完成',nextScene:'end'}}
    },
    trioInosuke:{
      text:[
        '墙脚的刻痕又粗又急，是伊之助约好的标记：下面有空间，入口却未必容得下所有人。',
        '你没有把一条能让他挤过去的路当成所有人的出口，而是在旁边补上了伤员需要更宽通道的提醒。'
      ],
      buttons:{back:{text:'记住入口与伤员路线，继续调查',nextScene:'search'},leave:{text:'返回地图，本次救援未完成',nextScene:'end'}}
    },
    makio:{
      text:[
        '房里的茶还温着，窗缝却夹着一小截割断的绳。卷绪把暗号藏在床脚：失踪的人不是从门口被带走的。',
        '你拆开地板，发现狭长的血带拖痕向地下延伸。那里传来不止一个人的呼吸声，卷绪也被困在其中。'
      ],
      onLoad:function(){Events.Yoshiwara.gather('makio');},
      buttons:{back:{text:'记下血带通道，继续调查',nextScene:'search'}}
    },
    suma:{
      text:[
        '侍女把声音压得极低：须磨在追查失踪者之前，托她把一份名册交给有藤花标记的人。',
        '名册里不只有花楼女子，也有帮工与前来寻亲的人。你按住发抖的纸页，核对出地下被困者的人数。',
        '须磨不是躲起来了。她与卷绪一样，被血带拖进了地下；撤离路线必须容得下所有获救的人。'
      ],
      onLoad:function(){Events.Yoshiwara.gather('suma');},
      buttons:{back:{text:'收好名册，继续调查',nextScene:'search'}}
    },
    hinatsuru:{
      text:[
        '偏僻的屋里，宇髓已经斩开困住雏鹤的血带。她先前借病退出花楼，仍守着来不及传出的情报；你确认她的状况，替她把药与水送到手边。',
        '她提醒你：操纵血带的鬼藏在人群中，地下的带子却会自己行动。先断开藏人的血带，才能让宇髓腾出手处理真正的威胁。',
        '雏鹤整理好藤花毒的援护器具。你替她清出一条通往屋顶的路线，再赶去地下支援。'
      ],
      onLoad:function(){Events.Yoshiwara.gather('hinatsuru');},
      buttons:{back:{text:'记住援护信号，继续调查',nextScene:'search'}}
    },
    cellar:{
      text:[
        '三份线索在同一处地板下汇合。地下的洞窟里，血带把受困者折进一道道窄缝；名册上的名字终于有了回声。',
        '伊之助先一步找到带穴，善逸也正把人从血带中分离。你沿他们撕开的缺口入内，负责守住撤离通道。'
      ],
      buttons:{guard:{text:'挡住回卷的血带',nextScene:'obi'},leave:{text:'撤离带穴，本次救援未完成',nextScene:'end'}}
    },
    obi:{
      combat:true,enemy:'district sentient obi',enemyName:'带穴中的血带分身',chara:'带',
      health:42,damage:6,attackDelay:2.6,hit:0.85,
      notification:'血带绕向刚获救的人。你必须守住通往街面的缺口。',
      deathMessage:'血带被切成碎片，卷绪和须磨接过获救者，一起往出口跑去。',
      loot:{cloth:{min:4,max:8,chance:1},scales:{min:3,max:6,chance:1}},
      buttons:{rescue:{text:'护送所有受困者离开带穴',cooldown:Events._LEAVE_COOLDOWN,nextScene:'evacuation'}}
    },
    evacuation:{
      text:[
        '你和卷绪、须磨照着名册清点获救者。宇髓赶来斩开剩余血带，地下的束缚终于散去。',
        '有人还在找家人，有人已经无力走路。你把能行走的人带到街口，让伤者靠着藤花标记等待接应。',
        '地面骤然传来巨响。堕姬的血带毁坏了街屋；若只追着战斗跑，逃出来的居民仍会被卷回去。'
      ],
      buttons:{routes:{text:'选择居民撤离路线',nextScene:'routes'},leave:{text:'返回地图，本次救援未完成',nextScene:'end'}}
    },
    routes:{
      text:[
        '通往外街的道路被断梁和瓦片堵住。两条路都能通行，但需要有人先把危险引开。',
        '选择只改变你负责的支援，不会跳过之后的战斗；没有藤花符也能从后巷护送居民。'
      ],
      buttons:{
        alley:{text:'护住后巷，把居民交给须磨',nextScene:'alley'},
        wisteria:{text:'消耗 1 枚藤花符，标出伤者避难处',cost:{'wisteria charm':1},nextScene:'shelter'},
        leave:{text:'返回地图，本次救援未完成',nextScene:'end'}
      }
    },
    alley:{
      text:[
        '你举起火把让居民认清出口，卷绪清除断梁，须磨挨个扶着伤者穿过后巷。',
        '街口被血带封住。你留在最后，把血带的攻击引向空下来的院子，为队伍争取离开的时间。'
      ],
      buttons:{hold:{text:'斩开街口的血带',nextScene:'dakiObi'}}
    },
    shelter:{
      text:[
        '藤花符的气味沿檐下散开。你把避难处的标记挂高，让失散的人和伤者找到接应的位置。',
        '卷绪和须磨留在后方，雏鹤也已就位。你返回空下来的街口，防止血带再次卷向避难处。'
      ],
      buttons:{hold:{text:'斩开逼近避难处的血带',nextScene:'dakiObi'}}
    },
    dakiObi:{
      combat:true,enemy:'daki district obi',enemyName:'堕姬延伸到街口的血带',chara:'陆',
      health:54,damage:8,attackDelay:2.6,hit:0.88,
      notification:'堕姬的血带横扫街口，你在后方拦下朝居民袭来的部分。',
      deathMessage:'袭向街口的血带被切开。正面战场上，宇髓已斩下堕姬的头颅，但鬼的气息仍未消失。',
      loot:{teeth:{min:5,max:9,chance:1},scales:{min:4,max:7,chance:1}},
      buttons:{observe:{text:'观察仍未结束的战局',cooldown:Events._LEAVE_COOLDOWN,nextScene:'brother'}}
    },
    brother:{
      text:[
        '妓夫太郎从妹妹体内现身，镰刃拖出带毒的血迹。原来上弦之陆不是一具身体，单独斩下堕姬的头并不能终结这场战斗。',
        '炭治郎与宇髓在正面迎战，善逸和伊之助牵制堕姬。雏鹤以藤花毒援护，你按照信号守住撤离通道。',
        '双鬼必须在同一瞬间被斩首。你的任务是挡住追向后方的血刃，让他们有机会配合，而不是独自抢下上弦的首级。'
      ],
      buttons:{cover:{text:'守住后方，挡开飞来的血刃',nextScene:'bloodSickles'},leave:{text:'返回地图，本次救援未完成',nextScene:'end'}}
    },
    bloodSickles:{
      combat:true,enemy:'gyutaro district blood sickles',enemyName:'妓夫太郎的回旋血刃',chara:'镰',
      health:66,damage:9,attackDelay:2.8,hit:0.9,ranged:true,
      notification:'旋转的血刃绕过正面战线，朝撤离的伤者逼近。',
      deathMessage:'最后一道血刃散开。你示意后方撤离完毕，决胜的信号也在屋顶之间传开。',
      loot:{teeth:{min:6,max:10,chance:1},'wisteria oil':{min:1,max:2,chance:0.6}},
      buttons:{signal:{text:'向正面战线发出接应信号',cooldown:Events._LEAVE_COOLDOWN,nextScene:'together'}}
    },
    together:{
      text:[
        '宇髓在激战中付出了一只手和一只眼的代价，仍以积累的判断牵住妓夫太郎。炭治郎终于将刀刃送向他的脖颈。',
        '另一侧，善逸与伊之助合力斩断堕姬的脖子。双鬼的头颅在同一时刻落地，上弦之陆的威胁终于被终结。',
        '但战斗还没有立即平静：妓夫太郎残留的血鬼术席卷废街。你趴下护住身旁的伤者，等冲击过去再向前。'
      ],
      buttons:{help:{text:'清点伤者，协助战后救援',nextScene:'aftercare'}}
    },
    aftercare:{
      text:[
        '祢豆子用血鬼术处理队士体内的毒，三妻守在宇髓身旁。你不再追逐鬼的残骸，转而包扎伤口、抬开压住道路的木梁。',
        '有人从破屋里走出来，低声问今晚是否真的结束了。你把名册交给卷绪，再与须磨逐项核对，没有漏下带穴中的任何一人。',
        '雏鹤将平安的消息交给鎹鸦。上弦被击败带来了希望，但失去的街屋与伤者仍需要有人照料。'
      ],
      buttons:{listen:{text:'听宇髓留下的训练建议',nextScene:'retirement'}}
    },
    retirement:{
      text:[
        '宇髓决定退出柱的最前线。三妻终于不用再以失联的暗号报平安，围在他身旁，哭声与笑声混在一起。',
        '他让你记住这次守住撤离通道的节奏：察觉攻击前的细响，藏起自己的气息，再选择出手的位置。活下来并带回情报，也是战斗的一部分。',
        '回到庄园后，你会获得气息断遮的训练成果。现在这份胜利仍只记在本次远征里，必须安全返程才能交付。'
      ],
      buttons:{dawn:{text:'完成清点，迎接花街的黎明',nextScene:'dawn'}}
    },
    dawn:{
      text:[
        '黎明落在毁坏的花街上。游郭只此一处，救出的名字也不再只是失踪名册上的记号。你将任务报告交给鎹鸦，准备沿来路返回。',
        '本次游郭救援已完成，但尚未提交：请安全返回庄园，保存章节与地图进展，领取阶段奖励。途中失败不会保存本次完成状态。'
      ],
      onLoad:Events.Yoshiwara.finish,
      buttons:{leave:{text:'结束救援，回地图安全返程',nextScene:'end'}}
    }
  },
  audio:AudioLibrary.LANDMARK_TOWN
};
