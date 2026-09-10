/** Completed descent summaries. Active descent statistics are never saved. */
var CastleReport = {
  _run: null,
  _dialog: null,
  _number: function(value) {
    return typeof value === 'number' && isFinite(value) ? Math.max(0, value) : 0;
  },
  _copy: function(value) { return JSON.parse(JSON.stringify(value)); },
  _meta: function() {
    var meta = $SM.get('game.castleMeta') || {};
    return {
      totalFloors: CastleReport._number(meta.totalFloors),
      totalHealed: CastleReport._number(meta.totalHealed),
      peakTalent: CastleReport._copy(meta.peakTalent || {}),
      hp: Space.getPermanentHpBonus ? Space.getPermanentHpBonus() : 0,
      damage: Space.getPermanentDmgMult ? Space.getPermanentDmgMult() : 0,
      reduction: Space.getPermanentDR ? Space.getPermanentDR() : 0,
      healing: Space.getHealMult ? Space.getHealMult() : 1
    };
  },
  _style: function() {
    return typeof CombatStyles !== 'undefined' ? CombatStyles.getSelected() : 'none';
  },
  _touch: function() {
    var run = CastleReport._run;
    if (!run) return null;
    run.highestFloor = Math.max(run.highestFloor, Math.min(Space.MAX_FLOOR || 100, CastleReport._number(Space.currentFloor)));
    var style = CastleReport._style();
    if (run.styles.indexOf(style) === -1) run.styles.push(style);
    return run;
  },
  begin: function() {
    CastleReport.close();
    CastleReport._run = {
      startedAt: Date.now(), highestFloor: 1, fights: 0, kills: 0,
      damageTaken: 0, healingReceived: 0, damageSources: Object.create(null),
      consumed: Object.create(null), styles: [], before: CastleReport._meta(), fight: null
    };
    CastleReport._touch();
  },
  startFight: function(scene) {
    var run = CastleReport._touch();
    if (!run || (run.fight && run.fight.scene === scene)) return;
    run.fights++;
    run.fight = { scene: scene, killed: false };
  },
  recordDamage: function(amount, source) {
    var run = CastleReport._touch();
    amount = CastleReport._number(amount);
    if (!run || !amount) return;
    source = typeof source === 'string' && source ? source : 'other damage';
    run.damageTaken += amount;
    run.damageSources[source] = (run.damageSources[source] || 0) + amount;
  },
  recordHealing: function(amount) {
    var run = CastleReport._touch();
    if (run) run.healingReceived += CastleReport._number(amount);
  },
  recordConsumption: function(item, amount) {
    var run = CastleReport._touch();
    amount = CastleReport._number(amount);
    if (!run || !amount || typeof item !== 'string' || !item) return;
    run.consumed[item] = (run.consumed[item] || 0) + amount;
  },
  recordKill: function() {
    var run = CastleReport._touch();
    if (!run || !run.fight || run.fight.killed) return;
    run.fight.killed = true;
    run.kills++;
  },
  _inherited: function(id, peak) {
    if (Space.getStartingTalentLevel) return Space.getStartingTalentLevel(id, peak);
    var grant = peak >= 20 ? 8 : peak >= 15 ? 5 : peak >= 10 ? 3 : peak >= 6 ? 2 : peak >= 3 ? 1 : 0;
    var talent = (Space.TALENTS || []).filter(function(t) { return t.id === id; })[0];
    return talent ? Math.min(talent.maxLevel, grant) : grant;
  },
  finish: function(outcome) {
    var run = CastleReport._touch();
    if (!run) return CastleReport.getLastReport();
    var after = CastleReport._meta();
    var talents = (Space.TALENTS || []).map(function(t) {
      var oldPeak = CastleReport._number(run.before.peakTalent[t.id]);
      var newPeak = CastleReport._number(after.peakTalent[t.id]);
      return {
        id: t.id, nameKey: t.nameKey, peakBefore: oldPeak, peakAfter: newPeak,
        inheritedBefore: CastleReport._inherited(t.id, oldPeak),
        inheritedAfter: CastleReport._inherited(t.id, newPeak)
      };
    }).filter(function(t) { return t.peakAfter > t.peakBefore; });
    var report = {
      version: 1, outcome: outcome || 'death', endedAt: Date.now(),
      durationSeconds: Math.max(0, Math.floor((Date.now() - run.startedAt) / 1000)),
      highestFloor: run.highestFloor, fights: run.fights, kills: run.kills, styles: run.styles.slice(),
      damageTaken: run.damageTaken, healingReceived: run.healingReceived,
      damageSources: Object.keys(run.damageSources).map(function(source) {
        return { source: source, amount: run.damageSources[source] };
      }).sort(function(a, b) { return b.amount - a.amount; }),
      consumed: CastleReport._copy(run.consumed),
      healingRemaining: ['cured meat', 'medicine', 'wisteria oil'].reduce(function(sum, item) {
        return sum + CastleReport._number((Path.outfit || {})[item]);
      }, 0),
      growth: {
        floors: after.totalFloors - run.before.totalFloors,
        healed: after.totalHealed - run.before.totalHealed,
        totalFloors: after.totalFloors, totalHealed: after.totalHealed, talents: talents,
        hp: after.hp - run.before.hp,
        damage: Math.round((after.damage - run.before.damage) * 100),
        reduction: Math.round((after.reduction - run.before.reduction) * 100),
        healing: Math.round((after.healing - run.before.healing) * 100)
      }
    };
    // Only this completed summary is persistent: no scene, backpack or resumable floor state.
    CastleReport._run = null;
    $SM.set('game.castleLastReport', report, true);
    return CastleReport._copy(report);
  },
  getLastReport: function() {
    var report = $SM.get('game.castleLastReport');
    return report && report.version === 1 ? CastleReport._copy(report) : null;
  },
  suggestions: function(report) {
    var advice = [];
    var telegraph = report.damageSources.reduce(function(sum, item) {
      return sum + (item.source === 'blood art' || item.source === 'bleeding' ? item.amount : 0);
    }, 0);
    if (telegraph > 0 && telegraph >= report.damageTaken * 0.35) {
      advice.push(_('blood arts caused much of your damage. keep a control tool ready to interrupt the next warning.'));
    } else if (report.outcome === 'death' && report.healingRemaining > 0) {
      advice.push(_('you still carried {0} healing items. heal before the next heavy attack, and use the numbered shortcuts.', report.healingRemaining));
    } else if (report.damageTaken > report.healingReceived && report.healingRemaining === 0) {
      advice.push(_('your healing supplies ran out. add medicine to your saved loadout and refill before the next descent.'));
    }
    var thresholds = [
      { at: 20, reward: '+8 max hp' }, { at: 50, reward: '+5% weapon damage' },
      { at: 100, reward: '+5% damage reduction' }, { at: 200, reward: '+8 max hp' },
      { at: 500, reward: '+5% weapon damage and damage reduction' }
    ];
    var next = thresholds.filter(function(t) { return t.at > report.growth.totalFloors; })[0];
    if (next) advice.push(_('clear {0} more floors across descents to gain {1} permanently.', next.at - report.growth.totalFloors, _(next.reward)));
    else if (advice.length === 0) advice.push(_('your floor legacies are complete. raise a talent to its next inheritance threshold to strengthen future descents.'));
    return advice.slice(0, 2);
  },
  _styleName: function(id) {
    if (typeof CombatStyles !== 'undefined' && CombatStyles.definition(id)) return CombatStyles.getName(id);
    var names = { water: 'water style', thunder: 'thunder style', flame: 'flame style', control: 'control style', none: 'no style selected' };
    return _(names[id] || id);
  },
  show: function() {
    var report = CastleReport.getLastReport();
    if (!report || typeof document === 'undefined' || !document.body) return false;
    CastleReport.close();
    if (Engine._resetHotkeys) Engine._resetHotkeys();
    var previousFocus = document.activeElement;
    var previousKeyLock = Engine.keyLock;
    Engine.keyLock = true;
    var overlay = document.createElement('div');
    overlay.id = 'castleReportOverlay';
    overlay.className = Engine.isLightsOff() ? 'castle-report-overlay castle-report-dark' : 'castle-report-overlay';
    var panel = document.createElement('section');
    panel.className = 'castle-report-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'castleReportTitle');
    overlay.appendChild(panel);
    function add(tag, text, parent, className) {
      var el = document.createElement(tag);
      el.textContent = text;
      if (className) el.className = className;
      (parent || panel).appendChild(el);
      return el;
    }
    add('h2', _('descent report')).id = 'castleReportTitle';
    var outcomeKeys = { death: 'fallen in battle', retreat: 'returned from the castle', victory: 'dawn has come', loss: 'the descent ended', 'lost': 'the descent ended' };
    add('p', _(outcomeKeys[report.outcome] || 'the descent ended'), panel, 'castle-report-outcome');
    var stats = add('dl', '', panel, 'castle-report-stats');
    function stat(label, value) { add('dt', _(label), stats); add('dd', value, stats); }
    stat('highest floor', report.highestFloor);
    stat('time in the castle', _('{0}m {1}s', Math.floor(report.durationSeconds / 60), report.durationSeconds % 60));
    stat('demons defeated', _('{0} / {1} fights', report.kills, report.fights));
    stat('styles used', report.styles.map(CastleReport._styleName).join(' / '));
    stat('damage taken / health restored', report.damageTaken + ' / ' + report.healingReceived);
    add('h3', _('main sources of damage'));
    var sources = add('ul', '');
    if (!report.damageSources.length) add('li', _('no damage recorded'), sources);
    report.damageSources.slice(0, 3).forEach(function(source) {
      add('li', _('{0}: {1} hp ({2}%)', _(source.source), source.amount, Math.round(source.amount / Math.max(1, report.damageTaken) * 100)), sources);
    });
    add('h3', _('supplies consumed'));
    var consumables = Object.keys(report.consumed).map(function(item) { return _(item) + ' ×' + report.consumed[item]; });
    add('p', consumables.length ? consumables.join(' / ') : _('no supplies consumed'));
    add('h3', _('permanent progress from this descent'));
    var growth = add('ul', '');
    add('li', _('floors cleared: +{0} (total {1})', report.growth.floors, report.growth.totalFloors), growth);
    add('li', _('healing accumulated: +{0} (total {1})', report.growth.healed, report.growth.totalHealed), growth);
    var bonuses = [];
    if (report.growth.hp > 0) bonuses.push(_('max hp +{0}', report.growth.hp));
    if (report.growth.damage > 0) bonuses.push(_('weapon damage +{0}%', report.growth.damage));
    if (report.growth.reduction > 0) bonuses.push(_('damage reduction +{0}%', report.growth.reduction));
    if (report.growth.healing > 0) bonuses.push(_('healing bonus +{0}%', report.growth.healing));
    if (bonuses.length) add('li', _('new permanent bonuses: {0}', bonuses.join(' / ')), growth);
    report.growth.talents.forEach(function(t) {
      add('li', _('{0}: best Lv.{1} → {2}; next descent starts Lv.{3} → {4}', _(t.nameKey), t.peakBefore, t.peakAfter, t.inheritedBefore, t.inheritedAfter), growth);
    });
    if (!report.growth.talents.length) add('li', _('no new talent inheritance this descent'), growth);
    add('h3', _('before the next descent'));
    CastleReport.suggestions(report).forEach(function(line) { add('p', line); });
    var actions = add('div', '', panel, 'castle-report-actions');
    var exportButton = add('button', _('save battle report'), actions);
    exportButton.type = 'button';
    exportButton.addEventListener('click', function() { CastleReport.download(report); });
    var closeButton = add('button', _('close report'), actions);
    closeButton.type = 'button';
    closeButton.addEventListener('click', CastleReport.close);
    function blockKeys(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        CastleReport.close();
        return;
      }
      if (event.type === 'keydown' && event.key === 'Tab') {
        event.preventDefault();
        (document.activeElement === closeButton ? exportButton : closeButton).focus();
      }
      event.stopImmediatePropagation();
    }
    document.addEventListener('keydown', blockKeys, true);
    document.addEventListener('keyup', blockKeys, true);
    CastleReport._dialog = { overlay: overlay, blockKeys: blockKeys, previousFocus: previousFocus, previousKeyLock: previousKeyLock };
    document.body.appendChild(overlay);
    closeButton.focus();
    return true;
  },
  close: function() {
    var dialog = CastleReport._dialog;
    if (!dialog) return;
    document.removeEventListener('keydown', dialog.blockKeys, true);
    document.removeEventListener('keyup', dialog.blockKeys, true);
    if (dialog.overlay.parentNode) dialog.overlay.parentNode.removeChild(dialog.overlay);
    Engine.keyLock = dialog.previousKeyLock;
    if (Engine._resetHotkeys) Engine._resetHotkeys();
    if (dialog.previousFocus && document.documentElement.contains(dialog.previousFocus)) dialog.previousFocus.focus();
    CastleReport._dialog = null;
  },
  download: function(report) {
    var blob = new Blob([JSON.stringify(report || CastleReport.getLastReport(), null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'infinity-castle-report.json';
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }
};
