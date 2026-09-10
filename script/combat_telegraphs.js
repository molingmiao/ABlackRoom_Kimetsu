/** Live blood-art warnings. All timers belong to the current fight, never to a save. */
var CombatTelegraphs = {
  _fight: null,
  _scale: function() {
    return Engine.options.testerMode ? Math.max(1, Engine.options.combatTimeScale || 1) : 1;
  },
  _isActive: function(fight) {
    var event = Events.activeEvent();
    return !!fight && CombatTelegraphs._fight === fight && !Events.won && !Events.fought
      && World.health > 0 && !!event && event.scenes[Events.activeScene] === fight.scene
      && fight.enemy.data('hp') > 0;
  },
  start: function(scene, parent) {
    CombatTelegraphs.stop();
    if (!scene.telegraphAttacks || !scene.telegraphAttacks.length) return;
    var panel = Events.eventPanel();
    var box = $('<div>').addClass('combatTelegraphs').attr('aria-label', _('blood art warnings')).appendTo(parent);
    var fight = CombatTelegraphs._fight = {
      scene: scene, enemy: panel.find('#enemy'), player: panel.find('#wanderer'), box: box,
      charges: [], intervals: []
    };
    $('<div>').addClass('combatTelegraphHint').text(_('watch for blood arts here. a successful control hit during a warning interrupts the cast.')).appendTo(box);
    scene.telegraphAttacks.forEach(function(attack) {
      fight.intervals.push(Engine.combatSetInterval(function() {
        CombatTelegraphs.queue(attack, fight);
      }, (attack.interval || 12) * 1000));
    });
    fight.intervals.push(Engine.combatSetInterval(function() {
      if (!CombatTelegraphs._isActive(fight)) {
        if (CombatTelegraphs._fight === fight) CombatTelegraphs.stop();
        return;
      }
      fight.charges.forEach(function(charge) { CombatTelegraphs._update(charge); });
    }, 100));
  },
  queue: function(attack, fight) {
    fight = fight || CombatTelegraphs._fight;
    if (!CombatTelegraphs._isActive(fight) || fight.enemy.data('stunned') || fight.enemy.data('status') === 'meditation') return;
    var duration = Math.max(0.1, attack.telegraphSec == null ? 1.5 : attack.telegraphSec);
    var row = $('<div>').addClass('combatTelegraph').appendTo(fight.box);
    $('<div>').addClass('combatTelegraphTitle').attr('role', 'alert').text(attack.telegraph || _('blood art incoming')).appendTo(row);
    var details = _('base damage: {0}', attack.dmg || 0);
    if (attack.bleedSec && attack.bleedPerSec) details += ' · ' + _('on hit: bleed {0}/s for {1}s', attack.bleedPerSec, attack.bleedSec);
    if (attack.shieldBreaker) details += ' · ' + _('a shield can block this blow, but will break.');
    $('<div>').addClass('combatTelegraphDetails').text(details).appendTo(row);
    var charge = {
      attack: attack, row: row, endAt: Date.now() + duration * 1000 / CombatTelegraphs._scale(), duration: duration,
      countdown: $('<div>').addClass('combatTelegraphCountdown').appendTo(row),
      progress: $('<progress>').attr({max: 100, value: 0, 'aria-label': _('blood art charge')}).appendTo(row)
    };
    fight.charges.push(charge);
    fight.enemy.addClass('charging');
    CombatTelegraphs._update(charge);
    if (attack.telegraph) Notifications.notify(null, attack.telegraph);
    charge.timer = Engine.combatSetTimeout(function() {
      CombatTelegraphs._resolve(charge, fight);
    }, duration * 1000);
  },
  _update: function(charge) {
    var left = Math.max(0, (charge.endAt - Date.now()) * CombatTelegraphs._scale() / 1000);
    charge.countdown.text(_('strike in {0}s — control now or prepare to defend.', left.toFixed(1)));
    charge.progress.attr('value', Math.max(0, Math.min(100, (1 - left / charge.duration) * 100)));
  },
  _remove: function(charge, fight) {
    clearTimeout(charge.timer);
    fight.charges = fight.charges.filter(function(item) { return item !== charge; });
    charge.row.remove();
    if (!fight.charges.length) fight.enemy.removeClass('charging');
  },
  interrupt: function(enemy) {
    var fight = CombatTelegraphs._fight;
    if (!CombatTelegraphs._isActive(fight) || enemy.get(0) !== fight.enemy.get(0)) return;
    fight.charges.slice().forEach(function(charge) {
      CombatTelegraphs._remove(charge, fight);
      Notifications.notify(null, charge.attack.interruptedText || _('blood art interrupted.'));
    });
  },
  _resolve: function(charge, fight) {
    if (!CombatTelegraphs._isActive(fight) || fight.charges.indexOf(charge) < 0) return;
    CombatTelegraphs._remove(charge, fight);
    var attack = charge.attack;
    if (fight.enemy.data('stunned') || fight.enemy.data('status') === 'meditation') {
      Notifications.notify(null, attack.interruptedText || _('blood art interrupted.'));
      return;
    }
    if (Math.random() > (typeof attack.hit === 'number' ? attack.hit : 1) || !(attack.dmg > 0)) {
      if (attack.missText) Notifications.notify(null, attack.missText);
      return;
    }
    if (attack.shieldBreaker && fight.player.data('status') === 'shield') {
      fight.player.data('status', 'none');
      Events.updateFighterDiv(fight.player);
      Notifications.notify(null, _('the shield shatters against the blow.'));
      return;
    }
    var attackFn = attack.ranged ? Events.animateRanged : Events.animateMelee;
    attackFn(fight.enemy, attack.dmg, function() {
      if (CombatTelegraphs._isActive(fight)) Events.checkPlayerDeath();
      else if (CombatTelegraphs._fight === fight && World.health <= 0) Events.checkPlayerDeath();
    }, {
      source: 'blood art',
      isValid: function() { return CombatTelegraphs._isActive(fight); },
      onDamage: function() { CombatTelegraphs._bleed(attack, fight); }
    });
  },
  _bleed: function(attack, fight) {
    // A miss, shield absorption or meditation never applies bleeding.
    if (!CombatTelegraphs._isActive(fight) || !attack.bleedSec || !attack.bleedPerSec) return;
    Notifications.notify(null, _('you are bleeding — {0} damage per second for {1} seconds', attack.bleedPerSec, attack.bleedSec));
    var ticks = attack.bleedSec;
    var timer = Engine.combatSetInterval(function() {
      if (!CombatTelegraphs._isActive(fight) || ticks-- <= 0) { clearInterval(timer); return; }
      Events.dotDamage(fight.player, attack.bleedPerSec, 'bleeding');
      if (ticks <= 0) clearInterval(timer);
    }, 1000);
    fight.intervals.push(timer);
  },
  stop: function() {
    var fight = CombatTelegraphs._fight;
    if (!fight) return;
    CombatTelegraphs._fight = null;
    fight.intervals.forEach(clearInterval);
    fight.charges.forEach(function(charge) { clearTimeout(charge.timer); });
    fight.enemy.removeClass('charging');
    fight.box.remove();
  }
};
