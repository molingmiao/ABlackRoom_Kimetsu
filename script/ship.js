/**
 * Module for the Infinity Castle descent system.
 * Replaces the starship escape with a plunge into Muzan's fortress.
 */
var Ship = {
DESCEND_COOLDOWN: 120,
ALLOY_PER_CROW: 1,
BASE_CROWS: 0,
name: _("Infinity Castle"),

init: function(options) {
this.options = $.extend(this.options, options);

if(!$SM.get('features.location.spaceShip')) {
$SM.set('features.location.spaceShip', true);
$SM.setM('game.spaceShip', {
crows: Ship.BASE_CROWS
});
}

// Create the Ship tab
this.tab = Header.addLocation(_("Infinity Castle"), "ship", Ship);

// Create the Ship panel
this.panel = $('<div>').attr('id', "shipPanel")
.addClass('location')
.appendTo('div#locationSlider');

Engine.updateSlider();

// Guide crows counter
var crowRow = $('<div>').attr('id', 'crowRow').appendTo('div#shipPanel');
$('<div>').addClass('row_key').text(_('guide crows:')).appendTo(crowRow);
$('<div>').addClass('row_val').text($SM.get('game.spaceShip.crows')).appendTo(crowRow);
$('<div>').addClass('clear').appendTo(crowRow);

// Summon crow button (costs alien alloy)
new Button.Button({
id: 'addCrowButton',
text: _('summon crow'),
click: Ship.addCrow,
width: '100px',
cost: {'demon stone': Ship.ALLOY_PER_CROW}
}).appendTo('div#shipPanel');

// Descend button
var b = new Button.Button({
id: 'liftoffButton',
text: _('descend'),
click: Ship.checkDescend,
width: '100px',
cooldown: Ship.DESCEND_COOLDOWN
}).appendTo('div#shipPanel');

if($SM.get('game.spaceShip.crows') <= 0) {
Button.setDisabled(b, true);
}
new Button.Button({
id: 'castleReportButton',
text: _('view last castle report'),
click: function() { if (window.CastleReport) CastleReport.show(); }
}).appendTo(Ship.panel).hide();

// Init Space
Space.init();

$.Dispatch('stateUpdate').subscribe(Ship.handleStateUpdates);
},

options: {},

onArrival: function(transition_diff) {
Ship.setTitle();
Ship.updateCrowStatus();
if (window.CombatStyles) CombatStyles.renderPicker(Ship.panel);
if (window.CastleReport) $('#castleReportButton').toggle(!!CastleReport.getLastReport());
if(!$SM.get('game.spaceShip.seenShip')) {
Notifications.notify(Ship, _('the entrance to the Infinity Castle yawns before you. Muzan hides somewhere far below.'));
$SM.set('game.spaceShip.seenShip', true);
}
AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_SHIP);
Engine.moveStoresView(null, transition_diff);
},

setTitle: function() {
if(Engine.activeModule == this) {
document.title = _("Infinity Castle");
}
},

addCrow: function() {
if($SM.get('stores["demon stone"]', true) < Ship.ALLOY_PER_CROW && !Engine.options.testerMode) {
Notifications.notify(Ship, _("not enough alien alloy"));
return false;
}
if (!Engine.options.testerMode) {
$SM.add('stores["demon stone"]', -Ship.ALLOY_PER_CROW);
}
$SM.add('game.spaceShip.crows', 1);
$('#crowRow .row_val', Ship.panel).text($SM.get('game.spaceShip.crows'));
if($SM.get('game.spaceShip.crows') > 0) {
Button.setDisabled($('#liftoffButton', Ship.panel), false);
}
AudioEngine.playSound(AudioLibrary.REINFORCE_HULL);
},

getCrowCount: function() {
return $SM.get('game.spaceShip.crows');
},

// Kept for compatibility with scoring.js
getMaxHull: function() {
return Ship.getCrowCount();
},

// Read-only preparation: only equipped AND packed weapons are usable in combat.
getDepartureInfo: function() {
var outfit = Path.outfit || {};
var stores = $SM.get('stores') || {};
var tester = !!Engine.options.testerMode;
var count = function(value) { return typeof value === 'number' && isFinite(value) ? Math.max(0, Math.floor(value)) : 0; };
var info = { style: window.CombatStyles ? CombatStyles.getSelected() : 'technique', weapons: [], healing: [], warnings: [], errors: [], outfit: {} };
var effective = {};
Object.keys(outfit).forEach(function(key) {
var amount = outfit[key];
if (typeof amount !== 'number' || !isFinite(amount) || amount < 0 || Math.floor(amount) !== amount) {
info.errors.push(_('invalid backpack quantity: {0}. adjust your backpack before departure.', _(key)));
return;
}
if (!amount) return;
info.outfit[key] = amount;
effective[key] = tester ? amount : Math.min(amount, count(stores[key]));
if (!tester && effective[key] < amount) {
info.errors.push(_('not enough stock for {0}: packed {1}, available {2}.', _(key), amount, effective[key]));
}
});
if (!tester && count(Ship.getCrowCount()) < 1) info.errors.push(_('a guide crow is required before descending.'));
var ordered = [];
['primary', 'secondary', 'tool'].forEach(function(category) {
Path.getEquippedSlots(category).forEach(function(key) {
if (!key || ordered.indexOf(key) >= 0 || !World.Weapons[key]) return;
if (!effective[key]) {
info.warnings.push(_('equipped but not packed: {0}.', _(key)));
return;
}
ordered.push(key);
});
});
Object.keys(World.Weapons).forEach(function(key) {
if (effective[key] && !Path.getWeaponCategory(key) && ordered.indexOf(key) < 0) ordered.push(key);
});
ordered.forEach(function(key) {
var weapon = World.Weapons[key];
var uses = null;
Object.keys(weapon.cost || {}).forEach(function(ammo) {
var shots = Math.floor((effective[ammo] || 0) / weapon.cost[ammo]);
uses = uses === null ? shots : Math.min(uses, shots);
if (!shots) info.warnings.push(_('no ammunition for {0}: pack {1}.', _(key), _(ammo)));
});
info.weapons.push({ key: key, uses: uses, ready: uses === null || uses > 0 });
});
var ready = info.weapons.filter(function(weapon) { return weapon.ready; });
var hasMelee = ready.some(function(weapon) { return World.Weapons[weapon.key].type === 'melee'; });
var hasControl = ready.some(function(weapon) { return World.Weapons[weapon.key].damage === 'stun'; });
var hasFlame = ready.some(function(weapon) { return ['nichirin katana', 'nichirin spear', 'flame blade'].indexOf(weapon.key) >= 0; });
if (info.style === 'technique' && !hasControl) info.warnings.push(_('battle technique needs a usable control weapon to create openings.'));
if ((info.style === 'water' || info.style === 'thunder') && !hasMelee) info.warnings.push(_('this form needs an equipped melee weapon; fists and ranged attacks do not activate it.'));
if (info.style === 'flame' && !hasFlame) info.warnings.push(_('flame form needs a nichirin katana, nichirin spear or flame blade to leave deep cuts.'));
['cured meat', 'medicine', 'wisteria oil'].forEach(function(key) {
if (effective[key]) info.healing.push({ key: key, amount: effective[key] });
});
if (!info.healing.length) info.warnings.push(_('no healing supplies packed. bring food, medicine or wisteria oil.'));
return info;
},

departureSummary: function(info) {
var weapons = info.weapons.map(function(weapon) {
return weapon.uses === null ? _(weapon.key) : _('{0} ({1} uses)', _(weapon.key), weapon.uses);
});
var healing = info.healing.map(function(item) { return _(item.key) + ' ×' + item.amount; });
var text = [
_('chosen form: {0}', window.CombatStyles ? CombatStyles.getName(info.style) : _('battle technique')),
_('usable equipped weapons: {0}', weapons.length ? weapons.join(' / ') : _('fists only')),
_('packed healing supplies: {0}', healing.length ? healing.join(' / ') : _('none')),
_('ammunition counts are per weapon; weapons using the same ammunition share the supply.')
];
info.errors.forEach(function(error) { text.push(_('departure blocked: {0}', error)); });
info.warnings.forEach(function(warning) { text.push(_('preparation note: {0}', warning)); });
if (info.warnings.length) text.push(_('preparation notes are advisory; you may still descend with this setup.'));
return text;
},

updateCrowStatus: function() {
$('#crowRow .row_val', Ship.panel).text(Ship.getCrowCount() || 0);
Button.setDisabled($('#liftoffButton', Ship.panel), !Engine.options.testerMode && !(Ship.getCrowCount() >= 1));
},

checkDescend: function() {
if (Engine.activeModule !== Ship || Events.activeEvent()) return false;
var firstTime = !$SM.get('game.spaceShip.seenWarning');
var intro = firstTime ? [
_("the castle plunges endlessly downward, corridors twisting in impossible geometry."),
_("each guide crow will light one path through the darkness — then be consumed."),
_("demons will block the descent. reach the Demon King's throne before the crows run out.")
] : [
_("confirm the supplies and weapons in your backpack before the plunge."),
_("what you pack is all you take below \u2014 you can still adjust it now.")
];
intro = intro.concat(Ship.departureSummary(Ship.getDepartureInfo()));
Events.startEvent({
title: _('Descend into the Infinity Castle?'),
scenes: {
'start': {
text: intro,
buttons: {
'descend': {
text: _('descend'),
onEnd: Ship.descend,
nextScene: 'end'
},
'outfit': {
text: _('adjust backpack'),
onEnd: function() {
Button.clearCooldown($('#liftoffButton'));
Engine.travelTo(Path);
},
nextScene: 'end'
},
'wait': {
text: _('wait'),
onChoose: function() {
Button.clearCooldown($('#liftoffButton'));
},
nextScene: 'end'
}
}
}
}
});
},

descend: function() {
if (Engine.activeModule !== Ship) return false;
// Revalidate after the confirmation closes: stock may change while it is open.
var info = Ship.getDepartureInfo();
if (info.errors.length) {
Notifications.notify(Ship, info.errors.join(' '));
Button.clearCooldown($('#liftoffButton'));
Ship.updateCrowStatus();
return false;
}
if (!Engine.options.testerMode) {
// Validate the entire selection before making any withdrawal; publish only after
// all deductions, so synchronous inventory listeners never see a partial loadout.
Object.keys(info.outfit).forEach(function(key) {
$SM.add('stores[' + JSON.stringify(key) + ']', -info.outfit[key], true);
});
$SM.add('game.spaceShip.crows', -1, true);
}
Path.outfit = info.outfit;
$SM.set('outfit', Path.outfit, true);
$SM.set('game.spaceShip.seenWarning', true, true);
// Castle-only max HP, inherited talents and report context must already be active.
Engine.activeModule = Space;
World.dead = false;
Ship.updateCrowStatus();
$SM.fireUpdate('stores');
$SM.fireUpdate('game.spaceShip.crows');
$('#outerSlider').animate({top: '-910px'}, 300);
Space.onArrival();
Engine.saveGame();
AudioEngine.playSound(AudioLibrary.LIFT_OFF);
return true;
},

handleStateUpdates: function(e) {}
};
