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
	{ /* The estate briefing opens the real K chapter; no remote instant victory. */
		title: _('Smith Village Under Siege'),
		storySupply: true,
		isAvailable: function() {
			return (Engine.activeModule == Room || Engine.activeModule == Outside)
				&& $SM.get('game.buildings["workshop"]', true) >= 1
				&& (!window.EarlyGame || EarlyGame.storyPrerequisite('smiths'))
				&& !$SM.get('game.swordsmithVillageDone') && !$SM.get('game.swordsmithBriefed');
		},
		scenes: {
			'start': {
				text: [
					'鎹鸦送来刀匠村的补给委托。游郭之后，炭治郎要修复损坏的日轮刀，你也能沿鬼杀队安排的隐秘路线前往支援。',
					'真正的锻刀村在地图上标记为 K，只有一处。Y 是普通废城，不是刀匠村；进入 K 才能推进完整章节。',
					'霞柱、恋柱与玄弥将守住正面战线。你的任务是护送刀匠、保护锻造与撤离通道，带上足够的治疗和返程口粮。'
				],
				notification: '锻刀村 K 的委托送到庄园；请先整备，再在地图上接下支援任务。',
				blink: true,
				buttons: {
					'depart': {
						text: '收下路线，查看任务说明',
						nextScene: 'briefing'
					},
					'refuse': {
						text: '稍后再准备',
						nextScene: 'end'
					}
				}
			},
			'briefing': {
				text: [
					'锻刀村通常距庄园 22 格，旧地图会补到最近的空地。隐会沿着调换路线接应，地图只是任务入口，不意味着暴露刀匠的真实地址。',
					'善逸与伊之助正在别处执行任务，他们会以前后方书信联络，不会被安排到原作未参战的村中。炭治郎、祢豆子、玄弥、霞柱和恋柱在村内与你联动。',
					'完成村落救援后请安全返回庄园：这时才保存章节、获得日轮刀与见切训练。仅阅读委托或拒绝支援都不会完成主线。'
				],
				onLoad: function() { $SM.set('game.swordsmithBriefed',true); },
				buttons: {
					'leave': {
						text: '回备战页，准备前往 K',
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
	{ /* 章 7：柱合议 + 柱训练 — 完成刀匠村并拥有图纸后，可在大厅主动开启。
	     九柱齐聚紫藤庄园，玩家任选一柱进行训练以补足尚缺的呼吸法。 */
		title: _('The Pillars Convene'),
		id: 'pillarConvocation',
		storySupply: true,
		isAvailable: function() {
			var bps = $SM.get('character.blueprints');
			var hasAnyBp = bps && Object.keys(bps).some(function(key) { return !!bps[key]; });
			return Engine.activeModule == Room
				&& hasAnyBp
				&& (!window.EarlyGame || EarlyGame.storyPrerequisite('pillars'))
				&& !$SM.get('game.pillarConvocationDone');
		},
		scenes: {
			'start': {
				text: [
					_('the gate creaks open all morning long. one by one they arrive.'),
					'富冈沉默地坐下，甘露寺与伊黑随后抵达。时透、悲鸣屿、不死川和胡蝶也来到庄园。',
					'已经退役的宇髓带来游郭的情报。炼狱的席位空着，案头放着他留下的训练札。',
					_('"the corps marches on the demon king at the next moonless night," Himejima rumbles.'),
					_('"until then, train with one of us. choose."')
				],
				notification: '仍能前来的柱齐聚紫藤庄园，为最终决战作准备。',
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
					'选择一项尚未掌握的训练，也可温习已有呼吸。暂时离开不会失去训练机会。',
					'普通训练消耗庄园仓库中的熏肉 ×50、火把 ×1；风柱训练消耗熏肉 ×80、火把 ×1。生肉不算口粮，训练物资不用装进背包；已携带萤之珠可免火把费用。选择训练时才扣材料；暂时离开后，可回大厅再次点击“参加柱训练”，无需等待。'
				],
				buttons: {
					'flame': {
						text: '炎柱遗志：依训练札习猛烈一击',
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
					'review': {
						text: '温习已学呼吸，协助队士训练',
						cost: { 'cured meat': 50, 'torch': 1 },
						nextScene: { 1: 'thanks' }
					},
					'leave': {
						text: _('bow and decline'),
						onEnd: function() { if (window.EarlyGame) EarlyGame.render(); },
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
						onEnd: function() { if (window.EarlyGame) EarlyGame.render(); },
						nextScene: 'end'
					}
				}
			}
		},
		audio: AudioLibrary.EVENT_WANDERING_MASTER
	},
	{ /* 游郭情报只引导到唯一的 O；实战及完成状态由远征章节负责。 */
		title: _('The Pleasure District'),
		isAvailable: function() {
			return (Engine.activeModule == Room || Engine.activeModule == Outside)
				&& (!window.EarlyGame || EarlyGame.storyPrerequisite('district'))
				&& !$SM.get('game.yoshiwaraDone') && !$SM.get('game.yoshiwaraBriefed');
		},
		scenes: {
			start: {
				text: [
					'鎹鸦送来音柱宇髓天元的情报：潜入游郭的三位妻子失去联络。花街越是热闹，失踪者留下的线索越容易被掩盖。',
					'这次任务不再从庄园直接进入战斗。请整备远行物资，前往地图上唯一的 O，参与救援并安全返回；普通旧街 D 和市镇 R 不是游郭。'
				],
				notification: '游郭任务已开放：寻找地图上的唯一地点 O。',
				blink: true,
				buttons: {
					help: {text: '查看救援任务', nextScene: 'briefing'},
					ignore: {text: '暂不接下任务', nextScene: 'end'}
				}
			},
			briefing: {
				text: [
					'游郭通常距庄园 15 格，旧地图的原有位置会保留。宇髓安排你从后方协助三妻搜集情报、救出被血带困住的人，再为队士争取决胜机会。',
					'备好武器、护甲、治疗物资与往返口粮。游郭内的连续战斗不能靠这张情报跳过；只有完成黎明结算并安全返回，主线才会确认完成。',
					'宇髓提醒你：先保护活着的人。暂时推迟任务不会被算成胜利，也不会领取章节奖励。'
				],
				onLoad: function() {$SM.set('game.yoshiwaraBriefed',true);},
				buttons: {leave: {text: '回庄园准备', nextScene: 'end'}}
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

