/** Live blood-art warnings. All timers belong to the current fight, never to a save. */
var CombatTelegraphs = {
  _fight: null,
  // Only castle demons learn from interruptions. Preserve the warning window
  // so faster retries still leave time for a meaningful control/defence choice.
  _retryRatio: 0.8,
  _minRetryRatio: 0.5,
  _scale: function() {
    return Engine.options.testerMode ? Math.max(1, Engine.options.combatTimeScale || 1) : 1;
  },
  _isCurrent: function(fight) {
    var event = Events.activeEvent();
    return !!fight && CombatTelegraphs._fight === fight && !Events.won && !Events.fought
      && !!event && !event.ending && event.scenes[Events.activeScene] === fight.scene;
  },
  _isActive: function(fight) {
    return CombatTelegraphs._isCurrent(fight) && World.health > 0 && fight.enemy.data('hp') > 0;
  },
  start: function(scene, parent) {
    CombatTelegraphs.stop();
    if (!scene.telegraphAttacks || !scene.telegraphAttacks.length) return;
    var panel = Events.eventPanel();
    var box = $('<div>').addClass('combatTelegraphs').attr('aria-label', _('blood art warnings')).appendTo(parent);
    var fight = CombatTelegraphs._fight = {
      scene: scene, enemy: panel.find('#enemy'), player: panel.find('#wanderer'), box: box,
      charges: [], intervals: [], arts: [],
      adaptive: typeof Space !== 'undefined' && Engine.activeModule === Space
    };
    // Live warnings stay at the top of the reserved scrolling area, ahead of
    // the rhythm guide, so a boss's three techniques cannot hide a new cast.
    fight.chargeBox = $('<div>').addClass('combatTelegraphCharges').appendTo(box);
    $('<div>').addClass('combatTelegraphHint').text(_('watch for blood arts here. a successful control hit during a warning interrupts the cast.')).appendTo(box);
    if (fight.adaptive) $('<div>').addClass('combatTelegraphAdaptation').text(_('castle demons retry faster after an interruption. warning time stays unchanged; a completed cast resets the interval.')).appendTo(box);
    scene.telegraphAttacks.forEach(function(attack, index) {
      if (fight.adaptive) {
        var baseInterval = Math.max(0.1, attack.interval || 12);
        var art = {
          attack: attack, number: index + 1, baseInterval: baseInterval,
          interval: baseInterval, interruptions: 0, lastStartAt: null,
          row: $('<div>').addClass('combatTelegraphRhythm').appendTo(box)
        };
        fight.arts.push(art);
        CombatTelegraphs._schedule(art, fight, baseInterval);
      } else {
        fight.intervals.push(Engine.combatSetInterval(function() {
          CombatTelegraphs.queue(attack, fight);
        }, (attack.interval || 12) * 1000));
      }
    });
    fight.intervals.push(Engine.combatSetInterval(function() {
      if (!CombatTelegraphs._isActive(fight)) {
        // Ordinary attacks settle second wind at animation completion. A brief
        // zero-HP frame must not permanently disable this fight's blood arts.
        if (!CombatTelegraphs._isCurrent(fight) && CombatTelegraphs._fight === fight) CombatTelegraphs.stop();
        return;
      }
      fight.charges.forEach(function(charge) { CombatTelegraphs._update(charge); });
      fight.arts.forEach(function(art) { CombatTelegraphs._updateRhythm(art, fight); });
    }, 100));
  },
  _schedule: function(art, fight, seconds) {
    clearTimeout(art.timer);
    art.nextAt = Date.now() + seconds * 1000 / CombatTelegraphs._scale();
    art.timer = Engine.combatSetTimeout(function() {
      art.timer = null;
      if (!CombatTelegraphs._isCurrent(fight)) {
        if (CombatTelegraphs._fight === fight) CombatTelegraphs.stop();
        return;
      }
      // Stun, meditation and second wind may delay a retry, but cannot erase it
      // or accumulate extra casts. A single timer belongs to each technique.
      if (!CombatTelegraphs.queue(art.attack, fight)) CombatTelegraphs._schedule(art, fight, 0.25);
    }, seconds * 1000);
    CombatTelegraphs._updateRhythm(art, fight);
  },
  _retime: function(art, fight) {
    var elapsed = art.lastStartAt == null ? 0 : (Date.now() - art.lastStartAt) * CombatTelegraphs._scale() / 1000;
    CombatTelegraphs._schedule(art, fight, Math.max(0.25, art.interval - elapsed));
  },
  _updateRhythm: function(art, fight) {
    if (fight.charges.some(function(charge) { return charge.art === art; })) {
      art.row.text(_('blood art {0}: charging · interval {1}s', art.number, art.interval.toFixed(1)));
    } else if (fight.enemy.data('stunned') || fight.enemy.data('status') === 'meditation') {
      art.row.text(_('blood art {0}: controlled · interval {1}s', art.number, art.interval.toFixed(1)));
    } else {
      var left = Math.max(0, (art.nextAt - Date.now()) * CombatTelegraphs._scale() / 1000);
      art.row.text(_('blood art {0}: charge starts in {1}s · interval {2}s', art.number, left.toFixed(1), art.interval.toFixed(1)));
    }
    if (art.interruptions) art.row.addClass('accelerated');
    else art.row.removeClass('accelerated');
  },
  _interrupted: function(charge, fight) {
    Notifications.notify(null, charge.attack.interruptedText || _('blood art interrupted.'));
    var art = charge.art;
    if (!art) return;
    art.interruptions++;
    var warning = Math.max(0.1, art.attack.telegraphSec == null ? 1.5 : art.attack.telegraphSec);
    var minInterval = Math.min(art.baseInterval, Math.max(art.baseInterval * CombatTelegraphs._minRetryRatio, warning + 0.5));
    art.interval = Math.max(minInterval, art.baseInterval * Math.pow(CombatTelegraphs._retryRatio, art.interruptions));
    CombatTelegraphs._retime(art, fight);
    Notifications.notify(null, _('blood art {0} adapts: next interval {1}s (normally {2}s). warning time is unchanged.', art.number, art.interval.toFixed(1), art.baseInterval.toFixed(1)));
  },
  _completed: function(charge, fight) {
    var art = charge.art;
    if (!art) return;
    var wasAccelerated = art.interruptions > 0;
    art.interruptions = 0;
    art.interval = art.baseInterval;
    CombatTelegraphs._retime(art, fight);
    if (wasAccelerated) Notifications.notify(null, _('blood art {0} is released; its interval returns to {1}s.', art.number, art.baseInterval.toFixed(1)));
  },
  queue: function(attack, fight) {
    fight = fight || CombatTelegraphs._fight;
    if (!CombatTelegraphs._isActive(fight) || fight.enemy.data('stunned') || fight.enemy.data('status') === 'meditation') return false;
    var art = fight.arts.filter(function(item) { return item.attack === attack; })[0];
    if (art && fight.charges.some(function(charge) { return charge.art === art; })) return false;
    var duration = Math.max(0.1, attack.telegraphSec == null ? 1.5 : attack.telegraphSec);
    var row = $('<div>').addClass('combatTelegraph').appendTo(fight.chargeBox);
    var title = attack.telegraph || _('blood art incoming');
    if (art) title = _('blood art {0}', art.number) + ' · ' + title;
    $('<div>').addClass('combatTelegraphTitle').attr('role', 'alert').text(title).appendTo(row);
    var details = _('base damage: {0}', attack.dmg || 0);
    if (attack.bleedSec && attack.bleedPerSec) details += ' · ' + _('on hit: bleed {0}/s for {1}s', attack.bleedPerSec, attack.bleedSec);
    if (attack.shieldBreaker) details += ' · ' + _('a shield can block this blow, but will break.');
    $('<div>').addClass('combatTelegraphDetails').text(details).appendTo(row);
    var charge = {
      attack: attack, art: art, row: row, endAt: Date.now() + duration * 1000 / CombatTelegraphs._scale(), duration: duration,
      countdown: $('<div>').addClass('combatTelegraphCountdown').appendTo(row),
      progress: $('<progress>').attr({max: 100, value: 0, 'aria-label': _('blood art charge')}).appendTo(row)
    };
    fight.charges.push(charge);
    if (art) {
      art.lastStartAt = Date.now();
      CombatTelegraphs._schedule(art, fight, art.interval);
    }
    fight.enemy.addClass('charging');
    CombatTelegraphs._update(charge);
    if (attack.telegraph) Notifications.notify(null, attack.telegraph);
    charge.timer = Engine.combatSetTimeout(function() {
      CombatTelegraphs._resolve(charge, fight);
    }, duration * 1000);
    return true;
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
      CombatTelegraphs._interrupted(charge, fight);
    });
  },
  _resolve: function(charge, fight) {
    if (fight.charges.indexOf(charge) < 0) return;
    if (!CombatTelegraphs._isActive(fight)) {
      // If second wind is being settled by another animation, discard this
      // expired charge without leaving it stuck in the next-cycle queue.
      CombatTelegraphs._remove(charge, fight);
      return;
    }
    CombatTelegraphs._remove(charge, fight);
    var attack = charge.attack;
    if (fight.enemy.data('stunned') || fight.enemy.data('status') === 'meditation') {
      CombatTelegraphs._interrupted(charge, fight);
      return;
    }
    // A released technique counts even when it misses or a shield absorbs it;
    // the player defended against a real cast, rather than interrupting it.
    CombatTelegraphs._completed(charge, fight);
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
    attackFn(fight.enemy, attack.dmg, null, {
      source: 'blood art',
      isValid: function() { return CombatTelegraphs._isActive(fight); },
      onDamage: function() {
        // Resolve fatal hits before the UI timer can clean up this fight.
        if (!Events.checkPlayerDeath()) CombatTelegraphs._bleed(attack, fight);
      }
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
    fight.arts.forEach(function(art) { clearTimeout(art.timer); });
    fight.charges.forEach(function(charge) { clearTimeout(charge.timer); });
    fight.enemy.removeClass('charging');
    fight.box.remove();
  }
};
