/** Shared rules for opening read-only camp panels and committing camp actions. */
window.UIContext = {
  canInspect: function() {
    if (!window.Engine || !window.Events || Engine.keyLock || Events.activeEvent()) return false;
    if (![window.Room,window.Outside,window.Path,window.Ship,window.Fabricator].some(function(module){return module && module === Engine.activeModule;})) return false;
    return !document.querySelector('[role="dialog"],#achievementsOverlay,#castleReportOverlay,#loadoutEditorOverlay,#scrapQuantityOverlay,#buyQuantityOverlay,#nichirinForgeOverlay');
  }
};
