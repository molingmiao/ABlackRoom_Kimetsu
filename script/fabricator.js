/**
 * Module that registers the Nichirin Forge functionality.
 * A blacksmith's forge where demon-slayer weapons are tempered
 * using demon stone (青鬼石) and nichirin techniques.
 */
const Fabricator = {
  _STORES_OFFSET: 0,
  name: _('Forge'),
  Craftables: {
    'water cycle': {
      name: _('water cycle'),
      type: 'upgrade',
      maximum: 1,
      buildMsg: _('water out, water in — breath flowing, never wasted.'),
      cost: () => ({
        'demon stone': 2
      })
    },
    'cargo crow': {
      name: _('cargo crow'),
      type: 'upgrade',
      maximum: 1,
      buildMsg: _("the workhorse of the slayer corps' messenger crows."),
      cost: () => ({
        'demon stone': 2
      })
    },
    'wind armour': {
      name: _('wind armour'),
      type: 'upgrade',
      maximum: 1,
      blueprintRequired: true,
      buildMsg: _("slayers prevail by turning the demon's rage against itself."),
      cost: () => ({
        'demon stone': 2
      })
    },
    'bind kunai': {
      name: _('bind kunai'),
      type: 'weapon',
      blueprintRequired: true,
      buildMsg: _("sometimes it is best not to fight."),
      cost: () => ({
        'demon stone': 1
      })
    },
    'wisteria oil': {
      name: _('wisteria oil'),
      type: 'tool',
      blueprintRequired: true,
      buildMsg: _('a handful of vials — life held in the scent of wisteria.'),
      cost: () => ({
        'demon stone': 1
      }),
      quantity: 5
    },
    'concentration pill': {
      name: _('concentration pill'),
      type: 'tool',
      blueprintRequired: true,
      buildMsg: _('sometimes it is best to fight without restraint.'),
      cost: () => ({
        'demon stone': 1
      })
    },
    'thunder gun': {
      name: _('thunder gun'),
      type: 'weapon',
      blueprintRequired: true,
      buildMsg: _('the pinnacle of forgotten slayer weapons — sleek and deadly.'),
      cost: () => ({
        'demon stone': 1
      })
    },
    'firefly orb': {
      name: _('firefly orb'),
      type: 'tool',
      blueprintRequired: true,
      buildMsg: _('a smooth, perfect sphere — its light is inextinguishable.'),
      cost: () => ({
        'demon stone': 1
      })
    }
  },

  init: () => {

    if (!$SM.get('features.location.fabricator')) {
      $SM.set('features.location.fabricator', true);
    }

    // Create the Fabricator tab
    Fabricator.tab = Header.addLocation(_("The Nichirin Forge"), "fabricator", Fabricator, 'ship');
    
    // Create the Fabricator panel
    Fabricator.panel = $('<div>').attr('id', "fabricatorPanel")
      .addClass('location');
    if (Ship.panel) {
      Fabricator.panel.insertBefore(Ship.panel);
    }
    else {
      Fabricator.panel.appendTo('div#locationSlider');
    }

    $.Dispatch('stateUpdate').subscribe(() => {
      Fabricator.updateBuildButtons();
      Fabricator.updateBlueprints();
    });
    
    Engine.updateSlider();
    Fabricator.updateBuildButtons();

  },

  onArrival: transition_diff => {
    Fabricator.setTitle();
    Fabricator.updateBuildButtons();
    Fabricator.updateBlueprints(true);

    if(!$SM.get('game.fabricator.seen')) {
      Notifications.notify(Fabricator, _('the forge fire roars back to life. nichirin steel rings at last — real weapons, finally.'));
      $SM.set('game.fabricator.seen', true);
    }
    AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_SHIP);

    Engine.moveStoresView(null, transition_diff);
  },

  setTitle: () => {
    if(Engine.activeModule == Fabricator) {
      document.title = _("The Nichirin Forge");
    }
  },

  updateBuildButtons: () => {
    let workbench = Fabricator.panel.find('.forgeWorkbench');
    if (!workbench.length) {
      workbench = $('<div>').addClass('forgeWorkbench').attr({tabindex:0,'aria-label':'锻造与制作，内容较长时可滚动查看'}).appendTo(Fabricator.panel);
    }
    let section = $('#fabricateButtons');
    let needsAppend = false;
    if (section.length === 0) {
      section = $('<div>').attr({ 'id': 'fabricateButtons', 'data-legend': _('forge:') }).css('opacity', 0);
      needsAppend = true;
    }

    for (const [ key, value ] of Object.entries(Fabricator.Craftables)) {
      const max = $SM.num(key, value) >= value.maximum;
      if (value.type === 'upgrade' && max) {
        if (value.button) value.button.remove();
        value.button = null;
        continue;
      }
      if (!value.button) {
        if (Fabricator.canFabricate(key)) {
          const name = _(value.name) + ((value.quantity ?? 1) > 1 ? ` (x${value.quantity})` : '');
          value.button = new Button.Button({
            id: 'fabricate_' + key,
            cost: value.cost(),
            text: name,
            click: Fabricator.fabricate,
            width: '150px',
            ttPos: section.children().length > 10 ? 'top right' : 'bottom right'
          }).css('opacity', 0).attr('fabricateThing', key).appendTo(section).animate({ opacity: 1 }, 300, 'linear');
        }
      } else {
        if (max && value.maxMsg && !value.button.hasClass('disabled')) {
          Notifications.notify(Fabricator, value.maxMsg);
        }
      }
      if (value.type === 'weapon') Room.decorateWeaponButton(value.button, key);
      Room.updateCraftAvailability(value.button, value.cost(), max);
    }

    Room.sortCraftWeaponButtons(section);

    if (needsAppend && section.children().length > 0) {
      section.appendTo(workbench).animate({ opacity: 1 }, 300, 'linear');
    }
    if (window.NichirinForge) NichirinForge.render();
  },

  updateBlueprints: ignoreStores => {
    if(!$SM.get('character.blueprints')) {
      return;
    }

    let blueprints = $('#blueprints');
    let needsAppend = false;
    if(blueprints.length === 0) {
      needsAppend = true;
      blueprints = $('<div>').attr({'id': 'blueprints', 'data-legend': _('blueprints')});
    }

    for (const k in $SM.get('character.blueprints')) {
      const id = 'blueprint_' + k.replace(/ /g, '-');
      if (k === 'flame blade' || k === 'nichirin blade flame') {$('#' + id).remove();continue;}
      let r = $('#' + id);
      if($SM.get(`character.blueprints["${k}"]`) && r.length === 0) {
        r = $('<div>').attr('id', id).addClass('blueprintRow').appendTo(blueprints);
        $('<div>').addClass('row_key').text(_(k)).appendTo(r);
      }
    }
    
    if(needsAppend && blueprints.children().length > 0) {
      blueprints.prependTo(Fabricator.panel);
    }
  },

  canFabricate: itemKey => 
    !Fabricator.Craftables[itemKey].blueprintRequired || 
    $SM.get(`character.blueprints['${itemKey}']`),

  fabricate: button => {
    const thing = $(button).attr('fabricateThing');
    const craftable = Fabricator.Craftables[thing];
    if (!craftable) return false;
    const numThings = Math.max(0, $SM.get(`stores['${thing}']`, true));

    if (craftable.maximum <= numThings) {
      return;
    }

    const quantity = typeof craftable.maximum === 'number'
      ? Math.min(craftable.quantity ?? 1, craftable.maximum - numThings)
      : craftable.quantity ?? 1;

    const storeMod = {};
    const cost = craftable.cost();
    for (const [ key, value ] of Object.entries(cost)) {
      const have = $SM.get(`stores['${key}']`, true);
      if (have < value && !Engine.options.testerMode) {
        Notifications.notify(Fabricator, _(`not enough ${key}`));
        return false;
      } else {
        storeMod[key] = have - value;
      }
    }
    if (!Engine.options.testerMode) {
      $SM.setM('stores', storeMod);
    }
    $SM.add(`stores['${thing}']`, quantity);

    Notifications.notify(Fabricator, craftable.buildMsg);
    AudioEngine.playSound(AudioLibrary.CRAFT);
  }

};
