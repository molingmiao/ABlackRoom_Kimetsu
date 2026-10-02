// Dependency-free browser integration smoke test. Uses an isolated, disposable Edge profile.
// Run with Node 22+ on Windows: node tools/test_browser.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = process.env.GAME_ASSET_ROOT
  ? path.resolve(process.env.GAME_ASSET_ROOT)
  : path.resolve(__dirname, '..');
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
      const timeout = setTimeout(() => { pending.delete(requestId); reject(Error('Timed out: ' + method)); }, 30000);
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
    const checkDialogTheme = async (selector, dark) => evaluate('(' + (async function(selector, dark) {
      if (Engine.isLightsOff() !== dark) Engine.turnLightsOff();
      const panel = document.querySelector(selector);
      const expected = dark ? 'rgb(39, 40, 35)' : 'rgb(255, 255, 255)';
      for (let i = 0; i < 40 && getComputedStyle(panel).backgroundColor !== expected; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      for (let i = 0; i < 40 && Number(getComputedStyle(panel).opacity) < 0.99; i++) {
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      const style = getComputedStyle(panel);
      if (style.backgroundColor !== expected) throw Error('dialog theme background incorrect: ' + style.backgroundColor);
      if (Number(style.opacity) < 0.99) throw Error('dialog did not finish its opening transition');
      const luminance = color => {
        const rgb = color.match(/\d+/g).slice(0, 3).map(value => {
          const channel = Number(value) / 255;
          return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const background = luminance(style.backgroundColor);
      const text = luminance(getComputedStyle(panel.querySelector('#description')).color);
      const contrast = (Math.max(background, text) + 0.05) / (Math.min(background, text) + 0.05);
      if (contrast < 4.5) throw Error('dialog text contrast too low: ' + contrast);
      const close = panel.querySelector('#buttons').getBoundingClientRect();
      if (close.top < 0 || close.bottom > innerHeight) throw Error('dialog close button outside viewport');
    }).toString() + ')(' + JSON.stringify(selector) + ',' + JSON.stringify(dark) + ')');
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
    // Room's initial income tick is untracked until it creates Engine._incomeTimeout.
    // Let it finish before freezing income for asynchronous inventory assertions below.
    await pause(1100);
    await evaluate(`(function() {
      $SM.set('game.fire.value',3); $SM.set('game.temperature.value',4);
      $SM.set('game.builder.level',4); $SM.set('features.location.outside',true);
      $SM.set('stores.wood',20); EarlyGame.render();
      const guide = document.querySelector('#roomPanel .earlyGameTask').getBoundingClientRect();
      const builds = document.querySelector('#buildBtns').getBoundingClientRect();
      if (builds.top < guide.bottom) throw Error('early guidance overlaps build controls');
    })()`);
    const earlyImage = await page('Page.captureScreenshot', {format:'png'});
    const earlyOutput = path.join(profile, 'early-game.png');
    fs.writeFileSync(earlyOutput, Buffer.from(earlyImage.data, 'base64'));
    console.log('SCREENSHOT: ' + earlyOutput);
    const checks = await evaluate(`(async function() {
      const checks = [];
      const check = (condition, name) => {
        if (!condition) throw Error(name + ': ' + JSON.stringify({floor: Space.currentFloor, scene: Events.activeScene, stack: Events.eventStack.map(e => ({title:e.title,ending:e.ending})), done:Space.done, module:Engine.activeModule.name, embarks:$SM.get('game.embarks'), food:$SM.get('stores["cured meat"]'), sword:$SM.get('stores["nichirin katana"]')}));
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
      clearTimeout(Engine._incomeTimeout); // Keep fixture inventory stable during asynchronous confirmation fades.
      check($('#roomPanel .earlyGameTask').length === 1, 'new saves show one collapsible estate task');
      $SM.set('game.fire.value', 3); $SM.set('game.temperature.value', 4);
      $SM.set('game.builder.level', 4);
      if (!Outside.panel) Outside.init();
      $SM.set('game.builder.level',1); $SM.set('game.temperature.value',2); $SM.set('stores.wood',5);
      EarlyGame.render();
      check($('#roomPanel .guestCare').is(':visible') && $('#roomPanel .guestCare').prop('disabled'), 'guest interaction explains warmth prerequisite');
      check(!$('#roomPanel .campaignGoal').is(':visible'), 'opening rescue does not show premature construction milestones');
      $SM.set('game.temperature.value',3);
      $('#roomPanel .guestCare').trigger('click');
      check($SM.get('game.builder.level') === 2 && $SM.get('stores.wood') === 4, 'first care click advances one recovery stage and pays one wood');
      $('#roomPanel .guestCare').trigger('click');
      check($SM.get('game.builder.level') === 4 && $SM.get('stores.wood') === 3 && $SM.get('income.builder.stores.wood') === 2, 'second care click introduces Shinobu and starts real helper income');
      const caredWood=$SM.get('stores.wood');
      Room.updateBuilderState(); EarlyGame.tendGuest();
      check($SM.get('stores.wood') === caredWood && !$('#roomPanel .guestCare').is(':visible'), 'finished care hides its button and ignores pending recovery');
      $SM.set('stores.wood',30);
      EarlyGame.render();
      check($('#roomPanel .earlyGameTaskText').text().includes('推车'), 'early guidance explains the cart upgrade');
      $('#roomPanel .earlyGameTask').prop('open', false);
      $SM.add('stores.wood', 1);
      check(!$('#roomPanel .earlyGameTask').prop('open'), 'income updates preserve collapsed guidance');
      $SM.set('game.gatherCount', 0);
      $('#gatherButton').trigger('click');
      check($SM.get('cooldown.gatherButton') === 20, 'first wood gathering uses the real 20-second button cooldown');
      Button.clearCooldown($('#gatherButton'));
      $SM.set('game.gatherCount', 3);
      $('#gatherButton').trigger('click');
      check($SM.get('cooldown.gatherButton') === 60, 'normal gathering cooldown resumes after three uses');
      Button.clearCooldown($('#gatherButton'));
      $SM.set('game.buildings.trap',1);
      Outside.updateTrapButton(); // Normally refreshed when travelling back to the forest.
      const firstFur=$SM.get('stores.fur',true), firstMeat=$SM.get('stores.meat',true);
      $('#trapsButton').trigger('click');
      check($SM.get('game.firstTrapCatch') && $SM.get('stores.fur') >= firstFur+3 && $SM.get('stores.meat') >= firstMeat+2, 'actual first trap check guarantees useful opening materials');
      Button.clearCooldown($('#trapsButton'));
      $SM.set('game.buildings.lodge',1);
      $('#roomPanel .earlyGameTask').prop('open',true);
      EarlyGame.render();
      check($('#roomPanel .openingSupply button').length === 2 && $('#roomPanel .openingSupply').is(':visible'), 'earned lodge offers two explicit one-time supplies');
      const choiceFur=$SM.get('stores.fur'), choiceFood=$SM.get('stores["cured meat"]',true);
      $('#roomPanel .openingSupply button[data-choice="journey"]').trigger('click');
      check($SM.get('game.openingSupplyChoice') === 'journey' && $SM.get('stores.fur') === choiceFur+180 && $SM.get('stores["cured meat"]') === choiceFood+5, 'real supply choice grants exactly the advertised materials');
      $('#outsidePanel .openingSupply button[data-choice="estate"]').trigger('click');
      check($SM.get('stores.fur') === choiceFur+180 && !$('.openingSupply').is(':visible') && !$SM.get('features.location.path'), 'duplicate panel cannot collect another choice or unlock the map');
      $SM.set('game.population',4);
      EarlyGame.render();
      const workerStores=JSON.stringify($SM.get('stores'));
      $('#roomPanel .openingHunters button').trigger('click');
      check($SM.get('game.workers.hunter') === 2 && Outside.getNumGatherers() === 2 && $SM.get('income.hunter.stores.fur') === 1, 'introductory worker button enables actual hunter production and reserves gatherers');
      check(JSON.stringify($SM.get('stores')) === workerStores && !$('.openingHunters').is(':visible'), 'worker setup grants no resources and hides after allocation');
      $SM.set('game.workers.hunter',0);
      $SM.set('playStats.audioAlertShown', true);
      $SM.set('game.population', 4);
      $SM.set('game.workers.charcutier', 2);
      $SM.setM('stores', {wood:5,meat:0});
      $('#productionOverviewButton').trigger('click');
      check(Events.eventPanel().text().includes('原料不够整组'), 'production overview identifies whole-group material shortages');
      check(Events.eventPanel().text().includes('持续供需缺口') && Events.eventPanel().text().includes('当前生产方'), 'production overview explains sustained deficits and assigned sources');
      check(Events.eventPanel().find('.productionSummary > div').length === 3 && Events.eventPanel().find('.productionBlockedRow').length > 0, 'production overview prioritizes live shortage cards and summary counts');
      $('[data-production-fold="jobs"], [data-production-fold="job:charcutier"]').prop('open',true);
      const workerCount = $SM.get('game.workers.charcutier');
      $SM.setM('stores', {wood:100,meat:100});
      $('#refresh').trigger('click');
      check(!Events.eventPanel().text().includes('原料不够整组') && $SM.get('game.workers.charcutier') === workerCount, 'production refresh reflects new stock without reassigning workers');
      check(Events.eventPanel().text().includes('持续供需缺口'), 'restocking removes immediate shortage but not the sustained supply deficit');
      check($('[data-production-fold="jobs"]')[0].open && $('[data-production-fold="job:charcutier"]')[0].open, 'refresh preserves both recipe-list and individual-job expansion');
      $('#reserves').trigger('click');
      const reserveSnapshot=JSON.stringify($SM.get('stores'));
      $('[data-material="wood"]').val('95');
      $('[data-material="meat"]').val('-1');
      $('#saveProductionReserves').trigger('click');
      check($('#productionReserveStatus').text().includes('本次未保存') && !$SM.get('game.productionReserves'), 'invalid reserve form never partially saves');
      $('[data-material="meat"]').val('0');
      $('#saveProductionReserves').trigger('click');
      check($SM.getProductionReserve('wood') === 95 && Events.eventPanel().text().includes('为保留库存暂停'), 'saved reserves explain why an affordable batch is held');
      check($('[data-production-fold="jobs"]')[0].open && $('[data-production-fold="job:charcutier"]')[0].open, 'returning from reserve settings keeps recipe sections expanded');
      check(JSON.stringify($SM.get('stores')) === reserveSnapshot, 'saving reserves never consumes inventory');
      $('#reserves').trigger('click');
      $('[data-material="wood"]').val('0');
      $('#cancelProductionReserves').trigger('click');
      check($SM.getProductionReserve('wood') === 95, 'cancel leaves reserve settings untouched');
      $('#reserves').trigger('click');
      $('[data-material="wood"]').val('0');
      $('#saveProductionReserves').trigger('click');
      check($SM.getProductionReserve('wood') === 0 && !Events.eventPanel().text().includes('为保留库存暂停'), 'zero disables reserve protection');
      await finishClick('#close');
      $SM.set('game.workers.charcutier', 0);
      $SM.setM('stores', {'wind armour':1,'nichirin katana':1,'bind kunai':1,'medicine':30,'cured meat':30,'wisteria oil':20,'teeth':100,'scales':100,'wood':100,'demon stone':5});
      if (!Path.panel) Path.init();
      check(EarlyGame.task() === null && $('.campaignClaim').length > 0, 'world exploration replaces opening guidance with continuing campaign milestones');
      const beforeCampaignWood=$SM.get('stores.wood');
      $('#roomPanel .campaignClaim').trigger('click');
      check($SM.get('game.campaignClaims.cart') && $SM.get('stores.wood') === beforeCampaignWood+40, 'campaign claim grants the advertised reward');
      const afterCampaignWood=$SM.get('stores.wood');
      EarlyGame.claimMilestone('cart');
      check($SM.get('stores.wood') === afterCampaignWood, 'duplicate campaign claims never repeat rewards');
      if (!World.panel) World.init();
      Engine.activeModule=Path;
      $SM.set('character.equippedInit',true,true);
      $SM.set('character.equipped',{primary:['nichirin katana'],secondary:[],tool:[]});
      Path.outfit={}; $SM.set('outfit',{});
      Path.updateOutfitting();
      check($('#journeyGuide .journeyChecklist').text().includes('口粮待备'), 'new explorers see live actual backpack checks');
      const beginnerStock=JSON.stringify($SM.get('stores'));
      $('#prepareJourneyBtn').trigger('click');
      check(Path.outfit['nichirin katana'] === 1 && Path.outfit['cured meat'] === 5 && $('#journeyGuide .journeyChecklist').text().includes('口粮已备'), 'beginner preparation button packs selected weapon and five food within starter capacity');
      check(JSON.stringify($SM.get('stores')) === beginnerStock && $SM.get('character.loadouts.expedition.targets["cured meat"]') === 5, 'beginner setup saves reusable targets without charging warehouse');
      $('#journeyGuide').prop('open',false);
      $SM.add('stores.wood',1);
      check(!$('#journeyGuide').prop('open'), 'live preparation checks preserve collapsed state');
      $SM.set('game.embarks',3);
      Path.updateJourneyGuide();
      check(!$('#journeyGuide').is(':visible'), 'beginner preparation guide retires after three departures');
      $SM.set('game.embarks',0);
      if (!Ship.panel) Ship.init();
      $SM.setM('stores', {'wisteria gun':1,'wisteria bomb':1});
      $SM.set('character.equipped.secondary',['wisteria gun','wisteria bomb']);
      Path.updateEquipDoll();
      const gearBefore = JSON.stringify($SM.get('character.equipped'));
      Path.showEquipPicker($('.equipSlot[data-cat="secondary"][data-slot="1"]'), 'secondary', 1);
      const comparison = $('.pickerOption[data-weapon="wisteria gun"] .weaponCompareDetails').text();
      check(comparison.includes('基础伤害：15 → 5') && comparison.includes('没有足够弹药'), 'equipment picker compares base values and warns about missing ammunition');
      check(JSON.stringify($SM.get('character.equipped')) === gearBefore, 'viewing weapon comparisons never changes equipment');
      $('.pickerOption[data-weapon="wisteria gun"]').trigger('click');
      check(Path.getEquippedSlots('secondary')[0] === null && Path.getEquippedSlots('secondary')[1] === 'wisteria gun', 'selecting a compared weapon preserves slot deduplication');
      $SM.set('character.equipped.secondary', [null,null]);
      Path.setEquipSlot('primary', 0, 'nichirin katana');
      Engine.activeModule = Path;
      Path.outfit = {'nichirin katana':1,'cured meat':5};
      const homeFood = $SM.get('stores["cured meat"]');
      Path.checkEmbark();
      check(Events.eventPanel().text().includes('第一次出门'), 'first expedition explains food, water and real-time combat');
      $SM.set('stores["cured meat"]', 4, true);
      await finishClick('#depart');
      check(Engine.activeModule === Path && !$SM.get('game.embarks', true) && $SM.get('stores["nichirin katana"]') === 1, 'stale expedition confirmation never partially charges stock');
      $SM.set('stores["cured meat"]', homeFood, true);
      Path.checkEmbark();
      await finishClick('#depart');
      check(Engine.activeModule === World && $SM.get('game.embarks') === 1 && $SM.get('stores["cured meat"]') === homeFood - 5, 'first expedition enters the actual world and charges once');
      check(Path.embark() === false, 'duplicate expedition departure is ignored');
      World.goHome();
      check(Engine.activeModule === Path && $SM.get('stores["cured meat"]') === homeFood, 'returning home restores unused expedition supplies');
      check(ExpeditionReport.latest().steps === 0 && !$SM.get('previous.embarkSnapshot'), 'zero-net trip produces a completed report and clears departure snapshot');
      const zeroTripStock=JSON.stringify($SM.get('stores'));
      check(World.goHome() === false && JSON.stringify($SM.get('stores')) === zeroTripStock, 'duplicate world return cannot credit inventory twice');
      $SM.set('stores.rucksack',1); // Treatment supplies need space beyond the first starter outfit.
      Path.outfit={'nichirin katana':1,'cured meat':5,medicine:2}; $SM.set('outfit',Path.outfit);
      const tripFood=$SM.get('stores["cured meat"]');
      check(Path.embark(), 'fresh world expedition begins new in-memory accounting');
      await new Promise(resolve=>$('#outerSlider').promise().done(resolve));
      check($('#worldFieldTreatment').is(':visible') && $('#worldHeal_medicine').prop('disabled'), 'map treatment appears but full health does not consume medicine');
      World.setHp(World.getMaxHealth()-3);
      check(FieldTreatment.info('medicine').heal === 3, 'map treatment previews clamped actual healing');
      const fieldStock=JSON.stringify($SM.get('stores'));
      const fieldCounters=[World.foodMove,World.waterMove,World.water];
      document.body.focus();
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'2',bubbles:true}));
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'2',repeat:true,bubbles:true}));
      document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'2',bubbles:true}));
      check(World.health === World.getMaxHealth() && Path.outfit.medicine === 1, 'map medicine hotkey consumes one item and restores actual health without held-key repeats');
      check(JSON.stringify($SM.get('stores')) === fieldStock && JSON.stringify(fieldCounters) === JSON.stringify([World.foodMove,World.waterMove,World.water]), 'field treatment touches neither home stock nor travel consumption counters');
      World.setHp(World.getMaxHealth()-3);
      $('#worldHeal_medicine').trigger('click');
      check(Path.outfit.medicine === 1 && World.health === World.getMaxHealth()-3, 'map treatment cooldown prevents repeated consumption');
      Events.startEvent({title:'field treatment isolation',scenes:{start:{text:['test'],buttons:{fieldReturn:{text:'return',nextScene:'end'}}}}});
      check($('#worldHeal_meat').prop('disabled') && FieldTreatment.use('cured meat') === 0 && Path.outfit['cured meat'] === 5, 'active events block background field treatment');
      await finishClick('#fieldReturn');
      check(!$('#worldHeal_meat').prop('disabled'), 'field treatment becomes available again after event closes');
      World.setHp(World.getMaxHealth());
      const originalCheckFight=World.checkFight;
      World.checkFight=function() {};
      for(let x=31;x<=33;x++) World.state.map[x][30]=World.TILE.FOREST;
      for(let i=0;i<3;i++) check(World.move(World.EAST),'actual outward map step '+i);
      check(World.travelInfo().distance === 3 && World.travelInfo().budget.food === 1 && World.travelInfo().budget.water === 2, 'return reminder includes phase counters and free final home step');
      $('#worldTravelGuide').prop('open',false);
      const tripWater=World.water;
      World.setWater(1);
      check($('#worldTravelGuide').attr('data-status') === 'danger' && !$('#worldTravelGuide').prop('open'), 'low-water warning updates without reopening collapsed reminder');
      World.setWater(tripWater);
      for(let i=0;i<3;i++) check(World.move(World.WEST),'actual homeward map step '+i);
      World.checkFight=originalCheckFight;
      let expedition=ExpeditionReport.latest();
      check(Engine.activeModule === Path && expedition.steps === 6 && expedition.farthestDistance === 3 && expedition.mapSaved && expedition.newTiles > 0, 'actual return stores completed exploration progress only');
      check(expedition.reduced['cured meat'] === 2 && expedition.returned['cured meat'] === 3 && $SM.get('stores["cured meat"]') === tripFood-2, 'report matches actual net food use and remaining warehouse credit');
      check(expedition.reduced.medicine === 1 && expedition.returned.medicine === 1 && !$('#worldFieldTreatment').is(':visible'), 'field medicine appears in the actual expedition report and its controls retire on return');
      const reportSnapshot=JSON.stringify($SM.get('game.lastExpeditionReport'));
      $('#expeditionReportButton').trigger('click');
      check(Events.eventPanel().hasClass('expeditionReport') && Events.eventPanel().text().includes('不含庄园生产'), 'report entry opens read-only exploration feedback');
      await finishClick('#closeExpeditionReport');
      check(JSON.stringify($SM.get('game.lastExpeditionReport')) === reportSnapshot, 'reading completed report changes neither report nor run state');
      Path.outfit={'nichirin katana':1,'cured meat':5}; $SM.set('outfit',Path.outfit);
      const beforeDeadFur=$SM.get('stores.fur',true);
      check(Path.embark(), 'next expedition starts independently of the finished report');
      World.state.map[31][30]=World.TILE.FOREST;
      World.checkFight=function() {};
      World.move(World.EAST);
      World.checkFight=originalCheckFight;
      Path.outfit.fur=2; Path.outfit['cured meat']=0;
      World.starvation=true; World.foodMove=1;
      check(World.useSupplies() === false, 'actual starvation branch ends the world expedition');
      check(World.move(World.EAST) === false, 'death animation blocks late world movement');
      await until(()=>Engine.activeModule === Room && Engine.tabNavigation && !Engine.keyLock);
      expedition=ExpeditionReport.latest();
      check(expedition.outcome === 'death' && expedition.reason === 'food' && !expedition.mapSaved && expedition.returned['nichirin katana'] === 1 && expedition.gained.fur === 2, 'failure report identifies real starvation without falsely losing returned weapons or loot');
      check($SM.get('stores.fur') === beforeDeadFur+2 && $SM.get('stores["nichirin katana"]') === 1 && ExpeditionReport._run === null, 'death actually returns remaining loot and leaves no resumable report state');
      Engine.travelTo(Path);
      await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
      $SM.set('stores.rucksack', 1); // Later loadout/style cases carry more than the starter bag allows.
      Path.outfit = { medicine:3, 'cured meat':2 };
      $SM.set('outfit', Path.outfit);
      $('#loadoutSelect').val('castle').trigger('change');
      $('#saveLoadoutBtn').trigger('click');
      check($SM.get('character.loadouts.castle').targets.medicine === 3, 'save loadout button records targets');
      Path.outfit.medicine = 1;
      const storedMedicine = $SM.get('stores.medicine');
      $('#loadoutPreview').prop('open', true);
      Path.updateOutfitting();
      const previewSnapshot = JSON.stringify({bag:Path.outfit, stores:$SM.get('stores'), equipment:$SM.get('character.equipped')});
      Path.updateLoadoutPanel();
      check($('#loadoutPreview').text().includes('已装 1／目标 3；补齐后预计 3'), 'loadout preview shows packed, target and planned quantities');
      check(JSON.stringify({bag:Path.outfit, stores:$SM.get('stores'), equipment:$SM.get('character.equipped')}) === previewSnapshot, 'loadout preview never mutates inventory or equipment');
      $SM.set('stores.medicine', 2);
      check($('#loadoutPreview').text().includes('库存缺 1') && $('#loadoutPreview').prop('open'), 'stock changes refresh shortages without collapsing the preview');
      $SM.set('stores.medicine', storedMedicine);
      $('#autoFillBtn').trigger('click');
      check(Path.outfit.medicine === 3 && $SM.get('stores.medicine') === storedMedicine, 'refill button tops up without charging inventory twice');
      check($('#loadoutPreview').text().includes('已装 3／目标 3；补齐后预计 3'), 'refill updates the live preview');
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
      $SM.set('game.spaceShip.crows', 2);
      Ship.checkDescend();
      check(Events.eventPanel().text().includes('本次流派：'), 'departure summary translations are loaded');
      const departureMedicine = $SM.get('stores.medicine');
      $SM.set('stores.medicine', 4);
      await finishClick('#descend');
      check(Engine.activeModule === Ship && $SM.get('game.spaceShip.crows') === 2 && $SM.get('stores.medicine') === 4, 'stale departure is rejected without partial charges');
      $SM.set('stores.medicine', departureMedicine);
      Ship.checkDescend();
      await finishClick('#descend');
      check(Engine.activeModule === Space && $SM.get('game.spaceShip.crows') === 1 && $SM.get('stores.medicine') === departureMedicine - 5, 'confirmed departure charges inventory and one crow exactly once');
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
      const warningScene = Events.activeEvent().scenes[Events.activeScene];
      warningScene.telegraphAttacks = [Space.BLOOD_ARTS.charged(5)];
      CombatTelegraphs.start(warningScene, $('#description'));
      $('#enemy').data('stunned', false);
      const beforeWarningTop = document.querySelector('#attackButtons').getBoundingClientRect().top;
      CombatTelegraphs.queue(warningScene.telegraphAttacks[0]);
      const charge = CombatTelegraphs._fight.charges[0];
      check($('.combatTelegraph').length === 1 && $('.combatTelegraphCountdown').text().includes('秒后出招'), 'blood-art countdown renders beside combat controls');
      check(Math.abs(document.querySelector('#attackButtons').getBoundingClientRect().top - beforeWarningTop) < 1, 'warnings do not shift attack buttons');
      check(document.querySelector('#fight').getBoundingClientRect().bottom <= document.querySelector('.combatTelegraphs').getBoundingClientRect().top, 'fighter health and warnings never overlap');
      Events.damage($('#wanderer'),$('#enemy'),'stun','ranged',null,{weaponName:'bind kunai'});
      check(CombatTelegraphs._fight.charges.length === 0 && !$('#enemy').hasClass('charging'), 'actual control hit cancels the pending blood art');
      $('#enemy').data('stunned', false);
      const beforeCancelled = World.health;
      CombatTelegraphs._resolve(charge, CombatTelegraphs._fight);
      check(World.health === beforeCancelled, 'cancelled cast stays cancelled after stun ends');
      const bleed = {telegraphSec:1,dmg:10,hit:1,bleedSec:3,bleedPerSec:2};
      const intervalCount = CombatTelegraphs._fight.intervals.length;
      $('#wanderer').data('status','shield');
      CombatTelegraphs.queue(bleed);
      CombatTelegraphs._resolve(CombatTelegraphs._fight.charges[0], CombatTelegraphs._fight);
      await until(() => $('#wanderer').data('status') !== 'shield');
      check(CombatTelegraphs._fight.intervals.length === intervalCount, 'shield absorption does not start bleeding');
      const damageBefore = CastleReport._run.damageTaken;
      CombatTelegraphs.queue(bleed);
      CombatTelegraphs._resolve(CombatTelegraphs._fight.charges[0], CombatTelegraphs._fight);
      await until(() => CastleReport._run.damageTaken > damageBefore);
      check(CombatTelegraphs._fight.intervals.length === intervalCount + 1, 'a damaging blood-art hit starts bleeding');
      await endFight();
      fight();
      Path.outfit.medicine = 1;
      const homeBeforePickup = $SM.get('stores.medicine');
      const gearBeforePickup = JSON.stringify($SM.get('character.equipped'));
      Space.collectConfiguredLoot();
      check(Path.outfit.medicine === 1, 'configured pickup cannot run during combat');
      Events.clearTimeouts();
      Events.won = true;
      Events.fought = true;
      $('#description').empty(); $('#buttons').empty();
      Events.drawLoot({medicine:{min:4,max:4,chance:1},scales:{min:5,max:5,chance:1}});
      $('<div id="exitButtons">').appendTo('#buttons');
      Events.drawButtons(Events.activeEvent().scenes.start);
      const homeScalesBeforePickup=$SM.get('stores.scales');
      Button.clearCooldown($('#collectConfigured'));
      await finishClick('#collectConfigured');
      check(Path.outfit.medicine === 3 && $SM.get('stores.medicine') === homeBeforePickup + 2, 'one-click pickup fills saved medicine target and banks only the remainder');
      check($SM.get('stores.scales') === homeScalesBeforePickup + 5 && JSON.stringify($SM.get('character.equipped')) === gearBeforePickup, 'one-click pickup banks materials without changing equipment');
      check(Events.activeEvent().title === _('slayer talent'), 'one-click collection still requires a manual talent choice');
      check(Events.eventPanel().text().includes('下次入城继承') && Events.eventPanel().text().includes('→'), 'talent choices show numerical and inheritance previews');
      const afterPickupStock=$SM.get('stores.medicine');
      Space.collectConfiguredLoot();
      check($SM.get('stores.medicine') === afterPickupStock, 'a late pickup callback cannot duplicate rewards');
      await finishClick('#talent_0');
      Space.currentFloor = 10;
      Space.triggerBossFight();
      Events.clearTimeouts();
      Events.dotDamage($('#enemy'), 999999, 'test finishing strike');
      await until(() => Events.won && $('#recraft').length === 1 && $('#lootButtons .lootRow').length > 0);
      const earnedScales = $('#lootButtons .lootRow').filter(function() {return $(this).data('item') === 'scales';}).find('.lootTake').data('numLeft');
      check(earnedScales >= 20 && earnedScales <= 30, 'real boss loot renders guaranteed scales');
      const scalesBeforeLoot = $SM.get('stores.scales', true);
      $SM.set('stores.convoy',1);
      const packedScalesBefore = Path.outfit.scales || 0;
      Events.getLoot($('#lootButtons .lootRow').filter(function() {return $(this).data('item') === 'scales';}).find('.lootTake'));
      check(Path.outfit.scales === packedScalesBefore + 1 && $SM.get('stores.scales') === scalesBeforeLoot, 'manual loot is packed without a duplicate warehouse credit');
      $('#recraft').trigger('click');
      check(Events.activeScene === 'recraft' && $('#recraft_0').length === 1, 'boss supply scene visible');
      check($SM.get('stores.scales') === scalesBeforeLoot + earnedScales - 1, 'real boss victory button banks only remaining loot before the shop replaces the scene');
      const beforePurchase = Path.outfit.medicine;
      const scalesBeforePurchase = $SM.get('stores.scales');
      $('#recraft_0').trigger('click'); $('#recraft_0').trigger('click');
      check(Path.outfit.medicine === beforePurchase + 2, 'repeat purchases stay in supply scene');
      check($SM.get('stores.scales') === scalesBeforePurchase - 16, 'boss medicine purchases consume warehouse scales at the displayed recipe');
      await finishClick('#leave');
      check(Events.activeEvent().title === _('slayer talent'), 'first boss reward opens after supply closes');
      await finishClick('#talent_0');
      check(Events.activeEvent().title === _('slayer talent'), 'second boss reward opens');
      await finishClick('#talent_0');
      check(Space.currentFloor === 11 && !Events.activeEvent(), 'boss rewards advance once');
      fight();
      const deathScene = Events.activeEvent().scenes[Events.activeScene];
      deathScene.telegraphAttacks = [{telegraphSec:1,dmg:999,hit:1}];
      CombatTelegraphs.start(deathScene, $('#description'));
      $SM.addPerk('total concentration');
      const beforeRecovery = CastleReport._run.healingReceived;
      CombatTelegraphs.queue(deathScene.telegraphAttacks[0]);
      CombatTelegraphs._resolve(CombatTelegraphs._fight.charges[0], CombatTelegraphs._fight);
      await until(() => Events._deathRecoveryUsed);
      check(World.health > 0 && CastleReport._run.healingReceived > beforeRecovery, 'fatal blood art triggers second wind and records actual recovery');
      CombatTelegraphs.queue(deathScene.telegraphAttacks[0]);
      CombatTelegraphs._resolve(CombatTelegraphs._fight.charges[0], CombatTelegraphs._fight);
      await until(() => !!document.querySelector('#castleReportOverlay'));
      const report = CastleReport.getLastReport();
      check(!!report && !!$SM.get('game.castleLastReport'), 'read-only result saved');
      check(Engine.activeModule === Room && World.dead && !Events.activeEvent(), 'real death returns to camp before showing the report');
      check(document.querySelector('[role="dialog"]') !== null, 'result dialog renders');
      check(document.querySelector('[role="dialog"]').textContent.includes('本次材料账本') && report.materials.find(row=>row.item==='scales').spent === 16, 'completed report displays actual material spending');
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
    await evaluate(`(async function() {
      CastleReport.close();
      Engine.activeModule = Ship;
      Ship.onArrival();
      $SM.setM('stores', {'nichirin katana':1,'wisteria gun':1,medicine:5});
      $SM.set('game.spaceShip.crows', 1);
      $SM.set('character.equipped.primary', ['nichirin katana']);
      $SM.set('character.equipped.secondary', ['wisteria gun']);
      Path.outfit = {'nichirin katana':1,'wisteria gun':1,medicine:5};
      Ship.checkDescend();
      await new Promise(resolve => setTimeout(resolve, 250));
    })()`);
    const departureImage = await page('Page.captureScreenshot', {format:'png'});
    const departureOutput = path.join(profile, 'departure-check.png');
    fs.writeFileSync(departureOutput, Buffer.from(departureImage.data, 'base64'));
    console.log('SCREENSHOT: ' + departureOutput);
    await evaluate(`(async function() {
      await new Promise(resolve => Events.endEvent(resolve));
      Ship.descend();
      Space.currentFloor = 10;
      Space.triggerBossFight();
      clearInterval(Events._enemyAttackTimer);
      (Events._specialTimers || []).forEach(clearInterval);
      const attack = Space.BLOOD_ARTS.charged(12);
      CombatTelegraphs.queue(attack);
      await new Promise(resolve => setTimeout(resolve, 250));
      const buttons = document.querySelector('#attackButtons').getBoundingClientRect();
      if (buttons.bottom > window.innerHeight) throw Error('warning pushes combat controls below viewport');
    })()`);
    const warningImage = await page('Page.captureScreenshot', {format:'png'});
    const warningOutput = path.join(profile, 'combat-warning.png');
    fs.writeFileSync(warningOutput, Buffer.from(warningImage.data, 'base64'));
    console.log('SCREENSHOT: ' + warningOutput);
    await evaluate(`(async function() {
      Events.clearTimeouts();
      await new Promise(resolve => Events.endEvent(resolve));
      Engine.activeModule = Outside;
      Outside.onArrival();
      $SM.set('game.workers.charcutier', 2);
      $SM.setM('stores', {wood:5,meat:0});
      CampGuide.showProduction();
      await new Promise(resolve => setTimeout(resolve, 250));
      const close = document.querySelector('#close').getBoundingClientRect();
      if (close.bottom > window.innerHeight) throw Error('production report hides its close button');
    })()`);
    const productionImage = await page('Page.captureScreenshot', {format:'png'});
    const productionOutput = path.join(profile, 'production-overview.png');
    fs.writeFileSync(productionOutput, Buffer.from(productionImage.data, 'base64'));
    console.log('SCREENSHOT: ' + productionOutput);
    await evaluate(`(async function() {
      $('#reserves').trigger('click');
      await new Promise(resolve => setTimeout(resolve, 350));
      const save = document.querySelector('#saveProductionReserves').getBoundingClientRect();
      if (save.bottom > innerHeight || save.top < 0) throw Error('production reserve save button outside viewport');
    })()`);
    const reserveImage = await page('Page.captureScreenshot', {format:'png'});
    const reserveOutput = path.join(profile, 'production-reserves.png');
    fs.writeFileSync(reserveOutput, Buffer.from(reserveImage.data, 'base64'));
    console.log('SCREENSHOT: ' + reserveOutput);
    await evaluate(`(async function() {
      await new Promise(resolve => Events.endEvent(resolve));
      Space.done = true;
      Space.returnToShip();
      await new Promise(resolve => $('#outerSlider').promise().done(resolve));
      CastleReport.close();
      Engine.travelTo(Path);
      await new Promise(resolve => $('#locationSlider').promise().done(resolve));
      $SM.set('character.equipped.secondary', ['wisteria bomb','wisteria gun']);
      $SM.setM('stores', {'wisteria gun':1,'wisteria bomb':1});
      Path.updateEquipDoll();
      Path.showEquipPicker($('.equipSlot[data-cat="secondary"][data-slot="0"]'), 'secondary', 0);
      await new Promise(resolve => setTimeout(resolve, 250));
      const picker = document.querySelector('.equipPicker').getBoundingClientRect();
      if (picker.right > innerWidth || picker.bottom > innerHeight) throw Error('weapon comparison overflows the viewport');
    })()`);
    const equipmentImage = await page('Page.captureScreenshot', {format:'png'});
    const equipmentOutput = path.join(profile, 'weapon-comparison.png');
    fs.writeFileSync(equipmentOutput, Buffer.from(equipmentImage.data, 'base64'));
    console.log('SCREENSHOT: ' + equipmentOutput);
    await evaluate(`(async function() {
      $('.equipPicker').remove();
      $('#loadoutPreview').prop('open', true);
      if (!document.querySelector('#materialSourcesButton')) throw Error('material sources entry missing');
      document.querySelector('#loadoutPanel').scrollIntoView({block:'center'});
      await new Promise(resolve => setTimeout(resolve, 250));
    })()`);
    const loadoutImage = await page('Page.captureScreenshot', {format:'png'});
    const loadoutOutput = path.join(profile, 'loadout-preview.png');
    fs.writeFileSync(loadoutOutput, Buffer.from(loadoutImage.data, 'base64'));
    console.log('SCREENSHOT: ' + loadoutOutput);
    await evaluate(`(async function() {
      CampGuide.discoverEnemy('water demon');
      window.materialInventoryBefore = JSON.stringify({stores:$SM.get('stores'),outfit:Path.outfit,equipped:$SM.get('game.equipped')});
      CampGuide.showMaterialSources();
      await new Promise(resolve => setTimeout(resolve, 250));
      if (!Events.eventPanel().text().includes('距庄园 11～20 格的森林')) throw Error('discovered source location missing');
      if (Events.eventPanel().text().includes('距庄园超过 20 格的森林')) throw Error('unseen thunder demon leaked');
      if (!CampGuide.routeMaterials('battle', 1).includes('必掉')) throw Error('known material route reward missing');
      const panel=Events.eventPanel()[0];
      const source=panel.querySelector('.materialSourceYield');
      if (Number(getComputedStyle(source).fontWeight)<700) throw Error('material yields are not bold');
      if (panel.querySelector('.materialSourceRules').open) throw Error('long material explanation should start collapsed');
      const event=Events.activeEvent();
      panel.querySelector('button[data-material="teeth"]').click();
      if (panel.querySelector('button[data-material="teeth"]').getAttribute('aria-pressed')!=='true' || panel.querySelector('h2').textContent!==_('teeth')) throw Error('material selection failed');
      if (Events.activeEvent()!==event || panel.querySelectorAll('h2').length!==1) throw Error('material selection should reuse one focused panel');
      panel.querySelector('button[data-material="scales"]').click();
      if (JSON.stringify({stores:$SM.get('stores'),outfit:Path.outfit,equipped:$SM.get('game.equipped')})!==window.materialInventoryBefore) throw Error('material lookup mutated inventory');
    })()`);
    await checkDialogTheme('.materialSources', false);
    const sourceImage = await page('Page.captureScreenshot', {format:'png'});
    const sourceOutput = path.join(profile, 'material-sources.png');
    fs.writeFileSync(sourceOutput, Buffer.from(sourceImage.data, 'base64'));
    console.log('SCREENSHOT: ' + sourceOutput);
    await checkDialogTheme('.materialSources', true);
    const darkSourceImage = await page('Page.captureScreenshot', {format:'png'});
    const darkSourceOutput = path.join(profile, 'material-sources-dark.png');
    fs.writeFileSync(darkSourceOutput, Buffer.from(darkSourceImage.data, 'base64'));
    console.log('SCREENSHOT: ' + darkSourceOutput);
    await evaluate(`document.querySelector('.materialSourceRules').open=true`);
    await checkDialogTheme('.materialSources', true);
    await page('Emulation.setDeviceMetricsOverride', {width:1137,height:745,deviceScaleFactor:1,mobile:false});
    await checkDialogTheme('.materialSources', true);
    await page('Emulation.clearDeviceMetricsOverride');
    await checkDialogTheme('.materialSources', false);
    await evaluate(`(async function() {
      await new Promise(resolve => Events.endEvent(resolve));
      Engine.activeModule = Space;
      Space.done = false;
      Space.currentFloor = 1;
      Space.triggerBattle(false);
      Events.clearTimeouts();
      Events.won = true;
      Events.fought = true;
      const scene = Events.activeEvent().scenes.start;
      $('#description').empty(); $('#buttons').empty();
      Events.startStory(Object.assign({}, scene, {text:[scene.deathMessage]}));
      await new Promise(resolve => setTimeout(resolve, 350));
      const button = document.querySelector('#collectConfigured').getBoundingClientRect();
      if (button.bottom > innerHeight || button.top < 0) throw Error('configured pickup button outside viewport');
    })()`);
    const pickupImage = await page('Page.captureScreenshot', {format:'png'});
    const pickupOutput = path.join(profile, 'configured-pickup.png');
    fs.writeFileSync(pickupOutput, Buffer.from(pickupImage.data, 'base64'));
    console.log('SCREENSHOT: ' + pickupOutput);
    await evaluate(`(async function() {
      await new Promise(resolve => Events.endEvent(resolve));
      Space._offerTalent();
      await new Promise(resolve => setTimeout(resolve, 350));
      const panel=document.querySelector('.talentCardsEvent'),bounds=panel.getBoundingClientRect();
      if(bounds.top<0||bounds.bottom>innerHeight)throw Error('talent preview panel is clipped');
      for(const id of ['talent_0','skip']) {
        const button=document.getElementById(id);button.scrollIntoView({block:'nearest'});
        const rect=button.getBoundingClientRect();
        if(rect.top<bounds.top||rect.bottom>bounds.bottom)throw Error('talent preview hides '+id+' after scrolling');
      }
      panel.scrollTop=0;
    })()`);
    const talentImage = await page('Page.captureScreenshot', {format:'png'});
    const talentOutput = path.join(profile, 'talent-preview.png');
    fs.writeFileSync(talentOutput, Buffer.from(talentImage.data, 'base64'));
    console.log('SCREENSHOT: ' + talentOutput);
    await evaluate(`(async function() {
      await new Promise(resolve => Events.endEvent(resolve));
      Engine.travelTo(Room);
      await new Promise(resolve => $('#locationSlider').promise().done(resolve));
      window.scrollTo(0,0);
      $SM.set('features.location.path',false);
      $SM.set('stores.compass',0);
      $SM.set('game.builder.level',1); $SM.set('game.temperature.value',3); $SM.set('stores.wood',5);
      $('#roomPanel .earlyGameTask').prop('open',true);
      EarlyGame.render();
      $('#content, #main, #locationSlider, #roomPanel').scrollTop(0);
      window.scrollTo(0,0);
      if (!$('#roomPanel .guestCare').is(':visible') || $('#roomPanel .guestCare').prop('disabled')) throw Error('care entry inaccessible');
    })()`);
    const careImage = await page('Page.captureScreenshot', {format:'png'});
    const careOutput = path.join(profile, 'opening-care.png');
    fs.writeFileSync(careOutput, Buffer.from(careImage.data, 'base64'));
    console.log('SCREENSHOT: ' + careOutput);
    await evaluate(`(function() {
      $SM.set('game.builder.level',4); $SM.set('game.buildings.lodge',1);
      $SM.set('game.openingSupplyChoice',false);
      $SM.set('game.campaignClaims',{cart:true,shelter:true,traps:true,hunters:true});
      EarlyGame.render();
      $('#content, #main, #locationSlider, #roomPanel').scrollTop(0);
      window.scrollTo(0,0);
      const guide=document.querySelector('#roomPanel .earlyGameTask').getBoundingClientRect();
      const builds=document.querySelector('#buildBtns').getBoundingClientRect();
      const choice=document.querySelector('#roomPanel .openingSupply button[data-choice="estate"]').getBoundingClientRect();
      if (guide.top < 0 || builds.top < guide.bottom || choice.bottom > innerHeight) throw Error('opening choices overlap building controls or leave viewport');
    })()`);
    const supplyImage = await page('Page.captureScreenshot', {format:'png'});
    const supplyOutput = path.join(profile, 'opening-supplies.png');
    fs.writeFileSync(supplyOutput, Buffer.from(supplyImage.data, 'base64'));
    console.log('SCREENSHOT: ' + supplyOutput);
    await evaluate(`(async function() {
      $SM.set('features.location.path',true);
      $SM.set('features.location.spaceShip',false);
      $SM.set('game.embarks',1); $SM.set('game.maxDistance',3);
      $SM.set('game.buildings["iron mine"]',0);
      Engine.travelTo(Path);
      await new Promise(resolve => $('#locationSlider').promise().done(resolve));
      $('#journeyGuide').prop('open',true);
      Path.updateJourneyGuide();
      $('#pathScroller, #content, #main, #locationSlider').scrollTop(0);
      window.scrollTo(0,0);
      const guide=document.querySelector('#journeyGuide').getBoundingClientRect();
      const supplies=document.querySelector('#suppliesRow').getBoundingClientRect();
      if (guide.top<0 || guide.right>innerWidth || guide.bottom>supplies.top) throw Error('beginner checklist overlaps supplies or leaves viewport');
    })()`);
    const journeyImage = await page('Page.captureScreenshot', {format:'png'});
    const journeyOutput = path.join(profile, 'beginner-journey.png');
    fs.writeFileSync(journeyOutput, Buffer.from(journeyImage.data, 'base64'));
    console.log('SCREENSHOT: ' + journeyOutput);
    await evaluate(`(async function() {
      ExpeditionReport.show();
      await new Promise(resolve=>Events.eventPanel().promise().done(resolve));
      const title=document.querySelector('.expeditionReport .eventTitle').getBoundingClientRect();
      const close=document.querySelector('#closeExpeditionReport').getBoundingClientRect();
      if(title.top<0 || title.right>innerWidth || close.top<0 || close.bottom>innerHeight) throw Error('expedition report hides its title or close button');
      if(document.querySelectorAll('.expeditionReport strong').length<9) throw Error('expedition key facts are not emphasized');
      if(document.querySelectorAll('.expeditionReport .expeditionSection').length!==4) throw Error('expedition sections missing');
      if(document.querySelector('.expeditionRules').open) throw Error('statistics explanation should start collapsed');
      window.expeditionStateBefore=JSON.stringify({stores:$SM.get('stores'),outfit:Path.outfit,report:ExpeditionReport.latest()});
    })()`);
    await checkDialogTheme('.expeditionReport', false);
    const expeditionImage = await page('Page.captureScreenshot', {format:'png'});
    const expeditionOutput = path.join(profile, 'expedition-report.png');
    fs.writeFileSync(expeditionOutput, Buffer.from(expeditionImage.data, 'base64'));
    console.log('SCREENSHOT: ' + expeditionOutput);
    await checkDialogTheme('.expeditionReport', true);
    const darkExpeditionImage = await page('Page.captureScreenshot', {format:'png'});
    const darkExpeditionOutput = path.join(profile, 'expedition-report-dark.png');
    fs.writeFileSync(darkExpeditionOutput, Buffer.from(darkExpeditionImage.data, 'base64'));
    console.log('SCREENSHOT: ' + darkExpeditionOutput);
    await evaluate(`document.querySelector('.expeditionRules').open=true`);
    await checkDialogTheme('.expeditionReport', true);
    await page('Emulation.setDeviceMetricsOverride', {width:1137,height:745,deviceScaleFactor:1,mobile:false});
    await checkDialogTheme('.expeditionReport', true);
    await page('Emulation.clearDeviceMetricsOverride');
    await checkDialogTheme('.expeditionReport', false);
    await evaluate(`(function(){
      if(JSON.stringify({stores:$SM.get('stores'),outfit:Path.outfit,report:ExpeditionReport.latest()})!==window.expeditionStateBefore) throw Error('reviewing and theme switching must not mutate inventory or report');
    })()`);
    await evaluate(`(async function() {
      await new Promise(resolve=>Events.endEvent(resolve));
      Path.outfit={'nichirin katana':1,'cured meat':5}; $SM.set('outfit',Path.outfit);
      Path.embark();
      await new Promise(resolve=>$('#outerSlider').promise().done(resolve));
      World.curPos=[33,32];World.foodMove=1;World.waterMove=0;World.setWater(2);
      Path.outfit['cured meat']=2;World.updateSupplies();
      World.drawMap();World.updateTravelGuide();
      World.setHp(World.getMaxHealth()-3);
      $('#worldTravelGuide').prop('open',true);
      $('#content, #outerSlider, #worldPanel').scrollTop(0);window.scrollTo(0,0);
      const guide=document.querySelector('#worldTravelGuide').getBoundingClientRect();
      const map=document.querySelector('#map').getBoundingClientRect();
      const treatment=document.querySelector('#worldFieldTreatment').getBoundingClientRect();
      const treatmentButton=document.querySelector('#worldHeal_meat');
      if(guide.top<0 || guide.left<0 || guide.right>innerWidth || guide.bottom>map.top) throw Error('return reminder overlaps map or leaves viewport');
      if(treatment.left<map.right || treatment.right>innerWidth || treatment.top<0 || treatment.bottom>innerHeight) throw Error('field treatment overlaps map or leaves viewport');
      if(Math.abs(treatmentButton.getBoundingClientRect().width-treatment.width)>2) throw Error('field treatment buttons too narrow: '+JSON.stringify({html:treatmentButton.outerHTML,width:getComputedStyle(treatmentButton).width,parentWidth:getComputedStyle(treatmentButton.parentNode).width}));
    })()`);
    const returnImage = await page('Page.captureScreenshot', {format:'png'});
    const returnOutput = path.join(profile, 'world-return-guide.png');
    fs.writeFileSync(returnOutput, Buffer.from(returnImage.data, 'base64'));
    console.log('SCREENSHOT: ' + returnOutput);
    const chapterChecks = await evaluate(`(async function() {
      const checks=[];
      const check=(condition,name)=>{if(!condition) throw Error(name);checks.push(name);};
      const until=async predicate=>{for(let i=0;i<160;i++){if(predicate()) return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('chapter state did not settle: '+Events.activeScene);};
      World.goHome();
      await new Promise(resolve=>$('#outerSlider').promise().done(resolve));
      $SM.setM('game.buildings',{'iron mine':1,'coal mine':1,steelworks:1});
      const savedMap=$SM.get('game.world.map').map(row=>row.slice());
      savedMap[30][31]='M!';
      $SM.set('game.world.map',savedMap);
      check(savedMap.flat().filter(cell=>cell.charAt(0)==='T').length===1,'world initialization adds exactly one train station');
      check(EarlyGame.milestones().length===21 && EarlyGame.trainReady(),'expanded mainline preserves train access without forcing optional rehabilitation');
      $SM.setM('stores',{'nichirin katana':1,'cured meat':20,medicine:5});
      Path.outfit={'nichirin katana':1,'cured meat':5,medicine:2};$SM.set('outfit',Path.outfit);
      check(Path.embark(),'train mission uses a normal charged expedition');
      let station;
      World.state.map.forEach((row,x)=>row.forEach((cell,y)=>{if(cell==='T') station=[x,y];}));
      World.curPos=station;World.drawMap();World.doSpace();
      check(Events.activeEvent()===Events.Setpieces.mugenTrain && !$('#board').hasClass('disabled'),'the real station opens the playable train episode');
      $('#board').trigger('click');$('#defend').trigger('click');
      check(Events.activeScene==='flesh' && $('#enemy').data('hp')===40,'train chapter enters the actual Enmu avatar combat');
      Events.clearTimeouts();
      const originalHit=World.BASE_HIT_CHANCE;World.BASE_HIT_CHANCE=1;
      $('#enemy').data('hp',1);
      $('#attack_nichirin-katana').trigger('click');
      await until(()=>$('#rescue').length && Events.fought);
      World.BASE_HIT_CHANCE=originalHit;
      check(!$SM.get('game.world.mugentrain') && !World.state.mugentrain,'winning the train fight alone does not complete the chapter');
      Button.clearCooldown($('#rescue'));$('#rescue').trigger('click');
      $('#stay').trigger('click');$('#listen').trigger('click');
      check(World.state.mugentrain && !$SM.get('game.world.mugentrain'),'chapter completion remains temporary before return');
      check(Events.eventPanel().text().includes('炎柱') && Events.eventPanel().text().includes('安全返回庄园'),'train ending explains lore and safe-return requirement');
      await new Promise(resolve=>Events.endEvent(resolve));

      // Ordinary victory: real attack, live discard counts, and treatment before exit.
      Path.outfit={'nichirin katana':1,medicine:3,'cured meat':Path.getCapacity()-Path.getWeight('nichirin katana')-3*Path.getWeight('medicine')};
      World.setHp(World.getMaxHealth()-5);
      Events.startEvent({title:'战后收拾背包',scenes:{start:{combat:true,enemy:'blood mist demon',chara:'鬼',health:1,damage:1,hit:1,attackDelay:30,loot:{cloth:{min:4,max:5,chance:1}},deathMessage:'鬼已倒下。'}}});
      Events.clearTimeouts();World.BASE_HIT_CHANCE=1;
      $('#attack_nichirin-katana').trigger('click');
      await until(()=>$('#leaveBtn').length && Events.fought);
      World.BASE_HIT_CHANCE=originalHit;
      check($('#buttons').children().last().attr('id')==='exitButtons','ordinary victory leaves treatment above the final exit');
      const food=Path.outfit['cured meat'];
      Events.drawDrop($('#take_cloth'));
      check($('#drop_cured-meat').text().includes('背包 '+food) && $('#drop_medicine').text().includes('背包 3'),'actual discard menu shows every remaining backpack quantity');
      $('#drop_cured-meat').trigger('click');
      check(Path.outfit['cured meat']===food-1 && Path.outfit.cloth===1 && $('#drop_cured-meat').text().includes('背包 '+(food-1)),'discarding and pickup refresh quantities without reopening');
      $('#dropMenu').remove();
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'2',bubbles:true}));
      document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'2',bubbles:true}));
      check(Path.outfit.medicine===2,'reordered post-battle treatment preserves the medicine hotkey');
      Button.clearCooldown($('#leaveBtn'));$('#leaveBtn').trigger('click');
      await until(()=>!Events.activeEvent());
      check(World.goHome() && $SM.get('game.world.mugentrain'),'safe return commits the new train chapter');
      check(ExpeditionReport.latest().unlocks.includes('无限列车支援完成'),'expedition report includes the new chapter completion');
      return checks;
    })()`);
    console.log(chapterChecks.map(name=>'PASS: '+name).join('\n'));
    const districtChecks=await evaluate(`(async function() {
      const checks=[],check=(ok,label)=>{if(!ok) throw Error(label);checks.push(label);};
      const until=async fn=>{for(let i=0;i<180&&!fn();i++) await new Promise(resolve=>setTimeout(resolve,30));if(!fn()) throw Error('district flow timeout: '+Events.activeScene);};
      await new Promise(resolve=>$('#outerSlider').promise().done(resolve));
      $SM.set('game.yoshiwaraDone',false);
      $SM.setM('stores',{'nichirin katana':1,'cured meat':30,medicine:6});
      Path.outfit={'nichirin katana':1,'cured meat':20,medicine:4};$SM.set('outfit',Path.outfit);
      check(Path.embark(),'district rescue starts with a normal charged expedition');
      const locations={};World.state.map.forEach((row,x)=>row.forEach((cell,y)=>{
        if(['O','D','R'].includes(cell[0])) locations[cell[0]]=[x,y];
      }));
      check(World.state.map.flat().filter(cell=>cell[0]==='O').length===1,'real world has exactly one district, with independent D/R settlements');
      World.state.mask=World.state.map.map(row=>row.map(()=>true));
      World.curPos=locations.O;World.drawMap();
      check(World.LANDMARKS.D.label==='宿场旧街' && World.LANDMARKS.R.label==='废弃市镇' &&
        Events.Setpieces.roadTown.title.includes('宿场') && Events.Setpieces.marketTown.title.includes('市镇'), 'new settlement letters open distinct names instead of duplicate Yoshiwara');
      World.doSpace();$('#enter').trigger('click');$('#search').trigger('click');
      check($('#assemble').hasClass('disabled'),'real search cannot skip missing wife intelligence');
      $('#makio').trigger('click');$('#back').trigger('click');
      check($('#makio').hasClass('disabled') && $('#assemble').hasClass('disabled'),'found intelligence retires its action without opening the incomplete route');
      $('#suma').trigger('click');$('#back').trigger('click');$('#hinatsuru').trigger('click');$('#back').trigger('click');
      check(!$('#assemble').hasClass('disabled'),'all three actual search choices unlock the underground rescue');
      $('#assemble').trigger('click');$('#guard').trigger('click');
      const win=async(scene,next)=>{
        check(Events.activeScene===scene && $('#enemy').length===1,'district '+scene+' enters real support combat');
        Events.clearTimeouts();Events.dotDamage($('#enemy'),9999,'regression finishing strike');
        await until(()=>Events.fought && $('#'+next).length);
        check(!$SM.get('game.yoshiwaraDone'),'district '+scene+' victory alone cannot commit the chapter');
        Button.clearCooldown($('#'+next));$('#'+next).trigger('click');
      };
      await win('obi','rescue');$('#routes').trigger('click');$('#alley').trigger('click');$('#hold').trigger('click');
      await win('dakiObi','observe');$('#cover').trigger('click');
      await win('bloodSickles','signal');$('#help').trigger('click');$('#listen').trigger('click');$('#dawn').trigger('click');
      check(World.state.yoshiwara && !$SM.get('game.yoshiwaraDone') && World.state.map[locations.O[0]][locations.O[1]]==='O!',
        'district ending marks only the temporary map and keeps permanent victory uncommitted');
      check(Events.eventPanel().text().includes('安全返回庄园'),'district conclusion explicitly asks for a safe return');
      $('#leave').trigger('click');await until(()=>!Events.activeEvent());
      check(World.goHome() && $SM.get('game.yoshiwaraDone') && $SM.get('game.world.yoshiwara'),'actual safe return commits unique district victory');
      check(CombatStyles.isUnlocked('sound') && $SM.hasPerk('kehai dansha'),'safe district rescue unlocks sound study and preserves its old training reward');
      check(ExpeditionReport.latest().unlocks.includes('游郭救援完成'),'district completion appears in the real expedition report');
      return checks;
    })()`);
    console.log(districtChecks.map(name=>'PASS: '+name).join('\n'));
    const newStoryChecks=await evaluate(`(async function() {
      const checks=[],check=(ok,label)=>{if(!ok) throw Error(label);checks.push(label);};
      const until=async fn=>{for(let i=0;i<180&&!fn();i++) await new Promise(resolve=>setTimeout(resolve,30));if(!fn()) throw Error('new chapter flow timeout: '+Events.activeScene);};
      await new Promise(resolve=>$('#outerSlider').promise().done(resolve));
      $SM.setM('game.buildings',{workshop:1,smokehouse:1});
      $SM.set('game.butterflyEstateDone',false);
      $SM.setM('stores',{'nichirin katana':1,'cured meat':10,medicine:3,wood:10,meat:4,cloth:1,torch:0});
      Path.outfit={'nichirin katana':1,'cured meat':2};$SM.set('outfit',Path.outfit);
      check(Path.embark(),'new story uses ordinary expedition departure');
      const locations={};World.state.map.forEach((row,x)=>row.forEach((cell,y)=>{if(['E','K'].includes(cell[0])) locations[cell[0]]=[x,y];}));
      check(World.state.map.flat().filter(cell=>cell[0]==='E').length===1 && World.state.map.flat().filter(cell=>cell[0]==='K').length===1,
        'real generated world has unique butterfly estate and swordsmith village');
      World.curPos=locations.E;World.doSpace();$('#enter').trigger('click');
      $SM.set('stores["cured meat"]',0);
      Path.outfit={'nichirin katana':1,fur:Path.getCapacity()-5};$SM.set('outfit',Path.outfit);World.updateSupplies();Events.updateButtons();
      check(Events.activeScene==='aoi' && $('#meal').hasClass('disabled') && $('.storySupplyAction').prop('disabled'),
        'real chapter renders a capacity-blocked commission instead of silently overfilling the bag');
      const before=JSON.stringify({stores:State.stores,outfit:Path.outfit});
      StoryCrafting.refresh();check(JSON.stringify({stores:State.stores,outfit:Path.outfit})===before,'story supply preview is read-only');
      Path.outfit.fur-=2;Events.updateButtons();
      check(!$('.storySupplyAction').prop('disabled') && $('.storySupplyDetails').text().includes('消耗庄园材料') && $('.storySupplyTitle').length===1,
        'commission shows actual ingredients with a bold choice heading');
      $('.storySupplyAction').trigger('click');
      check(Path.outfit['cured meat']===2 && $SM.get('stores.wood')===0 && $SM.get('stores.meat')===0 && !$('#meal').hasClass('disabled'),
        'actual commission crafts two portions from four meat and ten wood then enables the original story action');
      check(Events.activeScene==='aoi','commission never auto-selects the story response');
      $('#meal').trigger('click');check(Path.outfit['cured meat']===0 && Events.activeScene==='meal','original story submission charges the crafted goods once');
      $('#listen').trigger('click');$('#train').trigger('click');
      check($('#report').hasClass('disabled'),'butterfly joint report waits for all three companions');
      $('#tanjiro').trigger('click');$('#steady').trigger('click');$('#back').trigger('click');
      $('#zenitsu').trigger('click');$('#listen').trigger('click');$('#back').trigger('click');
      $('#inosuke').trigger('click');$('#lead').trigger('click');$('#back').trigger('click');
      check(!$('#report').hasClass('disabled'),'all three actual companion activities unlock the herb escort');
      $('#report').trigger('click');$('#pack').trigger('click');$('#day').trigger('click');$('#guard').trigger('click');
      check(Events.activeScene==='escort' && !$('.storySupplyAction').length,'live support combat never provides manor commissions');
      Events.clearTimeouts();Events.dotDamage($('#enemy'),9999,'regression finishing strike');
      await until(()=>Events.fought && $('#check').length);Button.clearCooldown($('#check'));$('#check').trigger('click');
      $('#rest').trigger('click');$('#friends').trigger('click');$('#finish').trigger('click');
      check(World.state.butterfly && !$SM.get('game.butterflyEstateDone'),'whole rehabilitation chapter remains temporary until safe return');
      $('#leave').trigger('click');await until(()=>!Events.activeEvent());
      check(World.goHome() && $SM.get('game.butterflyEstateDone') && $SM.hasPerk('total concentration'),
        'actual safe return commits rehabilitation and one-time concentration training');
      check(ExpeditionReport.latest().unlocks.includes('蝶屋康复训练完成'),'rehabilitation is reported in the real expedition outcome');
      await new Promise(resolve=>$('#outerSlider').promise().done(resolve));

      $SM.set('game.swordsmithVillageDone',true);$SM.set('game.swordsmithChapterDone',false);
      $SM.setM('stores',{'nichirin katana':3,'cured meat':30,medicine:5});
      Path.outfit={'nichirin katana':1,'cured meat':10,medicine:2};$SM.set('outfit',Path.outfit);
      check(Path.embark(),'legacy smith players may embark for the new full chapter');
      World.curPos=locations.K;World.doSpace();
      check(!$('#enter').hasClass('disabled'),'legacy smith completion preserves eligibility for the new K chapter');
      $('#enter').trigger('click');$('#visit').trigger('click');
      $('#forge').trigger('click');$('#window').trigger('click');$('#back').trigger('click');
      $('#kotetsu').trigger('click');$('#observe').trigger('click');$('#back').trigger('click');
      $('#letters').trigger('click');$('#read').trigger('click');$('#next').trigger('click');$('#back').trigger('click');
      check(!$('#ready').hasClass('disabled'),'village preparation includes forging, Kotetsu and both absent companions letters');
      $('#ready').trigger('click');$('#guard').trigger('click');
      const win=async(scene,next)=>{
        check(Events.activeScene===scene && $('#enemy').length===1,'swordsmith '+scene+' uses actual support combat');
        Events.clearTimeouts();Events.dotDamage($('#enemy'),9999,'regression finishing strike');
        await until(()=>Events.fought && $('#'+next).length);Button.clearCooldown($('#'+next));$('#'+next).trigger('click');
      };
      await win('fish','rescue');$('#cover').trigger('click');$('#cover').trigger('click');
      await win('gale','meet');$('#rear').trigger('click');await win('wood','signal');
      $('#care').trigger('click');$('#carry').trigger('click');$('#report').trigger('click');$('#finish').trigger('click');
      check(World.state.swordsmith && !$SM.get('game.swordsmithChapterDone') && $SM.get('game.swordsmithVillageDone'),
        'new village completion is temporary while legacy progress remains intact');
      $('#leave').trigger('click');await until(()=>!Events.activeEvent());
      check(World.goHome() && $SM.get('game.swordsmithChapterDone') && $SM.get('stores["nichirin katana"]')===3,
        'safe-return new village completion never grants legacy smiths a second fixed sword');
      check(ExpeditionReport.latest().unlocks.includes('锻刀村支援完成'),'village completion appears in expedition feedback');
      await new Promise(resolve=>$('#outerSlider').promise().done(resolve));

      Engine.travelTo(Room);await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
      $SM.remove('game.companionInteractions');Engine.keyLock=false;
      check(Events.Companions.event.isAvailable(),'appropriate local-time letters are actually eligible at home');
      const flags=JSON.stringify({train:$SM.get('game.world.mugentrain'),district:$SM.get('game.yoshiwaraDone'),smith:$SM.get('game.swordsmithVillageDone')});
      Events.startEvent(Events.Companions.event);
      check(Events.eventPanel().text().includes('本地时段') && $('#reply0').length===1 && $('#reply1').length===1,
        'real trio dialogue displays local time and two response choices');
      $('#reply0').trigger('click');
      check(Events.eventPanel().text().includes('首次交流补给已放入庄园仓库'),'actual trio response grants its first small reward');
      check(JSON.stringify({train:$SM.get('game.world.mugentrain'),district:$SM.get('game.yoshiwaraDone'),smith:$SM.get('game.swordsmithVillageDone')})===flags,
        'random letters never complete mainline chapters');
      $('#leave').trigger('click');await until(()=>!Events.activeEvent());
      check(!Events.Companions.event.isAvailable(),'actual letter completion respects its cooldown');
      return checks;
    })()`);
    console.log(newStoryChecks.map(name=>'PASS: '+name).join('\n'));
    const blueprintStateBackup = await evaluate('JSON.stringify(State)');
    const blueprintChecks = await evaluate(`(async function() {
      const checks=[],check=(ok,label)=>{if(!ok) throw Error(label);checks.push(label);};
      Engine.travelTo(Room);await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
      check(!Events.activeEvent(),'old-save blueprint backfill starts at home with no story event');
      clearTimeout(Events._eventTimeout);clearTimeout(Engine._incomeTimeout);
      $SM.set('income',{});
      const allClaims=Object.fromEntries(EarlyGame.milestones().filter(task=>!['pillars','castle'].includes(task.id)).map(task=>[task.id,true]));
      const pillarEvent=Events.Global.find(event=>event.title===_('The Pillars Convene'));
      for(const flag of ['game.swordsmithVillageDone','game.swordsmithChapterDone']) {
        $SM.set('game.swordsmithVillageDone',false);$SM.set('game.swordsmithChapterDone',false);$SM.set(flag,true);
        $SM.set('game.swordsmithBlueprintGranted',false);$SM.set('game.pillarConvocationDone',false);
        $SM.set('game.campaignClaims',Object.assign({},allClaims));
        $SM.set('character.blueprints',{'wisteria oil':false,'wind armour':null});
        EarlyGame.render();
        const button=document.querySelector('#roomPanel .smithBlueprintClaim');
        check(EarlyGame.milestone().id==='pillars' && !!button && $(button).is(':visible') && !button.disabled,
          flag+' exposes an actual enabled blueprint backfill button in the current stage task');
        check(button.textContent.includes('补领锻刀村图纸') && !pillarEvent.isAvailable(),
          flag+' false/null blueprints cannot silently unlock the Pillar event');
        const before=JSON.stringify({stores:State.stores,claims:State.game.campaignClaims,perks:State.character.perks});
        button.click();
        check(State.character.blueprints['wisteria oil']===true && $SM.get('game.swordsmithBlueprintGranted')===true
          && !$('#roomPanel .smithBlueprintClaim').is(':visible'),flag+' real button unlocks exactly the fixed blueprint and hides the claim');
        check(JSON.stringify({stores:State.stores,claims:State.game.campaignClaims,perks:State.character.perks})===before,
          flag+' backfill preserves weapons, supplies, stage claims and existing training');
        check(!$SM.get('game.pillarConvocationDone') && pillarEvent.isAvailable(),
          flag+' makes the actual Pillar event available without completing training');
        const claimed=JSON.stringify(State);button.click();
        check(!EarlyGame.claimSmithBlueprint() && JSON.stringify(State)===claimed,
          flag+' repeated detached-button/direct claims cannot award or change anything');
      }
      $SM.set('character.blueprints',{'wind armour':true,'wisteria oil':false});$SM.set('game.swordsmithBlueprintGranted',false);
      EarlyGame.render();
      check(pillarEvent.isAvailable() && !$('#roomPanel .smithBlueprintClaim').is(':visible'),
        'an existing usable blueprint keeps the original Pillar route without a new backfill step');
      $SM.set('character.blueprints',{'wisteria oil':true,'wind armour':null});$SM.set('game.swordsmithBlueprintGranted',true);
      Engine.saveGame();
      return checks;
    })()`);
    console.log(blueprintChecks.map(name=>'PASS: '+name).join('\n'));
    await page('Page.reload', {ignoreCache:true});
    let blueprintReloadReady=false;
    for(let i=0;i<100;i++) {
      blueprintReloadReady=await evaluate('!!(window.Engine && Engine.activeModule && window.EarlyGame && Events.StoryChapters)');
      if(blueprintReloadReady) break;
      await pause(100);
    }
    assert.ok(blueprintReloadReady,'game did not initialize after blueprint backfill reload');
    await pause(1100);
    const blueprintReloadChecks=await evaluate(`(function() {
      clearTimeout(Events._eventTimeout);clearTimeout(Engine._incomeTimeout);
      const pillarEvent=Events.Global.find(event=>event.title===_('The Pillars Convene'));
      if(!State.character.blueprints['wisteria oil'] || !$SM.get('game.swordsmithBlueprintGranted')) throw Error('backfill blueprint or once-only flag was lost after reload');
      if($SM.get('game.pillarConvocationDone') || !pillarEvent.isAvailable()) throw Error('reload must preserve new-flag-only Pillar eligibility without completing training');
      if($('#roomPanel .smithBlueprintClaim').is(':visible') || EarlyGame.claimSmithBlueprint()) throw Error('reload must not revive the completed backfill action');
      if(State.character.blueprints['wind armour']) throw Error('null blueprint keys must stay undiscovered after reload');
      return 'PASS: actual blueprint backfill survives reload, keeps the Pillar event available, and cannot be claimed twice.';
    })()`);
    console.log(blueprintReloadChecks);
    // Restore the previous completed chapter fixture so later regression sections remain independent.
    await evaluate('State=JSON.parse(' + JSON.stringify(blueprintStateBackup) + ');Engine.saveGame();');
    await page('Page.reload', {ignoreCache:true});
    let blueprintRestoreReady=false;
    for(let i=0;i<100;i++) {
      blueprintRestoreReady=await evaluate('!!(window.Engine && Engine.activeModule && window.EarlyGame && Events.StoryChapters)');
      if(blueprintRestoreReady) break;
      await pause(100);
    }
    assert.ok(blueprintRestoreReady,'game did not initialize after restoring chapter fixtures');
    await pause(1100);
    await evaluate(`(function() {
      clearTimeout(Events._eventTimeout);clearTimeout(Engine._incomeTimeout);
      // Reload discards line 273's manually created Ship/Space UI, which later castle cases still use.
      if (!Ship.panel) Ship.init();
    })()`);
    await evaluate(`(function(){
      $SM.setM('stores',{'cured meat':0,wood:10,meat:4});
      Events.startEvent({title:'蝶屋 · 剧情补料预览',storySupply:true,scenes:{start:{
        text:['神崎葵请你为康复中的队士准备餐食。没有熏肉成品时，可以委托庄园按现有配方代制，再交付这次互动。'],
        buttons:{meal:{text:'准备 2 份熏肉，陪伤者吃饭',cost:{'cured meat':2}},leave:{text:'暂不提交，回去整备',nextScene:'end'}}
      }}});
      Events.eventPanel().addClass('storySupplyTest');
    })()`);
    await checkDialogTheme('.storySupplyTest', false);
    const supplyDay=await page('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(profile,'story-supplies.png'),Buffer.from(supplyDay.data,'base64'));
    console.log('SCREENSHOT: '+path.join(profile,'story-supplies.png'));
    await checkDialogTheme('.storySupplyTest', true);
    const supplyNight=await page('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(profile,'story-supplies-dark.png'),Buffer.from(supplyNight.data,'base64'));
    console.log('SCREENSHOT: '+path.join(profile,'story-supplies-dark.png'));
    await evaluate(`(async function(){
      await new Promise(resolve=>Events.endEvent(resolve));
      Engine.travelTo(Path);await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
    })()`);
    const noticeChecks = await evaluate(`(async function() {
      const checks = [];
      const check = (condition, name) => { if (!condition) throw Error(name); checks.push(name); };
      await new Promise(resolve => $('#outerSlider').promise().done(resolve));
      check(!Events.activeEvent(), 'completed journey leaves no event before notice reading');
      const before = JSON.stringify(State), outfitBefore = JSON.stringify(Path.outfit);
      $('.menuToggle').trigger('click');
      check($('#updateNotesButton').is(':visible'), 'update announcement button is available in the menu');
      $('#updateNotesButton').trigger('click');
      const event = Events.activeEvent(), panel = Events.eventPanel();
      check(panel.hasClass('updateNotes') && panel.attr('role') === 'dialog', 'menu opens the actual update announcement dialog');
      check(panel.find('.updateNotesEntry').length === UpdateNotes.entries.length && panel.find('.updateNotesEntry[open]').length === 1, 'recent history starts with the latest batch expanded and older batches collapsed');
      check(panel.text().includes('20 个阶段') && panel.text().includes('150 → 15') && panel.text().includes('2 个肉 + 5 块木头'), 'recent mainline and resource changes are included in the game announcement');
      check(panel.find('li strong').length > 50, 'important update labels are bold throughout the history');
      $('#expandUpdateNotes').trigger('click');
      check(panel.find('.updateNotesEntry[open]').length === UpdateNotes.entries.length, 'all historical announcement batches can be expanded');
      $('#updateNotesCategory').val('资源').trigger('change');
      check(panel.find('li').length === UpdateNotes.filteredEntries('资源').reduce((sum, entry) => sum + entry.items.length, 0) && !panel.text().includes('菜单更新公告：'), 'category filtering displays only matching update items');
      $('#updateNotesCategory').val('全部').trigger('change');
      $('#collapseUpdateNotes').trigger('click');
      check(panel.find('.updateNotesEntry[open]').length === 1, 'collapse history keeps the latest announcement readable');
      check(!UpdateNotes.show() && Events.activeEvent() === event, 'opening twice never replaces or stacks the announcement');
      document.body.dispatchEvent(new KeyboardEvent('keydown', {key:'1', bubbles:true}));
      document.body.dispatchEvent(new KeyboardEvent('keyup', {key:'1', bubbles:true}));
      check(JSON.stringify(State) === before && JSON.stringify(Path.outfit) === outfitBefore, 'reading and filtering announcements never change saves or use background supplies');
      return checks;
    })()`);
    console.log(noticeChecks.map(name => 'PASS: ' + name).join('\n'));
    await checkDialogTheme('.eventPanel.updateNotes', false);
    const noticeDay = await page('Page.captureScreenshot', {format:'png'});
    fs.writeFileSync(path.join(profile, 'update-notes.png'), Buffer.from(noticeDay.data, 'base64'));
    console.log('SCREENSHOT: ' + path.join(profile, 'update-notes.png'));
    await checkDialogTheme('.eventPanel.updateNotes', true);
    const noticeDark = await page('Page.captureScreenshot', {format:'png'});
    fs.writeFileSync(path.join(profile, 'update-notes-dark.png'), Buffer.from(noticeDark.data, 'base64'));
    console.log('SCREENSHOT: ' + path.join(profile, 'update-notes-dark.png'));
    await evaluate(`(async function() {
      document.querySelector('#closeUpdateNotes').dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
      for (let i=0; i<50 && Events.activeEvent(); i++) await new Promise(resolve => setTimeout(resolve,20));
      if (Events.activeEvent() || document.activeElement.id !== 'updateNotesButton') throw Error('Escape must close notices and restore menu focus');
      const menu=document.querySelector('.menu'), button=document.querySelector('#updateNotesButton');
      for(let i=0;i<40 && button.getBoundingClientRect().top<menu.getBoundingClientRect().top;i++) await new Promise(resolve=>setTimeout(resolve,25));
      if(button.getBoundingClientRect().top<menu.getBoundingClientRect().top) throw Error('restored announcement focus must stay visible in the expanded menu');
      const module = Engine.activeModule, before = JSON.stringify(State);
      Engine.activeModule = World;
      if (UpdateNotes.show() || Events.activeEvent()) throw Error('notice must never pause world exploration');
      Engine.activeModule = Space;
      if (UpdateNotes.show() || Events.activeEvent()) throw Error('notice must never pause castle exploration');
      Engine.activeModule = module;
      if (JSON.stringify(State) !== before) throw Error('blocked notice changed persistent state');
    })()`);
    console.log('PASS: notice Escape restores focus, and active exploration cannot open a pause-like announcement.');
    const scrapChecks = await evaluate(`(function() {
      const checks = [], check = (condition, name) => { if (!condition) throw Error(name); checks.push(name); };
      $SM.set('stores["bone yari"]',8);
      Path.outfit['bone yari']=1; $SM.set('outfit',Path.outfit);
      Path.updateOutfitting();
      const trigger = $('#outfit_bone-yari > .scrapBtn')[0] || $('#outfitting .outfitRow[key="bone yari"] > .scrapBtn')[0];
      check(!!trigger,'recycling row exposes the live Shift-click preview');
      const before = JSON.stringify(State);
      trigger.dispatchEvent(new MouseEvent('click',{shiftKey:true,bubbles:true}));
      check($('#scrapQuantityPanel').attr('role')==='dialog' && $('.scrapQuantityStock').text().includes('背包保护1'), 'real Shift-click opens recycling preview with packed inventory protected');
      $('#scrapQuantityInput').val('3').trigger('input');
      check($('#scrapQuantityRefund').text().includes('+90') && $('#scrapQuantityRefund').text().includes('+4'), 'real batch preview uses whole-batch material rounding');
      check(JSON.stringify(State)===before,'editing recycling preview does not change saves');
      $('#scrapQuantityInput').val('1.5').trigger('input');
      check($('.scrapQuantityOk').prop('disabled') && !$('#scrapQuantityRefund').text(), 'fractional recycling quantities disable confirmation and hide misleading refunds');
      $('#scrapQuantityInput').val('3').trigger('input');
      $SM.set('stores["bone yari"]',2);
      check($('.scrapQuantityOk').prop('disabled') && $('.scrapQuantityStock').text().includes('可回收1'), 'stock changes refresh the open preview without silently shrinking the selected amount');
      $SM.set('stores["bone yari"]',6);
      check(!$('.scrapQuantityOk').prop('disabled'),'restocking restores a valid batch confirmation');
      let backgroundClicks=0;
      const background=$('<button>').attr({'data-hotkey':'1',id:'backgroundPreviewTest'}).text('test').on('click',()=>backgroundClicks++).appendTo('body');
      $('.scrapQuantityOk').trigger('focus');
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}));
      document.activeElement.dispatchEvent(new KeyboardEvent('keyup',{key:'1',bubbles:true}));
      check(backgroundClicks===0,'quantity dialog blocks background hotkeys even when focus is on its confirmation button');
      const module=Engine.activeModule;
      document.activeElement.dispatchEvent(new KeyboardEvent('keyup',{key:'a',keyCode:65,which:65,bubbles:true}));
      check(Engine.activeModule===module,'quantity dialog also prevents key-release navigation behind it');
      background.remove();
      const wood=$SM.get('stores.wood'),teeth=$SM.get('stores.teeth');
      $('.scrapQuantityOk').trigger('click');
      check($SM.get('stores["bone yari"]')===3 && Path.outfit['bone yari']===1 && $SM.get('stores.wood')===wood+90 && $SM.get('stores.teeth')===teeth+4, 'confirmed recycling charges the exact batch and preserves packed copies');
      check(!$('#scrapQuantityOverlay').length && document.activeElement===trigger,'successful recycling closes preview and restores the triggering button');
      trigger.dispatchEvent(new MouseEvent('click',{shiftKey:true,bubbles:true}));
      $('#scrapQuantityInput').val('1').trigger('input');
      return checks;
    })()`);
    console.log(scrapChecks.map(name=>'PASS: '+name).join('\n'));
    const checkScrapTheme = dark => evaluate('(' + (async function(dark) {
      if (Engine.isLightsOff()!==dark) Engine.turnLightsOff();
      const panel=document.querySelector('#scrapQuantityPanel'), expected=dark?'rgb(39, 40, 35)':'rgb(255, 255, 255)';
      for(let i=0;i<40 && getComputedStyle(panel).backgroundColor!==expected;i++) await new Promise(resolve=>setTimeout(resolve,25));
      if(getComputedStyle(panel).backgroundColor!==expected) throw Error('recycling theme incorrect');
      const box=panel.getBoundingClientRect();
      if(box.top<0 || box.bottom>innerHeight) throw Error('recycling controls outside viewport');
    }).toString()+')('+dark+')');
    await checkScrapTheme(false);
    const scrapDay=await page('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(profile,'scrap-preview.png'),Buffer.from(scrapDay.data,'base64'));
    console.log('SCREENSHOT: '+path.join(profile,'scrap-preview.png'));
    await checkScrapTheme(true);
    const scrapDark=await page('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(profile,'scrap-preview-dark.png'),Buffer.from(scrapDark.data,'base64'));
    console.log('SCREENSHOT: '+path.join(profile,'scrap-preview-dark.png'));
    await evaluate(`(function() {
      const before=JSON.stringify(State),trigger=Path._scrapDialog.trigger;
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      if($('#scrapQuantityOverlay').length || JSON.stringify(State)!==before || document.activeElement!==trigger) throw Error('cancelled recycling must not charge and must restore focus');
    })()`);
    console.log('PASS: actual recycling Escape cancels without consuming items.');
    const editorChecks=await evaluate(`(function() {
      const checks=[],check=(condition,name)=>{if(!condition) throw Error(name);checks.push(name);};
      $SM.setM('stores',{'bone yari':3,'cured meat':40,medicine:0,torch:3});
      Path.outfit={'bone yari':1,'cured meat':5,torch:2};$SM.set('outfit',Path.outfit);
      const saved={version:1,targets:{'bone yari':1,'cured meat':10,medicine:2,'legacy supply':2},equipped:{primary:['bone yari',null],secondary:[],tool:[]},note:'preserve this'};
      const other={version:1,targets:{medicine:3},equipped:{primary:[],secondary:[],tool:[]}};
      $SM.set('character.loadouts.expedition',saved);$SM.set('character.loadouts.castle',other);$SM.set('character.selectedLoadout','expedition');
      Path.updateLoadoutPanel();
      const before=JSON.stringify(State),bag=JSON.stringify(Path.outfit),stores=JSON.stringify($SM.get('stores')),equipment=JSON.stringify($SM.get('character.equipped'));
      $('#editLoadoutBtn').trigger('click');
      check($('#loadoutEditorPanel').attr('role')==='dialog','actual preparation button opens the target editor');
      const medicine=$('[data-loadout-item="medicine"]')[0];
      $(medicine).val('10').trigger('input');
      check($('.loadoutEditorSummary').text().includes('库存不足 10'),'zero-stock supplies can be planned with explicit live shortages');
      check(!$('[data-loadout-item="legacy supply"]').length && !$('[data-loadout-item="steel"]').length,'editor does not offer unknown legacy targets or raw crafting materials');
      check(JSON.stringify(State)===before && JSON.stringify(Path.outfit)===bag,'editing a draft never writes saves or fills the backpack');
      $(medicine).trigger('focus');
      $SM.set('stores.medicine',1);
      check($('[data-loadout-item="medicine"]')[0]===medicine && medicine.value==='10' && document.activeElement===medicine,'stock refresh keeps the input node, draft and focus');
      $(medicine).val('1.5').trigger('input');
      check($('#saveLoadoutTargets').prop('disabled') && $('#loadoutEditorError').text().length>0,'invalid target quantities disable saving without partial updates');
      $(medicine).val('100').trigger('input');
      check(!$('#saveLoadoutTargets').prop('disabled') && $('.loadoutEditorSummary').text().includes('目标超过当前容量'),'oversized future targets warn clearly while actual refill remains capacity-limited');
      let backgroundClicks=0;
      const background=$('<button>').attr('data-hotkey','1').text('test').on('click',()=>backgroundClicks++).appendTo('body');
      $('#saveLoadoutTargets').trigger('focus');
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}));
      document.activeElement.dispatchEvent(new KeyboardEvent('keyup',{key:'1',bubbles:true}));
      const module=Engine.activeModule;
      document.activeElement.dispatchEvent(new KeyboardEvent('keyup',{key:'a',keyCode:65,which:65,bubbles:true}));
      check(backgroundClicks===0 && Engine.activeModule===module,'editor blocks background medicine and navigation even with save-button focus');
      background.remove();
      $('#saveLoadoutTargets').trigger('click');
      const next=Path.getLoadout('expedition');
      check(next.targets.medicine===100 && next.targets['legacy supply']===2 && next.note==='preserve this' && JSON.stringify(next.equipped)===JSON.stringify(saved.equipped),'saving targets preserves original equipment and unknown legacy fields');
      check(JSON.stringify(Path.getLoadout('castle'))===JSON.stringify(other) && JSON.stringify(Path.outfit)===bag && JSON.stringify($SM.get('character.equipped'))===equipment,'saving one target profile leaves the other profile, backpack and current equipment untouched');
      check($SM.get('stores.medicine')===1 && !$('#loadoutEditorOverlay').length && document.activeElement.id==='editLoadoutBtn','saving a future target neither purchases supplies nor loses editor-button focus');
      $SM.set('stores.medicine',0);
      check(JSON.stringify($SM.get('stores'))===stores,'target saving itself never spends warehouse resources');
      $('#editLoadoutBtn').trigger('click');
      $('[data-loadout-item="medicine"]').val('10').trigger('input');
      return checks;
    })()`);
    console.log(editorChecks.map(name=>'PASS: '+name).join('\n'));
    const checkPlanningTheme=(selector,dark)=>evaluate('('+(async function(selector,dark) {
      if(Engine.isLightsOff()!==dark) Engine.turnLightsOff();
      const panel=document.querySelector(selector),expected=dark?'rgb(39, 40, 35)':'rgb(255, 255, 255)';
      for(let i=0;i<40 && getComputedStyle(panel).backgroundColor!==expected;i++) await new Promise(resolve=>setTimeout(resolve,25));
      const style=getComputedStyle(panel);
      if(style.backgroundColor!==expected) throw Error('planning dialog theme incorrect: '+selector+' '+style.backgroundColor);
      const luminance=color=>{const rgb=color.match(/\d+/g).slice(0,3).map(value=>{const c=Number(value)/255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);});return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};
      const a=luminance(style.backgroundColor),b=luminance(style.color);
      if((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)<4.5) throw Error('planning dialog contrast too low');
      const actions=panel.querySelector('.loadoutEditorActions, .buyQuantityActions').getBoundingClientRect();
      if(actions.top<0 || actions.bottom>innerHeight) throw Error('planning actions are outside viewport: '+selector);
    }).toString()+')('+JSON.stringify(selector)+','+dark+')');
    for(const dark of [false,true]) {
      await checkPlanningTheme('#loadoutEditorPanel',dark);
      const shot=await page('Page.captureScreenshot',{format:'png'}),name=dark?'loadout-editor-dark.png':'loadout-editor.png';
      fs.writeFileSync(path.join(profile,name),Buffer.from(shot.data,'base64'));console.log('SCREENSHOT: '+path.join(profile,name));
    }
    await evaluate(`(async function() {
      let before=JSON.stringify(State);
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      if($('#loadoutEditorOverlay').length || JSON.stringify(State)!==before || document.activeElement.id!=='editLoadoutBtn') throw Error('editor Escape must cancel without writing');
      $('#editLoadoutBtn').trigger('click');
      const fresh=JSON.parse(JSON.stringify(Path.getLoadout('expedition')));fresh.targets.medicine=7;
      $SM.set('character.loadouts.expedition',fresh);before=JSON.stringify(State);
      $('#saveLoadoutTargets').trigger('click');
      if(!$('#saveLoadoutTargets').prop('disabled') || JSON.stringify(State)!==before) throw Error('stale editor must not overwrite a newer profile');
      $('#cancelLoadoutTargets').trigger('click');
      $('#editLoadoutBtn').trigger('click');
      const profileBefore=JSON.stringify(Path.getLoadout('expedition'));
      Events.startEvent({title:'context isolation',scenes:{start:{text:[],buttons:{closeContext:{text:'close',nextScene:'end'}}}}});
      if($('#loadoutEditorOverlay').length || JSON.stringify(Path.getLoadout('expedition'))!==profileBefore) throw Error('starting an event must discard the editor, not save it');
      await new Promise(resolve=>Events.endEvent(resolve));
      const module=Engine.activeModule;
      Engine.activeModule=World;if(LoadoutEditor.show()) throw Error('editor must not pause exploration');
      Engine.activeModule=Space;if(LoadoutEditor.show()) throw Error('editor must not pause castle');
      Engine.activeModule=module;
      $('#editLoadoutBtn').trigger('click');Engine.travelTo(Room);
      if($('#loadoutEditorOverlay').length || JSON.stringify(Path.getLoadout('expedition'))!==profileBefore) throw Error('leaving preparation must close the draft without saving');
      await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
    })()`);
    console.log('PASS: editor cancel, newer-profile protection, event cleanup and exploration/exit guards.');
    const buyChecks=await evaluate(`(function() {
      const checks=[],check=(condition,name)=>{if(!condition) throw Error(name);checks.push(name);};
      $SM.set('game.buildings["trading post"]',1);
      $SM.setM('stores',{scales:100,teeth:60,medicine:0});Room.updateBuildButtons();
      // The real trade button may mark itself seen on its first click; opening never spends inventory.
      const trigger=Room.TradeGoods.medicine.button[0],before=JSON.stringify($SM.get('stores'));
      trigger.dispatchEvent(new MouseEvent('click',{shiftKey:true,bubbles:true}));
      check($('#buyQuantityPanel').attr('role')==='dialog' && $('#buyQuantityInput').val()==='1','real Shift purchase opens a budget dialog defaulting to one item');
      $('#buyQuantityInput').val('3').trigger('input');
      const budget=Room.buyPreview('medicine','3');
      check(budget.valid && budget.materials.some(row=>row.key==='scales' && row.cost===60 && row.remaining===40) && budget.materials.some(row=>row.key==='teeth' && row.cost===36 && row.remaining===24),'budget previews all real recipe costs and remaining warehouse quantities');
      check(JSON.stringify($SM.get('stores'))===before,'reading or editing purchase budget does not spend materials');
      $('#buyQuantityInput').val('').trigger('input');
      check($('.buyQuantityOk').prop('disabled') && $('#buyQuantityError').text().length>0,'empty purchase input never means buy the maximum');
      $('#buyQuantityInput').val('3').trigger('input');
      $SM.set('stores.teeth',10);
      check($('.buyQuantityOk').prop('disabled') && $('#buyQuantityInput').val()==='3','live shortage blocks purchase and preserves the requested quantity');
      $SM.set('stores.teeth',60);
      check(!$('.buyQuantityOk').prop('disabled'),'material replenishment restores the exact requested purchase');
      let backgroundClicks=0;
      const background=$('<button>').attr('data-hotkey','1').text('test').on('click',()=>backgroundClicks++).appendTo('body');
      $('.buyQuantityOk').trigger('focus');
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}));
      document.activeElement.dispatchEvent(new KeyboardEvent('keyup',{key:'1',bubbles:true}));
      const module=Engine.activeModule;
      document.activeElement.dispatchEvent(new KeyboardEvent('keyup',{key:'d',keyCode:68,which:68,bubbles:true}));
      check(backgroundClicks===0 && Engine.activeModule===module,'purchase confirmation focus blocks background actions and key-release navigation');background.remove();
      $('.buyQuantityOk').trigger('click');
      check($SM.get('stores.medicine')===3 && $SM.get('stores.scales')===40 && $SM.get('stores.teeth')===24,'actual batch purchase charges exactly the previewed full recipe');
      check(!$('#buyQuantityOverlay').length && document.activeElement===trigger,'successful purchase restores focus to the real trade button');
      trigger.dispatchEvent(new MouseEvent('click',{shiftKey:true,bubbles:true}));
      return checks;
    })()`);
    console.log(buyChecks.map(name=>'PASS: '+name).join('\n'));
    for(const dark of [false,true]) {
      await checkPlanningTheme('#buyQuantityPanel',dark);
      const shot=await page('Page.captureScreenshot',{format:'png'}),name=dark?'buy-preview-dark.png':'buy-preview.png';
      fs.writeFileSync(path.join(profile,name),Buffer.from(shot.data,'base64'));console.log('SCREENSHOT: '+path.join(profile,name));
    }
    await evaluate(`(function() {
      const before=JSON.stringify(State),trigger=Room._buyDialog.trigger;
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      if($('#buyQuantityOverlay').length || JSON.stringify(State)!==before || document.activeElement!==trigger) throw Error('purchase Escape must cancel and restore focus');
      trigger.dispatchEvent(new MouseEvent('click',{shiftKey:true,bubbles:true}));
      Engine.travelTo(Path);
      if($('#buyQuantityOverlay').length || JSON.stringify($SM.get('stores'))!==JSON.stringify(JSON.parse(before).stores)) throw Error('leaving the trading room must close the purchase draft without spending');
    })()`);
    console.log('PASS: actual purchase Escape and leaving trading discard the budget without spending.');
    const castleFixChecks = await evaluate(`(async function() {
      const checks = [], check = (condition, name) => { if (!condition) throw Error(name); checks.push(name); };
      const until = async predicate => {
        for (let i = 0; i < 120; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 25)); }
        throw Error('castle regression transition timed out');
      };
      const finish = async id => {
        const owner = Events.activeEvent();
        Button.clearCooldown($(id)); $(id).trigger('click');
        await until(() => Events.activeEvent() !== owner);
      };
      const win = async () => {
        Events.clearTimeouts(); Events.dotDamage($('#enemy'), 999999, 'test finishing strike');
        await until(() => Events.won && $('#bankLoot').length === 1);
      };
      Engine.activeModule = Space; World.dead = false; Space.onArrival();
      $('#outerSlider').css('top', '-910px');
      Path.outfit = {'nichirin katana': 1}; $SM.set('outfit', Path.outfit);
      $SM.setM('stores', {convoy:1, scales:1000, teeth:1000, cloth:100, steel:100, iron:100, sulphur:100, meat:100, wood:100});
      Space.currentFloor = 20; Space.triggerBossFight(); await win();
      const scaleRow = $('#lootButtons .lootRow').filter(function() { return $(this).data('item') === 'scales'; });
      const total = scaleRow.find('.lootTake').data('numLeft'), bankBefore = $SM.get('stores.scales');
      Events.getLoot(scaleRow.find('.lootTake'));
      const bagBeforeBank = JSON.stringify(Path.outfit), boss = Events.activeEvent();
      $('#bankLoot').trigger('click');
      check(Events.activeEvent() === boss && Events.activeScene === 'start' && JSON.stringify(Path.outfit) === bagBeforeBank,
        'real boss bank-only action stays in settlement and preserves manually packed loot');
      check($SM.get('stores.scales') === bankBefore + total - 1 && !$('#lootButtons .lootRow').length,
        'real boss bank-only action credits only unclaimed materials and clears the ground rows');
      const banked = $SM.get('stores.scales'); Space._collectRemainingLoot();
      check($SM.get('stores.scales') === banked, 'repeated bank callbacks never duplicate boss materials');
      $('#recraft').trigger('click');
      check(Events.eventPanel().find('.eventTitle').text() === '守关补给商店' && $('#exitButtons [id^="recraft_"]').length === 12,
        'guardian shop has a Chinese title and all twelve supply rows');
      check($('#recraft_10').text().includes('太阳结晶') && $('#recraft_11').text().includes('藤花符'),
        'guardian shop explicitly includes solar ammunition and wisteria charms');
      const solarBefore = Path.outfit['solar crystal'] || 0, teethBefore = $SM.get('stores.teeth'), scalesBefore = $SM.get('stores.scales');
      $('#recraft_10').trigger('click');
      check(Path.outfit['solar crystal'] === solarBefore + 1 && $SM.get('stores.teeth') === teethBefore - 6 && $SM.get('stores.scales') === scalesBefore - 6,
        'actual solar purchase consumes the displayed estate recipe and adds one crystal to the pack');
      const normalBag = {...Path.outfit};
      Path.outfit = {'cured meat': Path.getCapacity()}; $SM.set('outfit', Path.outfit); Events.updateButtons();
      const fullBefore = JSON.stringify([Path.outfit, $SM.get('stores')]); $('#recraft_10').trigger('click');
      check($('#recraft_10').hasClass('disabled') && $('#recraft_10').text().includes('背包容量不足') && JSON.stringify([Path.outfit, $SM.get('stores')]) === fullBefore,
        'full pack keeps solar supplies visible but blocks spending with an explicit capacity warning');
      Path.outfit = normalBag; $SM.set('outfit', Path.outfit); Events.updateButtons();
      await finish('#leave'); await finish('#skip'); await finish('#skip');
      Space.currentFloor = 12; Space.triggerAmbush();
      const count = Space._pendingAmbushTalentChoices, startStock = $SM.get('stores.scales'); let expected = 0;
      for (let i = 0; i < count; i++) {
        await win();
        expected += $('#lootButtons .lootRow').filter(function() { return $(this).data('item') === 'scales'; }).find('.lootTake').data('numLeft');
        await finish('#next');
        check($SM.get('stores.scales') === startStock + expected, 'actual ambush victory ' + (i + 1) + ' banks materials before the next enemy or resupply scene');
      }
      await finish('#continue');
      for (let i = 0; i < count; i++) await finish('#skip');
      check(Space.currentFloor === 13 && !Events.activeEvent(), 'ambush resupply and all talent rewards advance only one floor');
      $SM.set('game.castleMeta.talentCap', 20);
      Space.TALENTS.forEach(t => $SM.set('character.infinityTalents["' + t.id + '"]', t.id === 'swiftBlade' ? 19 : 20));
      Space._offerTalent({onComplete: function() {}});
      check($('#exitButtons [id^="talent_"]').length === 1 && $('#talent_0').text().includes('20/20'),
        'with five capped talents the real reward offers only the remaining unfinished talent');
      await finish('#talent_0');
      check(Space.getTalentCap() === 25 && Space.getTalentLevel('swiftBlade') === 20, 'the final level unlocks the shared twenty-five cap without wasting a reward');
      Space.TALENTS.forEach(t => Space.setTalentLevel(t.id, 25));
      check(Space.getTalentCap() === 30, 'all six twenty-five-level talents unlock the shared thirty cap');
      const peakBefore = JSON.stringify($SM.get('game.castleMeta.peakTalent'));
      Space.clearTalents(); Space._grantStartingTalents();
      check(Space.getTalentCap() === 30 && Space.TALENTS.every(t => Space.getTalentLevel(t.id) === 10) && JSON.stringify($SM.get('game.castleMeta.peakTalent')) === peakBefore,
        'new descent retains the unlocked ceiling and inherits forty percent without rewriting historical peaks');
      Space.setTalentLevel('steadyHand', 25);
      check(Space.getSteadyHandDamageMult() > 1 && Space.talentPreviewText('steadyHand').includes('命中溢出'),
        'real talent preview shows extra weapon damage instead of wasting hit chance over one hundred percent');
      Space._offerTalent({onComplete: function() {}});
      check(Events.eventPanel().text().includes('当前天赋上限 Lv.30') && !Events.eventPanel().text().includes('bounded bonuses'),
        'breakthrough guidance and benefit descriptions load their Chinese translations');
      await until(() => Number(getComputedStyle(Events.eventPanel()[0]).opacity) > 0.99);
      return checks;
    })()`);
    console.log(castleFixChecks.map(name => 'PASS: ' + name).join('\n'));
    const breakthroughShot = await page('Page.captureScreenshot', {format:'png'});
    fs.writeFileSync(path.join(profile, 'talent-breakthrough.png'), Buffer.from(breakthroughShot.data, 'base64'));
    console.log('SCREENSHOT: ' + path.join(profile, 'talent-breakthrough.png'));
    await evaluate(`(async function() {
      await new Promise(resolve => Events.endEvent(resolve));
      Space.currentFloor = 30; Space.triggerBossFight(); Events.clearTimeouts();
      Events.dotDamage($('#enemy'),999999,'test finishing strike');
      for (let i=0; i<120 && !$('#recraft').length; i++) await new Promise(resolve=>setTimeout(resolve,25));
      $('#recraft').trigger('click');
      await new Promise(resolve=>setTimeout(resolve,250));
      const list=document.querySelector('#exitButtons'),leave=document.querySelector('#leave').getBoundingClientRect();
      if (list.scrollHeight<=list.clientHeight || leave.top<0 || leave.bottom>innerHeight) throw Error('complete shop must scroll with leave visible');
      if (document.querySelector('#recraft_0').getBoundingClientRect().width < list.clientWidth * 0.9) throw Error('shop rows must use the full list width');
      list.scrollTop=list.scrollHeight;
      if (document.querySelector('#leave').getBoundingClientRect().bottom>innerHeight) throw Error('shop bottom cannot hide its leave action');
      list.scrollTop=0;
    })()`);
    const shopShot=await page('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(profile,'guardian-shop.png'),Buffer.from(shopShot.data,'base64'));
    console.log('SCREENSHOT: '+path.join(profile,'guardian-shop.png'));
    const breathingChecks = await evaluate(`(async function() {
      const checks = [], check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
      await new Promise(resolve => Events.endEvent(resolve));
      $SM.set('game.castleMeta.totalFloors',120); $SM.set('game.castleMeta.bossKilled',8);
      $SM.set('game.pillarConvocationDone',true); $SM.set('game.swordsmithVillageDone',true);
      $SM.set('game.yoshiwaraDone',true); Space.clearTalents();
      const saved = { damage: Space.getDamageMult, dr: Space.getDamageReduction, permanentDR: Space.getPermanentDR, lifesteal: Space.getLifestealPct };
      Space.getDamageMult = () => 1; Space.getDamageReduction = Space.getPermanentDR = Space.getLifestealPct = () => 0;
      const until = async fn => { for (let i=0; i<120 && !fn(); i++) await new Promise(resolve=>setTimeout(resolve,25)); if (!fn()) throw Error('breathing UI timeout'); };
      const begin = async id => {
        if (Events.activeEvent()) await new Promise(resolve=>Events.endEvent(resolve));
        Engine.activeModule = Ship; CombatStyles.renderPicker(Ship.panel);
        const option = $('[data-style="'+id+'"]'); check(option.length === 1 && !option.prop('disabled'), id+' has an unlocked, usable picker card');
        option.trigger('click'); check(CombatStyles.getSelected() === id, id+' selection is saved by the real picker');
        Engine.activeModule = Space; Space.done = false; Space.currentFloor = 1;
        World.setHp(World.getMaxHealth()-20);
        Events.startEvent({title:'breathing regression',scenes:{start:{combat:true,enemy:'forest demon',health:10000,damage:0,attackDelay:100,hit:0,
          buttons:{leave:{text:'leave',nextScene:'end'}}}}});
        clearInterval(Events._enemyAttackTimer); (Events._specialTimers || []).forEach(clearInterval);
        await until(()=>$('#wanderer').length && $('#enemy').length);
        check($('.castleStyleStatusName').text() === CombatStyles.getName(id), id+' real combat displays its breathing name');
      };
      const hit = (name='nichirin katana',amount=100) => {
        const before = $('#enemy').data('hp');
        Events.damage($('#wanderer'),$('#enemy'),amount,'melee',null,{weaponName:name});
        return before-$('#enemy').data('hp');
      };
      const incoming = (amount=10) => {
        const before=World.health;
        Events.damage($('#enemy'),$('#wanderer'),amount,'melee');
        return before-World.health;
      };
      try {
        await begin('wind'); for(let i=0;i<4;i++) hit();
        check(hit()===132 && $('.castleStyleStatusText').text().includes('32%'), 'real wind attacks build four visible momentum stacks');
        const momentum=CombatStyles._fight.combo; $('#enemy').data('status','shield'); hit();
        check(CombatStyles._fight.combo===momentum, 'enemy shields cannot generate wind momentum');
        await begin('stone'); for(let i=0;i<3;i++) incoming();
        check(hit()===150 && CombatStyles._fight.counters===0, 'actual direct incoming damage arms and spends the stone counter');
        await begin('mist'); check(incoming(100)===60, 'mist guard reduces the first real direct hit');
        check(hit()===125 && hit()===100 && CombatStyles._fight.guardReadyAt>Date.now(), 'mist retaliation is exactly one attack with a visible recovery window');
        await begin('insect'); for(let i=0;i<5;i++) hit();
        check(CombatStyles._fight.poisonStacks===5 && CombatStyles._fight.wound.ticks===4, 'real insect strikes apply capped four-tick poison');
        const poison=CombatStyles._fight.wound, poisonHp=$('#enemy').data('hp');
        await until(()=>$('#enemy').data('hp')<poisonHp);
        check(CombatStyles._fight.poisonStacks===5 && poison.damage===27, 'poison ticks do not recursively add doses');
        await begin('sound'); hit('nichirin katana'); hit('wisteria gun');
        check(hit('nichirin katana')===160 && CombatStyles._fight.combo===0, 'sound third alternating damage weapon hit completes a score');
        await begin('beast'); hit('nichirin katana');
        check(hit('nichirin spear')===135 && hit('nichirin spear')===100, 'beast rewards melee weapon changes rather than repeating a button');
        await begin('flower'); for(let i=0;i<3;i++) hit();
        check(hit()===160,'flower focus strengthens the fourth actual melee hit');
        hit(); Events.dotDamage($('#wanderer'),1,'regression poison');
        check(CombatStyles._fight.combo===0,'actual DOT damage also breaks flower focus');
        await begin('love'); Events.restoreHealth(2,'lifesteal');
        check(hit()===100,'automatic lifesteal cannot activate love surge');
        Path.outfit.medicine=2; $SM.set('outfit',Path.outfit);
        const meds=Path.outfit.medicine; Events.doHeal('medicine',World.medsHeal(),$('#meds'));
        check(Path.outfit.medicine===meds-1 && hit()===125 && incoming(100)===85,'real consumed medicine heals and activates love attack and guard buffs');
        await begin('serpent'); Events.damage($('#wanderer'),$('#enemy'),'stun','ranged',null,{weaponName:'bind kunai'});
        $('#enemy').data('status','shield'); hit();
        check(CombatStyles._fight.openingHits===2,'shielded serpent strikes keep both real damage opportunities');
        check(hit()===140 && hit()===140 && hit()===100,'serpent control grants exactly two successful curved strikes');
        await begin('sun'); for(let i=0;i<4;i++) hit();
        check(hit()===130 && $('.castleStyleStatusText').text().includes('神乐循环'),'sun chain opens the real, timed dance window');
        await begin('moon'); check(hit()===120 && CombatStyles._fight.wound.damage===14 && hit()===100,'moon sword imitation charges once and leaves a non-recursive sword trace');
        await begin('wind'); Space.setTalentLevel('sharpEdge',30);
        for(let i=0;i<4;i++) hit();
        check(hit()===140 && Space.getTalentName('sharpEdge').includes('风之呼吸') && Space.talentPreviewText('sharpEdge').includes('流派核心增益'),
          'saved cultivation actually strengthens signatures and has a before/after preview');
        const persisted = JSON.stringify($SM.get('character.infinityTalents'));
        Events.clearTimeouts(); await new Promise(resolve=>Events.endEvent(resolve));
        check(CombatStyles._fight===null && CombatStyles._woundTimer===null && JSON.stringify($SM.get('character.infinityTalents'))===persisted,
          'ending combat clears every temporary breathing buff without deleting shared cultivation');
        Engine.activeModule=Path; $('#outerSlider').stop(true,true).css({top:'0px',left:'0px'}); Engine.travelTo(Ship);
        await new Promise(resolve=>$('#locationSlider').promise().done(resolve)); window.scrollTo(0,0);
        check($('.castleStyleOption').length===15 && $('.castleStylePicker').text().includes('不赋予鬼化'), 'entry preparation lists fourteen breathing forms plus technique and clearly labels moon imitation');
        await until(()=>Number(getComputedStyle(Ship.panel[0]).opacity)>0.99);
        check($('.castleStylePicker').is(':visible') && document.querySelector('.castleStyleHeading').getBoundingClientRect().top>=0,
          'fourteen-form preparation is genuinely visible in the native entrance panel');
        return checks;
      } finally {
        Space.getDamageMult=saved.damage; Space.getDamageReduction=saved.dr; Space.getPermanentDR=saved.permanentDR; Space.getLifestealPct=saved.lifesteal;
      }
    })()`);
    console.log(breathingChecks.map(name=>'PASS: '+name).join('\n'));
    const breathingShot=await page('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(profile,'breathing-cultivation.png'),Buffer.from(breathingShot.data,'base64'));
    console.log('SCREENSHOT: '+path.join(profile,'breathing-cultivation.png'));
    const demonChecks=await evaluate(`(async function() {
      const checks=[],check=(ok,label)=>{if(!ok) throw Error(label);checks.push(label);};
      const until=async fn=>{for(let i=0;i<120&&!fn();i++) await new Promise(resolve=>setTimeout(resolve,25));if(!fn()) throw Error('demon animation timeout');};
      const saved={damage:Space.getDamageMult,dr:Space.getDamageReduction,permanentDR:Space.getPermanentDR,lifesteal:Space.getLifestealPct};
      Space.getDamageMult=()=>1; Space.getDamageReduction=Space.getPermanentDR=Space.getLifestealPct=()=>0;
      const begin=async id=>{
        if(Events.activeEvent()) await new Promise(resolve=>Events.endEvent(resolve));
        Engine.activeModule=Ship;CombatStyles.setSelected('technique');
        Engine.activeModule=Space;Space.done=false;Space.currentFloor=100;
        World.setHp(World.getMaxHealth());
        const art=DemonPatterns.makeArt(id,20);
        Events.startEvent({title:'鬼术实战回归',scenes:{start:{combat:true,enemy:'forest demon',health:1000,damage:0,attackDelay:100,hit:0,
          _demonPatternsConfigured:true,demonPatternIds:[id],telegraphAttacks:[art],buttons:{leave:{text:'leave',nextScene:'end'}}}}});
        clearInterval(Events._enemyAttackTimer);(Events._specialTimers||[]).forEach(clearInterval);
        await until(()=>!!DemonPatterns._fight);
        CombatTelegraphs._fight.arts.forEach(row=>clearTimeout(row.timer));
        check($('.demonPatternGuide').text().includes(DemonPatterns.TYPES.find(row=>row.id===id).hint),id+' shows its counterplay in the real combat panel');
        return art;
      };
      const strike=(weapon='nichirin katana')=>{
        const hp=$('#enemy').data('hp');Events.damage($('#wanderer'),$('#enemy'),100,World.Weapons[weapon].type,null,{weaponName:weapon});return hp-$('#enemy').data('hp');
      };
      try {
        let art=await begin('armour');DemonPatterns.resolve(art,CombatTelegraphs._fight);
        check(strike()===75&&strike()===75&&strike()===75&&strike()===100&&!DemonPatterns._fight.armour,'actual hits take 25% bone-armour reduction and break it on the third');
        art=await begin('siphon');$('#enemy').data('hp',500);const hp=World.health;
        DemonPatterns.resolve(art,CombatTelegraphs._fight);await until(()=>World.health<hp);
        check($('#enemy').data('hp')===500+Math.floor((hp-World.health)*.7),'siphon heals from actual inflicted damage rather than its nominal power');
        art=await begin('bind');const bindHp=World.health;DemonPatterns.resolve(art,CombatTelegraphs._fight);
        await until(()=>!!DemonPatterns._fight.bind);check(World.health<bindHp&&DemonPatterns.modifyHitChance(1)===.85,'a real silk hit applies the 15-point accuracy loss');
        World.setHp(World.getMaxHealth());Path.outfit.medicine=1;$SM.set('outfit',Path.outfit);Events.setHeal();
        check(!$('#meds').hasClass('disabled'),'medicine remains usable at full health specifically to remove silk');
        Events.doHeal('medicine',World.medsHeal(),$('#meds'));
        check(Path.outfit.medicine===0&&!DemonPatterns._fight.bind&&World.health===World.getMaxHealth(),'full-health treatment consumes one medicine and actually removes silk');
        art=await begin('shadow');DemonPatterns.resolve(art,CombatTelegraphs._fight);
        check(!!DemonPatterns._fight.shadow,'shadow is visible before its first extra strike');strike('wisteria gun');
        check(!DemonPatterns._fight.shadow,'one actual ranged hit dispels the clone');
        art=await begin('combo');const comboHp=World.health;DemonPatterns.resolve(art,CombatTelegraphs._fight);
        await until(()=>World.health<comboHp);Events.damage($('#wanderer'),$('#enemy'),'stun','ranged',null,{weaponName:'bind kunai'});
        const after=World.health;await new Promise(resolve=>setTimeout(resolve,1700));
        check(!DemonPatterns._fight.combo&&World.health===after,'control after the first combo hit cancels both pending real attacks');
        await new Promise(resolve=>Events.endEvent(resolve));
        check(!DemonPatterns._fight&&!CombatTelegraphs._fight,'end of combat removes all live demon effects and timers');
        return checks;
      } finally {
        Space.getDamageMult=saved.damage;Space.getDamageReduction=saved.dr;Space.getPermanentDR=saved.permanentDR;Space.getLifestealPct=saved.lifesteal;
      }
    })()`);
    console.log(demonChecks.map(name=>'PASS: '+name).join('\n'));
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
