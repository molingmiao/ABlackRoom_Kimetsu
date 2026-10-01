/** Manual treatment between ordinary-world encounters. No automatic use or saved cooldowns. */
var FieldTreatment = {
  _items: [
    { item: 'cured meat', id: 'worldHeal_meat', key: '1', label: '吃熏肉', cooldown: '_EAT_COOLDOWN' },
    { item: 'medicine', id: 'worldHeal_medicine', key: '2', label: '用药剂', cooldown: '_MEDS_COOLDOWN' },
    { item: 'wisteria oil', id: 'worldHeal_oil', key: '3', label: '用藤花精油', cooldown: '_HYPO_COOLDOWN' }
  ],
  _readyAt: {},
  _timer: null,
  _state: null,
  _outfit: null,
  _busy: false,
  _generation: 0,
  _panel: null,
  _buttons: {},
  _spec: function(item) {
    for (var i = 0; i < FieldTreatment._items.length; i++) {
      if (FieldTreatment._items[i].item === item) return FieldTreatment._items[i];
    }
    return null;
  },
  _finite: function(value) { return typeof value === 'number' && isFinite(value); },
  _inWorld: function() {
    return Engine.activeModule === World && !!World.state && !World.dead;
  },
  // A new data object on every call. Reading a preview never spends supplies, heals, or starts a timer.
  info: function(item) {
    var spec = FieldTreatment._spec(item);
    if (!spec) return null;
    var quantity = Path.outfit && Path.outfit[item];
    var stockValid = quantity === undefined || (FieldTreatment._finite(quantity) && quantity >= 0 && Math.floor(quantity) === quantity);
    var count = stockValid && quantity !== undefined ? quantity : 0;
    var hp = World.health;
    var maxHp = World.getMaxHealth();
    var healthValid = FieldTreatment._finite(hp) && hp > 0 && FieldTreatment._finite(maxHp) && maxHp > 0;
    var missingHp = healthValid ? Math.max(0, maxHp - hp) : 0;
    var base = Events.getBaseHealingAmount(item);
    var amount = Events.getHealingAmount(item);
    var healingValid = FieldTreatment._finite(base) && base > 0 && FieldTreatment._finite(amount) && amount > 0;
    var heal = healingValid ? Math.min(amount, missingHp) : 0;
    var deadline = FieldTreatment._readyAt[item];
    var remaining = FieldTreatment._finite(deadline) ? Math.max(0, deadline - Date.now()) : 0;
    var cooldownSeconds = Math.ceil(remaining / 1000);
    var inWorld = FieldTreatment._inWorld();
    var reason = !inWorld ? 'context' : !healthValid ? 'health' : Events.activeEvent() ? 'event' : Engine.keyLock ? 'locked' :
      FieldTreatment._busy ? 'busy' : !stockValid ? 'inventory' : count < 1 ? 'empty' : !healingValid ? 'healing' :
      missingHp <= 0 ? 'full' : remaining > 0 ? 'cooldown' : null;
    var budget = inWorld && item === 'cured meat' && typeof World.travelInfo === 'function' ? World.travelInfo() : null;
    var foodNeeded = budget && budget.budget && budget.budget.food;
    var foodWarning = count >= 1 && FieldTreatment._finite(foodNeeded) && foodNeeded >= 0 && count - 1 < foodNeeded;
    return {
      item: item, id: spec.id, key: spec.key, label: spec.label,
      count: count, base: healingValid ? base : 0, amount: healingValid ? amount : 0,
      missingHp: missingHp, heal: heal, healingAvailable: reason === null,
      reason: reason, cooldownSeconds: cooldownSeconds,
      foodWarning: foodWarning, foodNeeded: FieldTreatment._finite(foodNeeded) ? foodNeeded : null
    };
  },
  init: function(parent) {
    if (!parent || !parent.length) return;
    var existing = parent.find('#worldFieldTreatment');
    if (existing.length) {
      FieldTreatment._panel = existing;
    } else {
      var panel = $('<div>').attr('id', 'worldFieldTreatment').appendTo(parent);
      $('<div>').addClass('fieldTreatmentTitle').text('途中治疗').appendTo(panel);
      var actions = $('<div>').addClass('fieldTreatmentActions').appendTo(panel);
      FieldTreatment._items.forEach(function(spec) {
        var btn = $('<button>').attr('type', 'button').attr('id', spec.id)
          .addClass('button btnHeal').appendTo(actions);
        $('<span>').addClass('fieldTreatmentLabel').appendTo(btn);
        if (typeof Events._tagHotkey === 'function') Events._tagHotkey(btn, spec.key);
        else {
          btn.attr('data-hotkey', spec.key);
          $('<span>').addClass('hotkeyBadge').text(spec.key).appendTo(btn);
        }
        btn.on('click', function() { FieldTreatment.use(spec.item); });
      });
      $('<p>').addClass('fieldTreatmentStatus').attr('aria-live', 'polite').appendTo(panel);
      $('<p>').addClass('fieldTreatmentReserve').appendTo(panel);
      $('<p>').addClass('fieldTreatmentNote').text('只使用随身背包，不动庄园库存。熏肉兼作口粮；主动治疗不重置移动耗粮计数，也不解除已经进入的饥饿或口渴。水不能当治疗品使用。').appendTo(panel);
      FieldTreatment._panel = panel;
    }
    FieldTreatment._items.forEach(function(spec) {
      FieldTreatment._buttons[spec.item] = FieldTreatment._panel.find('#' + spec.id);
    });
    FieldTreatment.update();
  },
  _clearTimer: function() {
    if (FieldTreatment._timer !== null) clearTimeout(FieldTreatment._timer);
    FieldTreatment._timer = null;
  },
  _schedule: function() {
    FieldTreatment._clearTimer();
    if (!FieldTreatment._inWorld()) return;
    var pending = FieldTreatment._items.some(function(spec) {
      return (FieldTreatment._readyAt[spec.item] || 0) > Date.now();
    });
    if (!pending) return;
    var state = World.state, outfit = Path.outfit, generation = FieldTreatment._generation;
    var timer = setTimeout(function() {
      if (FieldTreatment._timer !== timer) return;
      FieldTreatment._timer = null;
      // A departed or replaced journey must not be reactivated by an old timer.
      if (FieldTreatment._generation !== generation || !FieldTreatment._inWorld() || World.state !== state || Path.outfit !== outfit) return;
      FieldTreatment.update();
    }, 250);
    FieldTreatment._timer = timer;
  },
  update: function() {
    var panel = FieldTreatment._panel;
    if (!FieldTreatment._inWorld()) {
      FieldTreatment._clearTimer();
      FieldTreatment._state = null;
      FieldTreatment._outfit = null;
      if (panel && panel.length) panel.hide();
      return;
    }
    FieldTreatment._state = World.state;
    FieldTreatment._outfit = Path.outfit;
    if (panel && panel.length) {
      panel.show();
      FieldTreatment._items.forEach(function(spec) {
        var info = FieldTreatment.info(spec.item), btn = FieldTreatment._buttons[spec.item];
        if (!btn || !btn.length) return;
        var text = spec.label + '（携带 ' + info.count + '，回复 ' + info.heal + '）';
        if (info.cooldownSeconds > 0) text += ' · ' + info.cooldownSeconds + ' 秒';
        btn.find('.fieldTreatmentLabel').text(text);
        btn.prop('disabled', !info.healingAvailable).attr('aria-disabled', String(!info.healingAvailable))
          .toggleClass('disabled', !info.healingAvailable).data('onCooldown', info.cooldownSeconds > 0);
      });
      var meat = FieldTreatment.info('cured meat');
      panel.find('.fieldTreatmentReserve').text(meat.foodWarning ?
        '口粮提醒：使用 1 份熏肉后，余量将低于普通地形返程估算所需的 ' + meat.foodNeeded + ' 份。估算不包含战斗、绕路或额外治疗，并非安全保证。' : '').toggle(meat.foodWarning);
      var status = Events.activeEvent() ? '事件进行中，请使用事件面板里的治疗按钮。' : Engine.keyLock ? '当前操作尚未结束，暂时无法治疗。' :
        World.health >= World.getMaxHealth() ? '当前生命已满，不会消耗治疗品。' : '可点击治疗，或使用快捷键 1 / 2 / 3；每种治疗品分别冷却。';
      panel.find('.fieldTreatmentStatus').text(status);
    }
    FieldTreatment._schedule();
  },
  use: function(item) {
    var spec = FieldTreatment._spec(item);
    if (!spec || !FieldTreatment._inWorld() || FieldTreatment._state !== World.state || FieldTreatment._outfit !== Path.outfit) return 0;
    var info = FieldTreatment.info(item);
    if (!info.healingAvailable || typeof Events.doHeal !== 'function') return 0;
    var duration = Events[spec.cooldown];
    // Reserve the slot before doHeal: supply/health callbacks can synchronously re-enter update or use.
    FieldTreatment._readyAt[item] = Date.now() + (FieldTreatment._finite(duration) && duration > 0 ? duration : 1) * 1000;
    FieldTreatment._busy = true;
    var healed = 0;
    try {
      healed = Events.doHeal(item, info.base, FieldTreatment._buttons[item]);
    } finally {
      FieldTreatment._busy = false;
      FieldTreatment.update();
    }
    if (!FieldTreatment._finite(healed) || healed <= 0) return 0;
    if (window.AudioEngine && window.AudioLibrary && typeof AudioEngine.playSound === 'function') {
      AudioEngine.playSound(item === 'cured meat' ? AudioLibrary.EAT_MEAT : AudioLibrary.USE_MEDS);
    }
    return healed;
  },
  reset: function() {
    FieldTreatment._clearTimer();
    FieldTreatment._generation++;
    FieldTreatment._readyAt = {};
    FieldTreatment._state = null;
    FieldTreatment._outfit = null;
    FieldTreatment._busy = false;
    if (FieldTreatment._panel && FieldTreatment._panel.length) FieldTreatment._panel.hide();
  }
};
