/** Validate once, then publish ingredients and the finished item together. */
var Crafting = {
  _busy:false,
  execute: function(options) {
    if (Crafting._busy || Engine.activeModule !== options.location || Engine.keyLock
      || (window.Events && Events.activeEvent()) || (window.UIContext && !UIContext.canInspect())) return false;
    Crafting._busy = true;
    try {
      var recipe = options.recipe, item = options.item;
      if (!recipe || !options.unlocked() || ['good','weapon','tool','upgrade','building'].indexOf(recipe.type) < 0) return false;
      var path = recipe.type === 'building' ? 'game.buildings' : 'stores';
      var current = $SM.get(path + '[' + JSON.stringify(item) + ']',true);
      var limit = recipe.maximum === undefined ? $SM.MAX_STORE : recipe.maximum;
      var quantity = recipe.quantity === undefined ? 1 : recipe.quantity;
      if (!Number.isSafeInteger(current) || current < 0 || !Number.isSafeInteger(quantity) || quantity <= 0
        || !Number.isSafeInteger(limit) || limit < 0 || current >= limit) return false;
      if (recipe.maximum === undefined && current + quantity > $SM.MAX_STORE) return false;
      quantity = Math.min(quantity,limit-current);
      if (current + quantity > $SM.MAX_STORE) return false;
      var costs = recipe.cost(), changes = {};
      if (!costs || typeof costs !== 'object' || Array.isArray(costs)) return false;
      for (var key of Object.keys(costs)) {
        var amount = costs[key], have = $SM.get('stores[' + JSON.stringify(key) + ']',true);
        if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(have) || have < 0 || have > $SM.MAX_STORE) return false;
        if (!Engine.options.testerMode && have < amount) {Notifications.notify(options.location,_('not enough ' + key));return false;}
        if (!Engine.options.testerMode) changes[key] = have-amount;
      }
      if (path === 'stores') changes[item] = (changes[item] === undefined ? current : changes[item]) + quantity;
      $SM.setM('stores',changes,true);
      if (path !== 'stores') $SM.set(path + '[' + JSON.stringify(item) + ']',current+quantity,true);
      Engine.saveGame();
      $SM.fireUpdate('stores');
      if (path !== 'stores') $SM.fireUpdate('game.buildings');
      Notifications.notify(options.location,recipe.buildMsg);
      if (recipe.type !== 'good') AudioEngine.playSound(recipe.type === 'building' ? AudioLibrary.BUILD : AudioLibrary.CRAFT);
      return true;
    } finally {Crafting._busy = false;}
  }
};
