/** Responsive presentation only. Exploration and battle rules stay unchanged. */
var MobileUI = window.MobileUI = {
  usesTouchControls: function() {return window.matchMedia('(max-width: 760px)').matches;},
  sync: function() {
    var panel = Engine.activeModule && Engine.activeModule.panel;
    var id = panel && panel.attr('id');
    if (!id) return;
    $('body').attr('data-active-panel',id);
    $('.mobile-active-panel').removeClass('mobile-active-panel');
    panel.addClass('mobile-active-panel');
    MobileUI.ensureControls();
  },
  ensureControls: function() {
    if (!document.getElementById('worldPanel') || document.getElementById('mobileWorldControls')) return;
    var controls = $('<nav>').attr({id:'mobileWorldControls','aria-label':'地图方向控制'}).appendTo('#worldPanel');
    [['北','moveNorth'],['西','moveWest'],['东','moveEast'],['南','moveSouth']].forEach(function(entry) {
      $('<button>').attr({type:'button','aria-label':'向'+entry[0]+'走一步'}).text('向'+entry[0])
        .on('click',function(){if (Engine.activeModule === World && !Engine.keyLock && !Events.activeEvent() && !World.dead) World[entry[1]]();})
        .appendTo(controls);
    });
  },
  init: function() {
    MobileUI.sync();
    $(window).on('resize.mobile',MobileUI.sync);
  }
};
$(function(){MobileUI.init();});
