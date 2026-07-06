/**
 * Events that only occur at specific times. Launched manually.
 **/
Events.Setpieces = {
	"outpost": { /* 藤花屋敷 - Wisteria Mansion safe house */
		title: _('Wisteria Mansion'),
		scenes: {
			'start': {
				text: [
					_('a wisteria-covered mansion stands here, its purple blooms keeping demons at bay.'),
					_('a Butterfly Estate servant bows in greeting. a safe haven in the demon-haunted wilds.')
				],
				notification: _('a wisteria mansion offers refuge from the demon night.'),
				loot: {
					'cured meat': {
						min: 5,
						max: 10,
						chance: 1
					}
				},
				onLoad: function() {
					World.useOutpost();
				},
				buttons: {
					'leave': {
						text: _('leave'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_FRIENDLY_OUTPOST
	},
	"swamp": { /* 那田蜘蛛山 - Natagumo Mountain（章 3 扩展版）
	     累（下弦之伍）的"家族"幻象 → 与累对战 → 富冈+胡蝶赶到 → 老刀匠遗孤的余韵 */
		title: _('Natagumo Mountain'),
		scenes: {
			'start': {
				text: [
					_('spider webs thick as rope stretch between the ancient trees.'),
					_('the mountain reeks of demon blood art. something powerful lives here.'),
					_('between the webs you see — a house. and through its papered windows, a family at supper.')
				],
				notification: _('Natagumo Mountain, where spider demons hold dominion.'),
				buttons: {
					'enter': {
						text: _('approach the house'),
						nextScene: { 1: 'family' }
					},
					'leave': {
						text: _('retreat'),
						nextScene: 'end'
					}
				}
			},
			'family': {
				text: [
					_('inside, a "father" and "mother" sit at a low table. between them, a small child with web-like hair.'),
					_('they do not eat. they do not speak. they breathe in unison — too quickly, too shallowly.'),
					_('the child smiles at you. his eyes are old.')
				],
				notification: _('a family of demons mimics human ritual.'),
				buttons: {
					'shatter': {
						text: _('shatter the illusion'),
						nextScene: { 1: 'rui' }
					},
					'observe': {
						text: _('observe in silence'),
						nextScene: { 1: 'rui_speaks' }
					},
					'flee': {
						text: _('back away'),
						nextScene: 'end'
					}
				}
			},
			'rui_speaks': {
				text: [
					_('the child notices you. "you do not belong in this family. but stay — i will let you live, if you take a role."'),
					_('"i need a sister. you can be my sister."'),
					_('"my real one was not strong enough."')
				],
				notification: _('Rui — Lower Moon Five — offers you a seat at his table.'),
				buttons: {
					'refuse': {
						text: _('refuse — strike instead'),
						nextScene: { 1: 'rui' }
					}
				}
			},
			'rui': {
				combat: true,
				enemy: 'lower five rui',
				enemyName: _('lower moon five · Rui'),
				deathMessage: _('Rui dissolves into thread, then smoke.'),
				chara: '伍',
				damage: 12,
				hit: 0.9,
				attackDelay: 2,
				health: 40,
				ranged: true,
				loot: {
					'teeth':          { min: 5, max: 10, chance: 1 },
					'wisteria charm': { min: 1, max: 2,  chance: 0.7 },
					'cloth':          { min: 5, max: 10, chance: 0.5 }
				},
				notification: _("Rui's threads slice between trees, severing trunks like reeds."),
				buttons: {
					'continue': {
						text: _('blood threads close around your neck...'),
						nextScene: { 1: 'pillars' }
					}
				}
			},
			'pillars': {
				text: [
					_('a wisteria-blue blade falls between you and the threads. they unravel like silk on a knife.'),
					_('Tomioka, Water Pillar. behind him — Kocho, Insect Pillar, kerchief drawn over her mouth.'),
					_('"the kid had bad parents," Tomioka says quietly. "the same as me."'),
					_('Kocho kneels by the dissolving body. she stays until there is nothing left to kneel beside.')
				],
				notification: _('the Water and Insect Pillars arrive.'),
				buttons: {
					'continue': {
						text: _('listen to what they say'),
						nextScene: { 1: 'aftermath' }
					}
				}
			},
			'aftermath': {
				text: [
					_('Kocho turns to you. "the body in the corner — the one you did not see — was a swordsmith."'),
					_('"he survived three nights bound here. he taught me a forging trick before he died."'),
					_('"i will teach it to you. you will need it." she touches your sternum, then your forehead.'),
					_('she leaves a small vial of pale liquid. "this too. wisteria. it will keep you on your feet."')
				],
				notification: _('Kocho teaches you the rudiments of demon-flesh nourishment.'),
				onLoad: function() {
					if (!$SM.hasPerk('breath nourish')) { $SM.addPerk('breath nourish'); }
					$SM.add('stores["wisteria oil"]', 2);
					World.markVisited(World.curPos[0], World.curPos[1]);
				},
				buttons: {
					'leave': {
						text: _('descend the mountain'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_SWAMP
	},
	"cave": { /* 无限城入口 - Infinity Castle entrance */
		title: _('Infinity Castle Entrance'),
		scenes: {
			'start': {
				text: [
					_('the cave entrance spirals downward in impossible geometric patterns.'),
					_('this is where Muzan hides his fortress  Ethe Infinity Castle.')
				],
				notification: _('the earth cracks open, revealing a path to the Infinity Castle'),
				buttons: {
					'enter': {
						text: _('descend'),
						cost: { torch: 1 },
						nextScene: {0.3: 'a1', 0.6: 'a2', 1: 'a3'}
					},
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			},
			
			'a1': {
				combat: true,
				enemy: 'lost demon',
				chara: 'R',
				damage: 1,
				hit: 0.8,
				attackDelay: 1,
				health: 5,
				notification: _('a lost demon lunges from the shadows'),
				loot: {
					'fur': {
						min: 1,
						max: 10,
						chance: 1
					},
					'teeth': {
						min: 1,
						max: 5,
						chance: 0.8
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'b1', 1: 'b2'}
					},
					'leave': {
						text: _('leave castle'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'a2': {
				text: [
					_('the corridors twist in impossible angles, defying gravity.'),
					_("spider webs glisten between the pillars")
				],
				buttons: {
					'continue': {
						text: _('squeeze'),
						nextScene: {0.5: 'b2', 1: 'b3'}
					},
					'leave': {
						text: _('leave castle'),
						nextScene: 'end'
					}
				}
			},
			'a3': {
				text: [
					_('the remains of a slain demon corps member rest in a corner.'),
					_('their blade lies nearby, still sharp.')
				],
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 1
					},
					'torch': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'leather': {
						min: 1,
						max: 5,
						chance: 0.3
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'b3', 1: 'b4'}
					},
					'leave': {
						text: _('leave castle'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'b1': {
				text: [
					_('the body of a demon slayer lies in a small chamber.'),
					_("their uniform is torn, their crow messenger long silent."),
					_("a nichirin blade still rests in their hand.")
				],
				loot: {
					'kou katana': {
						min: 1,
						max: 1,
						chance: 1
					},
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'torch': {
						min: 1,
						max: 3,
						chance: 0.5
					},
					'medicine': {
					min: 1,
					max: 2,
					chance: 0.1
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: { 1: 'c1' }
					},
					'leave': {
						text: _('leave castle'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'b2': {
				text: [
					_('blood demon art fills the corridor  Ethe torchlight bends and dims.'),
					_('the darkness becomes absolute')
				],
				notification: _('demon art extinguishes the torch'),
				buttons: {
					'continue': {
						text: _('continue'),
						cost: {'torch': 1},
						nextScene: { 1: 'c1' }
					},
					'leave': {
						text: _('leave castle'),
						nextScene: 'end'
					}
				}
			},
			'b3': {
				combat: true,
				enemy: 'demon guard',
				chara: 'R',
				damage: 2,
				hit: 0.8,
				attackDelay: 1,
				health: 8,
				notification: _('a demon guard blocks the winding passage'),
				loot: {
					'fur': {
						min: 1,
						max: 3,
						chance: 1
					},
					'teeth': {
						min: 1,
						max: 2,
						chance: 0.8
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'c2'}
					},
					'leave': {
						text: _('leave castle'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'b4': {
				combat: true,
				enemy: 'spider demon',
				chara: 'R',
				damage: 3,
				hit: 0.8,
				attackDelay: 2,
				health: 8,
				notification: _('a spider demon drops from the ceiling'),
				loot: {
					'scales': {
						min: 1,
						max: 3,
						chance: 1
					},
					'teeth': {
						min: 1,
						max: 2,
						chance: 0.8
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'c2'}
					},
					'leave': {
						text: _('leave castle'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'c1': {
				combat: true,
				enemy: 'blood demon',
				chara: 'R',
				damage: 4,
				hit: 0.8,
				attackDelay: 2,
				health: 12,
				notification: _('a blood demon surges forward with crimson tendrils'),
				loot: {
					'fur': {
						min: 1,
						max: 3,
						chance: 1
					},
					'teeth': {
						min: 1,
						max: 3,
						chance: 1
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'end1', 1: 'end2'}
					},
					'leave': {
						text: _('leave castle'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'c2': {
				combat: true,
				enemy: 'bone demon',
				chara: 'T',
				damage: 4,
				hit: 0.8,
				attackDelay: 2,
				health: 12,
				notification: _('a bone demon shambles forward, joints cracking'),
				loot: {
					'scales': {
						min: 1,
						max: 3,
						chance: 1
					},
					'teeth': {
						min: 1,
						max: 3,
						chance: 1
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.7: 'end2', 1: 'end3'}
					},
					'leave': {
						text: _('leave castle'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'end1': {
				text: [
					_('the demon\'s lair holds trophies from its victims.')
				],
				onLoad: function() {
					World.clearDungeon();
				},
				loot: {
					'meat': {
						min: 5,
						max: 10,
						chance: 1
					},
					'fur': {
						min: 5,
						max: 10,
						chance: 1
					},
					'scales': {
						min: 5,
						max: 10,
						chance: 1
					},
					'teeth': {
						min: 5,
						max: 10,
						chance: 1
					},
					'cloth': {
						min: 5,
						max: 10,
						chance: 0.5
					}
				},
				buttons: {
					'leave': {
						text: _('leave castle'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'end2': {
				text: [
					_('a hidden armory used by Muzan\'s servants is tucked in the deep chamber.')
				],
				loot: {
					'cloth': {
						min: 5,
						max: 10,
						chance: 1
					},
					'leather': {
						min: 5,
						max: 10,
						chance: 1
					},
					'iron': {
						min: 5,
						max: 10,
						chance: 1
					},
					'cured meat': {
						min: 5,
						max: 10,
						chance: 1
					},
					'steel': {
						min: 5,
						max: 10,
						chance: 0.5
					},
					'kusarigama': {
						min: 1,
						max: 3,
						chance: 0.3
					},
					'medicine': {
						min: 1,
						max: 4,
						chance: 0.15
					}
				},
				onLoad: function() {
					World.clearDungeon();
				},
				buttons: {
					'leave': {
						text: _('leave castle'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'end3': {
				text: [
					_('a demon corps cache is wedged in the chamber wall, sealed with a wisteria crest.')
				],
				loot: {
					'nichirin katana': {
						min: 1,
						max: 1,
						chance: 1
					},
					'kusarigama': {
						min: 1,
						max: 3,
						chance: 0.5
					},
					'medicine': {
						min: 1,
						max: 3,
						chance: 0.3
					}
				},
				onLoad: function() {
					World.clearDungeon();
				},
				buttons: {
					'leave': {
						text: _('leave castle'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_CAVE
	},
	"town": { /* 游郭 - Entertainment District */
		title: _('The Entertainment District'),
		scenes: {
			'start': {
				text: [
					_('lanterns still flicker in the ruined entertainment district.'),
					_('demons have made it their hunting ground, preying on those who wander in alone.')
				],
				notification: _("the entertainment district, where demons hunt in the dark"),
				buttons: {
					'enter': {
						text: _('explore'),
						nextScene: {0.3: 'a1', 0.7: 'a3', 1: 'a2'}
					},
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			},
			
			'a1': {
				text: [
					_("where the windows of the schoolhouse aren't shattered, they're blackened with soot."),
					_('the double doors creak endlessly in the wind.')
				],
				buttons: {
					'enter': {
						text: _('enter'),
						nextScene: {0.5: 'b1', 1: 'b2'},
						cost: {torch: 1}
					},
					'leave': {
						text: _('leave town'),
						nextScene: 'end'
					}
				}
			},
			
			'a2': {
				combat: true,
				enemy: 'thug',
				chara: 'E',
				damage: 4,
				hit: 0.8,
				attackDelay: 2,
				health: 30,
				loot: {
					'cloth': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'leather': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.5
					}
				},
				notification: _('ambushed on the street.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'b3', 1: 'b4'}
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'a3': {
				text: [
					_("a squat building up ahead."),
					_('a green cross barely visible behind grimy windows.')
				],
				buttons: {
					'enter': {
						text: _('enter'),
						nextScene: {0.5: 'b5', 1: 'end5'},
						cost: {torch: 1}
					},
					'leave': {
						text: _('leave town'),
						nextScene: 'end'
					}
				}
			},
			'b1': {
				text: [
					_('a small cache of supplies is tucked inside a rusting locker.')
				],
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 1
					},
					'torch': {
						min: 1,
						max: 3,
						chance: 0.8
					},
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 0.3
					},
					'medicine': {
						min: 1,
						max: 3,
						chance: 0.05
					}
			},
			buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'c1', 1: 'c2'}
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'b2': {
				combat: true,
				enemy: 'scavenger',
				chara: 'E',
				damage: 4,
				hit: 0.8,
				attackDelay: 2,
				health: 30,
				loot: {
					'cloth': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'leather': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.5
					}
				},
				notification: _('a scavenger waits just inside the door.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'c2', 1: 'c3'}
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'b3': {
				combat: true,
				enemy: 'beast',
				chara: 'R',
				damage: 3,
				hit: 0.8,
				attackDelay: 1,
				health: 25,
				loot: {
					'teeth': {
						min: 1,
						max: 5,
						chance: 1
					},
					'fur': {
						min: 5,
						max: 10,
						chance: 1
					}
				},
				notification: _('a beast stands alone in an overgrown park.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'c4', 1: 'c5'}
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'b4': {
				text: [
					_('an overturned caravan is spread across the pockmarked street.'),
					_("it's been picked over by scavengers, but there's still some things worth taking.")
				],
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'torch': {
						min: 1,
						max: 3,
						chance: 0.5
					},
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 0.3
					},
					'medicine': {
						min: 1,
						max: 3,
						chance: 0.1
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'c5', 1: 'c6' }
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'b5': {
				combat: true,
				enemy: 'madman',
				chara: 'E',
				damage: 6,
				hit: 0.3,
				attackDelay: 1,
				health: 10,
				loot: {
					'cloth': {
						min: 2,
						max: 4,
						chance: 0.3
					},
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.9
					},
					'medicine': {
						min: 1,
						max: 2,
						chance: 0.4
					}
				},
				notification: _('a madman attacks, screeching.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.3: 'end5', 1: 'end6'}
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'c1': {
				combat: true,
				enemy: 'thug',
				chara: 'E',
				damage: 4,
				hit: 0.8,
				attackDelay: 2,
				health: 30,
				loot: {
					'cloth': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'leather': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.5
					}
				},
				notification: _('a thug moves out of the shadows.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'd1'}
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'c2': {
				combat: true,
				enemy: 'beast',
				chara: 'R',
				damage: 3,
				hit: 0.8,
				attackDelay: 1,
				health: 25,
				loot: {
					'teeth': {
						min: 1,
						max: 5,
						chance: 1
					},
					'fur': {
						min: 5,
						max: 10,
						chance: 1
					}
				},
				notification: _('a beast charges out of a ransacked classroom.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'd1'}
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'c3': {
				text: [
					_('through the large gymnasium doors, footsteps can be heard.'),
					_('the torchlight casts a flickering glow down the hallway.'),
					_('the footsteps stop.')
				],
				buttons: {
					'continue': {
						text: _('enter'),
						nextScene: {1: 'd1'}
					},
					'leave': {
						text: _('leave town'),
						nextScene: 'end'
					}
				}
			},
			'c4': {
				combat: true,
				enemy: 'beast',
				chara: 'R',
				damage: 4,
				hit: 0.8,
				attackDelay: 1,
				health: 25,
				loot: {
					'teeth': {
						min: 1,
						max: 5,
						chance: 1
					},
					'fur': {
						min: 5,
						max: 10,
						chance: 1
					}
				},
				notification: _('another beast, draw by the noise, leaps out of a copse of trees.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'd2'}
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'c5': {
				text: [
					_("something's causing a commotion a ways down the road."),
					_("a fight, maybe.")
				],
				buttons: {
					'continue': {
						text: _('continue'),
						nextScene: {1: 'd2'}
					},
					'leave': {
						text: _('leave town'),
						nextScene: 'end'
					}
				}
			},
			'c6': {
				text: [
					_('a small basket of food is hidden under a park bench, with a note attached.'),
					_("can't read the words.")
				],
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 1
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'd2'}
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'd1': {
				combat: true,
				enemy: 'scavenger',
				chara: 'E',
				damage: 5,
				hit: 0.8,
				attackDelay: 2,
				health: 30,
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 1
					},
					'leather': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'nichirin katana': {
						min: 1,
						max: 1,
						chance: 0.5
					}
				},
				notification: _('a panicked scavenger bursts through the door, screaming.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'end1', 1: 'end2'}
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'd2': {
				combat: true,
				enemy: 'vigilante',
				chara: 'D',
				damage: 6,
				hit: 0.8,
				attackDelay: 2,
				health: 30,
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 1
					},
					'leather': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'nichirin katana': {
						min: 1,
						max: 1,
						chance: 0.5
					}
				},
				notification: _("a man stands over a dead wanderer. notices he's not alone."),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'end3', 1: 'end4'}
					},
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'end1': {
				text: [
					_('scavenger had a small camp in the school.'),
					_('collected scraps spread across the floor like they fell from heaven.')
				],
				onLoad: function() {
					World.clearDungeon();
				},
				loot: {
					'nichirin katana': {
						min: 1,
						max: 1,
						chance: 1
					},
					'steel': {
						min: 5,
						max: 10,
						chance: 1
					},
					'cured meat': {
						min: 5,
						max: 10,
						chance: 1
					},
					'kusarigama': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'medicine': {
						min: 1,
						max: 2,
						chance: 0.3
					}
				},
				buttons: {
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'end2': {
				text: [
					_("scavenger'd been looking for supplies in here, it seems."),
					_("a shame to let what he'd found go to waste.")
				],
				onLoad: function() {
					World.clearDungeon();
				},
				loot: {
					'coal': {
						min: 5,
						max: 10,
						chance: 1
					},
					'cured meat': {
						min: 5,
						max: 10,
						chance: 1
					},
					'leather': {
						min: 5,
						max: 10,
						chance: 1
					}
				},
				buttons: {
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'end3': {
				text: [
					_("beneath the wanderer's rags, clutched in one of its many hands, a glint of steel."),
					_("worth killing for, it seems.")
				],
				onLoad: function() {
					World.clearDungeon();
				},
				loot: {
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 1
					},
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 1
					}
				},
				buttons: {
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'end4': {
				text: [
					_("eye for an eye seems fair."),
					_("always worked before, at least."),
					_("picking the bones finds some useful trinkets.")
				],
				onLoad: function() {
					World.clearDungeon();
				},
				loot: {
					'cured meat': {
						min: 5,
						max: 10,
						chance: 1
					},
					'iron': {
						min: 5,
						max: 10,
						chance: 1
					},
					'torch': {
						min: 1,
						max: 5,
						chance: 1
					},
					'kusarigama': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'medicine': {
					min: 1,
					max: 2,
					chance: 0.1
					}
				},
				buttons: {
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'end5': {
				text: [
					_('some medicine abandoned in the drawers.')
				],
				onLoad: function() {
					World.clearDungeon();
				},
				loot: {
					'medicine': {
						min: 2,
						max: 5,
						chance: 1
					}
				},
				buttons: {
					'leave': {
						text: _('leave town'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'end6': {
				text: [
					_('the clinic has been ransacked.'),
					_('only dust and stains remain.')
				],
				onLoad: function() {
					World.clearDungeon();
				},
				buttons: {
					'leave': {
						text: _('leave town'),

						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_TOWN
	},
	"city": { /* 刀匠之里 - Swordsmith Village */
		title: _('A Ruined City'),
		scenes: {
			'start': {
				text: [
					_('a battered highway sign stands guard at the entrance to this once-great city.'),
					_("the towers that haven't crumbled jut from the landscape like the ribcage of some ancient beast."),
					_('might be things worth having still inside.')
				],
				notification: _("the towers of a decaying city dominate the skyline"),
				buttons: {
					'enter': {
						text: _('explore'),
						nextScene: {0.2: 'a1', 0.5: 'a2', 0.8: 'a3', 1: 'a4'}
					},
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			},
			'a1': {
				text:[
					_('the streets are empty.'),
					_('the air is filled with dust, driven relentlessly by the hard winds.')
				],
				buttons: {
					'continue': {
						text: _('continue'),
						nextScene: {0.5: 'b1', 1: 'b2'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			'a2': {
				text:[
					_('orange traffic cones are set across the street, faded and cracked.'),
					_('lights flash through the alleys between buildings.')
				],
				buttons: {
					'continue': {
						text: _('continue'),
						nextScene: {0.5: 'b3', 1: 'b4'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			'a3': {
				text: [
					_('a large shanty town sprawls across the streets.'),
					_('faces, darkened by soot and blood, stare out from crooked huts.')
				],
				buttons: {
					'continue': {
						text: _('continue'),
						nextScene: {0.5: 'b5', 1: 'b6'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			'a4': {
				text: [
					_('the shell of an abandoned hospital looms ahead.')
				],
				buttons: {
					'enter': {
						text: _('enter'),
						cost: { 'torch': 1 },
						nextScene: {0.5: 'b7', 1: 'b8'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			'b1': {
				text: [
					_('the old tower seems mostly intact.'),
					_('the shell of a burned out car blocks the entrance.'),
					_('most of the windows at ground level are busted anyway.')
				],
				buttons: {
					'enter': {
						text: _('enter'),
						nextScene: {0.5: 'c1', 1: 'c2'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			'b2': {
				combat: true,
				notification: _('a huge lizard scrambles up out of the darkness of an old well shaft.'),
				enemy: 'lizard',
				chara: 'R',
				damage: 5,
				hit: 0.8,
				attackDelay: 2,
				health: 20,
				loot: {
					'scales': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'teeth': {
						min: 5,
						max: 10,
						chance: 0.5
					},
					'meat': {
						min: 5,
						max: 10,
						chance: 0.8
					}
				},
				buttons: {
					'descend': {
						text: _('descend'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'c2', 1: 'c3'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'b3': {
				notification: _('the shot echoes in the empty street.'),
				combat: true,
				enemy: 'sniper',
				chara: 'D',
				damage: 15,
				hit: 0.8,
				attackDelay: 4,
				health: 30,
				ranged: true,
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 0.2
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'c4', 1: 'c5'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'b4': {
				notification: _('the soldier steps out from between the buildings, rifle raised.'),
				combat: true,
				enemy: 'soldier',
				ranged: true,
				chara: 'D',
				damage: 8,
				hit: 0.8,
				attackDelay: 2,
				health: 50,
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 0.2
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'c5', 1: 'c6'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'b5': {
				notification: _('a frail man stands defiantly, blocking the path.'),
				combat: true,
				enemy: 'frail man',
				chara: 'E',
				damage: 1,
				hit: 0.8,
				attackDelay: 2,
				health: 10,
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'cloth': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'leather': {
						min: 1,
						max: 1,
						chance: 0.2
					},
					'medicine': {
						min: 1,
						max: 3,
						chance: 0.05
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'c7', 1: 'c8'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'b6': {
				text: [
					_('nothing but downcast eyes.'),
					_('the people here were broken a long time ago.')
				],
				buttons: {
					'continue': {
						text: _('continue'),
						nextScene: {0.5: 'c8', 1: 'c9'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			'b7': {
				text: [
					_('empty corridors.'),
					_('the place has been swept clean by scavengers.')
				],
				buttons: {
					'continue': {
						text: _('continue'),
						nextScene: {0.3: 'c12', 0.7: 'c10', 1: 'c11'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			'b8': {
				notification: _('an old man bursts through a door, wielding a scalpel.'),
				combat: true,
				enemy: 'old man',
				chara: 'E',
				damage: 3,
				hit: 0.5,
				attackDelay: 2,
				health: 10,
				loot: {
					'cured meat': {
						min: 1,
						max: 3,
						chance: 0.5
					},
					'cloth': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'medicine': {
						min: 1,
						max: 2,
						chance: 0.5
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.3: 'c13', 0.7: 'c11', 1: 'end15'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'c1': {
				notification: _('a thug is waiting on the other side of the wall.'),
				combat: true,
				enemy: 'thug',
				chara: 'E',
				damage: 3,
				hit: 0.8,
				attackDelay: 2,
				health: 30,
				loot: {
					'nichirin katana': {
						min: 1,
						max: 1,
						chance: 0.5
					},
					'cured meat': {
						min: 1,
						max: 3,
						chance: 0.5
					},
					'cloth': {
						min: 1,
						max: 5,
						chance: 0.8
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'd1', 1: 'd2'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'c2': {
				notification: _('a snarling beast jumps out from behind a car.'),
				combat: true,
				enemy: 'beast',
				chara: 'R',
				damage: 2,
				hit: 0.8,
				attackDelay: 1,
				health: 30,
				loot: {
					'meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'fur': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'teeth': {
						min: 1,
						max: 5,
						chance: 0.5
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'd2'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'c3': {
				text: [
					_('the boards above the old stone landing are blown away.'),
					_('lets some light down into the dusty haze.'),
					_('a sound comes from the tunnel, just ahead.')
				],
				buttons: {
					'enter': {
						text: _('investigate'),
						cost: { 'torch': 1 },
						nextScene: {0.5: 'd2', 1: 'd3'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			
			'c4': {
				text: [
					_('looks like a camp of sorts up ahead.'),
                    /// TRANSLATORS : chainlink is a type of metal fence.
					_('rusted chainlink is pulled across an alleyway.'),
					_('fires burn in the courtyard beyond.')
				],
				buttons: {
					'enter': {
						text: _('continue'),
						nextScene: {0.5: 'd4', 1: 'd5'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			
			'c5': {
				text: [
					_('more voices can be heard ahead.'),
					_('they must be here for a reason.')
				],
				buttons: {
					'enter': {
						text: _('continue'),
						nextScene: {1: 'd5'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			
			'c6': {
				text: [
					_('the sound of gunfire carries on the wind.'),
					_('the street ahead glows with firelight.')
				],
				buttons: {
					'enter': {
						text: _('continue'),
						nextScene: {0.5: 'd5', 1: 'd6'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			
			'c7': {
				text: [
                    /// TRANSLATORS : squatters occupy abandoned dwellings they don't own.
					_('more squatters are crowding around now.'),
					_('someone throws a stone.')
				],
				buttons: {
					'enter': {
						text: _('continue'),
						nextScene: {0.5: 'd7', 1: 'd8'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			
			'c8': {
				text: [
					_('an improvised shop is set up on the sidewalk.'),
					_('the owner stands by, stoic.')
				],
				loot: {
					'nichirin katana': {
						min: 1,
						max: 1,
						chance: 0.8
					},
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 0.5
					},
					'wisteria bullet': {
						min: 1,
						max: 8,
						chance: 0.25
					},
					'demon stone': {
						min: 1,
						max: 1,
						chance: 0.01
					},
					'medicine': {
						min: 1,
						max: 4,
						chance: 0.5
					}
				},
				buttons: {
					'enter': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'd8'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'c9': {
				text: [
					_('strips of meat hang drying by the side of the street.'),
					_('the people back away, avoiding eye contact.')
				],
				loot: {
					'cured meat': {
						min: 5,
						max: 10,
						chance: 1
					}
				},
				buttons: {
					'enter': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'd8', 1: 'd9'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'c10': {
				text: [
					_('someone has locked and barricaded the door to this operating theatre.')
				],
				buttons: {
					'enter': {
						text: _('continue'),
						nextScene: {0.2: 'end12', 0.6: 'd10', 1: 'd11'}
					},
					'leave': {
						text: _('leave city'),
						nextScene: 'end'
					}
				}
			},
			
			'c11': {
				notification: _('a tribe of elderly squatters is camped out in this ward.'),
				combat: true,
				enemy: 'squatters',
				plural: true,
				chara: 'EEE',
				damage: 2,
				hit: 0.7,
				attackDelay: 0.5,
				health: 40,
				loot: {
					'cured meat': {
						min: 1,
						max: 3,
						chance: 0.5
					},
					'cloth': {
						min: 3,
						max: 8,
						chance: 0.8
					},
					'medicine': {
						min: 1,
						max: 3,
						chance: 0.3
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: { 1: 'end10' }
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'c12': {
				notification: _('a pack of lizards rounds the corner.'),
				combat: true,
				enemy: 'lizards',
				plural: true,
				chara: 'RRR',
				damage: 4,
				hit: 0.7,
				attackDelay: 0.7,
				health: 30,
				loot: {
					'meat': {
						min: 3,
						max: 8,
						chance: 1
					},
					'teeth': {
						min: 2,
						max: 4,
						chance: 1
					},
					'scales': {
						min: 3,
						max: 5,
						chance: 1
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: { 1: 'end10' }
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'c13': {
				text: [
					_('strips of meat are hung up to dry in this ward.')
				],
				loot: {
					'cured meat': {
						min: 3,
						max: 10,
						chance: 1
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: { 0.5: 'end10', 1: 'end11' }
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
						
			'd1': {
				notification: _('a large bird nests at the top of the stairs.'),
				combat: true,
				enemy: 'bird',
				chara: 'R',
				damage: 5,
				hit: 0.7,
				attackDelay: 1,
				health: 45,
				loot: {
					'meat': {
						min: 5,
						max: 10,
						chance: 0.8
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'end1', 1: 'end2'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'd2': {
				text: [
					_("the debris is denser here."),
					_("maybe some useful stuff in the rubble.")
				],
				loot: {
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'steel': {
						min: 1,
						max: 10,
						chance: 0.8
					},
					'demon stone': {
						min: 1,
						max: 1,
						chance: 0.01
					},
					'cloth': {
						min: 1,
						max: 10,
						chance: 1
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'end2'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'd3': {
				notification: _('a swarm of rats rushes up the tunnel.'),
				combat: true,
				enemy: 'rats',
				plural: true,
				chara: 'RRR',
				damage: 1,
				hit: 0.8,
				attackDelay: 0.25,
				health: 60,
				loot: {
					'fur': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'teeth': {
						min: 5,
						max: 10,
						chance: 0.5
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'end2', 1: 'end3'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'd4': {
				notification: _('a large man attacks, waving a bayonet.'),
				combat: true,
				enemy: 'veteran',
				chara: 'D',
				damage: 6,
				hit: 0.8,
				attackDelay: 2,
				health: 45,
				loot: {
					'nichirin spear': {
						min: 1,
						max: 1,
						chance: 0.5
					},
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'end4', 1: 'end5'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'd5': {
				notification: _('a second soldier opens fire.'),
				combat: true,
				enemy: 'soldier',
				ranged: true,
				chara: 'D',
				damage: 8,
				hit: 0.8,
				attackDelay: 2,
				health: 50,
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 0.2
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'end5'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'd6': {
				notification: _('a masked soldier rounds the corner, gun drawn'),
				combat: true,
				enemy: 'commando',
				chara: 'D',
				ranged: true,
				damage: 3,
				hit: 0.9,
				attackDelay: 2,
				health: 55,
				loot: {
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 0.5
					},
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'end5', 1: 'end6'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'd7': {
				notification: _('the crowd surges forward.'),
				combat: true,
				enemy: 'squatters',
				plural: true,
				chara: 'EEE',
				damage: 2,
				hit: 0.7,
				attackDelay: 0.5,
				health: 40,
				loot: {
					'cloth': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'teeth': {
						min: 1,
						max: 5,
						chance: 0.5
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'end7', 1: 'end8'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'd8': {
				notification: _('a youth lashes out with a tree branch.'),
				combat: true,
				enemy: 'youth',
				chara: 'E',
				damage: 2,
				hit: 0.7,
				attackDelay: 1,
				health: 45,
				loot: {
					'cloth': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'teeth': {
						min: 1,
						max: 5,
						chance: 0.5
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'end8'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'd9': {
				notification: _('a squatter stands firmly in the doorway of a small hut.'),
				combat: true,
				enemy: 'squatter',
				chara: 'E',
				damage: 3,
				hit: 0.8,
				attackDelay: 2,
				health: 20,
				loot: {
					'cloth': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'teeth': {
						min: 1,
						max: 5,
						chance: 0.5
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {0.5: 'end8', 1: 'end9'}
					},
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'd10': {
				notification: _('behind the door, a deformed figure awakes and attacks.'),
				combat: true,
				enemy: 'deformed',
				chara: 'T',
				damage: 8,
				hit: 0.6,
				attackDelay: 2,
				health: 40,
				loot: {
					'cloth': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'teeth': {
						min: 2,
						max: 2,
						chance: 1
					},
					'steel': {
						min: 1,
						max: 3,
						chance: 0.6
					},
					'scales': {
						min: 2,
						max: 3,
						chance: 0.1
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'end14'}
					}
				}
			},
			
			'd11': {
				notification: _('as soon as the door is open a little bit, hundreds of tentacles erupt.'),
				combat: true,
				enemy: 'tentacles',
				plural: true,
				chara: 'TTT',
				damage: 2,
				hit: 0.6,
				attackDelay: 0.5,
				health: 60,
				loot: {
					'meat': {
						min: 10,
						max: 20,
						chance: 1
					}
				},
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: {1: 'end13'}
					}
				}
			},
		
			'end1': {
				text: [
					_('bird must have liked shiney things.'),
					_('some good stuff woven into its nest.')
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'wisteria bullet': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					bolas: {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'demon stone': {
						min: 1,
						max: 1,
						chance: 0.5
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end2': {
				text: [
					_('not much here.'),
					_('scavengers must have gotten to this place already.')
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					torch: {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.5
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end3': {
				text: [
                    /// TRANSLATORS : a platform in the subway
					_('the tunnel opens up at another platform.'),
					_('the walls are scorched from an old battle.'),
					_('bodies and supplies from both sides litter the ground.')
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 0.8
					},
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'nichirin gun': {
						min: 1,
						max: 1,
						chance: 0.3
					},
					'solar crystal': {
						min: 1,
						max: 5,
						chance: 0.3
					},
					'demon stone': {
						min: 1,
						max: 1,
						chance: 0.3
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end4': {
				text: [
					_('the small military outpost is well supplied.'),
					_('arms and munitions, relics from the war, are neatly arranged on the store-room floor.'),
					_('just as deadly now as they were then.')
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 1
					},
					'wisteria bullet': {
						min: 1,
						max: 10,
						chance: 1
					},
					grenade: {
						min: 1,
						max: 5,
						chance: 0.8
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end5': {
				text: [
					_('searching the bodies yields a few supplies.'),
					_('more soldiers will be on their way.'),
					_('time to move on.')
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 1
					},
					'wisteria bullet': {
						min: 1,
						max: 10,
						chance: 1
					},
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'medicine': {
					min: 1,
					max: 4,
					chance: 0.1
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end6': {
				text: [
					_('the small settlement has clearly been burning a while.'),
					_('the bodies of the wanderers that lived here are still visible in the flames.'),
					_("still time to rescue a few supplies.")
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'nichirin gun': {
						min: 1,
						max: 1,
						chance: 0.5
					},
					'solar crystal': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'cured meat': {
						min: 1,
						max: 10,
						chance: 1
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end7': {
				text: [
					_('the remaining settlers flee from the violence, their belongings forgotten.'),
					_("there's not much, but some useful things can still be found.")
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'nichirin katana': {
						min: 1,
						max: 1,
						chance: 0.8
					},
					'solar crystal': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'cured meat': {
						min: 1,
						max: 10,
						chance: 1
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end8': {
				text: [
					_('the young settler was carrying a canvas sack.'),
					_("it contains travelling gear, and a few trinkets."),
					_("there's nothing else here.")
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'nichirin katana': {
						min: 1,
						max: 1,
						chance: 0.8
					},
					'kusarigama': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'cured meat': {
						min: 1,
						max: 10,
						chance: 1
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end9': {
				text: [
					_('inside the hut, a child cries.'),
					_("a few belongings rest against the walls."),
					_("there's nothing else here.")
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 0.8
					},
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'kusarigama': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'demon stone': {
						min: 1,
						max: 1,
						chance: 0.2
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end10': {
				text: [
					_('the stench of rot and death fills the operating theatres.'),
					_("a few items are scattered on the ground."),
					_('there is nothing else here.')
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'solar crystal': {
						min: 1,
						max: 1,
						chance: 0.3
					},
					'medicine': {
						min: 1,
						max: 5,
						chance: 0.3
					},
					'teeth': {
						min: 3,
						max: 8,
						chance: 1
					},
					'scales': {
						min: 4,
						max: 7,
						chance: 0.9
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end11': {
				text: [
					_('a pristine medicine cabinet at the end of a hallway.'),
					_("the rest of the hospital is empty.")
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'solar crystal': {
						min: 1,
						max: 1,
						chance: 0.2
					},
					'medicine': {
						min: 3,
						max: 10,
						chance: 1
					},
					'teeth': {
						min: 1,
						max: 2,
						chance: 0.2
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end12': {
				text: [
					_('someone had been stockpiling loot here.')
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'solar crystal': {
						min: 1,
						max: 3,
						chance: 0.2
					},
					'medicine': {
						min: 3,
						max: 10,
						chance: 0.5
					},
					'wisteria bullet': {
						min: 2,
						max: 8,
						chance: 1
					},
					'torch': {
					min: 1,
					max: 3,
					chance: 0.5
					},
					'wisteria bomb': {
					min: 1,
					max: 1,
					chance: 0.5
					},
					'demon stone': {
					min: 1,
					max: 2,
					chance: 0.8
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end13': {
				text: [
					_('the tentacular horror is defeated.'),
					_('inside, the remains of its victims are everywhere.')
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'nichirin katana': {
						min: 1,
						max: 3,
						chance: 0.5
					},
					'wisteria gun': {
						min: 1,
						max: 2,
						chance: 0.3
					},
					'teeth': {
						min: 2,
						max: 8,
						chance: 1
					},
					'cloth': {
					min: 3,
					max: 6,
					chance: 0.5
					},
					'demon stone': {
					min: 1,
					max: 1,
					chance: 0.1
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end14': {
				text: [
                    /// TRANSLATORS : warped means extremely disfigured.
					_('the warped man lies dead.'),
					_('the operating theatre has a lot of curious equipment.')
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'solar crystal': {
						min: 2,
						max: 5,
						chance: 0.8
					},
					'medicine': {
						min: 3,
						max: 12,
						chance: 1
					},
					'cloth': {
						min: 1,
						max: 3,
						chance: 0.5
					},
					'steel': {
						min: 2,
						max: 3,
						chance: 0.3
					},
					'demon stone': {
						min: 1,
						max: 1,
						chance: 0.3
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			
			'end15': {
				text: [
					_('the old man had a small cache of interesting items.')
				],
				onLoad: function() {
					World.clearDungeon();
					$SM.set('game.cityCleared', true);
				},
				loot: {
					'demon stone': {
						min: 1,
						max: 1,
						chance: 0.8
					},
					'medicine': {
					min: 1,
					max: 4,
					chance: 1
					},
					'cured meat': {
					min: 3,
					max: 7,
					chance: 1
					},
					'kusarigama': {
					min: 1,
					max: 3,
					chance: 0.5
					},
					'fur': {
					min: 1,
					max: 5,
					chance: 0.8
					}
				},
				buttons: {
					'leave': {
						text: _('leave city'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_CITY
	},
	"house": { /* 柱皁E�E��E�迹 - Hashira's Ruins */
		title: _('An Old House'),
		scenes: {
			'start': {
				text: [
					_('an old house remains here, once white siding yellowed and peeling.'),
					_('the door hangs open.')
				],
				notification: _('the remains of an old house stand as a monument to simpler times'),
				buttons: {
					'enter': {
						text: _('go inside'),
						nextScene: { 0.25: 'medicine', 0.5: 'supplies', 1: 'occupied' }
					},
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			},
			'supplies': {
				text: [
					_('the house is abandoned, but not yet picked over.'),
					_('still a few drops of water in the old well.')
				],
				onLoad: function() {
					World.markVisited(World.curPos[0], World.curPos[1]);
					World.setWater(World.getMaxWater());
					Notifications.notify(null, _('water replenished'));
				},
				loot: {
					'cured meat': {
						min: 1,
						max: 10,
						chance: 0.8
					},
					'leather': {
						min: 1,
						max: 10,
						chance: 0.2
					},
					'cloth': {
						min: 1,
						max: 10,
						chance: 0.5
					}
				},
				buttons: {
					'leave': {
						text: _('leave'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'medicine': {
				text: [
					_('the house has been ransacked.'),
					_('but there is a cache of medicine under the floorboards.')
				],
				onLoad: function() {
					World.markVisited(World.curPos[0], World.curPos[1]);
				},
				loot: {
					'medicine': {
						min: 2,
						max: 5,
						chance: 1
					}
				},
				buttons: {
					'leave': {
						text: _('leave'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'occupied': {
				combat: true,
				enemy: 'squatter',
				chara: 'E',
				damage: 3,
				hit: 0.8,
				attackDelay: 2,
				health: 10,
				notification: _('a man charges down the hall, a rusty blade in his hand'),
				onLoad: function() {
					World.markVisited(World.curPos[0], World.curPos[1]);
				},
				loot: {
					'cured meat': {
						min: 1,
						max: 10,
						chance: 0.8
					},
					'leather': {
						min: 1,
						max: 10,
						chance: 0.2
					},
					'cloth': {
						min: 1,
						max: 10,
						chance: 0.5
					}
				},
				buttons: {
					'leave': {
						text: _('leave'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_HOUSE
	},
	"battlefield": { /* 鬼与剑士皁E�E�E场 - Ancient Demon-Slayer Battlefield */
		title: _('A Forgotten Battlefield'),
		scenes: {
			'start': {
				text: [
					_('a battle was fought here, long ago.'),
					_('battered technology from both sides lays dormant on the blasted landscape.')
				],
				onLoad: function() {
					World.markVisited(World.curPos[0], World.curPos[1]);
				},
				loot: {
					'wisteria gun': {
						min: 1,
						max: 3,
						chance: 0.5
					},
					'wisteria bullet': {
						min: 5,
						max: 20,
						chance: 0.8
					},
					'nichirin gun': {
						min: 1,
						max: 3,
						chance: 0.3
					},
					'solar crystal': {
						min: 5,
						max: 10,
						chance: 0.5
					},
					'wisteria bomb': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'demon stone': {
						min: 1,
						max: 1,
						chance: 0.3
					}
				},
				buttons: {
					'leave': {
						text: _('leave'),

						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_BATTLEFIELD
	},
	"borehole": { /* Admiring a huge borehole */
		title: _('A Huge Borehole'),
		scenes: {
			'start': {
				text: [
					_('a huge hole is cut deep into the earth, evidence of the past harvest.'),
					_('they took what they came for, and left.'),
					_('castoff from the mammoth drills can still be found by the edges of the precipice.')
				],
				onLoad: function() {
					World.markVisited(World.curPos[0], World.curPos[1]);
				},
				loot: {
					'demon stone': {
						min: 1,
						max: 3,
						chance: 1
					}
				},
				buttons: {
					'leave': {
						text: _('leave'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_BOREHOLE
	},
	"ship": { /* 通往无限城深夁E- Hidden route deeper into the Infinity Castle */
		title: _('A Hidden Route'),
		scenes: {
			'start': {
				onLoad: function() {
					World.markVisited(World.curPos[0], World.curPos[1]);
					World.drawRoad();
					World.state.ship = true;
				},
				text: [
					_('a spiral staircase descends through the castle floor, carved into the impossible stone.'),
					_('the geometry shifts around it  Ebut the path downward is clear.'),
					_('a guide crow perches at the top of the stairs, watching with one red eye.')
				],
				buttons: {
					'mark': {
						text: _('mark the route'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_CRASHED_SHIP
	},
	"sulphurmine": { /* Clearing the Sulphur Mine */
		title: _('The Sulphur Mine'),
		scenes: {
			'start': {
				text: [
					_("the military is already set up at the mine's entrance."),
					_('soldiers patrol the perimeter, rifles slung over their shoulders.')
				],
				notification: _('a military perimeter is set up around the mine.'),
				buttons: {
					'attack': {
						text: _('attack'),
						nextScene: {1: 'a1'}
					},
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			},
			'a1': {
				combat: true,
				enemy: 'soldier',
				ranged: true,
				chara: 'D',
				damage: 8,
				hit: 0.8,
				attackDelay: 2,
				health: 50,
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 0.2
					}
				},
				notification: _('a soldier, alerted, opens fire.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: { 1: 'a2' }
					},
					'run': {
						text: _('run'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'a2': {
				combat: true,
				enemy: 'soldier',
				ranged: true,
				chara: 'D',
				damage: 8,
				hit: 0.8,
				attackDelay: 2,
				health: 50,
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'wisteria bullet': {
						min: 1,
						max: 5,
						chance: 0.5
					},
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 0.2
					}
				},
				notification: _('a second soldier joins the fight.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: { 1: 'a3' }
					},
					'run': {
						text: _('run'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'a3': {
				combat: true,
				enemy: 'veteran',
				chara: 'D',
				damage: 10,
				hit: 0.8,
				attackDelay: 2,
				health: 65,
				loot: {
					'nichirin spear': {
						min: 1,
						max: 1,
						chance: 0.5
					},
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					}
				},
				notification: _('a grizzled soldier attacks, waving a bayonet.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: { 1: 'cleared' }
					}
				}
			},
			'cleared': {
				text: [
					_('the military presence has been cleared.'),
					_('the mine is now safe for workers.')
				],
				notification: _('the sulphur mine is clear of dangers'),
				onLoad: function() {
					World.drawRoad();
					World.state.sulphurmine = true;
					World.markVisited(World.curPos[0], World.curPos[1]);
				},
				buttons: {
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_SULPHUR_MINE
	},
	"coalmine": { /* Clearing the Coal Mine */
		title: _('The Coal Mine'),
		scenes: {
			'start': {
				text: [
					_('camp fires burn by the entrance to the mine.'),
					_('men mill about, weapons at the ready.')
				],
				notification: _('this old mine is not abandoned'),
				buttons: {
					'attack': {
						text: _('attack'),
						nextScene: {1: 'a1'}
					},
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			},
			'a1': {
				combat: true,
				enemy: 'man',
				chara: 'E',
				damage: 3,
				hit: 0.8,
				attackDelay: 2,
				health: 10,
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'cloth': {
						min: 1,
						max: 5,
						chance: 0.8
					}
				},
				notification: _('a man joins the fight'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: { 1: 'a2' }
					},
					'run': {
						text: _('run'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'a2': {
				combat: true,
				enemy: 'man',
				chara: 'E',
				damage: 3,
				hit: 0.8,
				attackDelay: 2,
				health: 10,
				loot: {
					'cured meat': {
						min: 1,
						max: 5,
						chance: 0.8
					},
					'cloth': {
						min: 1,
						max: 5,
						chance: 0.8
					}
				},
				notification: _('a man joins the fight'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: { 1: 'a3' }
					},
					'run': {
						text: _('run'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: 'end'
					}
				}
			},
			'a3': {
				combat: true,
				enemy: 'chief',
				chara: 'D',
				damage: 5,
				hit: 0.8,
				attackDelay: 2,
				health: 20,
				loot: {
					'cured meat': {
						min: 5,
						max: 10,
						chance: 1
					},
					'cloth': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'iron': {
						min: 1,
						max: 5,
						chance: 0.8
					}
				},
				notification: _('only the chief remains.'),
				buttons: {
					'continue': {
						text: _('continue'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: { 1: 'cleared' }
					}
				}
			},
			'cleared': {
				text: [
					_('the camp is still, save for the crackling of the fires.'),
					_('the mine is now safe for workers.')
				],
				notification: _('the coal mine is clear of dangers'),
				onLoad: function() {
					World.drawRoad();
					World.state.coalmine = true;
					World.markVisited(World.curPos[0], World.curPos[1]);
				},
				buttons: {
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_COAL_MINE
	},
	"ironmine": { /* Clearing the Iron Mine */
		title: _('The Iron Mine'),
		scenes: {
			'start': {
				text: [
					_('an old iron mine sits here, tools abandoned and left to rust.'),
					_('bleached bones are strewn about the entrance. many, deeply scored with jagged grooves.'),
					_('feral howls echo out of the darkness.')
				],
				notification: _('the path leads to an abandoned mine'),
				buttons: {
					'enter': {
						text: _('go inside'),
						nextScene: { 1: 'enter' },
						cost: { 'torch': 1 }
					},
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			},
			'enter': {
				combat: true,
				enemy: 'beastly matriarch',
				chara: 'T',
				damage: 4,
				hit: 0.8,
				attackDelay: 2,
				health: 10,
				loot: {
					'teeth': {
						min: 5,
						max: 10,
						chance: 1
					},
					'scales': {
						min: 5,
						max: 10,
						chance: 0.8
					},
					'cloth': {
						min: 5,
						max: 10,
						chance: 0.5
					}
				},
				notification: _('a large creature lunges, muscles rippling in the torchlight'),
				buttons: {
					'leave': {
						text: _('leave'),
						cooldown: Events._LEAVE_COOLDOWN,
						nextScene: { 1: 'cleared' }
					}
				}
			},
			'cleared': {
				text: [
					_('the beast is dead.'),
					_('the mine is now safe for workers.')
				],
				notification: _('the iron mine is clear of dangers'),
				onLoad: function() {
					World.drawRoad();
					World.state.ironmine = true;
					World.markVisited(World.curPos[0], World.curPos[1]);
				},
				buttons: {
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_IRON_MINE
	},
	
	"cache": { /* Cache - contains some of supplies from previous game */
		title: _('A Destroyed Village'),
		scenes: {
			'start': {
				text: [
					_('a destroyed village lies in the dust.'),
					_('charred bodies litter the ground.')
				],
                /// TRANSLATORS : tang = strong metallic smell, wanderer afterburner = ship's engines
				notification: _('the metallic tang of wanderer afterburner hangs in the air.'),
				buttons: {
					'enter': {
						text: _('enter'),
						nextScene: {1: 'underground'}
					},
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			},
			'underground': {
				text: [
					_('a shack stands at the center of the village.'),
					_('there are still supplies inside.')
				],
				buttons: {
					'take': {
						text: _('take'),
						nextScene: {1: 'exit'}
					}
				}
			},
			'exit': {
				text: [
					_('all the work of a previous generation is here.'),
				_('ripe for the picking.')
				],
				onLoad: function() {
					World.markVisited(World.curPos[0], World.curPos[1]);
					Prestige.collectStores();
				},
				buttons: {
					'leave': {
						text: _('leave'),
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.LANDMARK_DESTROYED_VILLAGE
	}
};
