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
  const browser = spawn(edge, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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
    await page('Page.addScriptToEvaluateOnNewDocument', { source: "if (!localStorage.getItem('gameState')) localStorage.setItem('gameState', JSON.stringify({version:1.4,game:{prologue:{done:true}},playStats:{audioAlertShown:true}}));" });
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
      const check = (condition, name) => {
        if (!condition) throw Error(name + ': ' + JSON.stringify({floor: Space.currentFloor, scene: Events.activeScene, stack: Events.eventStack.map(e => ({title:e.title,ending:e.ending})), done:Space.done}));
        checks.push(name);
      };
      const finishClick = async selector => {
        const before = Events.activeEvent();
        $(selector).trigger('click');
        for (let i = 0; i < 100; i++) {
          if (Events.activeEvent() !== before) return;
          await new Promise(resolve => setTimeout(resolve, 30));
        }
        throw Error('event did not finish: ' + selector);
      };
      const until = async predicate => {
        for (let i = 0; i < 160; i++) {
          if (predicate()) return;
          await new Promise(resolve => setTimeout(resolve, 30));
        }
        throw Error('browser state did not settle: ' + JSON.stringify({checks,focus:document.activeElement.tagName,key:$('#attack_nichirin-katana').attr('data-hotkey'),visible:$('#attack_nichirin-katana').is(':visible'),classes:$('#attack_nichirin-katana').attr('class'),cooldown:$('#attack_nichirin-katana').data('onCooldown'),hp:$('#enemy').data('hp')}));
      };
      AudioEngine.playSound = AudioEngine.playBackgroundMusic = AudioEngine.playEventMusic = function() {};
      Engine.options.testerMode = false;
      $SM.set('playStats.audioAlertShown', true);
      $SM.setM('stores', {'wind armour':1,'nichirin katana':1,'bind kunai':1,'medicine':30,'cured meat':30,'wisteria oil':20,'teeth':100,'scales':100,'wood':100,'demon stone':5});
      if (!Path.panel) Path.init();
      if (!World.panel) World.init();
      if (!Ship.panel) Ship.init();
      Path.outfit = { medicine:3, 'cured meat':2 };
      $SM.set('outfit', Path.outfit);
      $('#loadoutSelect').val('castle').trigger('change');
      $('#saveLoadoutBtn').trigger('click');
      check($SM.get('character.loadouts.castle').targets.medicine === 3, 'save loadout button records targets');
      Path.outfit.medicine = 1;
      const storedMedicine = $SM.get('stores.medicine');
      $('#autoFillBtn').trigger('click');
      check(Path.outfit.medicine === 3 && $SM.get('stores.medicine') === storedMedicine, 'refill button tops up without charging inventory twice');
      Engine.activeModule = Ship;
      $SM.addPerk('water breath I'); $SM.addPerk('flame breath I'); $SM.addPerk('thunder breath I');
      Ship.onArrival();
      $('[data-style="water"]').trigger('click');
      check(CombatStyles.getSelected() === 'water', 'form picker selects an unlocked style');
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
      const fight = () => {
        Space.triggerBattle(false);
        clearInterval(Events._enemyAttackTimer);
        (Events._specialTimers || []).forEach(clearInterval);
        $('#enemy').data('hp',1000).data('maxHp',1000);
      };
      const endFight = async () => {
        Events.clearTimeouts();
        await new Promise(resolve => Events.endEvent(resolve));
      };
      const selectForm = id => {
        Engine.activeModule = Ship;
        Ship.onArrival();
        $('[data-style="' + id + '"]').trigger('click');
        Engine.activeModule = Space;
      };
      fight();
      World.setHp(World.getMaxHealth() - 30);
      $('#wanderer').data('hp',World.health);
      const waterHealing = CastleReport._run.healingReceived;
      for(let i=0;i<3;i++) Events.damage($('#wanderer'),$('#enemy'),10,'melee',null,{weaponName:'nichirin katana'});
      check(CombatStyles._fight.combo === 0 && CombatStyles._fight.guardUntil > Date.now(), 'actual water hits activate flow guard');
      check(CastleReport._run.healingReceived > waterHealing + 3, 'water healing is included in the report');
      const attackButton = $('#attack_nichirin-katana');
      check(attackButton.length === 1, 'equipped melee attack has a real button');
      const key = attackButton.attr('data-hotkey');
      Space.setTalentLevel('steadyHand',20);
      const enemyHp = $('#enemy').data('hp');
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
      document.body.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));
      await until(() => $('#enemy').data('hp') < enemyHp);
      check(!Engine._hotkeyDown[key], 'native keyup releases combat shortcut');
      const combatMedicine = Path.outfit.medicine;
      const combatHp = World.health;
      const healKey = $('#meds').attr('data-hotkey');
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:healKey,bubbles:true}));
      document.body.dispatchEvent(new KeyboardEvent('keyup',{key:healKey,bubbles:true}));
      check(Path.outfit.medicine === combatMedicine - 1 && World.health > combatHp, 'native medicine shortcut heals and consumes exactly once');
      await endFight();
      selectForm('flame'); fight();
      Events.damage($('#wanderer'),$('#enemy'),10,'melee',null,{weaponName:'nichirin katana'});
      const cutHp = $('#enemy').data('hp');
      await until(() => $('#enemy').data('hp') < cutHp);
      check(!!CombatStyles._fight.wound, 'flame cut deals timed damage through the combat engine');
      await endFight();
      check(CombatStyles._woundTimer === null, 'leaving combat cancels cut timers');
      selectForm('thunder'); fight();
      Events.damage($('#wanderer'),$('#enemy'),10,'melee',null,{weaponName:'nichirin katana'});
      check($('#enemy').data('hp') === 984, 'charged thunder hit deals 60% extra damage');
      Events.damage($('#wanderer'),$('#enemy'),10,'melee',null,{weaponName:'nichirin katana'});
      check($('#enemy').data('hp') === 974, 'immediate thunder follow-up spends no second charge');
      await endFight();
      selectForm('technique'); fight();
      Events.damage($('#wanderer'),$('#enemy'),'stun','ranged',null,{weaponName:'bind kunai'});
      Events.damage($('#wanderer'),$('#enemy'),10,'melee',null,{weaponName:'nichirin katana'});
      check($('#enemy').data('hp') === 986, 'control hit opens the technique damage window');
      await endFight();
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
      await finishClick('#leave');
      check(Events.activeEvent().title === _('slayer talent'), 'first boss reward opens after supply closes');
      await finishClick('#talent_0');
      check(Events.activeEvent().title === _('slayer talent'), 'second boss reward opens');
      await finishClick('#talent_0');
      check(Space.currentFloor === 11 && !Events.activeEvent(), 'boss rewards advance once');
      fight();
      Events.damage($('#enemy'),$('#wanderer'),999,'melee',null,{source:'blood art'});
      Events.checkPlayerDeath();
      await until(() => !!document.querySelector('#castleReportOverlay'));
      const report = CastleReport.getLastReport();
      check(!!report && !!$SM.get('game.castleLastReport'), 'read-only result saved');
      check(Engine.activeModule === Room && World.dead && !Events.activeEvent(), 'real death returns to camp before showing the report');
      check(document.querySelector('[role="dialog"]') !== null, 'result dialog renders');
      check(document.querySelector('.castle-report-stats dd').textContent === String(report.highestFloor), 'report displays the numeric floor');
      check(CastleReport._run === null && !('floorNodes' in report), 'finished report cannot resume a descent');
      const savedFood = $SM.get('stores["cured meat"]');
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}));
      document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'1',bubbles:true}));
      check($SM.get('stores["cured meat"]') === savedFood, 'report shortcuts do not consume background supplies');
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      check(!document.querySelector('#castleReportOverlay') && !Engine.keyLock, 'Escape closes report and restores controls');
      CastleReport.show();
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
