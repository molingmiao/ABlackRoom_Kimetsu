(function() {
  var Engine = window.Engine = {

    SITE_URL: encodeURIComponent("http://adarkroom.doublespeakgames.com"),
    VERSION: 1.4,
    MAX_STORE: 99999999999999,
    SAVE_DISPLAY: 30 * 1000,
    GAME_OVER: false,

    //object event types
    topics: {},

    Perks: {
      'fist form one': {
        name: _('fist form one'),
        desc: _('punches do more damage'),
        /// TRANSLATORS : means with more force.
        notify: _('learned to throw punches with purpose')
      },
      'fist form four': {
        name: _('fist form four'),
        desc: _('punches do even more damage.'),
        notify: _('learned to fight quite effectively without weapons')
      },
      'fist form master': {
        /// TRANSLATORS : master of unarmed combat
        name: _('fist form master'),
        desc: _('punch twice as fast, and with even more force'),
        notify: _('learned to strike faster without weapons')
      },
      'slash mastery': {
        name: _('slash mastery'),
        desc: _('melee weapons deal more damage'),
        notify: _('learned to swing weapons with force')
      },
      'breath no food': {
        name: _('breath no food'),
        desc: _('go twice as far without eating'),
        notify: _('learned how to ignore the hunger')
      },
      'breath no water': {
        name: _('breath no water'),
        desc: _('go twice as far without drinking'),
        notify: _('learned to love the dry air')
      },
      'step yushin': {
        name: _('step yushin'),
        desc: _('dodge attacks more effectively'),
        notify: _("learned to be where they're not")
      },
      'mikiri': {
        name: _('mikiri'),
        desc: _('land blows more often'),
        notify: _('learned to predict their movement')
      },
      'crow scout': {
        name: _('crow scout'),
        desc: _('see farther'),
        notify: _('learned to look ahead')
      },
      'kehai dansha': {
        name: _('kehai dansha'),
        desc: _('better avoid conflict in the wild'),
        notify: _('learned how not to be seen')
      },
      'breath nourish': {
        name: _('breath nourish'),
        desc: _('restore more health when eating'),
        notify: _('learned to make the most of food')
      },
      'water breath I': {
        name: _('water breath I'),
        desc: _('melee weapons deal slightly more damage'),
        notify: _('found a rhythm with the blade. the strikes flow now.')
      },
      'flame breath I': {
        name: _('flame breath I'),
        desc: _('the wisteria gun strikes harder'),
        notify: _('breath aligns with the trigger. the gun answers in kind.')
      },
      'thunder breath I': {
        name: _('thunder breath I'),
        desc: _('ranged shots land with extra force'),
        notify: _('every shot now arrives a moment ahead of expectation.')
      }
    },

    options: {
      state: null,
      debug: false,
      log: false,
      dropbox: false,
      doubleTime: false,
      testerMode: false,
      timeScale: 1,
      combatTimeScale: 1
    },

    // 日轮刀颜色派生表：根据玩家当前持有的呼吸法 perks 决定刀刃显色。
    // 优先级从上到下；每个颜色含描述与对 'nichirin katana' 武器的伤害乘数。
    NichirinColors: {
      'red':    { name: _('red'),    desc: _('sunbreathing extreme — 1.5x damage'),         mult: 1.5 },
      'black':  { name: _('black'),  desc: _('sun breathing — 1.3x damage'),                mult: 1.3 },
      'purple': { name: _('purple'), desc: _('mist breathing — 1.25x damage'),              mult: 1.25 },
      'white':  { name: _('white'),  desc: _('wind breathing — 1.2x damage'),               mult: 1.2 },
      'blue':   { name: _('blue'),   desc: _('water breathing — 1.15x damage'),             mult: 1.15 },
      'pink':   { name: _('pink'),   desc: _('love breathing — restore 2 hp on hit'),       mult: 1.0, healOnHit: 2 },
      'silver': { name: _('silver'), desc: _('blank nichirin steel — no buff yet'),         mult: 1.0 }
    },

    getNichirinColor: function() {
      if (!$SM || !$SM.hasPerk) return 'silver';
      if ($SM.hasPerk('slash mastery') && $SM.hasPerk('fist form master')) return 'red';
      if ($SM.hasPerk('crow scout') && $SM.hasPerk('kehai dansha'))         return 'black';
      if ($SM.hasPerk('mikiri'))                                            return 'purple';
      if ($SM.hasPerk('step yushin'))                                       return 'white';
      if ($SM.hasPerk('breath nourish'))                                    return 'pink';
      if ($SM.hasPerk('breath no food') || $SM.hasPerk('breath no water'))  return 'blue';
      return 'silver';
    },

    init: function(options) {
      this.options = $.extend(
        this.options,
        options
      );
      this._debug = this.options.debug;
      this._log = this.options.log;

      // Check for HTML5 support
      if(!Engine.browserValid()) {
        window.location = 'browserWarning.html';
      }

      // Check for mobile
      if(Engine.isMobile()) {
        window.location = 'mobileWarning.html';
      }

      Engine.disableSelection();

      if(this.options.state != null) {
        window.State = this.options.state;
      } else {
        Engine.loadGame();
      }

      // start loading music and events early
      for (var key in AudioLibrary) {
        if (
          key.toString().indexOf('MUSIC_') > -1 ||
          key.toString().indexOf('EVENT_') > -1) {
            AudioEngine.loadAudioFile(AudioLibrary[key]);
          }
      }

      $('<div>').attr('id', 'locationSlider').appendTo('#main');

      var menu = $('<div>')
        .addClass('menu')
        .appendTo('body');

      // 菜单折叠入口：默认只显示这一行，hover 整个菜单时展开（桌面）；
      // 触屏点击也可切换 .open 状态
      $('<span>')
        .addClass('menuToggle')
        .text(_('menu.'))
        .on('click', function(e) {
          e.stopPropagation();
          menu.toggleClass('open');
        })
        .appendTo(menu);

      // 点击菜单外区域收起
      $(document).on('click', function(e) {
        if (!$(e.target).closest('.menu').length) {
          menu.removeClass('open');
        }
      });

      if(typeof langs != 'undefined'){
        // 语言选择：独立右下角，点击“语言。”开合列表（不再 hover 自弹）
        var langSwitcher = $('<div>')
          .attr('id', 'langSwitcher')
          .appendTo('body');
        var customSelect = $('<span>')
          .addClass('customSelect menuBtn')
          .appendTo(langSwitcher);
        var selectOptions = $('<span>')
          .addClass('customSelectOptions')
          .appendTo(customSelect);
        var optionsList = $('<ul>')
          .appendTo(selectOptions);
        $('<li>')
          .text(_('language.'))
          .on('click', function(e) {
            e.stopPropagation();
            optionsList.toggleClass('open');
          })
          .appendTo(optionsList);
        // 点击全局别处则收起
        $(document).on('click.langSwitcher', function(e) {
          if (!$(e.target).closest('#langSwitcher').length) {
            optionsList.removeClass('open');
          }
        });

        $.each(langs, function(name,display){
          $('<li>')
            .text(display)
            .attr('data-language', name)
            .on('click', function() {
              optionsList.removeClass('open');
              Engine.switchLanguage(this);
            })
            .appendTo(optionsList);
        });
      }

      $('<span>')
        .addClass('volume menuBtn')
        .text(_('sound on.'))
        .click(() => Engine.toggleVolume())
        .appendTo(menu);

      $('<span>')
        .addClass('lightsOff menuBtn')
        .text(_('lights off.'))
        .click(Engine.turnLightsOff)
        .appendTo(menu);

      $('<span>')
        .addClass('hyper menuBtn')
        .text(_('hyper.'))
        .click(Engine.confirmHyperMode)
        .appendTo(menu);

      /* @strip:tester-start */
      $('<span>')
        .addClass('tester menuBtn')
        .text(_('tester.'))
        .click(Engine.toggleTesterMode)
        .appendTo(menu);

      // Tester panel: speed selector
      var testerPanel = $('<div>')
        .attr('id', 'testerPanel')
        .appendTo('body');
      // 菜单/世界倍速行
      var menuRow = $('<div>').addClass('speedRow').appendTo(testerPanel);
      $('<span>').addClass('testerLabel').text(_('menu speed: ')).appendTo(menuRow);
      [1, 2, 3, 4, 5, 6].forEach(function(s) {
        $('<span>')
          .addClass('speedBtn menuSpeedBtn menuBtn')
          .attr('data-speed', s)
          .text(s + 'x')
          .click(function() { Engine.setTimeScale(s); })
          .appendTo(menuRow);
      });
      $('<span>').addClass('currentSpeed menuCurrentSpeed').appendTo(menuRow);
      // 战斗倍速行（独立于菜单倍速）
      var combatRow = $('<div>').addClass('speedRow').appendTo(testerPanel);
      $('<span>').addClass('testerLabel').text(_('combat speed: ')).appendTo(combatRow);
      [1, 2, 3, 4, 5, 6].forEach(function(s) {
        $('<span>')
          .addClass('speedBtn combatSpeedBtn menuBtn')
          .attr('data-speed', s)
          .text(s + 'x')
          .click(function() { Engine.setCombatTimeScale(s); })
          .appendTo(combatRow);
      });
      $('<span>').addClass('currentSpeed combatCurrentSpeed').appendTo(combatRow);
      /* @strip:tester-end */

      $('<span>')
        .addClass('menuBtn')
        .text(_('restart.'))
        .click(Engine.confirmDelete)
        .appendTo(menu);

      // 成就按钮——独立放菜单右侧（不在 menu 容器里）
      $('<div>')
        .attr('id', 'achievementsBtn')
        .addClass('menuBtn')
        .text(_('achievements'))
        .click(function() { Achievements.showPanel(); })
        .appendTo('body');

      $('<span>')
        .addClass('menuBtn')
        .text(_('share.'))
        .click(Engine.share)
        .appendTo(menu);

      $('<span>')
        .addClass('menuBtn')
        .text(_('save.'))
        .click(Engine.exportImport)
        .appendTo(menu);

      if(this.options.dropbox && Engine.Dropbox) {
        this.dropbox = Engine.Dropbox.init();

        $('<span>')
          .addClass('menuBtn')
          .text(_('dropbox.'))
          .click(Engine.Dropbox.startDropbox)
          .appendTo(menu);
      }

      $('<span>')
        .addClass('menuBtn')
        .text(_('github.'))
        .click(function() { window.open('https://github.com/doublespeakgames/adarkroom'); })
        .appendTo(menu)
        .hide(); // 暂隐，依后替换为鬼灭版 GitHub 链接后再启用;

      // Register keypress handlers
      $('body').off('keydown').keydown(Engine.keyDown);
      $('body').off('keyup').keyup(Engine.keyUp);

      // Register swipe handlers
      swipeElement = $('#outerSlider');
      swipeElement.on('swipeleft', Engine.swipeLeft);
      swipeElement.on('swiperight', Engine.swipeRight);
      swipeElement.on('swipeup', Engine.swipeUp);
      swipeElement.on('swipedown', Engine.swipeDown);

      // subscribe to stateUpdates
      $.Dispatch('stateUpdate').subscribe(Engine.handleStateUpdates);

      $SM.init();
      AudioEngine.init();
      Notifications.init();
      Events.init();
      Room.init();


      if($SM.get('features.location.outside') || typeof $SM.get('stores.wood') != 'undefined') {
        Outside.init();
      }
      if($SM.get('features.location.path') || $SM.get('stores.compass', true) > 0) {
        Path.init();
      }
      if ($SM.get('features.location.fabricator')) {
        Fabricator.init();
      }
      if($SM.get('features.location.spaceShip')) {
        Ship.init();
      }

      if($SM.get('config.lightsOff', true)){
        Engine.turnLightsOff();
      }

      if($SM.get('config.hyperMode', true)){
        Engine.triggerHyperMode();
      }

      /* @strip:tester-start */
      if($SM.get('config.testerMode', true)){
        Engine.options.testerMode = true;
        Engine.options.timeScale = $SM.get('config.timeScale', true) || 1;
        Engine.options.combatTimeScale = $SM.get('config.combatTimeScale', true) || 1;
        Engine.updateTesterPanel();
      }
      /* @strip:tester-end */

      Engine.toggleVolume(Boolean($SM.get('config.soundOn')));
      if(!AudioEngine.isAudioContextRunning()){
        document.addEventListener('click', Engine.resumeAudioContext, true);
      }
      
      Engine.saveLanguage();
      // 血脉传承：跨周目累计击杀达阈时，在新存档起步后应用起始奖励一次
      try { Prestige.applyLegacy(); } catch (e) { Engine.log('applyLegacy failed: ' + e); }
      // 初始化成就系统
      try { Achievements.init(); } catch (e) { Engine.log('Achievements.init failed: ' + e); }
      Engine.travelTo(Room);

      setTimeout(notifyAboutSound, 3000);

    },
    resumeAudioContext: function () {
      AudioEngine.tryResumingAudioContext();
      
      // turn on music!
          AudioEngine.setMasterVolume($SM.get('config.soundOn') ? 1.0 : 0.0, 0);

      document.removeEventListener('click', Engine.resumeAudioContext);
    },
    browserValid: function() {
      return ( location.search.indexOf( 'ignorebrowser=true' ) >= 0 || ( typeof Storage != 'undefined' && !oldIE ) );
    },

    isMobile: function() {
      return ( location.search.indexOf( 'ignorebrowser=true' ) < 0 && /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test( navigator.userAgent ) );
    },

    saveGame: function() {
      if(typeof Storage == 'undefined' || !window.localStorage) return;
      if(Engine._saveTimer != null) {
        clearTimeout(Engine._saveTimer);
      }
      try {
        var serialized = JSON.stringify(State);
        localStorage.setItem('gameState', serialized);
        if(typeof Engine._lastNotify == 'undefined' || Date.now() - Engine._lastNotify > Engine.SAVE_DISPLAY){
          $('#saveNotify').css('opacity', 1).animate({opacity: 0}, 1000, 'linear');
          Engine._lastNotify = Date.now();
        }
      } catch(e) {
        // 存档超额 / 隐私模式 / 磁盘满 等场景
        Engine.log('saveGame failed: ' + e);
        if(!Engine._saveErrorShown){
          Engine._saveErrorShown = true;
          try {
            Notifications.notify(null, _('save failed. browser storage may be full or disabled.'));
          } catch(_ignored) { /* Notifications 可能尚未 init */ }
        }
      }
    },

    loadGame: function() {
      try {
        var raw = (typeof Storage != 'undefined' && window.localStorage) ? localStorage.getItem('gameState') : null;
        var savedState = raw ? JSON.parse(raw) : null;
        if(savedState) {
          State = savedState;
          $SM.updateOldState();
          Engine.log("loaded save!");
          return;
        }
      } catch(e) {
        Engine.log('loadGame failed, starting fresh: ' + e);
      }
      State = {};
      $SM.set('version', Engine.VERSION);
      Engine.event('progress', 'new game');
    },

    exportImport: function() {
      Events.startEvent({
        title: _('Export / Import'),
        scenes: {
          start: {
            text: [
              _('export or import save data, for backing up'),
              _('or migrating computers')
            ],
            buttons: {
              'export': {
                text: _('export'),
                nextScene: {1: 'inputExport'}
              },
              'import': {
                text: _('import'),
                nextScene: {1: 'confirm'}
              },
              'cancel': {
                text: _('cancel'),
                nextScene: 'end'
              }
            }
          },
          'inputExport': {
            text: [_('save this.')],
            textarea: Engine.export64(),
            onLoad: function() { Engine.event('progress', 'export'); },
            readonly: true,
            buttons: {
              'done': {
                text: _('got it'),
                nextScene: 'end',
                onChoose: Engine.disableSelection
              }
            }
          },
          'confirm': {
            text: [
              _('are you sure?'),
              _('if the code is invalid, all data will be lost.'),
              _('this is irreversible.')
            ],
            buttons: {
              'yes': {
                text: _('yes'),
                nextScene: {1: 'inputImport'},
                onChoose: Engine.enableSelection
              },
              'no': {
                text: _('no'),
                nextScene: {1: 'start'}
              }
            }
          },
          'inputImport': {
            text: [_('put the save code here.')],
            textarea: '',
            buttons: {
              'okay': {
                text: _('import'),
                nextScene: 'end',
                onChoose: Engine.import64
              },
              'cancel': {
                text: _('cancel'),
                nextScene: 'end'
              }
            }
          }
        }
      });
    },

    generateExport64: function(){
      var raw = '';
      try {
        raw = (typeof Storage != 'undefined' && window.localStorage)
          ? (localStorage.getItem('gameState') || '')
          : '';
      } catch(e) {
        Engine.log('export read failed: ' + e);
      }
      var string64 = Base64.encode(raw);
      string64 = string64.replace(/\s/g, '');
      string64 = string64.replace(/\./g, '');
      string64 = string64.replace(/\n/g, '');

      return string64;
    },

    export64: function() {
      Engine.saveGame();
      Engine.enableSelection();
      return Engine.generateExport64();
    },

    import64: function(string64) {
      Engine.event('progress', 'import');
      Engine.disableSelection();
      string64 = string64.replace(/\s/g, '');
      string64 = string64.replace(/\./g, '');
      string64 = string64.replace(/\n/g, '');
      var decodedSave;
      try {
        decodedSave = Base64.decode(string64);
        // 快速验证是合法 JSON，避免写入脑残后加载崩溃
        JSON.parse(decodedSave);
      } catch(e) {
        Engine.log('import failed: ' + e);
        try { Notifications.notify(null, _('import failed. the save string is invalid.')); }
        catch(_ignored) { /* no-op */ }
        return;
      }
      try {
        localStorage.setItem('gameState', decodedSave);
      } catch(e) {
        Engine.log('import write failed: ' + e);
        try { Notifications.notify(null, _('import failed. browser storage may be full or disabled.')); }
        catch(_ignored) { /* no-op */ }
        return;
      }
      location.reload();
    },

    event: function(cat, act) {
      if(typeof ga === 'function') {
        ga('send', 'event', cat, act);
      }
    },

    confirmDelete: function() {
      Events.startEvent({
        title: _('Restart?'),
        scenes: {
          start: {
            text: [_('restart the game?')],
            buttons: {
              'yes': {
                text: _('yes'),
                nextScene: 'end',
                onChoose: Engine.deleteSave
              },
              'no': {
                text: _('no'),
                nextScene: 'end'
              }
            }
          }
        }
      });
    },

    deleteSave: function(noReload) {
      if(typeof Storage != 'undefined' && window.localStorage) {
        var prestige = Prestige.get();
        window.State = {};
        try { localStorage.clear(); }
        catch(e) { Engine.log('deleteSave clear failed: ' + e); }
        Prestige.set(prestige);
      }
      if(!noReload) {
        location.reload();
      }
    },

    getApp: function() {
      Events.startEvent({
        title: _('Get the App'),
        scenes: {
          start: {
            text: [_('bring the room with you.')],
            buttons: {
              'ios': {
                text: _('ios'),
                nextScene: 'end',
                onChoose: function () {
                  window.open('https://itunes.apple.com/app/apple-store/id736683061?pt=2073437&ct=adrproper&mt=8');
                }
              },
              'android': {
                text: _('android'),
                nextScene: 'end',
                onChoose: function() {
                  window.open('https://play.google.com/store/apps/details?id=com.yourcompany.adarkroom');
                }
              },
              'close': {
                text: _('close'),
                nextScene: 'end'
              }
            }
          }
        }
      });
    },

    share: function() {
      Events.startEvent({
        title: _('Share'),
        scenes: {
          start: {
            text: [_('bring your friends.')],
            buttons: {
              'facebook': {
                text: _('facebook'),
                nextScene: 'end',
                onChoose: function() {
                  window.open('https://www.facebook.com/sharer/sharer.php?u=' + Engine.SITE_URL, 'sharer', 'width=626,height=436,location=no,menubar=no,resizable=no,scrollbars=no,status=no,toolbar=no');
                }
              },
              'google': {
                text:_('google+'),
                nextScene: 'end',
                onChoose: function() {
                  window.open('https://plus.google.com/share?url=' + Engine.SITE_URL, 'sharer', 'width=480,height=436,location=no,menubar=no,resizable=no,scrollbars=no,status=no,toolbar=no');
                }
              },
              'twitter': {
                text: _('twitter'),
                nextScene: 'end',
                onChoose: function() {
                  window.open('https://twitter.com/intent/tweet?text=A%20Dark%20Room&url=' + Engine.SITE_URL, 'sharer', 'width=660,height=260,location=no,menubar=no,resizable=no,scrollbars=yes,status=no,toolbar=no');
                }
              },
              'reddit': {
                text: _('reddit'),
                nextScene: 'end',
                onChoose: function() {
                  window.open('http://www.reddit.com/submit?url=' + Engine.SITE_URL, 'sharer', 'width=960,height=700,location=no,menubar=no,resizable=no,scrollbars=yes,status=no,toolbar=no');
                }
              },
              'close': {
                text: _('close'),
                nextScene: 'end'
              }
            }
          }
        }
      },
      {
        width: '400px'
      });
    },

    findStylesheet: function(title) {
      for(var i=0; i<document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        if(sheet.title == title) {
          return sheet;
        }
      }
      return null;
    },

    isLightsOff: function() {
      var darkCss = Engine.findStylesheet('darkenLights');
      if ( darkCss != null && !darkCss.disabled ) {
        return true;
      }
      return false;
    },

    turnLightsOff: function() {
      var darkCss = Engine.findStylesheet('darkenLights');
      if (darkCss == null) {
        $('head').append('<link rel="stylesheet" href="css/dark.css" type="text/css" title="darkenLights" />');
        $('.lightsOff').text(_('lights on.'));
        $SM.set('config.lightsOff', true, true);
      } else if (darkCss.disabled) {
        darkCss.disabled = false;
        $('.lightsOff').text(_('lights on.'));
        $SM.set('config.lightsOff', true,true);
      } else {
        $("#darkenLights").attr("disabled", "disabled");
        darkCss.disabled = true;
        $('.lightsOff').text(_('lights off.'));
        $SM.set('config.lightsOff', false, true);
      }
    },

    confirmHyperMode: function(){
      if (!Engine.options.doubleTime) {
        Events.startEvent({
          title: _('Go Hyper?'),
          scenes: {
            start: {
              text: [_('turning hyper mode speeds up the game to x2 speed. do you want to do that?')],
              buttons: {
                'yes': {
                  text: _('yes'),
                  nextScene: 'end',
                  onChoose: Engine.triggerHyperMode
                },
                'no': {
                  text: _('no'),
                  nextScene: 'end'
                }
              }
            }
          }
        });
      } else {
        Engine.triggerHyperMode();
      }
    },

    triggerHyperMode: function() {
      Engine.options.doubleTime = !Engine.options.doubleTime;
      if(Engine.options.doubleTime)
        $('.hyper').text(_('classic.'));
      else
        $('.hyper').text(_('hyper.'));

      $SM.set('config.hyperMode', Engine.options.doubleTime, false);
    },

    toggleTesterMode: function() {
      Engine.options.testerMode = !Engine.options.testerMode;
      if (!Engine.options.testerMode) {
        Engine.options.timeScale = 1;
        Engine.options.combatTimeScale = 1;
      }
      Engine.updateTesterPanel();
      $SM.set('config.testerMode', Engine.options.testerMode, false);
      $SM.set('config.timeScale', Engine.options.timeScale, false);
      $SM.set('config.combatTimeScale', Engine.options.combatTimeScale, false);
    },

    setTimeScale: function(scale) {
      Engine.options.timeScale = scale;
      Engine.updateTesterPanel();
      $SM.set('config.timeScale', scale, false);
    },

    setCombatTimeScale: function(scale) {
      Engine.options.combatTimeScale = scale;
      Engine.updateTesterPanel();
      $SM.set('config.combatTimeScale', scale, false);
    },

    updateTesterPanel: function() {
      var panel = $('#testerPanel');
      if (Engine.options.testerMode) {
        panel.show();
        $('.tester').text(_('tester off.'));
      } else {
        panel.hide();
        $('.tester').text(_('tester.'));
      }
      $('.speedBtn').removeClass('active');
      $('.menuSpeedBtn[data-speed="' + Engine.options.timeScale + '"]').addClass('active');
      $('.combatSpeedBtn[data-speed="' + Engine.options.combatTimeScale + '"]').addClass('active');
      $('.menuCurrentSpeed').text(' → ' + Engine.options.timeScale + 'x');
      $('.combatCurrentSpeed').text(' → ' + Engine.options.combatTimeScale + 'x');
    },

    // Gets a guid
    getGuid: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    },

    activeModule: null,

    travelTo: function(module) {
      if(Engine.activeModule == module) {
        return;
      }

      var currentIndex = Engine.activeModule ? $('.location').index(Engine.activeModule.panel) : 1;
      $('div.headerButton').removeClass('selected');
      module.tab.addClass('selected');

      var slider = $('#locationSlider');
      var stores = $('#storesContainer');
      var panelIndex = $('.location').index(module.panel);
      var diff = Math.abs(panelIndex - currentIndex);
      slider.animate({left: -(panelIndex * 910) + 'px'}, 300 * diff);

      if($SM.get('stores.wood') !== undefined) {
        // FIXME Why does this work if there's an animation queue...?
        stores.animate({right: -(panelIndex * 910) + 'px'}, 300 * diff);
      }

      if(Engine.activeModule == Room || Engine.activeModule == Path || Engine.activeModule == Fabricator) {
        // Don't fade out the weapons if we're switching to a module
        // where we're going to keep showing them anyway.
        if (module != Room && module != Path && module != Fabricator) {
          $('div#weapons').animate({opacity: 0}, 300);
        }
      }

      if(module == Room || module == Path || module == Fabricator) {
        $('div#weapons').animate({opacity: 1}, 300);
      }

      Engine.activeModule = module;
      module.onArrival(diff);
      Notifications.printQueue(module);
    },

    /* Move the stores panel beneath top_container (or to top: 0px if top_container
     * either hasn't been filled in or is null) using transition_diff to sync with
     * the animation in Engine.travelTo().
     */
    moveStoresView: function(top_container, transition_diff) {
      var stores = $('#storesContainer');

      // If we don't have a storesContainer yet, leave.
      if(typeof(stores) === 'undefined') return;

      if(typeof(transition_diff) === 'undefined') transition_diff = 1;

      if(top_container === null) {
        stores.animate({top: '0px'}, {queue: false, duration: 300 * transition_diff});
      }
      else if(!top_container.length) {
        stores.animate({top: '0px'}, {queue: false, duration: 300 * transition_diff});
      }
      else {
        stores.animate({
          top: top_container.height() + 26 + 'px'
        }, {
          queue: false,
          duration: 300 * transition_diff
        });
      }
    },

    log: function(msg) {
      if(this._log) {
        console.log(msg);
      }
    },

    updateSlider: function() {
      var slider = $('#locationSlider');
      slider.width((slider.children().length * 910) + 'px');
    },

    updateOuterSlider: function() {
      var slider = $('#outerSlider');
      slider.width((slider.children().length * 910) + 'px');
    },

    getIncomeMsg: function(num, delay) {
      return _("{0} per {1}s", (num > 0 ? "+" : "") + num, delay);
      //return (num > 0 ? "+" : "") + num + " per " + delay + "s";
    },

    keyLock: false,
    tabNavigation: true,
    restoreNavigation: false,

    keyDown: function(e) {
      e = e || window.event;
      if(!Engine.keyPressed && !Engine.keyLock) {
        Engine.pressed = true;
        if(Engine.activeModule.keyDown) {
          Engine.activeModule.keyDown(e);
        }
      }
      return jQuery.inArray(e.keycode, [37,38,39,40]) < 0;
    },

    keyUp: function(e) {
      Engine.pressed = false;
      if(Engine.activeModule.keyUp) {
        Engine.activeModule.keyUp(e);
      } else {
        switch(e.which) {
          case 38: // Up
          case 87:
            Engine.log('up');
            break;
          case 40: // Down
          case 83:
            Engine.log('down');
            break;
          case 37: // Left
          case 65:
            if (Engine.tabNavigation) {
              if (Engine.activeModule == Ship && Fabricator.tab) {
                Engine.travelTo(Fabricator);
              }
              else if ((Engine.activeModule == Ship || Engine.activeModule == Fabricator) && Path.tab) {
                Engine.travelTo(Path);
              }
              else if (Engine.activeModule == Path && Outside.tab) {
                Engine.travelTo(Outside);
              } 
              else if (Engine.activeModule == Outside && Room.tab) {
                Engine.travelTo(Room);
              }
            }
            Engine.log('left');
            break;
          case 39: // Right
          case 68:
            if (Engine.tabNavigation){
              if (Engine.activeModule == Room && Outside.tab) {
                Engine.travelTo(Outside);
              }
              else if (Engine.activeModule == Outside && Path.tab){
                Engine.travelTo(Path);
              }
              else if(Engine.activeModule == Path && Fabricator.tab) {
                Engine.travelTo(Fabricator);
              }
              else if ((Engine.activeModule == Path || Engine.activeModule == Fabricator) && Ship.tab){
                Engine.travelTo(Ship);
              }
            }
            Engine.log('right');
            break;
        }
      }
      if(Engine.restoreNavigation){
        Engine.tabNavigation = true;
        Engine.restoreNavigation = false;
      }
      return false;
    },

    swipeLeft: function(e) {
      if(Engine.activeModule.swipeLeft) {
        Engine.activeModule.swipeLeft(e);
      }
    },

    swipeRight: function(e) {
      if(Engine.activeModule.swipeRight) {
        Engine.activeModule.swipeRight(e);
      }
    },

    swipeUp: function(e) {
      if(Engine.activeModule.swipeUp) {
        Engine.activeModule.swipeUp(e);
      }
    },

    swipeDown: function(e) {
      if(Engine.activeModule.swipeDown) {
        Engine.activeModule.swipeDown(e);
      }
    },

    disableSelection: function() {
      document.onselectstart = eventNullifier; // this is for IE
      document.onmousedown = eventNullifier; // this is for the rest
    },

    enableSelection: function() {
      document.onselectstart = eventPassthrough;
      document.onmousedown = eventPassthrough;
    },

    autoSelect: function(selector) {
      $(selector).focus().select();
    },

    handleStateUpdates: function(e){

    },

    switchLanguage: function(dom){
      var lang = $(dom).data("language");
      if(document.location.href.search(/[\?\&]lang=[a-z_]+/) != -1){
        document.location.href = document.location.href.replace( /([\?\&]lang=)([a-z_]+)/gi , "$1"+lang );
      }else{
        document.location.href = document.location.href + ( (document.location.href.search(/\?/) != -1 )?"&":"?") + "lang="+lang;
      }
    },

    saveLanguage: function(){
      var lang = decodeURIComponent((new RegExp('[?|&]lang=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||["",""])[1].replace(/\+/g, '%20'))||null;
      if(lang && typeof Storage != 'undefined' && window.localStorage) {
        try { localStorage.setItem('lang', lang); }
        catch(e) { Engine.log('saveLanguage failed: ' + e); }
      }
    },

    toggleVolume: function(enabled /* optional */) {
      if (enabled == null) {
        enabled = !$SM.get('config.soundOn');
      }
      if (!enabled) {
        $('.volume').text(_('sound on.'));
        $SM.set('config.soundOn', false);
        AudioEngine.setMasterVolume(0.0);
      } else {
        $('.volume').text(_('sound off.'));
        $SM.set('config.soundOn', true);
        AudioEngine.setMasterVolume(1.0);
      }
    },

    setInterval: function(callback, interval, skipDouble){
      if( Engine.options.doubleTime && !skipDouble ){
        Engine.log('Double time, cutting interval in half');
        interval /= 2;
      }
      if( Engine.options.testerMode && Engine.options.timeScale > 1 && !skipDouble ){
        interval /= Engine.options.timeScale;
      }

      return setInterval(callback, interval);

    },

    setTimeout: function(callback, timeout, skipDouble){

      if( Engine.options.doubleTime && !skipDouble ){
        Engine.log('Double time, cutting timeout in half');
        timeout /= 2;
      }
      if( Engine.options.testerMode && Engine.options.timeScale > 1 && !skipDouble ){
        timeout /= Engine.options.timeScale;
      }

      return setTimeout(callback, timeout);

    },

    // 战斗专用：受 combatTimeScale 控制（与菜单 timeScale 独立）
    // 让玩家可以菜单常速、战斗高速；或反之
    combatSetInterval: function(callback, interval){
      if( Engine.options.testerMode && Engine.options.combatTimeScale > 1 ){
        interval /= Engine.options.combatTimeScale;
      }
      return setInterval(callback, interval);
    },

    combatSetTimeout: function(callback, timeout){
      if( Engine.options.testerMode && Engine.options.combatTimeScale > 1 ){
        timeout /= Engine.options.combatTimeScale;
      }
      return setTimeout(callback, timeout);
    }
  };

  function eventNullifier(e) {
    return $(e.target).hasClass('menuBtn');
  }

  function eventPassthrough(e) {
    return true;
  }

  function notifyAboutSound() {
    if ($SM.get('playStats.audioAlertShown')) {
      return;
    }

    // Tell new users that there's sound now!
    $SM.set('playStats.audioAlertShown', true);
    Events.startEvent({
      title: _('Sound Available!'),
      scenes: {
        start: {
          text: [
            _('ears flooded with new sensations.'),
            _('perhaps silence is safer?')
          ],
          buttons: {
            'yes': {
              text: _('enable audio'),
              nextScene: 'end',
              onChoose: () => Engine.toggleVolume(true)
            },
            'no': {
              text: _('disable audio'),
              nextScene: 'end',
              onChoose: () => Engine.toggleVolume(false)
            }
          }
        }
      }
    });
  }

})();

function inView(dir, elem){

  var scTop = $('#main').offset().top;
  var scBot = scTop + $('#main').height();

  var elTop = elem.offset().top;
  var elBot = elTop + elem.height();

  if( dir == 'up' ){
    // STOP MOVING IF BOTTOM OF ELEMENT IS VISIBLE IN SCREEN
    return ( elBot < scBot );
  } else if( dir == 'down' ){
    return ( elTop > scTop );
  } else {
    return ( ( elBot <= scBot ) && ( elTop >= scTop ) );
  }

}

function setYPosition(elem, y) {
  var elTop = parseInt( elem.css('top'), 10 );
  elem.css('top', `${y}px`);
}


//create jQuery Callbacks() to handle object events
$.Dispatch = function( id ) {
  var callbacks, topic = id && Engine.topics[ id ];
  if ( !topic ) {
    callbacks = jQuery.Callbacks();
    topic = {
      publish: callbacks.fire,
      subscribe: callbacks.add,
      unsubscribe: callbacks.remove
    };
    if ( id ) {
      Engine.topics[ id ] = topic;
    }
  }
  return topic;
};

$(function() {
  Engine.init();
});
