/**
 * Module that registers the notification box and handles messages
 */
var Notifications = {

	MAX_HISTORY: 20,

	init: function(options) {
		this.options = $.extend(
			this.options,
			options
		);
		
		// Create the notifications box
		var elem = $('<div>').attr({
			id: 'notifications',
			className: 'notifications'
		});
		// Create the transparency gradient
		$('<div>').attr('id', 'notifyGradient').appendTo(elem);
		
		elem.appendTo('div#wrapper');

		// 刷新后从 $SM 恢复最近 20 条通知可见
		Notifications._restoreHistory();
	},
	
	options: {}, // Nothing for now
	
	elem: null,
	
	notifyQueue: {},
	
	// Allow notification to the player
	notify: function(module, text, noQueue) {
		if(typeof text == 'undefined') return;
		if(text.slice(-1) != ".") text += ".";
		if(module != null && Engine.activeModule != module) {
			if(!noQueue) {
				if(typeof this.notifyQueue[module] == 'undefined') {
					this.notifyQueue[module] = [];
				}
				this.notifyQueue[module].push(text);
			}
		} else {
			Notifications.printMessage(text);
		}
		Engine.saveGame();
	},
	
	clearHidden: function() {
	
		// To fix some memory usage issues, we clear notifications that have been hidden.
		
		// We use position().top here, because we know that the parent will be the same, so the position will be the same.
		var bottom = $('#notifyGradient').position().top + $('#notifyGradient').outerHeight(true);
		
		$('.notification').each(function() {
		
			if($(this).position().top > bottom){
				$(this).remove();
			}
		
		});
		
	},
	
	printMessage: function(t) {
		var extraClass = Notifications._classify(t);
		var text = $('<div>').addClass('notification' + (extraClass ? ' ' + extraClass : '')).css('opacity', '0').text(t).prependTo('div#notifications');
		text.animate({opacity: 1}, 500, 'linear', function() {
			// Do this every time we add a new message, this way we never have a large backlog to iterate through. Keeps things faster.
			Notifications.clearHidden();
		});
		// 记入历史（仅最近 MAX_HISTORY 条）
		Notifications._recordHistory(t);
	},

	// 根据文本内容标记重要通知类型，供 CSS 提供区分样式
	NPC_RE: /胡蝶忍|竈门|鬼舞辻|煋獄|珁睘|宇髬|时透|永机吏的|不死川|悲鸣屿|伊黑|甘露寺|富冈|岩柱|水柱|蛇柱|风柱|炎柱|恋柱|音柱|霞柱|虫柱|日柱|鸦使|鸦杯|鬼王|上弦|下弦/,

	_classify: function(text) {
		if (!text) return '';
		if (text.indexOf('成就解锁') >= 0)   return 'notify-achievement';
		if (text.indexOf('永久增益') >= 0)   return 'notify-boon';
		if (text.indexOf('奖励：') >= 0)      return 'notify-reward';
		if (text.indexOf('远征结算') >= 0)   return 'notify-summary';
		if (text.indexOf('报告:') >= 0 || text.indexOf('报告：') >= 0 || text.indexOf('陳落') >= 0 || text.indexOf('殉身') >= 0 || text.indexOf('失败') >= 0) return 'notify-loss';
		if (Notifications.NPC_RE.test(text))       return 'notify-npc';
		return '';
	},

	// 记录一条通知到存档历史，溢出则按时间丢最早的
	_recordHistory: function(text) {
		if (typeof $SM === 'undefined' || !$SM.get) return;
		var history = $SM.get('notifications.history') || [];
		history.push(text);
		if (history.length > Notifications.MAX_HISTORY) {
			history = history.slice(history.length - Notifications.MAX_HISTORY);
		}
		// noEvent=true 避免触发额外 stateUpdate
		$SM.set('notifications.history', history, true);
	},

	// 刷新页面后从存档重画历史记录（淺淺顯示，区分于新消息）
	_restoreHistory: function() {
		if (typeof $SM === 'undefined' || !$SM.get) return;
		var history = $SM.get('notifications.history') || [];
		if (!history.length) return;
		// 按旧→新顺序逐条 prepend，最后视觉上新的在顶部
		for (var i = 0; i < history.length; i++) {
			var extraClass = Notifications._classify(history[i]);
			$('<div>')
				.addClass('notification historical' + (extraClass ? ' ' + extraClass : ''))
				.css('opacity', 0.45)
				.text(history[i])
				.prependTo('div#notifications');
		}
	},
	
	printQueue: function(module) {
		if(typeof this.notifyQueue[module] != 'undefined') {
			while(this.notifyQueue[module].length > 0) {
				Notifications.printMessage(this.notifyQueue[module].shift());
			}
		}
	}
};
