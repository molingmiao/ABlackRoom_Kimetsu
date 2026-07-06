// Opening Prologue — Demon Slayer Theme
// Fires exactly ONCE at the start of a new game.
// Triggered from Room.init() on first play.

Events.Prologue = {
	title: _('The Day Everything Changed'),
	scenes: {
		'start': {
			text: [
				_('it is dusk. you are walking home from the wisteria estate.'),
				_("the estate was your family's livelihood — a refuge and waystation for the demon slayer corps."),
				_("you are no slayer. you keep the house, the wisteria grove, and the records."),
				_('the mountain path is quiet. too quiet.')
			],
			buttons: {
				'continue': {
					text: _('continue'),
					nextScene: { 1: 'smoke' }
				}
			}
		},
		'smoke': {
			text: [
				_("you smell it before you see it."),
				_("a dark, oily column of smoke rises from the far side of the ridge."),
				_("your home is on the far side of the ridge.")
			],
			buttons: {
				'run': {
					text: _('run home'),
					nextScene: { 1: 'arrive' }
				}
			}
		},
		'arrive': {
			text: [
				_("the wisteria around the gate is untouched. it glows pale in the last of the light."),
				_("but the door is open."),
				_("inside — silence.")
			],
			buttons: {
				'enter': {
					text: _('step inside'),
					nextScene: { 1: 'family_dead' }
				}
			}
		},
		'family_dead': {
			text: [
				_("the smell hits first."),
				_("your family. gone."),
				_("the walls are dark."),
				_("something stirs in the corner.")
			],
			notification: _('a demon lurks in the ruins of your home'),
			buttons: {
				'look': {
					text: _('face it'),
					nextScene: { 1: 'demon_appears' }
				}
			}
		},
		'demon_appears': {
			text: [
				_("a demon rises from the shadows. its eyes are the colour of blood."),
				_("'another human.' it smiles. 'Muzan-sama sent us here. your family was first. you are next.'"),
				_("something snaps inside you."),
				_("you grab an axe from beside the hearth.")
			],
			notification: _("the demon grins — it has been waiting"),
			buttons: {
				'fight': {
					text: _('fight'),
					nextScene: { 1: 'fight1' }
				}
			}
		},
		'fight1': {
			text: [
				_("you swing. the demon is faster."),
				_("it catches your wrist, breaks something, flings you into the wall."),
				_("you get up.")
			],
			buttons: {
				'rise': {
					text: _('rise'),
					nextScene: { 1: 'fight2' }
				}
			}
		},
		'fight2': {
			text: [
				_("again. and again."),
				_("each time you stand, it hits harder."),
				_("your legs are giving out. your vision is narrowing to a tunnel."),
				_("the demon looks almost bored.")
			],
			buttons: {
				'refuse': {
					text: _('refuse to fall'),
					nextScene: { 1: 'near_death' }
				}
			}
		},
		'near_death': {
			text: [
				_("one more blow and you are dead."),
				_("the demon raises its hand."),
				_("you do not close your eyes.")
			],
			buttons: {
				'endure': {
					text: _("don't look away"),
					nextScene: { 1: 'giyuu_arrives' }
				}
			}
		},
		'giyuu_arrives': {
			text: [
				_("the blow does not come."),
				_("a blade, black as deep water, is buried to the hilt in the demon's neck."),
				_("a figure in a black and red-patterned haori stands in the doorway. sword still drawn."),
				_("the demon comes apart in the light of the rising sun.")
			],
			notification: _("the Water Hashira — Tomioka Giyuu"),
			buttons: {
				'watch': {
					text: _('watch'),
					nextScene: { 1: 'giyuu_speaks' }
				}
			}
		},
		'giyuu_speaks': {
			text: [
				_("the man sheathes his sword. he does not look at you."),
				_("'the wisteria house on the other path. go there.'"),
				_("'it needs to be reopened. the corps needs waystation.'"),
				_("he turns to leave.")
			],
			buttons: {
				'ask': {
					text: _('who are you'),
					nextScene: { 1: 'giyuu_name' }
				},
				'agree': {
					text: _('understood'),
					nextScene: { 1: 'epilogue' }
				}
			}
		},
		'giyuu_name': {
			text: [
				_("he pauses."),
				_("'Tomioka. Water Pillar.'"),
				_("he is already gone before you can speak again.")
			],
			buttons: {
				'nod': {
					text: _('nod'),
					nextScene: { 1: 'epilogue' }
				}
			}
		},
		'epilogue': {
			text: [
				_("by dawn you have reached the wisteria estate."),
				_("the grove is intact. the gate stands."),
				_("inside: cold ash in the hearth. bare walls. silence."),
				_("the slayers of demons will need this place."),
				_("you will give it to them.")
			],
			notification: _("the wisteria estate. it begins here."),
			onLoad: function () {
				$SM.set('game.prologue.done', true);
			},
			buttons: {
				'begin': {
					text: _('light the fire'),
					nextScene: 'end'
				}
			}
		}
	}
};
