/** Ordinary world journeys: active bookkeeping lives in memory, never in a save. */
var ExpeditionReport = {
  _run: null,
  _LIMIT: 80,
  _number: function(value) {
    return typeof value === 'number' && isFinite(value) ? Math.min(1000000000, Math.max(0, value)) : 0;
  },
  _copy: function(value) { return JSON.parse(JSON.stringify(value)); },
  _inventory: function(value) {
    var result = {};
    Object.keys(value || {}).slice(0, ExpeditionReport._LIMIT).forEach(function(key) {
      if (!key || key.length > 80 || key === '__proto__' || key === 'constructor' || key === 'prototype') return;
      var amount = ExpeditionReport._number(value[key]);
      if (amount > 0) result[key] = amount;
    });
    return result;
  },
  _grid: function(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 128).map(function(row) {
      return Array.isArray(row) ? row.slice(0, 128).map(function(cell) {
        return typeof cell === 'string' ? cell.slice(0, 8) : cell === true;
      }) : [];
    });
  },
  _names: function(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(function(name, i) {
      return typeof name === 'string' && name.length > 0 && name.length <= 80 && value.indexOf(name) === i;
    }).slice(0, 12);
  },
  begin: function(options) {
    options = options || {};
    var equipped = [];
    Object.keys(options.equipped || {}).slice(0, 3).forEach(function(category) {
      if (Array.isArray(options.equipped[category])) equipped = equipped.concat(options.equipped[category].slice(0, 2));
    });
    ExpeditionReport._run = {
      startedAt: Date.now(), steps: 0, farthestDistance: 0,
      outfit: ExpeditionReport._inventory(options.outfit),
      map: ExpeditionReport._grid(options.map), mask: ExpeditionReport._grid(options.mask),
      equipped: ExpeditionReport._names(equipped)
    };
  },
  recordMove: function(distance) {
    var run = ExpeditionReport._run;
    if (!run) return;
    run.steps = Math.min(1000000000, run.steps + 1);
    run.farthestDistance = Math.max(run.farthestDistance, ExpeditionReport._number(distance));
  },
  _countNew: function(before, after, predicate) {
    var count = 0;
    after.forEach(function(row, x) {
      row.forEach(function(cell, y) {
        if (predicate(cell) && !predicate((before[x] || [])[y])) count++;
      });
    });
    return count;
  },
  _diagnostics: function(run, remaining) {
    var definitions = typeof World !== 'undefined' ? World.Weapons || {} : {};
    var carried = run.equipped.slice();
    // Match combat's fallback for old/custom uncategorized weapons.
    Object.keys(run.outfit).forEach(function(key) {
      if (definitions[key] && typeof Path !== 'undefined' && Path.getWeaponCategory && !Path.getWeaponCategory(key)) carried.push(key);
    });
    var usable = 0, missingAmmo = [];
    carried.forEach(function(key) {
      var weapon = definitions[key];
      if (!weapon || typeof weapon.damage !== 'number' || weapon.damage <= 0 || !run.outfit[key]) return;
      var missing = Object.keys(weapon.cost || {}).filter(function(item) {
        return (remaining[item] || 0) < weapon.cost[item];
      });
      if (missing.length) missingAmmo = missingAmmo.concat(missing);
      else if (remaining[key] > 0) usable++;
    });
    return {
      unarmed: usable === 0,
      missingAmmo: ExpeditionReport._names(missingAmmo),
      healingRemaining: (remaining['cured meat'] || 0) + (remaining.medicine || 0) + (remaining['wisteria oil'] || 0)
    };
  },
  finish: function(outcome, options) {
    var run = ExpeditionReport._run;
    if (!run) return ExpeditionReport.latest();
    if (outcome !== 'return' && outcome !== 'death') return null;
    options = options || {};
    var remaining = ExpeditionReport._inventory(options.outfit), gained = {}, reduced = {};
    var keys = Object.keys(run.outfit);
    Object.keys(remaining).forEach(function(key) { if (keys.indexOf(key) < 0) keys.push(key); });
    keys.slice(0, ExpeditionReport._LIMIT).forEach(function(key) {
      var difference = (remaining[key] || 0) - (run.outfit[key] || 0);
      if (difference > 0) gained[key] = difference;
      else if (difference < 0) reduced[key] = -difference;
    });
    var report = {
      version: 1, outcome: outcome, endedAt: Date.now(),
      durationSeconds: Math.min(1000000000, Math.max(0, Math.floor((Date.now() - run.startedAt) / 1000))),
      steps: run.steps, farthestDistance: run.farthestDistance,
      newTiles: ExpeditionReport._countNew(run.mask, ExpeditionReport._grid(options.mask), function(cell) { return cell === true; }),
      newLocations: ExpeditionReport._countNew(run.map, ExpeditionReport._grid(options.map), function(cell) { return typeof cell === 'string' && cell.indexOf('!') >= 0; }),
      mapSaved: outcome === 'return', unlocks: ExpeditionReport._names(options.unlocks),
      gained: gained, reduced: reduced, returned: remaining,
      reason: ['food', 'water', 'combat'].indexOf(options.reason) >= 0 ? options.reason : null,
      diagnostics: ExpeditionReport._diagnostics(run, remaining)
    };
    // Neither position, map nor equipment assignments are written to persistent state.
    ExpeditionReport._run = null;
    $SM.set('game.lastExpeditionReport', report, true);
    return ExpeditionReport._copy(report);
  },
  latest: function() {
    var report = $SM.get('game.lastExpeditionReport');
    return report && report.version === 1 && (report.outcome === 'return' || report.outcome === 'death') ? ExpeditionReport._copy(report) : null;
  },
  _format: function(values) {
    var names = Object.keys(ExpeditionReport._inventory(values));
    return names.length ? names.map(function(item) { return _(item) + ' ×' + values[item]; }).join('、') : '无';
  },
  suggestions: function(report) {
    var advice = [];
    var diagnostic = report.diagnostics || {};
    if (report.outcome === 'death') {
      if (report.reason === 'food') advice.push('口粮耗尽后继续前进会导致饥饿。熏肉同时用于赶路与治疗；下次留出返程和战斗的余量。');
      else if (report.reason === 'water') advice.push('本次因缺水倒下。扩大携水容量、利用已发现的补水点，并在水耗尽前安排返程。');
      else if (report.reason === 'combat' && diagnostic.missingAmmo && diagnostic.missingAmmo.length) advice.push('结算时部分武器缺少 ' + diagnostic.missingAmmo.map(function(item) { return _(item); }).join('、') + '。下次补齐弹药，并考虑带上不耗弹药的近战武器。');
      else if (report.reason === 'combat' && diagnostic.unarmed) advice.push('结算时没有可用的伤害武器。下次检查装备槽，并将选中的武器实际装进背包。');
      else if (report.reason === 'combat' && diagnostic.healingRemaining > 0) advice.push('结算时仍有治疗物资。下次在生命过低前使用治疗，并留意敌人的攻击间隔。');
      else if (report.reason === 'combat') advice.push('本次败于战斗。下次补齐治疗物资，检查护甲与武器，再尝试推进。');
      else advice.push('这次探索未保存地图变化。整理补给和装备后再尝试，不必一次走到最远。');
    } else advice.push('已保存本次地图进展。下次可从已探索区域继续推进；出发前补齐配置，已走过的路线仍可能遭遇战斗。');
    return advice;
  },
  lines: function(report) {
    var lines = [
      report.outcome === 'death' ? '本次倒下：地图变化未保存，剩余背包已归还仓库。' : '已返回庄园：地图进展已保存，剩余背包已归还仓库。',
      '行程：' + report.steps + ' 步；最远距离 ' + report.farthestDistance + '。',
      '新照亮地图：' + report.newTiles + ' 格；新访问地点：' + report.newLocations + ' 处。' + (report.mapSaved ? '这些地图变化已保存。' : '这些地图变化未保存，下次需要重新探索。'),
      '本次解锁：' + (report.unlocks.length ? report.unlocks.map(function(item) { return _(item); }).join('、') : '无'),
      '背包净增加：' + ExpeditionReport._format(report.gained),
      '背包净减少：' + ExpeditionReport._format(report.reduced),
      '结算时归还仓库：' + ExpeditionReport._format(report.returned),
      '以上仅对比出发与结算背包，不含庄园生产。净减少可能包含使用、丢弃等；净增加不是全部拾取量，不能当作总消耗或总掉落。'
    ];
    return lines.concat(ExpeditionReport.suggestions(report));
  },
  show: function() {
    var report = ExpeditionReport.latest();
    if (!report || typeof Events === 'undefined' || Events.activeEvent()) return false;
    if (typeof Engine !== 'undefined' &&
        ((typeof World !== 'undefined' && Engine.activeModule === World) ||
        (typeof Space !== 'undefined' && Engine.activeModule === Space))) return false;
    Events.startEvent({
      title: '远征回顾', scenes: {
        start: {
          text: [],
          buttons: { closeExpeditionReport: { text: '关闭回顾', nextScene: 'end' } }
        }
      }
    }, { width: '520px' });
    ExpeditionReport.render(report, Events.eventPanel().addClass('expeditionReport'));
    return true;
  },
  render: function(report, panel) {
    var desc = panel.find('#description').empty();
    var outcome = $('<section>').addClass('expeditionOutcome').appendTo(desc);
    $('<strong>').text(report.outcome === 'death' ? '本次倒下' : '已返回庄园').appendTo(outcome);
    var status = $('<p>').appendTo(outcome);
    $('<strong>').text(report.mapSaved ? '地图进展已保存' : '地图变化未保存').appendTo(status);
    $('<span>').text(report.mapSaved ? '；剩余背包已归还仓库。' : '，下次需要重新探索；剩余背包已归还仓库。').appendTo(status);
    var section = function(title, className) {
      var card = $('<section>').addClass('expeditionSection ' + className).appendTo(desc);
      $('<h3>').text(title).appendTo(card);
      return card;
    };
    var progress = section('探索进展', 'expeditionProgress');
    var metrics = $('<div>').addClass('expeditionMetrics').appendTo(progress);
    [['行程', report.steps + ' 步'], ['最远距离', report.farthestDistance + ' 格'],
      ['新照亮地图', report.newTiles + ' 格'], ['新访问地点', report.newLocations + ' 处']].forEach(function(metric) {
      var row = $('<div>').appendTo(metrics);
      $('<span>').text(metric[0]).appendTo(row);
      $('<strong>').text(metric[1]).appendTo(row);
    });
    var unlocks = section('本次解锁', 'expeditionUnlocks');
    $('<strong>').text(report.unlocks.length ? report.unlocks.map(function(item) { return _(item); }).join('、') : '无新解锁').appendTo(unlocks);
    var resources = section('物资变化', 'expeditionResources');
    [['背包净增加', report.gained], ['背包净减少', report.reduced], ['归还仓库', report.returned]].forEach(function(resource) {
      var row = $('<div>').addClass('expeditionResourceRow').appendTo(resources);
      $('<span>').text(resource[0]).appendTo(row);
      $('<strong>').text(ExpeditionReport._format(resource[1])).appendTo(row);
    });
    var advice = section('下次准备', 'expeditionAdvice');
    ExpeditionReport.suggestions(report).forEach(function(text) { $('<p>').text(text).appendTo(advice); });
    var rules = $('<details>').addClass('expeditionRules').appendTo(desc);
    $('<summary>').text('物资统计说明（净变化，不是总掉落）').appendTo(rules);
    $('<p>').text('以上仅对比出发与结算背包，不含庄园生产。净减少可能包含使用、丢弃等；净增加不是全部拾取量，不能当作总消耗或总掉落。').appendTo(rules);
  }
};
