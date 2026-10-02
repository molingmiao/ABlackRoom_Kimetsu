/** Castle-only demon tactics. Transient effects belong to one live fight. */
var DemonPatterns = {
  _fight: null,
  TYPES: [
    { id: 'combo', floor: 11, name: '连刃鬼', title: '血鬼术 · 三叠连刃', hint: '预警后连攻三次；控制可打断蓄力，也能取消尚未落下的连击。' },
    { id: 'armour', floor: 21, name: '骨铠鬼', title: '血鬼术 · 骨铠架势', hint: '骨甲减伤 25%，最多持续 8 秒；三次实际命中或一次控制可击碎。' },
    { id: 'siphon', floor: 31, name: '噬血鬼', title: '血鬼术 · 噬血突袭', hint: '仅造成实际伤害时，鬼回复该伤害的 70%；打断、护盾或减伤可限制吸血。' },
    { id: 'bind', floor: 41, name: '缚丝鬼', title: '血鬼术 · 缠身血丝', hint: '命中后降低命中率 15 个百分点，最多 6 秒；三次实际命中、控制或服药/精油可解除。' },
    { id: 'shadow', floor: 51, name: '影分身鬼', title: '血鬼术 · 血影分身', hint: '分身存在最多 10 秒，每 2.5 秒追加一次低伤攻击；远程命中一次、近战命中三次或控制可驱散。' }
  ],
  _scale: function() {
    return Engine.options.testerMode ? Math.max(1, Engine.options.combatTimeScale || 1) : 1;
  },
  available: function(floor) {
    return DemonPatterns.TYPES.filter(function(type) { return floor >= type.floor; });
  },
  pickArchetype: function(floor) {
    var pool = DemonPatterns.available(floor);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  },
  strengthen: function(stats, floor) {
    // Preserve the first twenty floors; strength comes mainly from tactics,
    // with bounded stat growth rather than a new exponential HP curve.
    if (floor > 20) {
      stats.hp = Math.floor(stats.hp * (1 + Math.min(0.12, (floor - 20) * 0.0015)));
      stats.dmg = Math.floor(stats.dmg * (1 + Math.min(0.16, (floor - 20) * 0.002)) + 1e-9);
    }
    return stats;
  },
  makeArt: function(id, dmg) {
    var type = DemonPatterns.TYPES.filter(function(item) { return item.id === id; })[0];
    if (!type) return null;
    var art = {
      patternType: id, telegraph: type.title, patternHint: type.hint,
      interruptedText: type.title + '被打断。', hit: 0.95,
      interval: 18, telegraphSec: 2.5, dmg: Math.max(1, Math.floor(dmg * 0.6))
    };
    if (id === 'combo') { art.interval = 17; art.telegraphSec = 2; art.dmg = Math.max(1, Math.floor(dmg * 0.55)); }
    if (id === 'armour') { art.interval = 21; art.dmg = 0; }
    if (id === 'siphon') { art.interval = 19; art.dmg = Math.max(1, Math.floor(dmg * 0.8)); }
    if (id === 'bind') { art.interval = 20; art.ranged = true; art.dmg = Math.max(1, Math.floor(dmg * 0.5)); }
    if (id === 'shadow') { art.interval = 24; art.telegraphSec = 3; art.ranged = true; art.dmg = Math.max(1, Math.floor(dmg * 0.4)); }
    return art;
  },
  configureScene: function(scene, floor, kind, preferredId) {
    var pool = DemonPatterns.available(floor).slice();
    if (!pool.length) return scene;
    var count = (kind === 'boss' && floor >= 50) || (kind === 'elite' && floor >= 31) ? 2 : 1;
    var picked = [];
    if (preferredId) {
      var preferred = pool.filter(function(type) { return type.id === preferredId; })[0];
      if (preferred) { picked.push(preferred); pool = pool.filter(function(type) { return type !== preferred; }); }
    }
    while (picked.length < count && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    var old = (scene.telegraphAttacks || []).slice();
    // A guardian keeps a mix of familiar and new techniques. Cap the total
    // warning load so adding archetypes does not pile five simultaneous casts.
    var cap = kind === 'boss' ? (floor >= 60 ? 4 : 3) : kind === 'elite' ? 3 : 1;
    var arts = picked.map(function(type) { return DemonPatterns.makeArt(type.id, scene.damage); });
    scene.telegraphAttacks = old.slice(0, Math.max(0, cap - arts.length)).concat(arts);
    scene.demonPatternIds = picked.map(function(type) { return type.id; });
    return scene;
  },
  _isCurrent: function(fight) {
    var event = Events.activeEvent();
    return !!fight && DemonPatterns._fight === fight && CombatTelegraphs._fight === fight.telegraphs
      && Engine.activeModule === Space && !Events.won && !Events.fought && !!event && !event.ending
      && event.scenes[Events.activeScene] === fight.scene;
  },
  _isActive: function(fight) {
    return DemonPatterns._isCurrent(fight) && World.health > 0 && fight.enemy.data('hp') > 0;
  },
  start: function(scene, parent, telegraphs) {
    DemonPatterns.stop();
    if (Engine.activeModule !== Space || !(scene.demonPatternIds || []).length) return;
    var fight = DemonPatterns._fight = {
      scene: scene, telegraphs: telegraphs, enemy: telegraphs.enemy, player: telegraphs.player,
      timers: [], armour: null, bind: null, shadow: null, combo: null,
      box: $('<div>').addClass('demonPatternStatus').attr('aria-live', 'polite').appendTo(parent)
    };
    $('<div>').addClass('demonPatternGuide').text('本场鬼术：' + scene.demonPatternIds.map(function(id) {
      return DemonPatterns.TYPES.filter(function(type) { return type.id === id; })[0].hint;
    }).join(' ')).appendTo(fight.box);
    fight.live = $('<div>').addClass('demonPatternLive').appendTo(fight.box);
    DemonPatterns.update();
  },
  _seconds: function(seconds) { return Date.now() + seconds * 1000 / DemonPatterns._scale(); },
  update: function() {
    var fight = DemonPatterns._fight;
    if (!fight) return;
    if (!DemonPatterns._isCurrent(fight)) { DemonPatterns.stop(); return; }
    var wasBound = !!fight.bind;
    var labels = [];
    ['armour', 'bind', 'shadow'].forEach(function(id) {
      var effect = fight[id];
      if (effect && (id === 'shadow' ? Date.now() > effect.until : Date.now() >= effect.until)) {
        if (id === 'shadow') clearTimeout(effect.timer);
        fight[id] = null;
        Notifications.notify(null, {armour: '骨甲架势消退。', bind: '血丝松开，命中率恢复。', shadow: '血影分身消散。'}[id]);
      }
      effect = fight[id];
      if (effect) labels.push({armour: '骨甲减伤 25%', bind: '缚丝：命中率 -15 个百分点', shadow: '分身追加攻击'}[id]
        + ' · ' + Math.max(0, (effect.until - Date.now()) * DemonPatterns._scale() / 1000).toFixed(1) + '秒 · 再命中' + effect.hits + '次可解除');
    });
    if (fight.combo) labels.push('连刃余下 ' + fight.combo.remaining + ' 段，可用控制取消。');
    fight.live.text(labels.length ? labels.join('；') : '当前没有持续鬼术效果。');
    if (wasBound && !fight.bind) Events.setHeal();
  },
  _later: function(fight, action, seconds) {
    var timer = Engine.combatSetTimeout(function() {
      fight.timers = fight.timers.filter(function(id) { return id !== timer; });
      if (DemonPatterns._isActive(fight)) action();
    }, seconds * 1000);
    fight.timers.push(timer);
    return timer;
  },
  _strike: function(fight, art, onDamage, source) {
    if (!DemonPatterns._isActive(fight) || fight.enemy.data('stunned') || fight.enemy.data('status') === 'meditation') return;
    if (Math.random() > art.hit) { Notifications.notify(null, art.telegraph + '未命中。'); return; }
    var fn = art.ranged ? Events.animateRanged : Events.animateMelee;
    fn(fight.enemy, art.dmg, null, {
      source: source || 'blood art',
      isValid: function() {
        return DemonPatterns._isActive(fight) && !fight.enemy.data('stunned') && fight.enemy.data('status') !== 'meditation';
      },
      onDamage: function(amount) {
        // Shields and misses never reach this hook; fatal hits settle before
        // a summon can tick again or the demon can heal against a dead player.
        if (!Events.checkPlayerDeath() && DemonPatterns._isActive(fight) && amount > 0 && onDamage) onDamage(amount);
      }
    });
  },
  resolve: function(art, telegraphs) {
    if (!art.patternType) return false;
    var fight = DemonPatterns._fight;
    if (!DemonPatterns._isActive(fight) || fight.telegraphs !== telegraphs) return true;
    if (art.patternType === 'armour') {
      fight.armour = {hits: 3, until: DemonPatterns._seconds(8)};
      Notifications.notify(null, '鬼展开骨甲：减伤 25%，三次实际命中或控制可击碎。');
    } else if (art.patternType === 'siphon') {
      DemonPatterns._strike(fight, art, function(amount) {
        var before = fight.enemy.data('hp');
        var healed = Math.min(fight.enemy.data('maxHp') - before, Math.floor(amount * 0.7));
        if (healed > 0) {
          fight.enemy.data('hp', before + healed);
          Events.updateFighterDiv(fight.enemy);
          Events.drawFloatText('吸血 +' + healed, $('.hp', fight.enemy));
        }
      });
    } else if (art.patternType === 'bind') {
      DemonPatterns._strike(fight, art, function() {
        fight.bind = {hits: 3, until: DemonPatterns._seconds(6)};
        Notifications.notify(null, '缚丝缠身：命中率降低 15 个百分点；实际命中、控制或药物可解除。');
        Events.setHeal();
        DemonPatterns.update();
      });
    } else if (art.patternType === 'shadow') {
      if (fight.shadow) clearTimeout(fight.shadow.timer);
      var shadow = fight.shadow = {hits: 3, until: DemonPatterns._seconds(10)};
      var strike = function() {
        if (fight.shadow !== shadow || Date.now() > shadow.until) return;
        DemonPatterns._strike(fight, art, null, 'blood shadow');
        if (DemonPatterns._isActive(fight) && fight.shadow === shadow && Date.now() < shadow.until) shadow.timer = DemonPatterns._later(fight, strike, 2.5);
        else if (fight.shadow === shadow && Date.now() >= shadow.until) { fight.shadow = null; DemonPatterns.update(); }
      };
      shadow.timer = DemonPatterns._later(fight, strike, 2.5);
      Notifications.notify(null, '血影分身出现：优先用远程命中或控制驱散，也可用三次近战命中击破。');
    } else if (art.patternType === 'combo') {
      if (fight.combo) clearTimeout(fight.combo.timer);
      var combo = fight.combo = {remaining: 3};
      var next = function() {
        if (fight.combo !== combo) return;
        if (fight.enemy.data('stunned') || fight.enemy.data('status') === 'meditation') { fight.combo = null; return; }
        combo.remaining--;
        DemonPatterns._strike(fight, art);
        if (combo.remaining > 0 && DemonPatterns._isActive(fight) && fight.combo === combo) combo.timer = DemonPatterns._later(fight, next, 0.75);
        else fight.combo = null;
        DemonPatterns.update();
      };
      next();
    }
    DemonPatterns.update();
    return true;
  },
  modifyDamage: function(damage) {
    var fight = DemonPatterns._fight;
    return DemonPatterns._isActive(fight) && fight.armour && Date.now() < fight.armour.until ? damage * 0.75 : damage;
  },
  modifyHitChance: function(chance) {
    var fight = DemonPatterns._fight;
    return DemonPatterns._isActive(fight) && fight.bind && Date.now() < fight.bind.until ? Math.max(0.05, chance - 0.15) : chance;
  },
  afterHit: function(weaponName, amount) {
    var fight = DemonPatterns._fight;
    if (!(amount > 0) || !DemonPatterns._isActive(fight)) return;
    ['armour', 'bind', 'shadow'].forEach(function(id) {
      var effect = fight[id];
      if (!effect) return;
      var ranged = World.Weapons[weaponName] && World.Weapons[weaponName].type === 'ranged';
      effect.hits -= id === 'shadow' && ranged ? 3 : 1;
      if (effect.hits <= 0) {
        if (id === 'shadow') clearTimeout(effect.timer);
        fight[id] = null;
        Notifications.notify(null, {armour: '骨甲被击碎！', bind: '血丝被斩断，命中率恢复！', shadow: '血影分身被击散！'}[id]);
      }
    });
    DemonPatterns.update();
  },
  afterControl: function() {
    var fight = DemonPatterns._fight;
    if (!DemonPatterns._isActive(fight)) return;
    var hadEffect = !!(fight.armour || fight.bind || fight.shadow || fight.combo);
    if (fight.shadow) clearTimeout(fight.shadow.timer);
    if (fight.combo) clearTimeout(fight.combo.timer);
    fight.armour = fight.bind = fight.shadow = fight.combo = null;
    if (hadEffect) Notifications.notify(null, '控制奏效：骨甲、缚丝、分身与剩余连刃已解除。');
    Events.setHeal();
    DemonPatterns.update();
  },
  afterMedicine: function(item) {
    var fight = DemonPatterns._fight;
    if (DemonPatterns._isActive(fight) && fight.bind && (item === 'medicine' || item === 'wisteria oil')) {
      fight.bind = null;
      Notifications.notify(null, '药物解开缚丝，命中率恢复。');
      Events.setHeal();
      DemonPatterns.update();
    }
  },
  canUseMedicine: function(item) {
    var fight = DemonPatterns._fight;
    return DemonPatterns._isActive(fight) && !!fight.bind && (item === 'medicine' || item === 'wisteria oil');
  },
  stop: function() {
    var fight = DemonPatterns._fight;
    if (!fight) return;
    DemonPatterns._fight = null;
    fight.timers.forEach(clearTimeout);
    fight.armour = fight.bind = fight.shadow = fight.combo = null;
    fight.box.remove();
  }
};
