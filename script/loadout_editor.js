// A draft-only editor: saving changes a preset, never inventory or equipment.
var LoadoutEditor = {
  _dialog: null,
  otherOverlay: function() {
    return ['scrapQuantityOverlay', 'buyQuantityOverlay', 'castleReportOverlay', 'achievementsOverlay']
      .some(function(id) { return !!document.getElementById(id); });
  },
  canShow: function() {
    return Engine.activeModule === Path && !Events.activeEvent() && !LoadoutEditor.otherOverlay();
  },
  parseCount: function(value) {
    if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null;
    if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
    var count = Number(value);
    return Number.isSafeInteger(count) ? count : null;
  },
  fingerprint: function(id) {
    var value = $SM.get('character.loadouts["' + id + '"]');
    return typeof value === 'undefined' ? 'undefined' : JSON.stringify(value);
  },
  editableKeys: function(profile) {
    var definitions = Path.carryables(), stores = $SM.get('stores') || {}, bag = Path.outfit || {};
    var targets = profile && profile.targets || {}, visible = {}, equipment = Path.getLoadoutEquipment();
    Object.keys(stores).concat(Object.keys(bag), Object.keys(targets)).forEach(function(key) { visible[key] = true; });
    [equipment, Path.getLoadoutEquipment(profile && profile.equipped || {})].forEach(function(selected) {
      Object.keys(selected).forEach(function(category) {
        selected[category].forEach(function(key) {
          if (!key) return;
          visible[key] = true;
          Object.keys(World.Weapons[key] && World.Weapons[key].cost || {}).forEach(function(ammo) { visible[ammo] = true; });
        });
      });
    });
    return Object.keys(definitions).filter(function(key) {
      return visible[key] && (definitions[key].type === 'weapon' || definitions[key].type === 'tool');
    }).sort(function(a, b) {
      var weaponA = definitions[a].type === 'weapon', weaponB = definitions[b].type === 'weapon';
      return weaponA !== weaponB ? weaponA ? -1 : 1 : _(a).localeCompare(_(b));
    });
  },
  draftProfile: function(dialog) {
    var profile = Object.create(null), targets = Object.create(null);
    Object.keys(dialog.original || {}).forEach(function(key) { profile[key] = dialog.original[key]; });
    Object.keys(dialog.originalTargets).forEach(function(key) { targets[key] = dialog.originalTargets[key]; });
    var valid = true;
    dialog.rows.forEach(function(row) {
      var count = LoadoutEditor.parseCount(row.input.val());
      if (count === null) valid = false;
      else targets[row.key] = count;
      row.input.attr('aria-invalid', count === null);
    });
    profile.targets = targets;
    if (!dialog.hadProfile) {
      profile.version = 1;
      profile.equipped = dialog.initialEquipment;
    }
    return {valid:valid, profile:profile};
  },
  sameContext: function(dialog) {
    return LoadoutEditor.canShow() && Path.getLoadoutId() === dialog.id;
  },
  close: function(restoreFocus) {
    var dialog = LoadoutEditor._dialog;
    if (!dialog) return;
    LoadoutEditor._dialog = null;
    dialog.closed = true;
    $.Dispatch('stateUpdate').unsubscribe(dialog.refresh);
    dialog.overlay.remove();
    if (restoreFocus && dialog.trigger && document.documentElement.contains(dialog.trigger)) dialog.trigger.focus();
  },
  show: function(trigger) {
    if (!LoadoutEditor.canShow()) return false;
    LoadoutEditor.close(false);
    var id = Path.getLoadoutId(), saved = Path.getLoadout(id), original = $SM.get('character.loadouts["' + id + '"]');
    original = original && typeof original === 'object' && !Array.isArray(original) ? original : {};
    var originalTargets = saved ? saved.targets : {}, initialEquipment = Path.getLoadoutEquipment();
    var source = saved ? originalTargets : Path.outfit || {}, keys = LoadoutEditor.editableKeys(saved);
    var overlay = $('<div>').attr('id','loadoutEditorOverlay');
    var panel = $('<div>').attr({id:'loadoutEditorPanel', role:'dialog', 'aria-modal':'true', 'aria-labelledby':'loadoutEditorTitle'}).appendTo(overlay);
    $('<h2>').attr('id','loadoutEditorTitle').text('编辑 ' + _(Path.LOADOUT_NAMES[id]) + ' 目标').appendTo(panel);
    $('<p>').addClass('loadoutEditorNote').text(saved
      ? '这里只修改下次补齐的目标数量，保留已保存的装备选择。不会立即装包、扣库存或更换当前装备。'
      : '尚无保存配置：草稿从当前装包数量建立。保存会新建配置并记录当前装备；不会自动建议、免费补给或立即装包。').appendTo(panel);
    $('<p>').addClass('loadoutEditorNote').text('0 表示不补齐该物品；库存为 0 也可以规划未来数量。目标可以超过容量，实际补齐仍受库存与容量限制，且不会丢弃额外物资。').appendTo(panel);
    var summary = $('<div>').addClass('loadoutEditorSummary').attr('aria-live','polite').appendTo(panel);
    var list = $('<div>').addClass('loadoutEditorRows').appendTo(panel);
    var dialog = {id:id, original:original, originalTargets:originalTargets, initialEquipment:initialEquipment, hadProfile:!!saved,
      fingerprint:LoadoutEditor.fingerprint(id), overlay:overlay, trigger:trigger || document.activeElement, rows:[], closed:false};
    keys.forEach(function(key, index) {
      var line = $('<div>').addClass('loadoutEditorRow').appendTo(list), inputId = 'loadoutTarget' + index;
      var title = $('<div>').addClass('loadoutEditorItem').appendTo(line);
      $('<label>').attr('for',inputId).text(_(key)).appendTo(title);
      var stock = $('<span>').addClass('loadoutEditorStock').appendTo(title);
      var count = LoadoutEditor.parseCount(source[key]);
      var input = $('<input>').attr({id:inputId, 'data-loadout-item':key, type:'number', min:0, step:1, max:Number.MAX_SAFE_INTEGER,
        'aria-describedby':'loadoutEditorError', value:count === null ? 0 : count}).appendTo(line);
      dialog.rows.push({key:key, input:input, stock:stock});
    });
    if (!keys.length) $('<p>').text('尚未发现可携带的物品。可以保存空配置，之后发现物品再编辑。').appendTo(list);
    var error = $('<p>').attr({id:'loadoutEditorError', role:'status'}).appendTo(panel);
    var actions = $('<div>').addClass('loadoutEditorActions').appendTo(panel);
    LoadoutEditor._dialog = dialog;
    var refresh = dialog.refresh = function() {
      if (dialog.closed || LoadoutEditor._dialog !== dialog) return;
      if (!LoadoutEditor.sameContext(dialog)) { LoadoutEditor.close(false); return; }
      var draft = LoadoutEditor.draftProfile(dialog), stores = $SM.get('stores') || {}, bag = Path.outfit || {};
      dialog.rows.forEach(function(row) {
        row.stock.text('库存 ' + Path.loadoutCount(stores[row.key]) + ' · 已装包 ' + Math.min(Path.loadoutCount(stores[row.key]),Path.loadoutCount(bag[row.key])));
      });
      var stale = LoadoutEditor.fingerprint(id) !== dialog.fingerprint;
      error.text(stale ? '保存的配置已在其他操作中改变，请取消后重新打开，避免覆盖。' : !draft.valid ? '目标数量须为非负安全整数，请输入 0 或正整数。' : '');
      save.prop('disabled',stale || !draft.valid);
      summary.empty();
      if (!draft.valid) return;
      var profile = draft.profile, capacity = Path.getCapacity(), targetWeight = 0;
      Object.keys(profile.targets).forEach(function(key) { targetWeight += Path.loadoutCount(profile.targets[key]) * Path.getWeight(key); });
      var plan = Path.planLoadout(profile,bag,stores,capacity);
      var weight = isFinite(targetWeight) ? Math.round(targetWeight * 10) / 10 : '超过可计算范围';
      $('<strong>').text('目标重量 ' + weight + ' / 容量 ' + capacity + '；本次可补齐 ' + plan.added + ' 件').appendTo(summary);
      if (targetWeight > capacity) $('<p>').addClass('loadoutEditorWarning').text('目标超过当前容量，可以保存未来规划；这次只会补齐装得下的数量，不会清空或丢弃当前额外物资。').appendTo(summary);
      plan.shortages.forEach(function(shortage) {
        var reasons = [];
        if (shortage.stock) reasons.push('库存不足 ' + shortage.stock);
        if (shortage.space) reasons.push('空间不足 ' + shortage.space + ' 件');
        $('<p>').addClass('loadoutEditorWarning').text(_(shortage.key) + '：仍缺 ' + shortage.missing + '（' + reasons.join('；') + '）').appendTo(summary);
      });
      if (Object.keys(profile.targets).some(function(key) { return keys.indexOf(key) < 0; })) {
        $('<p>').text('旧配置中未列出的目标项将原样保留。').appendTo(summary);
      }
    };
    var commit = function() {
      if (dialog.closed || LoadoutEditor._dialog !== dialog || !document.documentElement.contains(overlay[0])) return false;
      refresh();
      if (dialog.closed || save.prop('disabled')) return false;
      var draft = LoadoutEditor.draftProfile(dialog);
      if (!draft.valid || !LoadoutEditor.sameContext(dialog) || LoadoutEditor.fingerprint(id) !== dialog.fingerprint) return false;
      LoadoutEditor.close(false);
      $SM.set('character.loadouts["' + id + '"]',draft.profile);
      Path.updateLoadoutPanel();
      Path.showLoadoutResult('配置目标已保存。背包、库存和当前装备未改变；需要时再点击“补齐我的配置”。');
      if (dialog.trigger && document.documentElement.contains(dialog.trigger)) dialog.trigger.focus();
      return true;
    };
    var save = $('<button>').attr({id:'saveLoadoutTargets',type:'button'}).addClass('loadoutEditorSave').text('仅保存目标').on('click',commit).appendTo(actions);
    var cancel = $('<button>').attr({id:'cancelLoadoutTargets',type:'button'}).addClass('loadoutEditorCancel').text(_('cancel')).on('click',function() {
      if (LoadoutEditor._dialog === dialog) LoadoutEditor.close(true);
    }).appendTo(actions);
    overlay.on('click',function(e) { e.stopPropagation(); if (e.target === overlay[0] && LoadoutEditor._dialog === dialog) LoadoutEditor.close(true); });
    overlay.on('keydown',function(e) {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); if (LoadoutEditor._dialog === dialog) LoadoutEditor.close(true); }
      else if (e.key === 'Tab') {
        var focusables = dialog.rows.map(function(row) { return row.input[0]; });
        if (!save.prop('disabled')) focusables.push(save[0]);
        focusables.push(cancel[0]);
        var index = focusables.indexOf(document.activeElement);
        if ((e.shiftKey && index <= 0) || (!e.shiftKey && index === focusables.length - 1)) {
          e.preventDefault(); focusables[e.shiftKey ? focusables.length - 1 : 0].focus();
        }
      }
    });
    overlay.on('keyup',function(e) { e.stopPropagation(); });
    dialog.rows.forEach(function(row) { row.input.on('input change',refresh); });
    $.Dispatch('stateUpdate').subscribe(refresh);
    overlay.appendTo('body');
    refresh();
    (dialog.rows.length ? dialog.rows[0].input : save).focus();
    return true;
  }
};
