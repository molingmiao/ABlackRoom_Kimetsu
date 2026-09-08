/** Infinite Castle breathing forms. Only the chosen form persists between runs. */
var CombatStyles = {
	STYLES: [
		{ id: 'technique', name: 'battle technique', description: 'control weapons recover 20% faster. a successful bind opens a 4-second window for 35% more damage.' },
		{ id: 'water', name: 'water form', perk: 'water breath I', weapon: 'nichirin katana', uses: 100,
			description: 'land 3 melee hits, each within 6 seconds, to recover 4% max health and take 15% less damage for 4 seconds.' },
		{ id: 'flame', name: 'flame form', perk: 'flame breath I', weapon: 'wisteria gun', uses: 50,
			description: 'nichirin katana, nichirin spear and flame blade hits leave a deep cut: 18% of actual damage each second for 3 seconds. new cuts refresh, not stack.' },
		{ id: 'thunder', name: 'thunder form', perk: 'thunder breath I', weapon: 'thunder gun', uses: 30,
			description: 'begin combat ready to strike. after 4 seconds without a damaging melee hit, the next melee hit deals 60% more damage. ranged attacks do not spend the charge.' }
	],
	_fight: null,
	_woundTimer: null,
	_statusTimer: null,

	_inCastle: function() {
		return typeof Space !== 'undefined' && typeof Engine !== 'undefined' && Engine.activeModule === Space;
	},
	definition: function(id) {
		return CombatStyles.STYLES.filter(function(style) { return style.id === id; })[0];
	},
	isUnlocked: function(id) {
		var style = CombatStyles.definition(id);
		return !!style && (!style.perk || !!$SM.hasPerk(style.perk));
	},
	getSelected: function() {
		if (CombatStyles._fight && CombatStyles._inCastle()) return CombatStyles._fight.style;
		var saved = $SM.get('character.castleStyle', true);
		return CombatStyles.isUnlocked(saved) ? saved : 'technique';
	},
	getName: function(id) {
		var style = CombatStyles.definition(id || CombatStyles.getSelected());
		return _((style || CombatStyles.STYLES[0]).name);
	},
	setSelected: function(id) {
		// The entry preparation is the only place to change forms during a run.
		if (CombatStyles._inCastle() || !CombatStyles.isUnlocked(id)) return false;
		$SM.set('character.castleStyle', id);
		return true;
	},
	_scale: function() {
		var options = Engine.options || {};
		return options.testerMode ? Math.max(1, options.combatTimeScale || 1) : 1;
	},
	_duration: function(ms) { return ms / CombatStyles._scale(); },
	_isActive: function() {
		if (!CombatStyles._fight || !CombatStyles._inCastle() || Events.won || Events.fought || World.health <= 0) return false;
		var event = Events.activeEvent();
		return !!event && event.scenes[Events.activeScene] === CombatStyles._fight.scene;
	},
	_isMelee: function(weaponName) {
		var weapon = World.Weapons[weaponName];
		return !!weapon && weapon.type === 'melee';
	},

	renderPicker: function(parent) {
		var target = $(parent);
		target.find('.castleStylePicker').remove();
		var box = $('<div>').addClass('castleStylePicker').attr('role', 'group')
			.attr('aria-label', _('castle battle form')).appendTo(target);
		$('<div>').addClass('castleStyleHeading').text(_('castle battle form')).appendTo(box);
		$('<p>').addClass('castleStyleHint').text(_('choose before entering. the form stays fixed until you return and only affects castle battles.')).appendTo(box);
		var list = $('<div>').addClass('castleStyleOptions').appendTo(box);
		var selected = CombatStyles.getSelected();
		CombatStyles.STYLES.forEach(function(style) {
			var unlocked = CombatStyles.isUnlocked(style.id);
			var chosen = style.id === selected;
			var button = $('<button>').attr({ type: 'button', 'data-style': style.id, 'aria-pressed': chosen ? 'true' : 'false' })
				.addClass('castleStyleOption style-' + style.id).toggleClass('selected', chosen)
				.prop('disabled', !unlocked || CombatStyles._inCastle()).appendTo(list);
			$('<span>').addClass('castleStyleName').text(CombatStyles.getName(style.id)).appendTo(button);
			$('<span>').addClass('castleStyleDescription').text(_(style.description)).appendTo(button);
			if (!unlocked) {
				var uses = $SM.get('character.weaponHits["' + style.weapon + '"]', true) || 0;
				$('<span>').addClass('castleStyleLock')
					.text(_('unlock {0}: use {1} {2} times ({3}/{2}).', _(style.perk), _(style.weapon), style.uses, Math.min(style.uses, uses))).appendTo(button);
			} else {
				$('<span>').addClass('castleStyleChoice').text(chosen ? _('form selected') : _('select this form')).appendTo(button);
			}
			button.on('click', function() {
				if (CombatStyles.setSelected(style.id)) CombatStyles.renderPicker(target);
			});
		});
		return box;
	},

	startFight: function(scene) {
		CombatStyles.endFight();
		if (!CombatStyles._inCastle() || !scene || !scene.combat) return;
		CombatStyles._fight = {
			scene: scene, style: CombatStyles.getSelected(), combo: 0,
			lastWaterHit: null, guardUntil: 0, thunderReadyAt: 0, openingUntil: 0, wound: null
		};
	},
	renderStatus: function(parent) {
		if (!CombatStyles._isActive()) return;
		$(parent).find('.castleStyleStatus').remove();
		var box = $('<div>').addClass('castleStyleStatus style-' + CombatStyles.getSelected())
			.attr('role', 'status').attr('aria-live', 'off').appendTo(parent);
		$('<span>').addClass('castleStyleStatusName').text(CombatStyles.getName()).appendTo(box);
		$('<span>').addClass('castleStyleStatusText').appendTo(box);
		CombatStyles._updateStatus();
		clearInterval(CombatStyles._statusTimer);
		CombatStyles._statusTimer = Engine.combatSetInterval(function() {
			if (!CombatStyles._isActive()) {
				clearInterval(CombatStyles._statusTimer);
				CombatStyles._statusTimer = null;
				return;
			}
			CombatStyles._updateStatus();
		}, 250);
		return box;
	},
	_statusText: function() {
		var fight = CombatStyles._fight;
		if (!fight) return '';
		var now = Date.now();
		var seconds = function(until) { return Math.max(0, Math.ceil((until - now) * CombatStyles._scale() / 1000)); };
		if (fight.style === 'water') {
			var combo = fight.lastWaterHit !== null && now - fight.lastWaterHit <= CombatStyles._duration(6000) ? fight.combo : 0;
			return _('flow: {0}/3 melee hits', combo) + (fight.guardUntil > now ? ' · ' + _('flow guard: {0}s remaining', seconds(fight.guardUntil)) : '');
		}
		if (fight.style === 'flame') return fight.wound ? _('deep cut: {0} damage, {1} ticks remaining', fight.wound.damage, fight.wound.ticks) : _('land a nichirin weapon hit to open a deep cut.');
		if (fight.style === 'thunder') return fight.thunderReadyAt <= now ? _('charged: next melee hit +60%') : _('gathering breath: {0}s', seconds(fight.thunderReadyAt));
		return fight.openingUntil > now ? _('opening: +35% damage for {0}s', seconds(fight.openingUntil)) : _('bind the enemy to create an opening.');
	},
	_updateStatus: function() { $('.castleStyleStatusText').text(CombatStyles._statusText()); },

	modifyAttack: function(weaponName, damage) {
		if (!CombatStyles._isActive() || typeof damage !== 'number' || damage <= 0) return damage;
		var fight = CombatStyles._fight;
		if (fight.style === 'thunder' && CombatStyles._isMelee(weaponName) && Date.now() >= fight.thunderReadyAt) return Math.max(1, Math.round(damage * 1.6));
		if (fight.style === 'technique' && Date.now() < fight.openingUntil) return Math.max(1, Math.round(damage * 1.35));
		return damage;
	},
	afterHit: function(weaponName, actualDamage, enemy) {
		// Call only after damage resolution; shields, misses and meditation are not hits.
		if (!CombatStyles._isActive() || typeof actualDamage !== 'number' || actualDamage <= 0) return;
		var fight = CombatStyles._fight;
		var now = Date.now();
		if (fight.style === 'water' && CombatStyles._isMelee(weaponName)) {
			if (fight.lastWaterHit === null || now - fight.lastWaterHit > CombatStyles._duration(6000)) fight.combo = 0;
			fight.lastWaterHit = now;
			fight.combo++;
			if (fight.combo >= 3) {
				fight.combo = 0;
				fight.guardUntil = now + CombatStyles._duration(4000);
				CombatStyles._heal(Math.max(1, Math.ceil(World.getMaxHealth() * 0.04)));
			}
		} else if (fight.style === 'flame' && ['nichirin katana', 'nichirin spear', 'flame blade'].indexOf(weaponName) >= 0) {
			if (enemy && enemy.length && enemy.data('hp') > 0) CombatStyles._openWound(enemy, Math.max(1, Math.round(actualDamage * 0.18)));
		} else if (fight.style === 'thunder' && CombatStyles._isMelee(weaponName)) {
			fight.thunderReadyAt = now + CombatStyles._duration(4000);
		}
		CombatStyles._updateStatus();
	},
	afterControl: function(weaponName, enemy) {
		var weapon = World.Weapons[weaponName];
		if (!CombatStyles._isActive() || CombatStyles._fight.style !== 'technique'
			|| !weapon || weapon.damage !== 'stun' || !enemy || !enemy.data('stunned')) return;
		CombatStyles._fight.openingUntil = Date.now() + CombatStyles._duration(4000);
		CombatStyles._updateStatus();
	},
	modifyIncoming: function(damage) {
		if (!CombatStyles._isActive() || typeof damage !== 'number' || damage <= 0) return damage;
		var fight = CombatStyles._fight;
		return fight.style === 'water' && Date.now() < fight.guardUntil ? Math.max(1, Math.round(damage * 0.85)) : damage;
	},
	cooldownMultiplier: function(weaponName) {
		if (!CombatStyles._inCastle()) return 1;
		var weapon = World.Weapons[weaponName];
		return CombatStyles.getSelected() === 'technique' && weapon && weapon.damage === 'stun' ? 0.8 : 1;
	},
	_heal: function(amount) {
		var before = World.health;
		var hp = Math.min(World.getMaxHealth(), before + amount);
		if (hp <= before) return;
		World.setHp(hp);
		var player = $('#wanderer');
		if (player.length) {
			player.data('hp', hp);
			Events.updateFighterDiv(player);
			Events.drawFloatText('+' + (hp - before), $('.hp', player));
		}
		Events.setHeal();
		if (Space.addMetaHealed) Space.addMetaHealed(hp - before);
	},
	_openWound: function(enemy, damage) {
		var fight = CombatStyles._fight;
		fight.wound = { enemy: enemy, damage: damage, ticks: 3 };
		// Keep the ticking cadence when refreshing, so repeated slashes do not postpone every tick.
		if (CombatStyles._woundTimer !== null) return;
		CombatStyles._woundTimer = Engine.combatSetInterval(function() {
			if (!CombatStyles._isActive() || CombatStyles._fight !== fight || !fight.wound) {
				CombatStyles._clearWound();
				return;
			}
			var wound = fight.wound;
			if ($('#enemy').get(0) !== wound.enemy.get(0) || wound.enemy.data('hp') <= 0) {
				CombatStyles._clearWound();
				return;
			}
			wound.ticks--;
			// Existing DoT resolution also calls winFight when the target dies.
			Events.dotDamage(wound.enemy, wound.damage);
			if (wound.ticks <= 0 || Events.won || Events.fought) CombatStyles._clearWound();
			CombatStyles._updateStatus();
		}, 1000);
	},
	_clearWound: function() {
		clearInterval(CombatStyles._woundTimer);
		CombatStyles._woundTimer = null;
		if (CombatStyles._fight) CombatStyles._fight.wound = null;
	},
	endFight: function() {
		CombatStyles._clearWound();
		clearInterval(CombatStyles._statusTimer);
		CombatStyles._statusTimer = null;
		CombatStyles._fight = null;
		$('.castleStyleStatus').remove();
	}
};
