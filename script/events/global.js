/**
 * 鬼灭之刃 - 全局随机事件（任意模块激活时均可触发）
 **/
Events.Global = [
	{ /* 叛逃的鬼杀队员 - 替换原盗贼事件 */
		title: _('The Deserter'),
		isAvailable: function() {
			return (Engine.activeModule == Room || Engine.activeModule == Outside) && $SM.get('game.thieves') == 1;
		},
		scenes: {
			'start': {
				text: [
					_('the slayers drag a trembling man from the supply room.'),
					_('say he abandoned his post when demons came. let his comrades die.'),
					_('say justice must be served before he escapes into the night.')
				],
				notification: _('a deserter is caught stealing supplies'),
				blink: true,
				buttons: {
					'kill': {
						text: _('cast him out'),
						nextScene: {1: 'exile'}
					},
					'spare': {
						text: _('hear him out'),
						nextScene: {1: 'spare'}
					}
				}
			},
			'exile': {
				text: [
					_('the slayers cast the deserter out into the demon-haunted dark.'),
					_('the missing supplies reappear over the following days, left by those who felt guilt.')
				],
				onLoad: function() {
					$SM.set('game.thieves', 2);
					$SM.remove('income.thieves');
					$SM.addM('stores', $SM.get('game.stolen'));
				},
				buttons: {
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			},
			'spare': {
				text: [
					_('the man weeps. says he watched his family turn to ash before his eyes.'),
					_('says fear took him before reason could. teaches breathing techniques to make amends.')
				],
				onLoad: function() {
					$SM.set('game.thieves', 2);
					$SM.remove('income.thieves');
					$SM.addPerk('kehai dansha');
				},
				buttons: {
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.EVENT_THIEF
	},
	{ /* 铸刀师初音 - 新增事件 */
		title: _('The Swordsmith'),
		isAvailable: function() {
			return (Engine.activeModule == Room || Engine.activeModule == Outside)
				&& $SM.get('stores.iron', true) >= 10
				&& !$SM.get('game.swordsmithVisited');
		},
		scenes: {
			'start': {
				text: [
					_('a swordsmith arrives, wearing a strange gourd-shaped mask.'),
					_('says he heard you\'ve been gathering tamahagane.'),
					_('offers to forge you a proper blade, if the iron is good enough.')
				],
				notification: _('a masked swordsmith comes seeking iron'),
				blink: true,
				buttons: {
					'forge': {
						text: _('give iron'),
						cost: { 'iron': 10 },
						nextScene: {0.7: 'goodBlade', 1: 'rageBlade'}
					},
					'decline': {
						text: _('turn him away'),
						nextScene: 'end'
					}
				}
			},
			'goodBlade': {
				text: [
					_('the swordsmith works through the night, his hammer ringing like a war drum.'),
					_('in the morning, a gleaming blade rests on the forge — a weapon worthy of a slayer.')
				],
				onLoad: function() {
					$SM.set('game.swordsmithVisited', true);
					$SM.add('stores["kou katana"]', 1);
				},
				buttons: {
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			},
			'rageBlade': {
				text: [
					_('the swordsmith shrieks with rage at impurities in the steel.'),
					_('but forges on. the resulting blade hums with restrained fury.')
				],
				onLoad: function() {
					$SM.set('game.swordsmithVisited', true);
					$SM.add('stores["nichirin katana"]', 1);
				},
				buttons: {
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.EVENT_THIEF
	},
	{ /* 鸦传讯 - 新增事件，来自鬼杀队 */
		title: _('The Crow Messenger'),
		isAvailable: function() {
			return (Engine.activeModule == Room || Engine.activeModule == Outside)
				&& $SM.get('features.location.outside');
		},
		scenes: {
			'start': {
				text: [
					_('a crow lands on the windowsill, bearing a message in its talons.'),
					_('the Demon Slayer Corps has marked a dangerous demon in the eastern wilds.'),
					_('eliminate it, or let it hunt.')
				],
				notification: _('a crow arrives with orders from the Corps'),
				blink: true,
				buttons: {
					'accept': {
						text: _('accept mission'),
						nextScene: {0.3: 'crow_lost', 1: 'accepted'}
					},
					'refuse': {
						text: _('ignore the crow'),
						nextScene: 'end'
					}
				}
			},
			'crow_lost': {
				text: [
					_('the crow is found at dawn — broken on the wall, the writ shredded in its talons.'),
					_('whatever provisions the Corps sent were scattered in the night. only scraps remain.'),
					_('this hunt, you go alone.')
				],
				notification: _('the rider crow falls — most of the provisions are lost.'),
				onLoad: function() {
					$SM.set('game.crowMission', true);
					$SM.add('stores["cured meat"]', 2);
				},
				buttons: {
					'leave': {
						text: _('prepare to depart anyway'),
						nextScene: 'end'
					}
				}
			},
			'accepted': {
				text: [
					_('the crow caws once and takes to the sky.'),
					_('the eastern wilds grow more dangerous — but so do the rewards.'),
					_('the Corps sends provisions ahead: cured meat and charms to ward off blood demon art.')
				],
				notification: _('the Corps issues a writ — provisions arrive at your gate.'),
				onLoad: function() {
					$SM.set('game.crowMission', true);
					$SM.add('stores["cured meat"]', 10);
					$SM.add('stores["wisteria charm"]', 2);
					$SM.add('stores.medicine', 1);
				},
				buttons: {
					'leave': {
						text: _('prepare to depart'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.EVENT_THIEF
	},
	{ /* 章 4：刀匠村事件 — workshop 建成后触发一次。
	     紫藤家族分部视角：玩家不是柱，是后方支援；霞柱·无一郎与不死川玄弥并肩。 */
		title: _('Smith Village Under Siege'),
		isAvailable: function() {
			return (Engine.activeModule == Room || Engine.activeModule == Outside)
				&& $SM.get('game.buildings["workshop"]', true) >= 1
				&& !$SM.get('game.swordsmithVillageDone');
		},
		scenes: {
			'start': {
				text: [
					_('a wounded crow lands on the windowsill, ink-black wings limp.'),
					_('its message: the village of swordsmiths is under attack by an upper moon.'),
					_('two pillars are already on their way. they would value any aid.')
				],
				notification: _('a crow brings word: the smithing village burns.'),
				blink: true,
				buttons: {
					'depart': {
						text: _('depart at once'),
						cost: { 'cured meat': 20, 'torch': 2 },
						nextScene: { 1: 'arrive' }
					},
					'refuse': {
						text: _('the path is too long'),
						notification: _('the crow flies onward, silent.'),
						onLoad: function() { $SM.set('game.swordsmithVillageDone', true); },
						nextScene: 'end'
					}
				}
			},
			'arrive': {
				text: [
					_('by the time you arrive, the village square is ash and screams.'),
					_('a teal-haired pillar moves like mist between the rubble — the Mist Hashira, Tokito.'),
					_('a one-eyed slayer eats demon flesh in the corner, breathing hard. Shinazugawa Genya.')
				],
				notification: _('the Mist Pillar and the demon-eater make their stand.'),
				buttons: {
					'fight': {
						text: _('join the fight'),
						nextScene: { 1: 'combat' }
					},
					'support': {
						text: _('hold the rear lines'),
						notification: _('you guard the wounded smiths while the pillars cut through the swarm.'),
						nextScene: { 1: 'aftermath' }
					}
				}
			},
			'combat': {
				combat: true,
				enemy: 'upper four clone',
				enemyName: _('upper moon four · clone'),
				deathMessage: _("one of half-dome's clones dissolves into wisteria-purple mist."),
				chara: '肆',
				damage: 8,
				hit: 0.85,
				attackDelay: 2,
				health: 35,
				ranged: false,
				loot: {
					'teeth': { min: 5, max: 10, chance: 1 },
					'scales': { min: 3, max: 6, chance: 0.8 },
					'wisteria charm': { min: 1, max: 2, chance: 0.5 }
				},
				notification: _("one of half-dome's clones — the wrath of upper moon four — turns on you."),
				buttons: {
					'leave': {
						text: _('press on'),
						nextScene: { 1: 'aftermath' }
					}
				}
			},
			'aftermath': {
				text: [
					_("by dawn the village is silent. the true demon — half-dome's core — has fled."),
					_('an elderly smith emerges from a forge, a freshly tempered blade across his arms.'),
					_('"this one bathed all night in wisteria oil. tested against the upper moon. take it."')
				],
				notification: _('the smith offers you a freshly-bathed nichirin blade.'),
				onLoad: function() {
					$SM.add('stores["nichirin katana"]', 1);
					$SM.set('game.swordsmithVillageDone', true);
				},
				buttons: {
					'gratitude': {
						text: _('bow in gratitude'),
						nextScene: { 1: 'pillar_reward' }
					}
				}
			},
			'pillar_reward': {
				text: [
					_('the Mist Pillar wipes blood from his brow, gazing distantly.'),
					_('"i remembered something just now. i\'ll teach you what i can — about seeing through it all."'),
					_('he traces a line in the air. you feel something settle behind your eyes.')
				],
				notification: _('the Mist Pillar shares the rudiments of mikiri with you.'),
				onLoad: function() {
					if (!$SM.hasPerk('mikiri')) { $SM.addPerk('mikiri'); }
				},
				buttons: {
					'leave': {
						text: _('return home'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.EVENT_WANDERING_MASTER
	},
	{ /* 章 2：真菰幻影 — lodge 建成后触发；传授全集中・常中基础。
	     真菰是手鬼（炭治郎首战的鬼）曾经吃掉的孩子之一，以幻影形式守护后辈鬼杀队员。 */
		title: _('A Faded Memory'),
		isAvailable: function() {
			return (Engine.activeModule == Room || Engine.activeModule == Outside)
				&& $SM.get('game.buildings["lodge"]', true) >= 1
				&& !$SM.get('game.makomoVisionDone');
		},
		scenes: {
			'start': {
				text: [
					_("a girl's laugh drifts from the wisteria grove. high, light, far too innocent for a forest of demons."),
					_('she wears a fox mask and a faded kimono. when you blink she is sitting by the hearth.'),
					_('"i am Makomo," she says. "and you are not breathing correctly."')
				],
				notification: _('a fox-masked girl appears by the hearth — she should not be here.'),
				blink: true,
				buttons: {
					'listen': {
						text: _('sit by the fire'),
						nextScene: { 1: 'training' }
					},
					'ignore': {
						text: _('look away — when you look back, she is gone'),
						notification: _('the fox-masked girl fades like smoke.'),
						onLoad: function() { $SM.set('game.makomoVisionDone', true); },
						nextScene: 'end'
					}
				}
			},
			'training': {
				text: [
					_('she demonstrates the breath: a long inhale, a held breath, a measured release.'),
					_('"total concentration. constant. when even your sleep is breath, your body asks for nothing else."'),
					_('she puts her small hand over yours. it feels warm — and then nothing.')
				],
				notification: _('Makomo guides you through total concentration breathing.'),
				buttons: {
					'food': {
						text: _('learn to forgo food'),
						available: function() { return !$SM.hasPerk('breath no food'); },
						onChoose: function() { $SM.addPerk('breath no food'); },
						nextScene: { 1: 'farewell' }
					},
					'water': {
						text: _('learn to forgo water'),
						available: function() { return !$SM.hasPerk('breath no water'); },
						onChoose: function() { $SM.addPerk('breath no water'); },
						nextScene: { 1: 'farewell' }
					},
					'both': {
						text: _('practice with her until dawn'),
						cost: { 'cured meat': 30, 'torch': 1 },
						available: function() {
							return !$SM.hasPerk('breath no food') || !$SM.hasPerk('breath no water');
						},
						onChoose: function() {
							if (!$SM.hasPerk('breath no food'))  $SM.addPerk('breath no food');
							if (!$SM.hasPerk('breath no water')) $SM.addPerk('breath no water');
						},
						nextScene: { 1: 'farewell' }
					},
					'leave': {
						text: _('thank her and rise'),
						onLoad: function() { $SM.set('game.makomoVisionDone', true); },
						nextScene: 'end'
					}
				}
			},
			'farewell': {
				text: [
					_('when you open your eyes, the hearth is alone.'),
					_('on the floor, where she sat, is a single drop of dew. and a fox mask, no larger than your palm.'),
					_('"a child of the demon king\'s first night," Shinobu murmurs. "they say her name was Makomo."')
				],
				notification: _('the fox mask is small, and very, very cold.'),
				onLoad: function() {
					$SM.set('game.makomoVisionDone', true);
				},
				buttons: {
					'keep': {
						text: _('keep the mask'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.EVENT_MYSTERIOUS_WANDERER
	},
	{ /* 章 7：柱合议 + 柱训练 — 拥有任意蓝图后（玩家已探过 Ravaged Battleship）触发。
	     九柱齐聚紫藤庄园，玩家任选一柱进行训练以补足尚缺的呼吸法。 */
		title: _('The Pillars Convene'),
		isAvailable: function() {
			var bps = $SM.get('character.blueprints');
			var hasAnyBp = bps && Object.keys(bps).length > 0;
			return Engine.activeModule == Room
				&& hasAnyBp
				&& !$SM.get('game.pillarConvocationDone');
		},
		scenes: {
			'start': {
				text: [
					_('the gate creaks open all morning long. one by one they arrive.'),
					_('Tomioka — silent. Rengoku — radiant. Kanroji — flushed. Iguro — coiled.'),
					_('Tokito, Uzui, Himejima, Shinazugawa, and Kocho behind them. all nine of the Hashira, here.'),
					_('"the corps marches on the demon king at the next moonless night," Himejima rumbles.'),
					_('"until then, train with one of us. choose."')
				],
				notification: _('all nine Hashira have gathered at the wisteria estate.'),
				blink: true,
				buttons: {
					'choose': {
						text: _('approach the pillars'),
						nextScene: { 1: 'select' }
					},
					'humble': {
						text: _('"i am only a keeper of this house..."'),
						notification: _('Kocho smiles. "exactly why you must train. there will be no rear left to keep."'),
						nextScene: { 1: 'select' }
					}
				}
			},
			'select': {
				text: [
					_('each Hashira beckons. each offers a distinct path.'),
					_('choose wisely — they will not be free again until the last battle.')
				],
				buttons: {
					'flame': {
						text: _('炎柱・煉獄: train in fierce strikes'),
						cost: { 'cured meat': 50, 'torch': 1 },
						available: function() { return !$SM.hasPerk('slash mastery'); },
						onChoose: function() { $SM.addPerk('slash mastery'); },
						nextScene: { 1: 'thanks' }
					},
					'water': {
						text: _('水柱・富岡: train in flowing stance'),
						cost: { 'cured meat': 50, 'torch': 1 },
						available: function() { return !$SM.hasPerk('step yushin'); },
						onChoose: function() { $SM.addPerk('step yushin'); },
						nextScene: { 1: 'thanks' }
					},
					'mist': {
						text: _('霞柱・時透: train in piercing sight'),
						cost: { 'cured meat': 50, 'torch': 1 },
						available: function() { return !$SM.hasPerk('mikiri'); },
						onChoose: function() { $SM.addPerk('mikiri'); },
						nextScene: { 1: 'thanks' }
					},
					'love': {
						text: _('恋柱・甘露寺: train in nourishment'),
						cost: { 'cured meat': 50, 'torch': 1 },
						available: function() { return !$SM.hasPerk('breath nourish'); },
						onChoose: function() { $SM.addPerk('breath nourish'); },
						nextScene: { 1: 'thanks' }
					},
					'serpent': {
						text: _('蛇柱・伊黑: train in the unseen step'),
						cost: { 'cured meat': 50, 'torch': 1 },
						available: function() { return !$SM.hasPerk('kehai dansha'); },
						onChoose: function() { $SM.addPerk('kehai dansha'); },
						nextScene: { 1: 'thanks' }
					},
					'wind': {
						text: _('风柱・不死川: spar bare-fisted until you bleed'),
						cost: { 'cured meat': 80, 'torch': 1 },
						available: function() { return !$SM.hasPerk('fist form master'); },
						onChoose: function() {
							if (!$SM.hasPerk('fist form one'))    $SM.addPerk('fist form one');
							if (!$SM.hasPerk('fist form four'))   $SM.addPerk('fist form four');
							if (!$SM.hasPerk('fist form master')) $SM.addPerk('fist form master');
						},
						nextScene: { 1: 'thanks' }
					},
					'leave': {
						text: _('bow and decline'),
						onLoad: function() { $SM.set('game.pillarConvocationDone', true); },
						nextScene: 'end'
					}
				}
			},
			'thanks': {
				text: [
					_('they finish at sundown. you can barely stand.'),
					_('"we leave at dawn," Iguro hisses. "see you in the Infinity Castle."'),
					_("one by one they vanish into the wisteria. the estate's air feels thinner without them.")
				],
				notification: _('the Hashira depart for the final descent. you have been trained.'),
				onLoad: function() {
					$SM.set('game.pillarConvocationDone', true);
				},
				buttons: {
					'rest': {
						text: _('tend the hearth'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.EVENT_WANDERING_MASTER
	},
	{ /* 章 6：游郭篇 — 已探完 city 后触发。
	     音柱·宇髓天元 + 三妻（须磨/雏鹤/卷绪）+ 上弦之陆 妓夫太郎/堕姬兄妹。 */
		title: _('The Pleasure District'),
		isAvailable: function() {
			return (Engine.activeModule == Room || Engine.activeModule == Outside)
				&& $SM.get('character.cityCleared')
				&& !$SM.get('game.yoshiwaraDone');
		},
		scenes: {
			'start': {
				text: [
					_('a crow brings urgent word: the Sound Hashira, Uzui Tengen, is pinned in the pleasure quarter.'),
					_('his three wives — disguised as courtesans — have located demons but not yet returned.'),
					_('the upper moon presence is unmistakable. he asks for any able body who can wear a disguise.')
				],
				notification: _('Uzui Tengen calls for aid from the pleasure quarter.'),
				blink: true,
				buttons: {
					'help': {
						text: _('travel to the quarter'),
						cost: { 'cured meat': 30, 'torch': 3, 'wisteria charm': 1 },
						nextScene: { 1: 'wives' }
					},
					'ignore': {
						text: _('decline — the path is no place for a keeper'),
						notification: _('the crow caws once and is gone.'),
						onLoad: function() { $SM.set('game.yoshiwaraDone', true); },
						nextScene: 'end'
					}
				}
			},
			'wives': {
				text: [
					_('the pleasure quarter glitters with paper lanterns and distant screams.'),
					_('Uzui presses a wisteria seal into your palm. "split up. each of my wives is in one of three houses."'),
					_('"find one — any one. then we converge."')
				],
				notification: _('choose which house to search.'),
				buttons: {
					'kyogoku': {
						text: _('the highest-ranked house'),
						nextScene: { 1: 'meet_makio' }
					},
					'ogimoto': {
						text: _('a quieter, older quarter'),
						nextScene: { 1: 'meet_suma' }
					},
					'tokitou': {
						text: _('a backstreet teahouse'),
						nextScene: { 1: 'meet_hinatsuru' }
					}
				}
			},
			'meet_makio': {
				text: [
					_('Makio — one of Uzui\'s wives — is bound but alive. she rips her gag off the moment you cut her free.'),
					_('"the demoness wears the obi of a princess. she eats girls who cannot pay their debts."'),
					_('"she is sister to the male one. they share a head."')
				],
				notification: _('Makio joins you. she knows the upper moon.'),
				buttons: {
					'fight': {
						text: _('hunt the demoness'),
						nextScene: { 1: 'combat' }
					}
				}
			},
			'meet_suma': {
				text: [
					_('Suma is in a closet, weeping, unhurt. she clings to your sleeve and refuses to let go.'),
					_('"i found her. i found the demoness. she\'s so beautiful and so cruel."'),
					_('"please — please let\'s go. Tengen will know what to do."')
				],
				notification: _('Suma joins you, terrified but unbroken.'),
				buttons: {
					'fight': {
						text: _('hunt the demoness'),
						nextScene: { 1: 'combat' }
					}
				}
			},
			'meet_hinatsuru': {
				text: [
					_('Hinatsuru is wounded but composed. she presses a folded paper into your hand.'),
					_('"she has a brother. they share one heart between two bodies."'),
					_('"to slay one is to slay neither. cut them both."')
				],
				notification: _('Hinatsuru joins you, with intelligence on the upper moon\'s nature.'),
				buttons: {
					'fight': {
						text: _('hunt the demoness'),
						nextScene: { 1: 'combat' }
					}
				}
			},
			'combat': {
				combat: true,
				enemy: 'upper six daki',
				enemyName: _('upper moon six · sister'),
				deathMessage: _('the obi-sash demoness scatters into red ribbons of mist.'),
				chara: '陆',
				damage: 10,
				hit: 0.85,
				attackDelay: 2,
				health: 50,
				ranged: false,
				loot: {
					'teeth': { min: 8, max: 15, chance: 1 },
					'scales': { min: 5, max: 10, chance: 1 },
					'wisteria charm': { min: 2, max: 3, chance: 0.8 }
				},
				notification: _('the obi-sash demoness — half of upper moon six — is unleashed.'),
				buttons: {
					'continue': {
						text: _('she dissolves — but is the brother behind her?'),
						nextScene: { 1: 'brother' }
					}
				}
			},
			'brother': {
				combat: true,
				enemy: 'upper six gyutaro',
				enemyName: _('upper moon six · brother'),
				deathMessage: _('the sickle-wielding demon collapses into ash beside his sister.'),
				chara: '陆',
				damage: 14,
				hit: 0.9,
				attackDelay: 2,
				health: 70,
				ranged: true,
				loot: {
					'demon stone': { min: 1, max: 2, chance: 1 },
					'teeth': { min: 10, max: 20, chance: 1 },
					'wisteria oil': { min: 1, max: 2, chance: 0.6 }
				},
				notification: _('he emerges from her shadow — the elder brother, sickles drawn. blood-mist art unfurls.'),
				buttons: {
					'finish': {
						text: _('strike them both at once'),
						nextScene: { 1: 'aftermath' }
					}
				}
			},
			'aftermath': {
				text: [
					_('Uzui crashes through a wall behind you, one hand missing, eyes wild and laughing.'),
					_('"flashy! that\'s flashy as hell. you killed an upper moon."'),
					_('he ruffles your hair with the hand he has left. it leaves blood.'),
					_('"go home, keeper. there are pillars left to die for this. but stay for the breath i\'m about to teach you."')
				],
				notification: _('Uzui — Sound Hashira — survives. he teaches what he can before he retires.'),
				onLoad: function() {
					$SM.set('game.yoshiwaraDone', true);
					if (!$SM.hasPerk('kehai dansha')) { $SM.addPerk('kehai dansha'); }
				},
				buttons: {
					'leave': {
						text: _('return to the wisteria'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.EVENT_WANDERING_MASTER
	},

	{ /* 灾难 1：鬼夜袭村庄 — 低级鬼破墙而入，损失人口和食物 */
		title: _('Demon Raid'),
		isAvailable: function() {
			return (Engine.activeModule == Room || Engine.activeModule == Outside)
				&& $SM.get('game.builder.level') >= 4
				&& $SM.get('game.population', true) >= 15
				&& !$SM.get('game.demonRaidDone');
		},
		scenes: {
			'start': {
				text: [
					_('the watch crow caws frantically before dawn.'),
					_('three lesser demons have torn through the outer fence and reached the storehouses.'),
					_('villagers scatter. the slayers grab whatever blade is nearest.')
				],
				notification: _('lesser demons breach the wisteria gate.'),
				blink: true,
				buttons: {
					'rally': {
						text: _('rally the slayers'),
						cost: { 'cured meat': 20, 'wisteria charm': 1 },
						nextScene: { 0.5: 'rally_loss', 1: 'rally_win' }
					},
					'shelter': {
						text: _('seal the inner gate'),
						nextScene: { 1: 'shelter_loss' }
					}
				}
			},
			'rally_win': {
				text: [
					_('the slayers cut the demons down before sunlight finishes the work.'),
					_('a few villagers are wounded but none have turned.'),
					_('Shinobu collects samples from the ash for her medicine cabinet.')
				],
				notification: _('the raid is repelled. medicine stocks improve.'),
				onLoad: function() {
					$SM.set('game.demonRaidDone', true);
					$SM.add('stores.medicine', 10);
				},
				buttons: {
					'leave': { text: _('clean the courtyard'), nextScene: 'end' }
				}
			},
			'rally_loss': {
				text: [
					_('the slayers are inexperienced. two are bitten before the demons fall.'),
					_('Shinobu drags them inside and works through the night.'),
					_('the bitten are saved, but the food stores were trampled in the fight.')
				],
				notification: _('the raid is repelled, at a cost.'),
				onLoad: function() {
					$SM.set('game.demonRaidDone', true);
					var lost = Math.min(Outside.killVillagers ? 3 : 0, $SM.get('game.population', true));
					if (lost > 0 && typeof Outside.killVillagers === 'function') Outside.killVillagers(lost);
					var meat = $SM.get('stores["cured meat"]', true);
					$SM.set('stores["cured meat"]', Math.max(0, meat - 40));
				},
				buttons: {
					'leave': { text: _('count the dead'), nextScene: 'end' }
				}
			},
			'shelter_loss': {
				text: [
					_('the inner gate holds. the outer ring does not.'),
					_('by dawn the demons have fled, leaving silence and the scent of iron.'),
					_('several villagers were outside the wall when the alarm sounded.')
				],
				notification: _('the wisteria gate holds. the outer ring does not.'),
				onLoad: function() {
					$SM.set('game.demonRaidDone', true);
					if (typeof Outside.killVillagers === 'function') {
						var lost = Math.min(8, $SM.get('game.population', true));
						Outside.killVillagers(lost);
					}
				},
				buttons: {
					'leave': { text: _('mourn the lost'), nextScene: 'end' }
				}
			}
		},
		audio: AudioLibrary.EVENT_THIEF
	},

	{ /* 灾难 2：瘟疫 — 鬼血污染食物链，消耗药品或丧失人口 */
		title: _('A Creeping Sickness'),
		isAvailable: function() {
			return (Engine.activeModule == Room || Engine.activeModule == Outside)
				&& $SM.get('game.builder.level') >= 4
				&& $SM.get('game.population', true) >= 30
				&& $SM.get('stores.medicine', true) >= 10
				&& !$SM.get('game.plagueDone');
		},
		scenes: {
			'start': {
				text: [
					_('Shinobu finds black specks in three villagers\' blood under the lamp.'),
					_('it is not a demon turning, she says. it is something the demons left behind in the well.'),
					_('she can stop it, but she will need a great deal of medicine — and quickly.')
				],
				notification: _('a sickness spreads through the village.'),
				blink: true,
				buttons: {
					'treat': {
						text: _('hand over the medicine'),
						cost: { 'medicine': 25 },
						nextScene: { 1: 'treat_win' }
					},
					'ration': {
						text: _('ration the medicine — save half for emergencies'),
						cost: { 'medicine': 10 },
						nextScene: { 0.4: 'ration_loss', 1: 'ration_win' }
					},
					'ignore': {
						text: _('leave it to nature'),
						nextScene: { 1: 'ignore_loss' }
					}
				}
			},
			'treat_win': {
				text: [
					_('Shinobu works without sleep for three days. all sick villagers recover.'),
					_('she leaves a flask of distilled wisteria oil on your desk in thanks.')
				],
				notification: _('the sickness passes. Shinobu shares her work.'),
				onLoad: function() {
					$SM.set('game.plagueDone', true);
					$SM.add('stores["wisteria oil"]', 3);
				},
				buttons: { 'leave': { text: _('let her rest'), nextScene: 'end' } }
			},
			'ration_win': {
				text: [
					_('the medicine reaches the sick in time. most recover.'),
					_('a handful never wake. the rest of the village goes on.')
				],
				notification: _('the sickness passes — barely.'),
				onLoad: function() {
					$SM.set('game.plagueDone', true);
					if (typeof Outside.killVillagers === 'function') Outside.killVillagers(2);
				},
				buttons: { 'leave': { text: _('bury the dead'), nextScene: 'end' } }
			},
			'ration_loss': {
				text: [
					_('the rationed medicine was not enough. by the time more was sent, the sick were past saving.'),
					_('the surviving villagers withdraw deeper into the estate.')
				],
				notification: _('the sickness takes its share.'),
				onLoad: function() {
					$SM.set('game.plagueDone', true);
					if (typeof Outside.killVillagers === 'function') Outside.killVillagers(8);
				},
				buttons: { 'leave': { text: _('see to the survivors'), nextScene: 'end' } }
			},
			'ignore_loss': {
				text: [
					_('within a week the well is condemned. within two, the lodge is a hospice.'),
					_('Shinobu does what she can with field herbs. it is not enough.')
				],
				notification: _('the sickness eats deep into the village.'),
				onLoad: function() {
					$SM.set('game.plagueDone', true);
					if (typeof Outside.killVillagers === 'function') Outside.killVillagers(15);
				},
				buttons: { 'leave': { text: _('regret it'), nextScene: 'end' } }
			}
		},
		audio: AudioLibrary.EVENT_THIEF
	},

	{ /* 灾难 3：水源污染 — 鬼血流入水脉，损失水储或熏肉 */
		title: _('Tainted Water'),
		isAvailable: function() {
			return (Engine.activeModule == Room || Engine.activeModule == Outside)
				&& $SM.get('game.builder.level') >= 4
				&& $SM.get('stores["cured meat"]', true) >= 40
				&& !$SM.get('game.taintedWaterDone');
		},
		scenes: {
			'start': {
				text: [
					_('the upstream brook runs red at first light.'),
					_('a slayer rides in: a demon was killed two ridges over, and the river carried the rot here.'),
					_('the smokehouse meat that drank that water cannot be saved.')
				],
				notification: _('a demon carcass has tainted the water upstream.'),
				blink: true,
				buttons: {
					'burn': {
						text: _('burn the tainted meat'),
						nextScene: { 1: 'burn_end' }
					},
					'distill': {
						text: _('try to distill it (consumes wood)'),
						cost: { 'wood': 200 },
						nextScene: { 0.6: 'distill_partial', 1: 'distill_win' }
					}
				}
			},
			'burn_end': {
				text: [
					_('the smokehouse goes up in a thick column of greasy smoke.'),
					_('the village will be hungry for a week, but no one will turn.')
				],
				notification: _('the tainted meat is burned. the river clears in days.'),
				onLoad: function() {
					$SM.set('game.taintedWaterDone', true);
					var meat = $SM.get('stores["cured meat"]', true);
					$SM.set('stores["cured meat"]', Math.max(0, meat - 40));
				},
				buttons: { 'leave': { text: _('walk away from the smoke'), nextScene: 'end' } }
			},
			'distill_win': {
				text: [
					_('the wood-fire distillation works. clean water, clean meat.'),
					_('Shinobu salts what is left and stores it again.')
				],
				notification: _('the meat is saved.'),
				onLoad: function() {
					$SM.set('game.taintedWaterDone', true);
					$SM.add('stores["wisteria charm"]', 2);
				},
				buttons: { 'leave': { text: _('thank Shinobu'), nextScene: 'end' } }
			},
			'distill_partial': {
				text: [
					_('the distillation works for most of the smokehouse — about half is still ruined.'),
					_('no one falls sick, but the storage is thin.')
				],
				notification: _('half the meat is saved.'),
				onLoad: function() {
					$SM.set('game.taintedWaterDone', true);
					var meat = $SM.get('stores["cured meat"]', true);
					$SM.set('stores["cured meat"]', Math.max(0, meat - 20));
				},
				buttons: { 'leave': { text: _('be grateful'), nextScene: 'end' } }
			}
		},
		audio: AudioLibrary.EVENT_THIEF
	}
];

