// Dependency-free browser integration smoke test. Uses an isolated, disposable Edge profile.
// Run with Node 22+ on Windows: node tools/test_browser.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function port() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}

(async () => {
  const edge = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  assert.ok(fs.existsSync(edge), 'Set EDGE_PATH to a Chromium browser executable');
  const server = http.createServer((req, res) => {
    const filename = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(filename, (error, data) => {
      if (error) { res.writeHead(404).end(); return; }
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' };
      res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kimetsu-browser-test-'));
  const debugPort = await port();
  const browser = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-port=' + debugPort, '--user-data-dir=' + profile,
    '--window-size=1280,1000', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  let call;
  try {
    let version;
    for (let i = 0; i < 100; i++) {
      try { version = await (await fetch('http://127.0.0.1:' + debugPort + '/json/version')).json(); break; }
      catch { await pause(100); }
    }
    assert.ok(version, 'browser did not start');
    socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let id = 0;
    const pending = new Map();
    const errors = [];
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (pending.has(message.id)) {
        const { resolve, reject, timeout } = pending.get(message.id);
        clearTimeout(timeout); pending.delete(message.id);
        if (message.error) reject(Error(JSON.stringify(message.error))); else resolve(message.result);
      }
    };
    call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timeout = setTimeout(() => { pending.delete(requestId); reject(Error('Timed out: ' + method)); }, 15000);
      pending.set(requestId, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id: requestId, method, params, sessionId }));
    });
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => call(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await page('Runtime.enable');
    await page('Network.enable');
    await page('Network.setBlockedURLs', { urls: ['https://*'] });
    await page('Page.enable');
    await page('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/index.html?lang=zh_cn' });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      ready = await evaluate('!!(window.Engine && Engine.activeModule && window.CombatStyles && window.CastleReport)');
      if (ready) break;
      await pause(100);
    }
    assert.ok(ready, 'game modules did not initialize');
    const checks = await evaluate(`(async function() {
      const checks = [];
      const check = (condition, name) => { if (!condition) throw Error(name); checks.push(name); };
      const settle = () => new Promise(resolve => setTimeout(resolve, 350));
      AudioEngine.playSound = AudioEngine.playBackgroundMusic = AudioEngine.playEventMusic = function() {};
      Engine.options.testerMode = false;
      $SM.set('playStats.audioAlertShown', true);
      $SM.setM('stores', {'wind armour':1,'nichirin katana':1,'bind kunai':1,'medicine':30,'cured meat':30,'wisteria oil':20,'teeth':100,'scales':100,'wood':100,'demon stone':5});
      if (!Path.panel) Path.init();
      if (!World.panel) World.init();
      if (!Ship.panel) Ship.init();
      Engine.activeModule = Ship;
      Ship.onArrival();
      check(!!document.querySelector('#shipPanel'), 'castle entrance renders');
      check(_('view last castle report') === '查看上次无限城战报', 'new and old translations coexist');
      check(_('medicine') !== 'medicine', 'original translations preserved');
      Path.outfit = {'nichirin katana':1,'medicine':5,'cured meat':5,'wisteria oil':5};
      $SM.set('outfit', Path.outfit);
      Engine.activeModule = Space;
      World.dead = false;
      Space.onArrival();
      check(World.health === World.getMaxHealth(), 'entry applies inherited HP before healing');
      World.setHp(World.health - 20);
      Space.showFloor();
      const beforeHeal = World.health;
      const medCount = Path.outfit.medicine;
      $('#spacePanel [data-hotkey="2"]').trigger('click');
      check(World.health > beforeHeal && Path.outfit.medicine === medCount - 1, 'preparation medicine uses real shared healing');
      Space.currentFloor = 10;
      Space.triggerBossFight();
      Events.clearTimeouts();
      Events.won = true;
      Events.fought = true;
      $('#buttons').empty();
      $('<div id="exitButtons">').appendTo('#buttons');
      Events.drawButtons(Events.activeEvent().scenes.start);
      $('#recraft').trigger('click');
      check(Events.activeScene === 'recraft' && $('#recraft_0').length === 1, 'boss supply scene visible');
      const beforePurchase = Path.outfit.medicine;
      $('#recraft_0').trigger('click'); $('#recraft_0').trigger('click');
      check(Path.outfit.medicine === beforePurchase + 2, 'repeat purchases stay in supply scene');
      $('#leave').trigger('click'); await settle();
      check(Events.activeEvent().title === _('slayer talent'), 'first boss reward opens after supply closes');
      $('#talent_0').trigger('click'); await settle();
      check(Events.activeEvent().title === _('slayer talent'), 'second boss reward opens');
      $('#talent_0').trigger('click'); await settle();
      check(Space.currentFloor === 11 && !Events.activeEvent(), 'boss rewards advance once');
      CastleReport.recordDamage(18, 'blood art');
      CastleReport.recordConsumption('medicine', 2);
      const report = CastleReport.finish('death');
      check(!!report && !!$SM.get('game.castleLastReport'), 'read-only result saved');
      CastleReport.show();
      check(document.querySelector('[role="dialog"]') !== null, 'result dialog renders');
      return checks;
    })()`);
    console.log(checks.map(name => 'PASS: ' + name).join('\n'));
    const screenshot = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const output = path.join(profile, 'castle-report.png');
    fs.writeFileSync(output, Buffer.from(screenshot.data, 'base64'));
    console.log('SCREENSHOT: ' + output);
    assert.deepEqual(errors, [], 'uncaught browser exceptions');
  } finally {
    if (call && socket?.readyState === WebSocket.OPEN) {
      try { await call('Browser.close'); } catch {}
    }
    socket?.close();
    browser.kill();
    server.closeAllConnections();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
