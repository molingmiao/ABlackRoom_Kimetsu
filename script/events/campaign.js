/** World chapters commit only with the temporary map on a safe return. */
Events.Setpieces.mugenTrain = {
  title: '无限列车',
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
        '惊醒时，血肉触手已经爬上车厢。炭治郎他们向车头赶去；你必须守住后面的乘客。'
      ],
      buttons: {
        defend: {text: '守住乘客所在的车厢', nextScene: 'flesh'},
        leave: {text: '撤离车厢，放弃本次任务', nextScene: 'end'}
      }
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
