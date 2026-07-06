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

// Init Space
Space.init();

$.Dispatch('stateUpdate').subscribe(Ship.handleStateUpdates);
},

options: {},

onArrival: function(transition_diff) {
Ship.setTitle();
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

checkDescend: function() {
if(!$SM.get('game.spaceShip.seenWarning')) {
Events.startEvent({
title: _('Descend into the Infinity Castle?'),
scenes: {
'start': {
text: [
_("the castle plunges endlessly downward, corridors twisting in impossible geometry."),
_("each guide crow will light one path through the darkness — then be consumed."),
_("demons will block the descent. reach the Demon King's throne before the crows run out.")
],
buttons: {
'descend': {
text: _('descend'),
onChoose: function() {
$SM.set('game.spaceShip.seenWarning', true);
Ship.descend();
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
} else {
Ship.descend();
}
},

descend: function() {
$('#outerSlider').animate({top: '700px'}, 300);
Space.onArrival();
Engine.activeModule = Space;
AudioEngine.playSound(AudioLibrary.LIFT_OFF);
},

handleStateUpdates: function(e) {}
};
