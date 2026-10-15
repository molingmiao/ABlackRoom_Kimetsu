// Reuse the isolated real-browser harness with Android touch emulation.
process.env.GAME_BROWSER_FOCUS='mobile';
require('./test_browser.cjs');
