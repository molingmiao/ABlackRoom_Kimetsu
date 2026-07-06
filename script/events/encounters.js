/**
 * 鬼灭之刃 - 世界探索遭遇事件
 * 将原游戏的野怪替换为各类鬼族敌人
 **/
Events.Encounters = [
	/* 第一层 - 近距离（<=10）：流浪鬼、低阶鬼 */
	{ /* 森林流浪鬼 */
		title: _('Forest Demon'),
		isAvailable: function() {
			return World.getDistance() <= 10 && World.getTerrain() == World.TILE.FOREST;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'forest demon',
				enemyName: _('forest demon'),
				deathMessage: _('the forest demon crumbles into ash, its curse lifted'),
				chara: '鬼',
				damage: 1,
				hit: 0.8,
				attackDelay: 1,
				health: 5,
				loot: {
					'fur': {
						min: 1,
						max: 3,
						chance: 1
					},
					'meat': {
						min: 1,
						max: 3,
						chance: 1
					},
					'teeth': {
						min: 1,
						max: 3,
						chance: 0.8
					}
				},
				notification: _('a demon leaps from the darkness of the trees')
			}
		}
	},
	{ /* 荒地爪牙鬼 */
	title: _('Claw Demon'),
		isAvailable: function() {
			return World.getDistance() <= 10 && World.getTerrain() == World.TILE.BARRENS;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'claw demon',
				enemyName: _('claw demon'),
				deathMessage: _('the claw demon dissolves into dust, finally at peace'),
				chara: '爪',
				damage: 2,
				hit: 0.8,
				attackDelay: 2,
				health: 6,
				loot: {
					'cloth': {
						min: 1,
						max: 3,
						chance: 0.8
					},
					'teeth': {
						min: 1,
						max: 2,
						chance: 0.8
					},
					'leather': {
						min: 1,
						max: 2,
						chance: 0.5
					}
				},
				notification: _('a claw demon charges, slashing wildly with elongated hands')
			}
		}
	},
	{ /* 原野血雾鬼 */
	title: _('Blood Mist Demon'),
		isAvailable: function() {
			return World.getDistance() <= 10 && World.getTerrain() == World.TILE.FIELD;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'blood mist demon',
				enemyName: _('blood mist demon'),
				deathMessage: _('the blood mist demon scatters like morning fog'),
				chara: '霧',
				damage: 3,
				hit: 0.8,
				attackDelay: 2,
				health: 4,
				loot: {
					'scales': {
						min: 1,
						max: 3,
						chance: 0.8
					},
					'teeth': {
						min: 1,
						max: 2,
						chance: 0.5
					},
					'meat': {
						min: 1,
						max: 3,
						chance: 0.8
					}
				},
				notification: _('a demon wreathed in crimson mist drifts across the field')
			}
		}
	},
	{ /* 双首异形鬼 */
	title: _('Twin-Headed Demon'),
		isAvailable: function() {
			return World.getDistance() <= 10 && World.getTerrain() == World.TILE.FIELD;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'twin-headed demon',
				enemyName: _('twin-headed demon'),
				deathMessage: _('both heads cry out as the demon turns to ash'),
				chara: '双',
				damage: 2,
				hit: 0.5,
				attackDelay: 3,
				health: 10,
				loot: {
					'fur': {
						min: 2,
						max: 4,
						chance: 1
					},
					'teeth': {
						min: 2,
						max: 3,
						chance: 0.8
					},
					'meat': {
						min: 2,
						max: 3,
						chance: 0.8
					}
				},
				notification: _('a twin-headed demon appears, one head weeping, one howling')
			}
		}
	},
	/* 第二层 - 中距离（10~20）：强化鬼族、特殊变种 */
	{ /* 蜈蚣变形鬼 */
	title: _('Centipede Demon'),
		isAvailable: function() {
			return World.getDistance() > 10 && World.getDistance() <= 20 && World.getTerrain() == World.TILE.BARRENS;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'centipede demon',
				enemyName: _('centipede demon'),
				deathMessage: _('the centipede demon writhes and bursts into flames'),
				chara: '蜈',
				damage: 5,
				hit: 0.5,
				attackDelay: 1,
				health: 20,
				loot: {
					'cloth': {
						min: 1,
						max: 1,
						chance: 0.2
					},
					'teeth': {
						min: 1,
						max: 2,
						chance: 0.8
					},
					'leather': {
						min: 1,
						max: 1,
						chance: 0.2
					},
					'medicine': {
						min: 1,
						max: 3,
						chance: 0.7
					}
				},
				notification: _('a centipede demon erupts from the earth, dozens of legs churning')
			}
		}
	},
	{ /* 食人变形鬼 */
		title: _('Man-Eating Demon'),
		isAvailable: function() {
			return World.getDistance() > 10 && World.getDistance() <= 20 && World.getTerrain() == World.TILE.FOREST;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'man-eating demon',
				enemyName: _('man-eating demon'),
				deathMessage: _('the man-eating demon falls, its hunger finally extinguished'),
				chara: '喰',
				damage: 3,
				hit: 0.8,
				attackDelay: 1,
				health: 25,
				loot: {
					'fur': {
						min: 5,
						max: 10,
						chance: 1
					},
					'meat': {
						min: 5,
						max: 10,
						chance: 1
					},
					'teeth': {
						min: 5,
						max: 10,
						chance: 0.8
					}
				},
				notification: _('a massive demon crashes through the undergrowth, claws stained crimson')
			}
		}
	},
	{ /* 弦月鬼 */
	title: _('Crescent Moon Demon'),
		isAvailable: function() {
			return World.getDistance() > 10 && World.getDistance() <= 20 && World.getTerrain() == World.TILE.BARRENS;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'crescent moon demon',
				enemyName: _('crescent moon demon'),
				deathMessage: _('the crescent moon demon shatters like a broken blade'),
				chara: '月',
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
					'iron': {
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
				notification: _('a demon wielding crescent blades swoops down without warning')
			}
		}
	},
	{ /* 蛛鬼幼体 */
	title: _('Spider Demon Spawn'),
		isAvailable: function() {
			return World.getDistance() > 10 && World.getDistance() <= 20 && World.getTerrain() == World.TILE.FIELD;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'spider demon spawn',
				enemyName: _('spider demon spawn'),
				deathMessage: _('the spider demon spawn dissolves, threads of web drifting in the air'),
				chara: '蛛',
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
				notification: _('spider silk shoots from the grass, a demon spawn lurking beneath')
			}
		}
	},
	{ /* 水鬼 */
	title: _('Water Demon'),
		isAvailable: function() {
			return World.getDistance() > 10 && World.getDistance() <= 20 && World.getTerrain() == World.TILE.FOREST;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'water demon',
				enemyName: _('water demon'),
				deathMessage: _('the water demon evaporates like morning dew'),
				chara: '水',
				damage: 4,
				hit: 0.7,
				attackDelay: 1.5,
				health: 22,
				loot: {
					'scales': {
						min: 3,
						max: 8,
						chance: 0.9
					},
					'cloth': {
						min: 2,
						max: 5,
						chance: 0.7
					},
					'medicine': {
						min: 1,
						max: 2,
						chance: 0.3
					}
				},
				notification: _('a serpentine demon rises from the stream, water swirling around it')
			}
		}
	},
	{ /* 操线傀儡鬼 */
	title: _('Puppet Demon'),
		isAvailable: function() {
			return World.getDistance() > 10 && World.getDistance() <= 20 && World.getTerrain() == World.TILE.BARRENS;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'puppet demon',
				enemyName: _('puppet demon'),
				deathMessage: _('the puppet demon collapses, its strings cut forever'),
				chara: '線',
				damage: 3,
				hit: 0.9,
				attackDelay: 1.2,
				health: 18,
				loot: {
					'cloth': {
						min: 4,
						max: 8,
						chance: 1
					},
					'leather': {
						min: 2,
						max: 5,
						chance: 0.6
					},
					'teeth': {
						min: 1,
						max: 3,
						chance: 0.7
					}
				},
				notification: _('thin wires slice through the air as a puppet demon manipulates its victims')
			}
		}
	},
	/* 第三层 - 远距离（>20）：上弦之鬼候选、强力鬼族 */
	{ /* 狂暴变异鬼 */
		title: _('Berserk Demon'),
		isAvailable: function() {
			return World.getDistance() > 20 && World.getTerrain() == World.TILE.FOREST;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'berserk demon',
				enemyName: _('berserk demon'),
				deathMessage: _('the berserk demon screams its final breath as it crumbles'),
				chara: '狂',
				damage: 6,
				hit: 0.8,
				attackDelay: 1,
				health: 45,
				loot: {
					'fur': {
						min: 5,
						max: 10,
						chance: 1
					},
					'meat': {
						min: 5,
						max: 10,
						chance: 1
					},
					'teeth': {
						min: 5,
						max: 10,
						chance: 0.8
					}
				},
				notification: _('an enormous demon bursts from the forest, consumed by bloodlust')
			}
		}
	},
	{ /* 下弦之鬼 */
	title: _('Lower Moon Demon'),
		isAvailable: function() {
			return World.getDistance() > 20 && World.getTerrain() == World.TILE.BARRENS;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'lower moon demon',
				enemyName: _('lower moon demon'),
				deathMessage: _('the lower moon demon curses Muzan with its last breath before turning to ash'),
				ranged: true,
				chara: '下',
				damage: 8,
				hit: 0.8,
				attackDelay: 2,
				health: 50,
				loot: {
					'cloth': {
						min: 5,
						max: 10,
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
					},
					'medicine': {
						min: 1,
						max: 2,
						chance: 0.1
					}
				},
				notification: _('a Lower Moon demon appears, the number carved into its eye')
			}
		}
	},
	{ /* 上弦候选 */
	title: _('Upper Moon Candidate'),
		isAvailable: function() {
			return World.getDistance() > 20 && World.getTerrain() == World.TILE.FIELD;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'upper moon candidate',
				enemyName: _('upper moon candidate'),
				deathMessage: _('the upper moon candidate disintegrates, whispering Muzan\'s name'),
				chara: '上',
				damage: 15,
				hit: 0.8,
				attackDelay: 4,
				health: 30,
				ranged: true,
				telegraphAttacks: [
					{
						interval: 18,
						telegraphSec: 1.5,
						telegraph: _('blood demon art swells — the air thickens.'),
						interruptedText: _('its concentration breaks; the technique fizzles.'),
						dmg: 12,
						hit: 0.9,
						ranged: true
					}
				],
				loot: {
					'cloth': {
						min: 5,
						max: 10,
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
					},
					'medicine': {
						min: 1,
						max: 2,
						chance: 0.1
					}
				},
				notification: _('a demon of terrible power descends, its blood art already in motion')
			}
		}
	},
	{ /* 鼓鬼守卫 */
	title: _('Drum Demon Guardian'),
		isAvailable: function() {
			return World.getDistance() > 20 && World.getTerrain() == World.TILE.BARRENS;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'drum demon guardian',
				enemyName: _('drum demon guardian'),
				deathMessage: _('the drum demon\'s beat falls silent, the spinning rooms grow still'),
				chara: '鼓',
				damage: 10,
				hit: 0.75,
				attackDelay: 1.5,
				health: 60,
				telegraphAttacks: [
					{
						interval: 12,
						telegraphSec: 1.5,
						telegraph: _('the drum-rhythm tightens — a chamber is rearranging itself.'),
						interruptedText: _('the rhythm breaks; the chamber stalls.'),
						dmg: 8,
						hit: 0.85,
						ranged: false
					}
				],
				loot: {
					'iron': {
						min: 5,
						max: 10,
						chance: 0.9
					},
					'steel': {
						min: 1,
						max: 3,
						chance: 0.5
					},
					'medicine': {
						min: 2,
						max: 4,
						chance: 0.4
					},
					'leather': {
						min: 3,
						max: 8,
						chance: 0.8
					}
				},
				notification: _('thunderous drumbeats echo as a demon made of drums descends')
			}
		}
	},
	{ /* 雷鬼 */
	title: _('Thunder Demon'),
		isAvailable: function() {
			return World.getDistance() > 20 && World.getTerrain() == World.TILE.FOREST;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'thunder demon',
				enemyName: _('thunder demon'),
				deathMessage: _('the thunder demon\'s lightning fades as it turns to ash'),
				chara: '雷',
				damage: 12,
				hit: 0.85,
				attackDelay: 0.8,
				health: 35,
				loot: {
					'scales': {
						min: 5,
						max: 12,
						chance: 1
					},
					'iron': {
						min: 3,
						max: 6,
						chance: 0.7
					},
					'medicine': {
						min: 1,
						max: 3,
						chance: 0.3
					}
				},
				notification: _('lightning splits the sky as a thunder demon strikes without warning')
			}
		}
	},
	{ /* 炎鬼 */
	title: _('Flame Demon'),
		isAvailable: function() {
			return World.getDistance() > 25 && World.getTerrain() == World.TILE.FIELD;
		},
		scenes: {
			'start': {
				combat: true,
				enemy: 'flame demon',
				enemyName: _('flame demon'),
				deathMessage: _('the flame demon\'s fires extinguish as it returns to darkness'),
				chara: '炎',
				damage: 18,
				hit: 0.8,
				attackDelay: 2.5,
				health: 80,
				ranged: true,
				loot: {
					'sulphur': {
						min: 5,
						max: 10,
						chance: 1
					},
					'steel': {
						min: 3,
						max: 6,
						chance: 0.8
					},
					'medicine': {
						min: 2,
						max: 5,
						chance: 0.5
					},
					'wisteria gun': {
						min: 1,
						max: 1,
						chance: 0.15
					}
				},
				notification: _('waves of scorching heat precede a demon of living flame')
			}
		}
	}
];
