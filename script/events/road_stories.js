/*
 * Optional support stories, inspired by the official episode settings:
 * https://kimetsu.com/anime/risshihen/story/?story=3
 * https://kimetsu.com/anime/risshihen/story/?story=11
 * Dialogue and side missions are original. Only safe return commits a reward.
 */
Object.assign(Events.StoryChapters.definitions, {
  sagiri: {
    tile:'Q',flag:'game.sagiriRoadDone',name:'狭雾山旧道',
    required:['route','supplies','rescue'],reward:{cloth:8,'cured meat':8},
    prerequisite:function(){return true;}
  },
  drumRoad: {
    tile:'G',flag:'game.drumRoadDone',name:'鼓屋外围支援',
    required:['children','signals','guard'],reward:{fur:12,teeth:6},
    prerequisite:function(){return true;}
  },
  wisteriaHouse: {
    tile:'J',flag:'game.wisteriaHouseDone',name:'藤之家夜路',
    required:['companions','route','escort'],reward:{cloth:12,medicine:2},
    prerequisite:function(){return true;}
  }
});

Events.Setpieces.sagiriRoad = {
  title:'狭雾山旧道 · 雾里留下的路标',
  storySupply:true,
  scenes:{
    start:{
      text:[
        '狭雾山的旧道 Q 被薄雾遮去一半。路旁保留着一份早年的支援记录：那时炭治郎还在鳞泷左近次门下修行，你曾随送补给的队伍上山。',
        '本篇回看那次同行，不改变现在的剧情时间。这里没有必须战胜的鬼；你要辨路、整理补给，再把落在山里的送货人带回来。',
        '本篇是可选见闻，不阻挡主线。完整完成后，必须安全返回庄园，才会保存记录并获得一次性补给：布料 ×8、熏肉 ×8。'
      ],
      onLoad:function(){Events.StoryChapters.reset('sagiri');},
      buttons:{
        enter:{text:'翻开旧记录，沿山道送补给',available:function(){return Events.StoryChapters.ready('sagiri');},nextScene:'footprints'},
        recap:{text:'回顾已完成的狭雾山见闻',available:function(){return !!$SM.get('game.sagiriRoadDone');},nextScene:'recap'},
        leave:{text:'返回地图',nextScene:'end'}
      }
    },
    footprints:{
      text:[
        '湿泥里有往返的脚印，细绳却在脚印旁绷得笔直。炭治郎抬手示意停下：这里接着训练用的机关，不是运送米袋该走的捷径。',
        '他自己仍会在训练中跌倒，却把送货人可能踩到的危险记得很清楚。你们先确认上山的安全路线。'
      ],
      buttons:{
        high:{text:'走高处石阶，记住避开机关的拐点',nextScene:'stoneRoute'},
        stream:{text:'沿溪岸辨认旧路，留下回程标记',nextScene:'streamRoute'},
        leave:{text:'暂不进山，返回地图',nextScene:'end'}
      }
    },
    stoneRoute:{
      text:[
        '石阶比近路多绕了一段，你们却能从高处看清被雾藏住的岔口。炭治郎在危险的细绳前横放树枝，提醒后来的人止步。',
        '你记下三个能互相看见的位置。背着重物的人不必踏进机关，也能一步步找到下一处路标。'
      ],
      onLoad:function(){Events.StoryChapters.mark('sagiri','route');},
      buttons:{continue:{text:'沿石阶送达山间小屋',nextScene:'hut'}}
    },
    streamRoute:{
      text:[
        '溪岸的泥软，重物不能全压在同一个人肩上。你与炭治郎轮流接过米袋，在每个离水的岔口绑好醒目的草结。',
        '溪声会盖过呼喊，于是你们约好每到岔路就回头点人数。路线慢了一些，队伍却没有在雾里散开。'
      ],
      onLoad:function(){Events.StoryChapters.mark('sagiri','route');},
      buttons:{continue:{text:'带齐队伍，送达山间小屋',nextScene:'hut'}}
    },
    hut:{
      text:[
        '鳞泷接过补给，先问一路上有没有人落下。他没有让你参与炭治郎的考验，只请你照看山道上的人，别把训练机关当成给行人设下的难关。',
        '炭治郎将祢豆子休息的房门轻轻带上，回来帮忙整理受潮的粮袋。你可以补上两份熏肉，也可以修好储粮处，减少往后的损耗。'
      ],
      buttons:{
        food:{text:'补上 2 份熏肉，留下能直接吃的饭食',cost:{'cured meat':2},nextScene:'sharedMeal'},
        mend:{text:'修整粮架与屋檐，不消耗物资',nextScene:'mendedRoof'},
        leave:{text:'暂不继续，返回地图',nextScene:'end'}
      }
    },
    sharedMeal:{
      text:[
        '炭治郎把熏肉分成几份，没有先取走最大的一块。他留出送货人下山的路餐，再把剩下的放进干燥的盒子。',
        '你们终于有空坐下吃饭。鳞泷提醒，修行不是挨饿的比试：赶路之前，要给身体留下回来的力气。'
      ],
      onLoad:function(){Events.StoryChapters.mark('sagiri','supplies');},
      buttons:{listen:{text:'饭后听炭治郎说起训练',nextScene:'breathing'}}
    },
    mendedRoof:{
      text:[
        '你把歪斜的粮架垫稳，炭治郎沿屋檐找到漏水的缝。两人用屋旁现成的竹片补好遮挡，没有取用你的物资。',
        '最后一袋粮食离开湿地时，屋里多出一小块干燥的空地。帮助人活下来，有时就是让明天的饭不再发霉。'
      ],
      onLoad:function(){Events.StoryChapters.mark('sagiri','supplies');},
      buttons:{listen:{text:'收好工具，听炭治郎说起训练',nextScene:'breathing'}}
    },
    breathing:{
      text:[
        '炭治郎说，上山时他总以为咬紧牙就能多跑一段，后来才发现一旦乱了呼吸，脚下也会跟着乱。他把今日踩错的地方一一记下，并没有把失败藏起来。',
        '你没有因此立刻学会一式剑技，却记住了一个实用的提醒：在下一次拐弯前停下来确认同伴，比跑到终点才发现少了人更有用。'
      ],
      buttons:{depart:{text:'清点送货人，准备下山',nextScene:'missing'}}
    },
    missing:{
      text:[
        '清点人数时，队里少了一位去找散落绳索的老人。雾中的一声回应很低，方向又被石壁折回。',
        '炭治郎辨出潮湿山草间留下的气味，你则沿刚才记住的路标寻找。两个人约好只走已经确认的安全区域。'
      ],
      buttons:{call:{text:'停下脚步，用短声呼唤确认位置',nextScene:'found'},trace:{text:'沿回程标记逐段寻找，保持照应',nextScene:'found'}}
    },
    found:{
      text:[
        '老人坐在倒木后，脚踝肿得无法独自站起来。他怕耽误送货，反而不敢大声求助。你让他扶稳肩膀，炭治郎用空绳把散落的货物重新绑好。',
        '这一次，队伍按最慢的那个人调整速度。雾还在，路标也还在，没有人再因怕麻烦别人而掉队。'
      ],
      onLoad:function(){Events.StoryChapters.mark('sagiri','rescue');},
      buttons:{return:{text:'把老人送回山脚，写下路况',nextScene:'record'}}
    },
    record:{
      text:[
        '鳞泷收下路况记录，只在最末添上一笔：上山的人数与下山的人数相同。炭治郎重新背好训练用的行囊，向你郑重道别。',
        '多年后的重读里，你仍记得那天没有什么惊天动地的战果。山路上只是少了一份恐惧，多了一条能把人带回来的路。'
      ],
      buttons:{finish:{text:'合上旧记录，准备交付见闻',nextScene:'ending'}}
    },
    ending:{
      text:['狭雾山旧道见闻已完成，尚未永久保存。请安全返回庄园，交付本次记录与一次性补给；途中失败不会保留本次章节进度。'],
      onLoad:function(){Events.StoryChapters.finish('sagiri');},
      buttons:{leave:{text:'返回地图，安全回到庄园',nextScene:'end'}}
    },
    recap:{
      text:['山雾仍会散去又聚拢，旧道上的路标已经补齐。你记得炭治郎递来的绳索，也记得送货人终于敢开口求助。','这段见闻已经安全交付。重访只回看记录，不再战斗、不重复发放补给。'],
      buttons:{leave:{text:'收好记录，返回地图',nextScene:'end'}}
    }
  },
  audio:AudioLibrary.LANDMARK_FRIENDLY_OUTPOST
};

Events.Setpieces.drumRoad = {
  title:'鼓屋外围 · 墙外也有人需要守护',
  storySupply:true,
  scenes:{
    start:{
      text:[
        '鼓屋外围 G 的旧木牌保留着一次救援的经过。这段见闻发生在炭治郎、善逸和伊之助初次相遇的时期；你负责屋外的撤离，屋内的正篇战斗仍由他们完成。',
        '别追着每一次鼓声闯进去。先照顾受惊的孩子，再接应散落在林道的人，最后守住通向安全处的小路。建议携带武器、食物与治疗用品；本篇有一场外围战斗。',
        '这是可选支援，不阻挡主线。完成后请安全返回庄园，一次性获得毛皮 ×12、牙齿 ×6；重访不会重复战斗或领奖。'
      ],
      onLoad:function(){Events.StoryChapters.reset('drumRoad');},
      buttons:{
        enter:{text:'回看救援，守住鼓屋外侧',available:function(){return Events.StoryChapters.ready('drumRoad');},nextScene:'children'},
        recap:{text:'回顾已完成的鼓屋支援',available:function(){return !!$SM.get('game.drumRoadDone');},nextScene:'recap'},
        leave:{text:'返回地图',nextScene:'end'}
      }
    },
    children:{
      text:[
        '屋内传来低沉的鼓声，孩子们说不清门后究竟发生了什么。你先把附近逃出来的一对姐弟带离门口，让他们坐在仍有天光的空地。',
        '他们担心自己一离开，家人就再也找不到。你可以分出一点路餐，也可以陪他们写下接应记号；两种办法都能让他们愿意留在安全处。'
      ],
      buttons:{
        meal:{text:'分出 1 份熏肉，陪孩子慢慢吃',cost:{'cured meat':1},nextScene:'meal'},
        names:{text:'记下家人与衣着，在树旁留下记号',nextScene:'names'},
        leave:{text:'暂不接下支援，返回地图',nextScene:'end'}
      }
    },
    meal:{
      text:['姐弟分着一份熏肉，终于能把话说完整。你一边听，一边确认他们有没有受伤，约定家人出来时由你去接应。','他们答应待在明亮的空地，不再因为屋里的一声响动就朝门口跑去。'],
      onLoad:function(){Events.StoryChapters.mark('drumRoad','children');},
      buttons:{listen:{text:'确认孩子安全，留意屋外动静',nextScene:'drum'}}
    },
    names:{
      text:['你让姐姐写下家人的名字，弟弟则认真描述对方袖口的颜色。每说清一件事，他们眼里的慌乱就少一点。','树旁的接应记号让他们知道，这里不会被遗忘。你约定先守在看得见彼此的地方，等屋里的人出来。'],
      onLoad:function(){Events.StoryChapters.mark('drumRoad','children');},
      buttons:{listen:{text:'留下接应记号，留意屋外动静',nextScene:'drum'}}
    },
    drum:{
      text:['又一记鼓声落下，门后的脚步仿佛忽然换了方向。你从敞开的窗里短暂看见炭治郎，他示意屋外的人先撤开，不要挤进变化中的房间。','你把这句话传给赶来的隐：搜救要留出接应的空地，不能让惊慌的人在屋檐下互相冲撞。'],
      buttons:{wait:{text:'接住从侧门撤出来的人',nextScene:'zenitsu'}}
    },
    zenitsu:{
      text:['善逸从侧面带出一名逃散的孩子，嘴上仍在说这里有多可怕，手却始终没有松开。他听了片刻，指出林道深处还有不属于同行人的脚步。','你没有让他独自回去查看。你们先约定声音信号：听见两下敲击便停步聚拢，连续三下则沿空地的方向退。'],
      buttons:{signal:{text:'试一遍信号，交代隐照看孩子',nextScene:'inosuke'}}
    },
    inosuke:{
      text:['戴野猪头套的少年从屋旁冲出，险些撞散刚排好的队伍。你把撤离方向指给他，说明有人还没走出林子；这次要找的是落单的人。','伊之助跃上倒木，看出一处被灌木遮住的岔口。善逸指出那里的脚步越来越近，你则把两人的提醒连成一条能让伤者走过的路。'],
      onLoad:function(){Events.StoryChapters.mark('drumRoad','signals');},
      buttons:{route:{text:'带领队伍向有天光的坡地撤离',nextScene:'track'}}
    },
    track:{
      text:['泥地上，几行慌乱的脚印汇进同一片密林。你找到两名躲藏的路人，正准备让他们跟上队伍，一只伏在根隙间的鬼忽然抬起头。','屋里的鼓声仍未停歇。你不能替炭治郎去完成他的战斗，只能先守住眼前这些人。'],
      buttons:{guard:{text:'让路人撤到坡地，拦住伏路鬼',nextScene:'guard'},leave:{text:'放弃本次支援，返回地图',nextScene:'end'}}
    },
    guard:{
      combat:true,enemy:'鼓屋外围的伏路鬼',enemyName:'鼓屋外围的伏路鬼',chara:'伏',health:32,damage:2,hit:0.8,attackDelay:2.6,
      notification:'伏路鬼绕过屋舍，扑向刚撤出林道的人。',
      deathMessage:'伏路鬼倒在树根旁。你听见约定的短声，撤离的人仍聚在一起。',
      loot:{},
      buttons:{check:{text:'确认战斗结束，清点撤离队伍',cooldown:Events._LEAVE_COOLDOWN,nextScene:'count'}}
    },
    count:{
      text:['隐念出名单，你逐一确认回应。善逸把最后一个孩子带到空地，伊之助指着自己找出的岔路，非要你把它画进报告。','没有人因鼓声又走回屋里，也没有人被留在林间。屋外的支援终于有了完整的交代。'],
      onLoad:function(){Events.StoryChapters.mark('drumRoad','guard');},
      buttons:{wait:{text:'把接应名单交给归来的炭治郎',nextScene:'reunion'}}
    },
    reunion:{
      text:['屋内的战斗由炭治郎结束。你没有见证每一次挥刀，只在他带着伤走出来时，将完整的接应名单递给他。','炭治郎先问孩子是否平安，随后才看见自己袖口渗出的血。善逸和伊之助还不习惯彼此的脾气，却已经和他一起走上了下一段路。'],
      buttons:{report:{text:'收好外围救援记录，准备返程',nextScene:'ending'}}
    },
    ending:{
      text:['鼓屋外围支援已完成，记录仍留在本次远征中。请安全返回庄园，保存这段见闻并获得一次性补给；中途失败不会保存本次完成状态。'],
      onLoad:function(){Events.StoryChapters.finish('drumRoad');},
      buttons:{leave:{text:'返回地图，安全回到庄园',nextScene:'end'}}
    },
    recap:{
      text:['树上的接应记号已经褪色，你仍能在记录里读出那天所有获救者的名字。炭治郎结束了屋内的战斗，你与伙伴们守住了屋外的归路。','本篇已经安全交付。重访仅回看见闻，不重复战斗或领取补给。'],
      buttons:{leave:{text:'合上记录，返回地图',nextScene:'end'}}
    }
  },
  audio:AudioLibrary.LANDMARK_FRIENDLY_OUTPOST
};

Events.Setpieces.wisteriaHouse = {
  title:'藤之家 · 留给晚归人的灯',
  storySupply:true,
  scenes:{
    start:{
      text:[
        '藤之家 J 的门牌绘着藤花家纹。屋主受过鬼杀队的恩惠，愿意为受伤的队士提供歇脚处。桌上留着一段鼓屋之后、那田蜘蛛山之前的夜路支援记录。',
        '本篇回看炭治郎、善逸与伊之助在此休养时的一次见闻。三人的伤还没有好，你负责护送夜归的送药人，不能把养伤的伙伴拉上新的战场。建议备好武器与治疗用品；途中有一场战斗。',
        '这是可选故事，不增加主线门槛。完成后必须安全回庄园，才能保存并获得一次性补给：布料 ×12、药剂 ×2。重访不会重复领奖。'
      ],
      onLoad:function(){Events.StoryChapters.reset('wisteriaHouse');},
      buttons:{
        enter:{text:'翻开夜路记录，拜访藤之家',available:function(){return Events.StoryChapters.ready('wisteriaHouse');},nextScene:'welcome'},
        recap:{text:'回顾已完成的藤之家见闻',available:function(){return !!$SM.get('game.wisteriaHouseDone');},nextScene:'recap'},
        leave:{text:'返回地图',nextScene:'end'}
      }
    },
    welcome:{
      text:['屋主把热水与换洗的衣服放在门边，没有先问队士能付多少钱。医师刚交代过，受伤的人必须休养，不能因为听见下一项任务就立即起身。','炭治郎接过绷带向你道谢，善逸先问药苦不苦，伊之助则盯着餐盘，仿佛食量也能分出胜负。'],
      buttons:{sit:{text:'坐下吃饭，听三位伙伴说话',nextScene:'supper'}}
    },
    supper:{
      text:['炭治郎把祢豆子的木箱安放在安静的地方，再给你留出座位。善逸对箱子里的妹妹仍有数不清的问题，伊之助则不明白为什么没人愿意饭后马上比试。','你请他们各自说一件此刻能帮上忙的事。炭治郎记得送药人走过的路，善逸听得见远处的脚步，伊之助熟悉山坡上的岔口。'],
      buttons:{listen:{text:'把三人的提醒记在同一张路图上',nextScene:'promise'}}
    },
    promise:{
      text:['你向炭治郎确认失联者的衣着，与善逸约好回程的敲门节奏，又让伊之助画出容易误入深林的岔口。屋主把三份提醒收在同一张纸上。','他们不用再次受伤才能派上用场。你答应回来时告诉他们每个人都平安，也请他们答应在医师允许之前好好休息。'],
      onLoad:function(){Events.StoryChapters.mark('wisteriaHouse','companions');},
      buttons:{ask:{text:'向屋主询问尚未归来的送药人',nextScene:'lateGuest'}}
    },
    lateGuest:{
      text:['屋主望了一眼门外：常来送药的两人应当早已到达，却一直没有消息。天色渐暗，留在远处的灯光不足以指清岔路。','你可以提供一支火把设置信号，也可以沿屋主熟悉的路逐段寻找。两种办法都能完成护送，不需要等待现实中的夜晚。'],
      buttons:{
        torch:{text:'提供 1 支火把，在路口设置接应信号',cost:{torch:1},nextScene:'litRoute'},
        guide:{text:'带上路图，沿熟悉的路逐段寻找',nextScene:'quietRoute'},
        leave:{text:'暂不护送，返回地图',nextScene:'end'}
      }
    },
    litRoute:{
      text:['火把被安在不易碰倒的石缝里，你和留守的人约好，回程看见光就停下来确认人数。善逸从门内辨认出远处一声拖长的呼救。','你沿信号指向的岔路赶去。光没有让黑暗消失，却让归来的人知道门在什么地方。'],
      onLoad:function(){Events.StoryChapters.mark('wisteriaHouse','route');},
      buttons:{search:{text:'沿信号前进，寻找送药人',nextScene:'cart'}}
    },
    quietRoute:{
      text:['你没有取用额外物资，只在屋主的路图上依次核对水渠、矮桥与山坡。走到伊之助圈出的岔口时，果然看见新近折断的药箱绑带。','你把绑带系在显眼处，告诉后来的接应者已经有人继续向前。熟悉路线与留下记号，同样能把慌乱缩小一点。'],
      onLoad:function(){Events.StoryChapters.mark('wisteriaHouse','route');},
      buttons:{search:{text:'顺着绑带的痕迹寻找',nextScene:'cart'}}
    },
    cart:{
      text:['药车的一只轮子卡进沟里。两位送药人正靠在路边，一人扭伤了脚，另一人迟迟不肯放下沉重的药箱。','你让他们先带上能随身携带的急用药，留下路标再安排取回车上的东西。人活着回去，比把每样物品都扛到身上更要紧。'],
      buttons:{escort:{text:'扶起伤者，沿标记退回藤之家',nextScene:'pursuit'},leave:{text:'放弃本次护送，返回地图',nextScene:'end'}}
    },
    pursuit:{
      text:['林间响起追赶的脚步，速度比拖着伤腿的送药人快得多。你把他们送向留守者看得见的拐角，自己停在狭窄的桥头。','藤花家纹在远处的门边轻轻晃动。回到那里之前，你还得守住这一小段没有灯的路。'],
      buttons:{guard:{text:'挡住追来的夜路鬼',nextScene:'guard'}}
    },
    guard:{
      combat:true,enemy:'追逐药车的夜路鬼',enemyName:'追逐药车的夜路鬼',chara:'追',health:55,damage:4,hit:0.82,attackDelay:2.5,
      notification:'夜路鬼越过散落的药箱，想从你身旁追向伤者。',
      deathMessage:'追赶声终于停下。桥的另一侧传来回应，两位送药人都已经靠近藤之家。',
      loot:{},
      buttons:{return:{text:'确认道路安全，护送伤者进门',cooldown:Events._LEAVE_COOLDOWN,nextScene:'homecoming'}}
    },
    homecoming:{
      text:['你按约定敲了门，屋主立刻让开门口。炭治郎扶住快要滑落的药袋，善逸一边抱怨等得心慌一边递来水，伊之助终于肯先把自己的座位让给伤者。','送药人报出同伴的名字，两声回应都在屋里。你将未取回的药车位置交给隐，请他们天亮后再去处理。'],
      onLoad:function(){Events.StoryChapters.mark('wisteriaHouse','escort');},
      buttons:{rest:{text:'与伙伴整理这次夜路记录',nextScene:'lamp'}}
    },
    lamp:{
      text:['屋主没有追问战斗有多激烈，只把已经凉下来的饭重新热好。伊之助吃得很快，善逸仍在说下一次可别这么晚，炭治郎认真记下送药人的谢意。','你在记录末尾画了一盏灯。它没有替任何人挥刀，却让走在夜路上的人知道，前面还有一扇会为他们打开的门。'],
      buttons:{finish:{text:'合上夜路记录，准备安全返程',nextScene:'ending'}}
    },
    ending:{
      text:['藤之家夜路护送已完成，尚未永久保存。请安全返回庄园交付见闻与一次性补给；途中失败会丢失本次章节进度。'],
      onLoad:function(){Events.StoryChapters.finish('wisteriaHouse');},
      buttons:{leave:{text:'返回地图，安全回到庄园',nextScene:'end'}}
    },
    recap:{
      text:['旧记录里夹着一张画有灯盏的纸。送药人平安到家，三位伙伴也继续完成了那段难得的休养。','本篇已经安全交付。这里仍能回看那晚的见闻，但不会重复开启战斗或发放补给。'],
      buttons:{leave:{text:'放回记录，返回地图',nextScene:'end'}}
    }
  },
  audio:AudioLibrary.LANDMARK_FRIENDLY_OUTPOST
};
