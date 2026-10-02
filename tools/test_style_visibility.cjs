// Real desktop geometry and keyboard checks in an isolated disposable Edge profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = process.env.GAME_ASSET_ROOT ? path.resolve(process.env.GAME_ASSET_ROOT) : path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const edge = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  assert.ok(fs.existsSync(edge), 'Set EDGE_PATH to a Chromium executable');
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
  const portServer = net.createServer();
  await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
  const debugPort = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kimetsu-style-visibility-'));
  const browser = spawn(edge, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-port=' + debugPort, '--user-data-dir=' + profile,
    '--window-size=1315,938', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket, call;
  try {
    let version;
    for (let i = 0; i < 100; i++) {
      try { version = await (await fetch('http://127.0.0.1:' + debugPort + '/json/version')).json(); break; }
      catch { await pause(100); }
    }
    assert.ok(version, 'Edge did not initialize');
    socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let id = 0;
    const pending = new Map(), errors = [];
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timeout); pending.delete(message.id);
      if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result);
    };
    call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timeout = setTimeout(() => { pending.delete(requestId); reject(Error('Timed out: ' + method)); }, 30000);
      pending.set(requestId, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id: requestId, method, params, sessionId }));
    });
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params = {}) => call(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await page('Runtime.enable'); await page('Network.enable'); await page('Page.enable');
    await page('Network.setBlockedURLs', { urls: ['https://*'] });
    await page('Page.addScriptToEvaluateOnNewDocument', { source: "if(!localStorage.getItem('gameState'))localStorage.setItem('gameState',JSON.stringify({version:1.4,game:{prologue:{done:true}},playStats:{audioAlertShown:true}}));" });
    await page('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/index.html?lang=zh_cn' });
    let ready;
    for (let i = 0; i < 100; i++) {
      ready = await evaluate('!!(window.Engine && Engine.activeModule && window.CombatStyles && window.BreathingCultivation)');
      if (ready) break;
      await pause(100);
    }
    assert.ok(ready, 'Game did not initialize');
    await evaluate(`(async function() {
      AudioEngine.playSound=AudioEngine.playBackgroundMusic=AudioEngine.playEventMusic=function(){};
      $SM.addPerk('water breath I'); $SM.addPerk('flame breath I'); $SM.addPerk('thunder breath I');
      $SM.set('game.castleMeta.totalFloors',60); $SM.set('game.castleMeta.bossKilled',0);
      $SM.set('game.pillarConvocationDone',true);
      Ship.init(); Engine.travelTo(Ship);
      await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
      $('#castleReportButton').show(); window.scrollTo(0,0);
    })()`);
    for (const [width, height] of [[1315, 938], [1280, 1000], [1137, 745], [1200, 600]]) {
      await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await evaluate(`(function() {
        const picker=document.querySelector('.castleStylePicker');
        picker.querySelector('.castleStyleLocked').open=true;
        picker.scrollTop=picker.scrollHeight;
        const view=picker.getBoundingClientRect(), content=document.querySelector('#content').getBoundingClientRect();
        if(view.bottom>innerHeight || view.bottom>content.bottom) throw Error('picker viewport is clipped');
        for(const id of ['sun','moon']) {
          const card=picker.querySelector('[data-style="'+id+'"]');
          const lock=card.querySelector('.castleStyleLock').getBoundingClientRect();
          if(lock.top<view.top || lock.bottom>view.bottom) throw Error(id+' unlock conditions are not visible after scrolling');
          if(!card.disabled) throw Error(id+' incorrectly unlocked');
        }
        if([...picker.querySelectorAll('.castleStyleOptions')].some(list=>getComputedStyle(list).overflowY==='auto'))
          throw Error('nested list scroll traps remain');
      })()`);
      console.log(`PASS: future sun/moon descriptions and unlock conditions reachable at ${width}×${height}`);
    }
    await page('Emulation.setDeviceMetricsOverride', { width: 1315, height: 938, deviceScaleFactor: 1, mobile: false });
    await evaluate(`(function(){const p=document.querySelector('.castleStylePicker');p.scrollTop=0;p.focus();})()`);
    await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    await pause(500);
    await evaluate(`(function() {
      const picker=document.querySelector('.castleStylePicker');
      if(picker.scrollTop<100) throw Error('focused picker cannot scroll with the keyboard');
      const oldScroll=picker.scrollTop;
      picker.querySelector('[data-style="serpent"]').focus({preventScroll:true});
      picker.querySelector('[data-style="serpent"]').click();
      const next=document.querySelector('.castleStylePicker');
      if(!next.querySelector('.castleStyleLocked').open || Math.abs(next.scrollTop-oldScroll)>2)
        throw Error('selection redraw loses expanded future forms or scroll position');
      if(document.activeElement.getAttribute('data-style')!=='serpent') throw Error('selection loses keyboard focus');
      if(CombatStyles.getSelected()!=='serpent') throw Error('visible choice did not persist');
      $SM.set('game.castleMeta.totalFloors',120); $SM.set('game.castleMeta.bossKilled',8);
      CombatStyles.renderPicker(Ship.panel);
      const unlocked=document.querySelector('.castleStylePicker');
      if(unlocked.querySelector('.castleStyleLocked')) throw Error('unlocked future forms still hidden');
      const moon=unlocked.querySelector('[data-style="moon"]'); moon.focus();
      const card=moon.getBoundingClientRect(), view=unlocked.getBoundingClientRect();
      if(card.top<view.top-2 || card.bottom>view.bottom+2 || moon.disabled) throw Error('unlocked moon cannot be focused into view');
    })()`);
    console.log('PASS: native keyboard scrolling, persistent scroll/expanded state and selection focus, all-unlocked final card');
    const screenshot = await page('Page.captureScreenshot', { format: 'png' });
    const filename = path.join(profile, 'future-breathing-forms.png');
    fs.writeFileSync(filename, Buffer.from(screenshot.data, 'base64'));
    console.log('SCREENSHOT: ' + filename);
    const forgeChecks = await evaluate(`(async function() {
      const checks=[], check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
      const until=async fn=>{for(let i=0;i<120&&!fn();i++)await new Promise(resolve=>setTimeout(resolve,25));if(!fn())throw Error('forging browser transition timed out');};
      clearTimeout(Engine._incomeTimeout); // Freeze unrelated home income while checking exact recipe payments.
      if(!Path.panel)Path.init();
      $SM.set('character.blueprints',Object.fromEntries(Object.keys(Fabricator.Craftables).map(key=>[key,true])));
      $SM.setM('stores',{'demon stone':20,steel:500,wood:5000});
      $SM.setM('game.nichirinForge',{attempts:0,lastResults:[]});
      if(!Fabricator.panel)Fabricator.init();
      Engine.travelTo(Fabricator);await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
      const forge=NichirinForge,purple=forge.key('flame',4),gold=forge.key('flame',5);
      const before=JSON.stringify([$SM.get('stores'),$SM.get('game.nichirinForge')]);
      const initialStock=JSON.parse(before)[0];
      $('#forgeNichirin10').trigger('click');
      check($('#forgeNichirin10').prop('disabled')&&JSON.stringify([$SM.get('stores'),$SM.get('game.nichirinForge')])===before,
        'unconfirmed forging risk cannot charge materials or advance the guarantee');
      $('#forgeRiskAccepted').prop('checked',true).trigger('change');
      check(!$('#forgeNichirin10').prop('disabled'),'risk confirmation enables the actual affordable batch button');
      const oldRandom=Math.random,values=[];
      for(let i=0;i<9;i++)values.push(.5,.1);values.push(.1);
      Math.random=()=>{if(!values.length)throw Error('unexpected forge random draw');return values.shift();};
      try{$('#forgeNichirin10').trigger('click');}finally{Math.random=oldRandom;}
      const results=$SM.get('game.nichirinForge.lastResults');
      check(forge.attempts()===10&&$SM.get('stores["'+purple+'"]')===9&&$SM.get('stores["'+gold+'"]')===1&&
        results.length===10&&results[9].guaranteed&&results[9].tier===5,
        'real ten-forge button stores nine purple blades and the exact tenth-attempt gold guarantee');
      check($SM.get('stores["demon stone"]')===initialStock['demon stone']-10&&$SM.get('stores.steel')===initialStock.steel-200&&$SM.get('stores.wood')===initialStock.wood-1000,
        'real ten-forge batch consumes precisely the advertised whole-batch material costs');
      check($SM.get('game.nichirinForge.lastResults').every(result=>result.style==='flame')&&
        document.querySelector('.nichirinForgeProgress').textContent.includes('10 次'),
        'real result cards and persistent progress display the random breathing affiliation');
      const workbench=document.querySelector('.forgeWorkbench'),blueprints=document.querySelector('#blueprints');
      const benchRect=workbench.getBoundingClientRect(),bpRect=blueprints.getBoundingClientRect();
      check(benchRect.right<=bpRect.left&&benchRect.bottom<=innerHeight&&workbench.scrollHeight>workbench.clientHeight,
        'forge left-column scroll area does not overlap blueprints or extend below the desktop viewport');
      workbench.scrollTop=workbench.scrollHeight;
      const oldButtons=[...document.querySelectorAll('#fabricateButtons > .button')],last=oldButtons.at(-1).getBoundingClientRect();
      check(oldButtons.length===8&&last.top>=benchRect.top&&last.bottom<=benchRect.bottom&&
        !oldButtons.some(btn=>btn.getAttribute('fabricateThing')==='flame blade'),
        'scrolling the shared forge workbench reveals the final legacy crafting button without the old direct flame exchange');
      const purpleRow=document.querySelector('#row_'+purple.replaceAll(' ','-')),goldRow=document.querySelector('#row_'+gold.replaceAll(' ','-'));
      check(purpleRow.classList.contains('weapon-tier-4')&&goldRow.classList.contains('weapon-tier-5')&&
        getComputedStyle(purpleRow.querySelector('.row_key')).color!==getComputedStyle(goldRow.querySelector('.row_key')).color,
        'new forged inventory is classified as weapons with distinct purple and gold warehouse colors');
      Engine.travelTo(Path);await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
      Path.setEquipSlot('primary',0,purple);Path.setEquipSlot('primary',1,gold);
      $('#outfit_row_'+purple.replaceAll(' ','-')+' .upBtn').trigger('click');
      $('#outfit_row_'+gold.replaceAll(' ','-')+' .upBtn').trigger('click');
      check(Path.outfit[purple]===1&&Path.outfit[gold]===1&&Path.getFreeSpace()===0&&Path.isEquipped(purple)&&Path.isEquipped(gold),
        'real equipment slots and packing buttons equip both forged blades and charge their five-weight capacity');
      const steel=$SM.get('stores.steel'),wood=$SM.get('stores.wood');
      $('#outfit_row_'+purple.replaceAll(' ','-')+' .scrapBtn').trigger('click');
      check($SM.get('stores["'+purple+'"]')===8&&Path.outfit[purple]===1&&$SM.get('stores.steel')===steel+6&&$SM.get('stores.wood')===wood+30,
        'actual forged-blade recycling refunds thirty percent and protects the packed blade');
      check(StoryCrafting.recipe(purple)===null&&StoryCrafting.recipe('flame blade')===null,
        'story material commissions cannot bypass random forging or revive the old direct exchange');
      const saved={damage:Space.getDamageMult,dr:Space.getDamageReduction,permanent:Space.getPermanentDR,lifesteal:Space.getLifestealPct,hit:World.getHitChance};
      $SM.set('character.perks',{'flame breath I':true});Space.clearTalents();
      Space.getDamageMult=()=>1;Space.getDamageReduction=Space.getPermanentDR=Space.getLifestealPct=()=>0;World.getHitChance=()=>1;
      const begin=async style=>{
        if(Events.activeEvent())await new Promise(resolve=>Events.endEvent(resolve));
        Engine.activeModule=Ship;check(CombatStyles.setSelected(style),'forge test breathing choice can be selected before entry');
        if(style==='flame')check(!Ship.getDepartureInfo().warnings.includes(_('flame form needs a nichirin katana, nichirin spear or flame blade to leave deep cuts.')),
          'forged blades satisfy the flame-form departure preparation');
        Engine.activeModule=Space;Space.done=false;Space.currentFloor=1;World.dead=false;World.setHp(World.getMaxHealth());
        $('#outerSlider').stop(true,true).css('top','-910px');
        Events.startEvent({title:'forged blade browser regression',scenes:{start:{combat:true,enemy:'forest demon',chara:'鬼',health:10000,damage:0,attackDelay:100,hit:0,
          buttons:{leave:{text:'leave',nextScene:'end'}}}}});
        clearInterval(Events._enemyAttackTimer);(Events._specialTimers||[]).forEach(clearInterval);
        await until(()=>$('#enemy').length&&$('#wanderer').length);
        check($('#attack_'+purple.replaceAll(' ','-')).length===1&&$('#attack_'+gold.replaceAll(' ','-')).length===1&&!$('#attack_fists').length,
          'equipped and packed forged blades create genuine attack buttons instead of fists');
      };
      const attack=async(key,expected)=>{
        const btn=$('#attack_'+key.replaceAll(' ','-')),hp=$('#enemy').data('hp');
        $('#attackButtons > .button').each(function(){Button.clearCooldown($(this));});
        const old=Math.random;Math.random=()=>.5;
        try{btn.trigger('click');}finally{Math.random=old;}
        await until(()=>$('#enemy').data('hp')<hp);
        check(hp-$('#enemy').data('hp')===expected,'actual '+key+' attack applies the expected matching multiplier and integer damage');
      };
      try{
        await begin('flame');await attack(purple,13);
        check(CombatStyles._fight.wound&&CombatStyles._fight.wound.source==='deep cut'&&CombatStyles._fight.wound.damage===2,
          'real forged purple attack activates the flame breathing aftercut');
        CombatStyles._clearWound();await attack(gold,22);
        check(CombatStyles._fight.wound&&CombatStyles._fight.wound.damage===4,
          'real forged gold attack applies twenty-five percent affiliation damage and creates a flame aftercut');
        CombatStyles._clearWound();await begin('technique');await attack(purple,12);await attack(gold,18);
        check(!CombatStyles._fight.wound,'unmatched breathing uses base blade damage without free flame aftercuts');
      }finally{
        Events.clearTimeouts();if(Events.activeEvent())await new Promise(resolve=>Events.endEvent(resolve));
        Space.getDamageMult=saved.damage;Space.getDamageReduction=saved.dr;Space.getPermanentDR=saved.permanent;Space.getLifestealPct=saved.lifesteal;World.getHitChance=saved.hit;
        Engine.activeModule=Path;$('#outerSlider').stop(true,true).css('top','0px');Engine.travelTo(Fabricator);
        await new Promise(resolve=>$('#locationSlider').promise().done(resolve));Engine.saveGame();
      }
      return checks;
    })()`);
    console.log(forgeChecks.map(label=>'PASS: '+label).join('\n'));
    await page('Page.reload');
    ready=false;
    for(let i=0;i<100;i++){
      ready=await evaluate('!!(window.Engine&&Engine.activeModule&&window.NichirinForge&&typeof Fabricator!=="undefined"&&Fabricator.panel)');
      if(ready)break;await pause(100);
    }
    assert.ok(ready,'game did not initialize after forge save/reload');
    await evaluate(`(async function(){
      Engine.travelTo(Fabricator);await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
      const f=NichirinForge,p=f.key('flame',4),g=f.key('flame',5);
      if(f.attempts()!==10||$SM.get('stores["'+p+'"]')!==8||$SM.get('stores["'+g+'"]')!==1||
        $SM.get('game.nichirinForge.lastResults').length!==10||!document.querySelector('.nichirinForgeProgress').textContent.includes('10 次'))
        throw Error('refresh lost forging results, inventory or fixed-ten guarantee progress');
      if(document.querySelector('#forgeRiskAccepted').checked)throw Error('refresh should require a fresh risk acknowledgment');
    })()`);
    console.log('PASS: actual page refresh keeps forge results, inventory and guarantee progress, and requests fresh risk acknowledgment');
    const forgeScreenshot=await page('Page.captureScreenshot',{format:'png'});
    const forgeFilename=path.join(profile,'nichirin-forge.png');
    fs.writeFileSync(forgeFilename,Buffer.from(forgeScreenshot.data,'base64'));
    console.log('SCREENSHOT: '+forgeFilename);
    assert.deepEqual(errors, [], 'Uncaught browser errors');
  } finally {
    if (call && socket?.readyState === WebSocket.OPEN) { try { await call('Browser.close'); } catch {} }
    socket?.close(); browser.kill(); server.closeAllConnections(); server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
