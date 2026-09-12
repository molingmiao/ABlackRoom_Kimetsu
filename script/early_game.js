/** Small, optional early-game guidance; never unlocks content or spends resources. */
var EarlyGame = {
  init: function() {
    if (!EarlyGame._subscribed) {
      $.Dispatch('stateUpdate').subscribe(EarlyGame.render);
      EarlyGame._subscribed = true;
    }
    EarlyGame.render();
  },
  gatherCooldown: function(normal) {
    var early = !$SM.get('features.location.path') && !$SM.get('game.buildings.hut', true)
      && !$SM.get('game.earlyResidentsArrived') && !$SM.get('game.population', true)
      && $SM.get('game.gatherCount', true) < 3;
    return early ? Math.min(normal, 20) : normal;
  },
  firstResidentsPending: function() {
    return !$SM.get('game.earlyResidentsArrived') && !$SM.get('features.location.path')
      && $SM.get('game.buildings.hut', true) > 0 && !$SM.get('game.population', true);
  },
  task: function() {
    if (!$SM.get('game.prologue.done') || $SM.get('features.location.path') || $SM.get('stores.compass', true)) return null;
    if (!$SM.get('game.fire.value', true)) return {text: 'light the hearth first. warmth will make this estate a refuge again.'};
    if (!$SM.get('features.location.outside')) return {text: 'keep the fire burning. the room and your guest need time to warm up.'};
    if (($SM.get('game.builder.level') || 0) < 4) return {text: 'gather wood while your guest recovers, then return to the hall to speak with her.'};
    if ($SM.get('game.temperature.value', true) <= Room.TempEnum.Cold.value) return {text: 'warm the hall before building. Shinobu cannot work while shivering.'};
    var buildings = $SM.get('game.buildings') || {};
    if (!buildings.cart) return {text: 'build a cart: each wood gathering rises from 10 to 50, before legacy bonuses.', cost: Room.Craftables.cart.cost()};
    if (!buildings.hut) return {text: $SM.get('game.earlyResidentsArrived') ? 'there is room for survivors. gather supplies while you wait for their arrival.' : 'build your first shelter. two survivors will arrive after 30 seconds and help gather wood.', cost: Room.Craftables.hut.cost()};
    if (!$SM.get('game.population', true)) return {text: 'there is room for survivors. gather supplies while you wait for their arrival.'};
    if (!buildings.trap) return {text: 'set a trap to discover food and materials. check it when its cooldown ends.', cost: Room.Craftables.trap.cost()};
    if (!buildings.lodge) return {text: 'build a hunting lodge for a steady source of meat and fur. check traps for missing materials.', cost: Room.Craftables.lodge.cost()};
    if (!buildings['trading post']) return {text: 'build a trading post to prepare for journeys beyond the estate.', cost: Room.Craftables['trading post'].cost()};
    return {text: 'obtain a compass to open world exploration. prepare food and a weapon before leaving.', cost: Room.TradeGoods.compass.cost()};
  },
  render: function() {
    var task = EarlyGame.task();
    $('#roomPanel, #outsidePanel').each(function() {
      var panel = $(this), box = panel.children('.earlyGameTask');
      if (!task) { box.remove(); panel.css('--early-guide-height', '0px'); return; }
      if (!box.length) {
        box = $('<details>').addClass('earlyGameTask').prop('open', true).prependTo(panel);
        $('<summary>').text(_('current estate task')).appendTo(box);
        $('<p>').addClass('earlyGameTaskText').appendTo(box);
        $('<p>').addClass('earlyGameTaskCost').appendTo(box);
        box.on('toggle', function() { EarlyGame.layout(panel, box); });
      }
      box.find('.earlyGameTaskText').text(_(task.text));
      var costs = Object.keys(task.cost || {}).map(function(item) {
        var have = Math.max(0, $SM.get('stores[' + JSON.stringify(item) + ']', true));
        return _('{0}: {1}/{2}', _(item), have, task.cost[item]);
      });
      box.find('.earlyGameTaskCost').text(costs.join(' · '));
      EarlyGame.layout(panel, box);
    });
  },
  layout: function(panel, box) {
    panel.css('--early-guide-height', box.outerHeight(true) + 'px');
  }
};
