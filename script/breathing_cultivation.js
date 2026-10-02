/** Signature cultivation builds on the existing six talent IDs and castle lifecycle. */
var BreathingCultivation = {
	FORMS: [
		{ id: 'beast', name: 'beast form', focus: 'steadyHand', story: 'game.yoshiwaraDone', storyName: 'finish yoshiwara chapter', floors: 5 },
		{ id: 'insect', name: 'insect form', focus: 'steadyHand', chapter: 'M', storyName: 'finish natagumo chapter', floors: 10 },
		{ id: 'sound', name: 'sound form', focus: 'swiftBlade', story: 'game.yoshiwaraDone', storyName: 'finish yoshiwara chapter', floors: 20 },
		{ id: 'mist', name: 'mist form', focus: 'swiftBlade', story: 'game.swordsmithVillageDone', storyName: 'finish swordsmith chapter', floors: 25 },
		{ id: 'wind', name: 'wind form', focus: 'sharpEdge', story: 'game.pillarConvocationDone', storyName: 'finish hashira training', floors: 30 },
		{ id: 'stone', name: 'stone form', focus: 'ironWall', story: 'game.pillarConvocationDone', storyName: 'finish hashira training', floors: 35 },
		{ id: 'flower', name: 'flower form', focus: 'steadyHand', floors: 40 },
		{ id: 'love', name: 'love form', focus: 'hardBody', story: 'game.swordsmithVillageDone', storyName: 'finish swordsmith chapter', floors: 45 },
		{ id: 'serpent', name: 'serpent form', focus: 'steadyHand', story: 'game.pillarConvocationDone', storyName: 'finish hashira training', floors: 50 },
		{ id: 'sun', name: 'sun form', focus: 'sharpEdge', story: 'game.pillarConvocationDone', storyName: 'finish hashira training', floors: 80, bosses: 5, advanced: true },
		{ id: 'moon', name: 'moon form', focus: 'steadyHand', story: 'game.pillarConvocationDone', storyName: 'finish hashira training', floors: 120, bosses: 8, advanced: true }
	],
	TRAINING: { hardBody: 'body cultivation', sharpEdge: 'blade cultivation', ironWall: 'guard cultivation',
		bloodDrink: 'recovery cultivation', steadyHand: 'perception cultivation', swiftBlade: 'breath rhythm cultivation' },
	DESCRIPTIONS: {
		technique: 'Control cooldown -{0}%. Successful binds open a 4s window with +{1}% weapon damage.',
		water: 'Three melee hits within 6s gaps heal {0}% max HP and grant {1}% damage reduction for 4s.',
		flame: 'Nichirin katana, spear or flame blade hits leave a cut: {0}% actual hit damage each second for 3s. Refreshes, never stacks timers.',
		thunder: 'Start charged. Wait {0}s after a damaging melee hit for +{1}% on the next. Early melee hits restart the wait; ranged hits keep the charge.',
		wind: 'Melee hits build up to four momentum stacks, each granting +{0}% melee damage. A gap over 4s breaks the chain.',
		stone: 'Direct damage -{0}%. Three actual direct hits received charge a +{1}% melee counter. Misses, shields and DOT do not count.',
		mist: 'Every 8s, the next direct hit is reduced by {0}%. Being hit opens one +{1}% melee retaliation for 3s. DOT cannot trigger it.',
		insect: 'Melee hits refresh 4 poison ticks: {0}% of actual hit damage plus 3% per dose, up to five. DOT cannot trigger lifesteal or new combos.',
		sound: 'Alternate damage weapons within 6s gaps: every third hit gains +{0}%. Repeating the same weapon restarts at beat one. Control does not count.',
		beast: 'Switch melee weapons within 5s of a melee hit for +{0}% damage. Ranged attacks do not receive the bonus.',
		flower: 'After three melee hits within 6s gaps, the next gains +{0}%. Any actual damage received breaks focus.',
		love: 'Actual consumable healing grants +{0}% melee damage and 15% guard for 4s. Lifesteal, passive healing and overhealing do not trigger it.',
		serpent: 'Successful binds grant +{0}% for the next two melee hits within 6s. Misses, shields and meditation do not spend them.',
		sun: 'Four melee hits within 6s gaps open a 4s dance with +{0}% melee damage. Repeat the chain to renew it.',
		moon: 'Fan-game sword imitation, not demon powers or physical crescents. Start charged; wait 5s between melee hits for +{0}% and a sword trace dealing {1}% actual damage for three ticks.'
	},
	progress: function(path) {
		var n = $SM.get(path, true);
		return Number.isSafeInteger(n) && n > 0 ? n : 0;
	},
	storyComplete: function(style) {
		if (style.chapter) return ($SM.get('game.world.map', true) || []).some(function(row) {
			return Array.isArray(row) && row.indexOf(style.chapter + '!') >= 0;
		});
		return !!style.story && !!$SM.get(style.story, true);
	},
	trainingLevel: function(id) {
		var n = Space.getTalentLevel ? Space.getTalentLevel(id) : 0;
		return Number.isSafeInteger(n) && n > 0 ? n : 0;
	},
	parameters: function(id, level) {
		var style = CombatStyles.definition(id || CombatStyles.getSelected()) || CombatStyles.STYLES[0];
		var n = typeof level === 'number' && Number.isFinite(level) ? Math.max(0, level) : BreathingCultivation.trainingLevel(style.focus);
		var score = n / (n + 30);
		return { controlCooldown: 0.8 - 0.1 * score, opening: 0.35 + 0.25 * score,
			waterHeal: 0.04 + 0.04 * score, waterGuard: 0.15 + 0.10 * score, cut: 0.18 + 0.10 * score,
			thunderBurst: 0.60 + 0.30 * score, thunderWait: 4 - 0.8 * score,
			windStep: 0.08 + 0.04 * score, stoneGuard: 0.12 + 0.08 * score, stoneCounter: 0.50 + 0.30 * score,
			mistGuard: 0.40 + 0.10 * score, mistCounter: 0.25 + 0.15 * score, poison: 0.12 + 0.08 * score,
			soundBurst: 0.60 + 0.30 * score, beastBurst: 0.35 + 0.20 * score, flowerBurst: 0.60 + 0.30 * score,
			loveBurst: 0.25 + 0.15 * score, serpentBurst: 0.40 + 0.20 * score, sunBurst: 0.30 + 0.20 * score,
			moonBurst: 0.20 + 0.20 * score, moonCut: 0.12 + 0.06 * score };
	},
	pct: function(n) { return Math.round(n * 1000) / 10; },
	describe: function(id) {
		var p = BreathingCultivation.parameters(id), pct = BreathingCultivation.pct;
		var message = function(form) {
			var args = Array.prototype.slice.call(arguments, 1), key = form + ' style mechanics';
			var translated = _.apply(null, [key].concat(args));
			return translated === key ? _.apply(null, [BreathingCultivation.DESCRIPTIONS[form]].concat(args)) : translated;
		};
		switch (id) {
		case 'water': return message('water', pct(p.waterHeal), pct(p.waterGuard));
		case 'flame': return message('flame', pct(p.cut));
		case 'thunder': return message('thunder', Math.round(p.thunderWait * 100) / 100, pct(p.thunderBurst));
		case 'wind': return message('wind', pct(p.windStep));
		case 'stone': return message('stone', pct(p.stoneGuard), pct(p.stoneCounter));
		case 'mist': return message('mist', pct(p.mistGuard), pct(p.mistCounter));
		case 'insect': return message('insect', pct(p.poison));
		case 'sound': return message('sound', pct(p.soundBurst));
		case 'beast': return message('beast', pct(p.beastBurst));
		case 'flower': return message('flower', pct(p.flowerBurst));
		case 'love': return message('love', pct(p.loveBurst));
		case 'serpent': return message('serpent', pct(p.serpentBurst));
		case 'sun': return message('sun', pct(p.sunBurst));
		case 'moon': return message('moon', pct(p.moonBurst), pct(p.moonCut));
		default: return message('technique', pct(1 - p.controlCooldown), pct(p.opening));
		}
	},
	chainActive: function(ms) {
		var f = CombatStyles._fight;
		return f.lastHit !== null && Date.now() - f.lastHit <= CombatStyles._duration(ms);
	},
	install: function() {
		var focuses = ['swiftBlade', 'bloodDrink', 'sharpEdge', 'swiftBlade'];
		CombatStyles.STYLES.forEach(function(s, i) { s.focus = focuses[i]; });
		CombatStyles.STYLES = CombatStyles.STYLES.concat(BreathingCultivation.FORMS);
		CombatStyles.parameters = BreathingCultivation.parameters;
		CombatStyles.describe = BreathingCultivation.describe;
		CombatStyles.trainingName = function(id) {
			return _('{0} · {1}', CombatStyles.getName(), _(BreathingCultivation.TRAINING[id] || id));
		};
		CombatStyles.trainingPreview = function(id, before, after) {
			var s = CombatStyles.definition(CombatStyles.getSelected());
			if (!s || s.focus !== id) return '';
			var key = { technique: 'opening', water: 'waterHeal', flame: 'cut', thunder: 'thunderBurst', wind: 'windStep',
				stone: 'stoneGuard', mist: 'mistGuard', insect: 'poison', sound: 'soundBurst', beast: 'beastBurst',
				flower: 'flowerBurst', love: 'loveBurst', serpent: 'serpentBurst', sun: 'sunBurst', moon: 'moonBurst' }[s.id];
			var format = function(lvl) { return (BreathingCultivation.parameters(s.id, lvl)[key] * 100).toFixed(3) + '%'; };
			return _('form signature cultivation: {0} → {1}', format(before), format(after)) + '\n' + BreathingCultivation.describe(s.id);
		};
		var oldUnlock = CombatStyles.isUnlocked;
		CombatStyles.isUnlocked = function(id) {
			var s = CombatStyles.definition(id);
			if (!s || !s.floors) return oldUnlock(id);
			var story = BreathingCultivation.storyComplete(s), floors = BreathingCultivation.progress('game.castleMeta.totalFloors') >= s.floors;
			return s.advanced ? story && floors && BreathingCultivation.progress('game.castleMeta.bossKilled') >= s.bosses : story || floors;
		};
		CombatStyles.unlockText = function(s) {
			if (s.perk) return _('unlock {0}: use {1} {2} times ({3}/{2}).', _(s.perk), _(s.weapon), s.uses,
				Math.min(s.uses, BreathingCultivation.progress('character.weaponHits["' + s.weapon + '"]')));
			var text = _('castle practice: {0}/{1} total floors', Math.min(s.floors, BreathingCultivation.progress('game.castleMeta.totalFloors')), s.floors);
			if (s.story || s.chapter) text = _(s.storyName) + (s.advanced ? _(' and ') : _(' or ')) + text;
			if (s.bosses) text += ' · ' + _('gate bosses: {0}/{1}', Math.min(s.bosses, BreathingCultivation.progress('game.castleMeta.bossKilled')), s.bosses);
			return text;
		};
		var oldStart = CombatStyles.startFight;
		CombatStyles.startFight = function(scene) {
			oldStart(scene);
			if (CombatStyles._fight) Object.assign(CombatStyles._fight, { lastHit: null, lastWeapon: null, guardReadyAt: 0, openingHits: 0, counters: 0, poisonStacks: 0 });
		};
		var oldAttack = CombatStyles.modifyAttack;
		CombatStyles.modifyAttack = function(name, damage) {
			if (!CombatStyles._isActive() || typeof damage !== 'number' || damage <= 0) return damage;
			var f = CombatStyles._fight, p = BreathingCultivation.parameters(f.style), now = Date.now(), bonus = 0;
			if (f.style === 'sound' && BreathingCultivation.chainActive(6000) && name !== f.lastWeapon && f.combo === 2) bonus = p.soundBurst;
			if (CombatStyles._isMelee(name)) {
				if (f.style === 'wind' && BreathingCultivation.chainActive(4000)) bonus = f.combo * p.windStep;
				if (f.style === 'stone' && f.counters >= 3) bonus = p.stoneCounter;
				if (f.style === 'mist' && f.openingHits > 0 && now < f.openingUntil) bonus = p.mistCounter;
				if (f.style === 'beast' && BreathingCultivation.chainActive(5000) && name !== f.lastWeapon) bonus = p.beastBurst;
				if (f.style === 'flower' && BreathingCultivation.chainActive(6000) && f.combo >= 3) bonus = p.flowerBurst;
				if (f.style === 'love' && now < f.openingUntil) bonus = p.loveBurst;
				if (f.style === 'serpent' && now < f.openingUntil && f.openingHits > 0) bonus = p.serpentBurst;
				if (f.style === 'sun' && now < f.openingUntil) bonus = p.sunBurst;
				if (f.style === 'moon' && now >= f.thunderReadyAt) bonus = p.moonBurst;
			}
			return bonus ? Math.max(1, Math.round(damage * (1 + bonus))) : oldAttack(name, damage);
		};
		var oldHit = CombatStyles.afterHit;
		CombatStyles.afterHit = function(name, damage, enemy) {
			if (!CombatStyles._isActive() || typeof damage !== 'number' || damage <= 0) return;
			var f = CombatStyles._fight, now = Date.now(), p = BreathingCultivation.parameters(f.style), melee = CombatStyles._isMelee(name);
			oldHit(name, damage, enemy);
			if (f.style === 'sound') {
				f.combo = BreathingCultivation.chainActive(6000) && name !== f.lastWeapon ? f.combo + 1 : 1;
				if (f.combo >= 3) f.combo = 0;
				f.lastHit = now; f.lastWeapon = name;
			}
			if (melee) {
				if (f.style === 'wind') f.combo = Math.min(4, (BreathingCultivation.chainActive(4000) ? f.combo : 0) + 1);
				if (f.style === 'stone' && f.counters >= 3) f.counters = 0;
				if ((f.style === 'mist' || f.style === 'serpent') && now < f.openingUntil && f.openingHits > 0) f.openingHits--;
				if (f.style === 'insect' && enemy && enemy.length && enemy.data('hp') > 0) {
					f.poisonStacks = Math.min(5, f.poisonStacks + 1);
					CombatStyles._openWound(enemy, Math.max(1, Math.round(damage * (p.poison + 0.03 * f.poisonStacks))), 4, 'wisteria poison');
				}
				if (f.style === 'flower') f.combo = BreathingCultivation.chainActive(6000) ? (f.combo >= 3 ? 0 : f.combo + 1) : 1;
				if (f.style === 'sun') {
					f.combo = (BreathingCultivation.chainActive(6000) ? f.combo : 0) + 1;
					if (f.combo >= 4) { f.combo = 0; f.openingUntil = now + CombatStyles._duration(4000); }
				}
				if (f.style === 'moon') {
					if (now >= f.thunderReadyAt && enemy && enemy.length && enemy.data('hp') > 0) CombatStyles._openWound(enemy, Math.max(1, Math.round(damage * p.moonCut)), 3, 'sword trace');
					f.thunderReadyAt = now + CombatStyles._duration(5000);
				}
				if (f.style !== 'sound') { f.lastHit = now; f.lastWeapon = name; }
			}
			CombatStyles._updateStatus();
		};
		var oldControl = CombatStyles.afterControl;
		CombatStyles.afterControl = function(name, enemy) {
			oldControl(name, enemy);
			var w = World.Weapons[name];
			if (CombatStyles._isActive() && CombatStyles._fight.style === 'serpent' && w && w.damage === 'stun' && enemy && enemy.data('stunned')) {
				CombatStyles._fight.openingUntil = Date.now() + CombatStyles._duration(6000); CombatStyles._fight.openingHits = 2;
				CombatStyles._updateStatus();
			}
		};
		var oldIncoming = CombatStyles.modifyIncoming;
		CombatStyles.modifyIncoming = function(damage) {
			if (!CombatStyles._isActive() || typeof damage !== 'number' || damage <= 0) return damage;
			var f = CombatStyles._fight, p = BreathingCultivation.parameters(f.style), reduction = 0;
			if (f.style === 'stone') reduction = p.stoneGuard;
			if (f.style === 'mist' && Date.now() >= f.guardReadyAt) reduction = p.mistGuard;
			if (f.style === 'love' && Date.now() < f.openingUntil) reduction = 0.15;
			return reduction ? Math.max(1, Math.round(damage * (1 - reduction))) : oldIncoming(damage);
		};
		CombatStyles.afterIncoming = function(actualDamage, options) {
			if (!CombatStyles._isActive() || typeof actualDamage !== 'number' || actualDamage <= 0) return;
			var f = CombatStyles._fight, now = Date.now();
			if (f.style === 'stone' && !(options && options.dot)) f.counters = Math.min(3, f.counters + 1);
			if (f.style === 'flower') f.combo = 0;
			if (f.style === 'mist' && !(options && options.dot) && now >= f.guardReadyAt) {
				f.guardReadyAt = now + CombatStyles._duration(8000); f.openingUntil = now + CombatStyles._duration(3000); f.openingHits = 1;
			}
			CombatStyles._updateStatus();
		};
		CombatStyles.afterHeal = function(healing, item) {
			if (!CombatStyles._isActive() || CombatStyles._fight.style !== 'love' || typeof healing !== 'number' || healing <= 0
				|| ['cured meat', 'medicine', 'wisteria oil'].indexOf(item) < 0) return;
			CombatStyles._fight.openingUntil = Date.now() + CombatStyles._duration(4000); CombatStyles._updateStatus();
		};
		var oldClear = CombatStyles._clearWound;
		CombatStyles._clearWound = function() { oldClear(); if (CombatStyles._fight) CombatStyles._fight.poisonStacks = 0; };
		var oldStatus = CombatStyles._statusText;
		CombatStyles._statusText = function() {
			var f = CombatStyles._fight;
			if (!f) return '';
			var now = Date.now(), p = BreathingCultivation.parameters(f.style), pct = BreathingCultivation.pct;
			var seconds = function(until) { return Math.max(0, Math.ceil((until - now) * CombatStyles._scale() / 1000)); };
			var combo = BreathingCultivation.chainActive(f.style === 'wind' ? 4000 : 6000) ? f.combo : 0;
			switch (f.style) {
			case 'wind': return _('wind momentum: {0}/4, melee damage +{1}%', combo, pct(combo * p.windStep));
			case 'stone': return _('stone guard: -{0}%; counter: {1}/3', pct(p.stoneGuard), f.counters) + (f.counters >= 3 ? ' · ' + _('charged strike: +{0}%', pct(p.stoneCounter)) : '');
			case 'mist': return (f.guardReadyAt <= now ? _('mist concealment ready: -{0}% next direct hit', pct(p.mistGuard)) : _('mist concealment returns in {0}s', seconds(f.guardReadyAt)))
				+ (f.openingUntil > now && f.openingHits ? ' · ' + _('opening buff: +{0}%, {1}s, {2} melee hits', pct(p.mistCounter), seconds(f.openingUntil), f.openingHits) : '');
			case 'insect': return _('wisteria poison: {0}/5 doses', f.poisonStacks) + (f.wound ? ' · ' + _('deep cut: {0} damage, {1} ticks remaining', f.wound.damage, f.wound.ticks) : '');
			case 'sound': return _('score: {0}/3; change damage weapons to keep the rhythm', combo);
			case 'beast': return BreathingCultivation.chainActive(5000) ? _('beast senses: switch melee weapons for +{0}%', pct(p.beastBurst)) : _('land a melee hit to read the enemy.');
			case 'flower': return _('flower focus: {0}/3; damage received breaks focus', combo) + (combo >= 3 ? ' · ' + _('charged strike: +{0}%', pct(p.flowerBurst)) : '');
			case 'love': return f.openingUntil > now ? _('love surge: melee +{0}%, guard 15%, {1}s', pct(p.loveBurst), seconds(f.openingUntil)) : _('heal with a consumable to activate love surge.');
			case 'serpent': return f.openingUntil > now && f.openingHits ? _('opening buff: +{0}%, {1}s, {2} melee hits', pct(p.serpentBurst), seconds(f.openingUntil), f.openingHits) : _('bind the enemy to prepare two curved strikes.');
			case 'sun': return _('sun dance: {0}/4 melee hits', combo) + (f.openingUntil > now ? ' · ' + _('timed melee buff: +{0}%, {1}s', pct(p.sunBurst), seconds(f.openingUntil)) : '');
			case 'moon': return (f.thunderReadyAt <= now ? _('charged strike: +{0}%', pct(p.moonBurst)) : _('gathering breath: {0}s', seconds(f.thunderReadyAt)))
				+ (f.wound ? ' · ' + _('sword trace: {0} damage, {1} ticks remaining', f.wound.damage, f.wound.ticks) : '');
			default: return oldStatus();
			}
		};
	}
};
BreathingCultivation.install();
