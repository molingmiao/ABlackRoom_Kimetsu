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
      $('#openNichirinForge').trigger('click');
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
      const forgePanel=document.querySelector('#nichirinForgePanel'),modal=forgePanel.getBoundingClientRect();
      check(forgePanel.getAttribute('role')==='dialog'&&modal.top>=0&&modal.bottom<=innerHeight&&modal.width>=500,
        'forging recipes, chance, results and guarantee progress are displayed in a viewport-bounded dialog');
      NichirinForge.close(false);
      check(benchRect.right<=bpRect.left&&benchRect.bottom<=innerHeight,
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
      $('#openNichirinForge').trigger('click');
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
    const recycleChecks=await evaluate(`(async function() {
      const checks=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
      clearTimeout(Engine._incomeTimeout);
      AudioEngine.playSound=AudioEngine.playBackgroundMusic=AudioEngine.playEventMusic=function(){};
      NichirinForge.close(false);
      Engine.travelTo(Path);await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
      const permanent=['waterskin','cask','water tank','water cycle','rucksack','wagon','convoy','cargo crow',
        'l armour','i armour','s armour','wind armour','compass'];
      const weapons=Object.keys(World.Weapons).filter(key=>key!=='fists');
      check(weapons.length===39,'the complete live weapon registry contains eleven legacy weapons and twenty-eight forged blades');
      $SM.set('character.equippedInit',true,true);
      $SM.set('character.equipped',{primary:[null,null],secondary:[null,null],tool:[null,null]},true);
      $SM.set('outfit',{},true);Path.outfit=$SM.get('outfit');
      const stores={};
      weapons.forEach(key=>{stores[key]=3;Object.keys(Path.getScrapCost(key)||{}).forEach(mat=>{stores[mat]=100;});});
      permanent.forEach(key=>{stores[key]=3;Object.keys(Path.getScrapCost(key)||{}).forEach(mat=>{stores[mat]=100;});});
      $SM.setM('stores',stores,true);$SM.set('game.scrapRemainders',{},true);$SM.fireUpdate('stores');Path.updateOutfitting();
      for(const key of weapons) {
        const row=document.getElementById('outfit_row_'+key.replaceAll(' ','-')),button=row&&row.querySelector('.scrapBtn');
        check(!!button&&!button.classList.contains('disabled')&&Path.scrapPreview(key,1).valid,
          'actual recycling entry is usable for '+key);
        const have=$SM.get('stores["'+key+'"]');button.click();
        check($SM.get('stores["'+key+'"]')===have-1,'actual recycling callback consumes one surplus '+key);
      }
      const abilities=()=>JSON.stringify([World.getBaseMaxHealth(),World.getMaxWater(),Path.getCapacity()]);
      const before=abilities();
      for(const key of permanent) {
        const row=[...document.querySelectorAll('#permanentEquipmentScrap .permanentScrapRow')].find(item=>item.getAttribute('key')===key);
        const button=row&&row.querySelector('.scrapBtn');
        check(!!button&&Path.scrapPreview(key,2).valid&&!Path.scrapPreview(key,3).valid,
          'actual permanent-equipment surplus entry keeps the first '+key);
        button.click();
        check($SM.get('stores["'+key+'"]')===2&&abilities()===before,
          'actual permanent-equipment recycling preserves health, water and capacity for '+key);
      }
      check(document.querySelectorAll('#permanentEquipmentScrap .permanentScrapRow').length===13,
        'all thirteen surplus permanent upgrades including compass have dedicated recycling rows');
      window.__recyclingPermanent=permanent;
      return checks;
    })()`);
    console.log(recycleChecks.map(label=>'PASS: '+label).join('\n'));
    for(const [width,height] of [[1315,938],[1137,745],[1200,600]]) {
      await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await evaluate(`(function() {
        const details=document.getElementById('permanentEquipmentScrap');details.open=true;
        const row=details.querySelector('.permanentScrapRow:last-child'),button=row.querySelector('.scrapBtn');
        button.scrollIntoView({block:'center',inline:'nearest'});
        const rect=button.getBoundingClientRect(),scroll=document.getElementById('pathScroller').getBoundingClientRect();
        const content=document.getElementById('content').getBoundingClientRect();
        if(rect.top<0||rect.bottom>innerHeight||rect.top<scroll.top||rect.bottom>scroll.bottom||rect.bottom>content.bottom)
          throw Error('last permanent-equipment recycling row is clipped at '+innerWidth+'x'+innerHeight);
        const target=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
        if(target!==button&&!button.contains(target))throw Error('last permanent-equipment recycling entry is covered');
      })()`);
      console.log('PASS: final permanent-equipment recycling entry reachable at '+width+'×'+height);
    }
    await page('Emulation.setDeviceMetricsOverride',{width:1315,height:938,deviceScaleFactor:1,mobile:false});
    await evaluate(`(function() {
      Path.closeScrapQuantityDialog(false);
      $SM.set('character.equipped',{primary:[null,null],secondary:[null,null],tool:[null,null]},true);
      $SM.set('outfit',{},true);Path.outfit=$SM.get('outfit');
      $SM.setM('stores',{'flame blade':5,'demon stone':10},true);$SM.set('game.scrapRemainders',{},true);
      $SM.fireUpdate('stores');Path.updateOutfitting();
      for(let i=1;i<=4;i++) {
        const button=document.querySelector('#outfit_row_flame-blade .scrapBtn');
        if(!button)throw Error('low-cost single-item recycling entry disappeared');
        button.click();
        const balance=$SM.get('game.scrapRemainders["demon stone"]');
        if($SM.get('stores["flame blade"]')!==5-i||balance!==[30,60,90,20][i-1]||
          $SM.get('stores["demon stone"]')!==10+(i===4?1:0))
          throw Error('low-cost single recycling lost fractional credit at attempt '+i);
      }
      $SM.setM('stores',{'bone yari':8,wood:100,teeth:100},true);
      Path.outfit['bone yari']=1;$SM.set('outfit["bone yari"]',1,true);$SM.fireUpdate('stores');Path.updateOutfitting();
      window.__recyclingBeforeCancel=JSON.stringify([$SM.get('stores'),$SM.get('game.scrapRemainders')]);
    })()`);
    console.log('PASS: four real low-cost recycling clicks retain 30/60/90/20 credit and return exactly one stone');
    const nativeClick=async(selector,shift=false)=>{
      const point=await evaluate(`(function(){const button=document.querySelector(${JSON.stringify(selector)});if(!button)throw Error('Missing native-click target');button.scrollIntoView({block:'center'});const r=button.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
      await page('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      await page('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,modifiers:shift?8:0,...point});
      await page('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,modifiers:shift?8:0,...point});
    };
    await nativeClick('#outfit_row_bone-yari .scrapBtn',true);
    await evaluate(`(function() {
      if(!document.querySelector('#scrapQuantityPanel')||document.querySelector('#scrapQuantityPanel').getAttribute('role')!=='dialog')
        throw Error('real Shift+mouse recycling did not open the quantity dialog');
      const input=document.getElementById('scrapQuantityInput');input.value='3';input.dispatchEvent(new Event('input',{bubbles:true}));
      if(document.querySelector('.scrapQuantityOk').disabled||!document.getElementById('scrapQuantityRefund').textContent.includes('90'))
        throw Error('real quantity input did not update the batch refund preview');
    })()`);
    await nativeClick('.scrapQuantityActions button:last-child');
    await evaluate(`(function(){
      if(document.getElementById('scrapQuantityOverlay')||JSON.stringify([$SM.get('stores'),$SM.get('game.scrapRemainders')])!==window.__recyclingBeforeCancel)
        throw Error('cancelling real recycling dialog changed inventory or fractional credit');
    })()`);
    await nativeClick('#outfit_row_bone-yari .scrapBtn',true);
    await evaluate(`(function() {
      const input=document.getElementById('scrapQuantityInput');input.value='7';input.dispatchEvent(new Event('input',{bubbles:true}));
      if(document.querySelector('.scrapQuantityOk').disabled)throw Error('valid initial batch was disabled');
      Path.outfit['bone yari']=6;$SM.set('outfit["bone yari"]',6,true);$SM.fireUpdate('outfit');
      if(!document.querySelector('.scrapQuantityOk').disabled||Number(input.max)!==2)
        throw Error('live backpack change did not invalidate stale recycling quantity');
      window.__recyclingBeforeStale=JSON.stringify([$SM.get('stores'),$SM.get('game.scrapRemainders')]);
      input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
      if(JSON.stringify([$SM.get('stores'),$SM.get('game.scrapRemainders')])!==window.__recyclingBeforeStale)
        throw Error('stale quantity keyboard submission consumed protected items');
    })()`);
    await nativeClick('.scrapQuantityActions button:last-child');
    const protectionChecks=await evaluate(`(function() {
      const checks=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
      const before=JSON.stringify([$SM.get('stores'),$SM.get('game.scrapRemainders')]);
      Path.setEquipSlot('primary',0,'flame blade');
      check(!(Path.outfit['flame blade']>0)&&!Path.scrapPreview('flame blade',1).valid,
        'an equipped but unpacked final weapon is protected from recycling');
      check(!document.querySelector('#outfit_row_flame-blade .scrapBtn')&&Path.scrapItem('flame blade',1)===false,
        'equipped final-weapon protection covers both the actual entry and direct execution');
      check(JSON.stringify([$SM.get('stores'),$SM.get('game.scrapRemainders')])===before,
        'blocked equipped-weapon recycling cannot change inventory or fractional credit');
      const abilities=JSON.stringify([World.getBaseMaxHealth(),World.getMaxWater(),Path.getCapacity()]);
      for(const key of window.__recyclingPermanent) {
        $SM.set('stores["'+key+'"]',1,true);$SM.fireUpdate('stores');Path.updateOutfitting();
        check(!Path.scrapPreview(key,1).valid&&Path.scrapItem(key,1)===false&&$SM.get('stores["'+key+'"]')===1,
          'the final permanent '+key+' cannot be recycled through direct execution');
      }
      check(JSON.stringify([World.getBaseMaxHealth(),World.getMaxWater(),Path.getCapacity()])===abilities,
        'keeping all final permanent copies preserves actual health, water and bag capacity');
      check(!document.querySelector('#permanentEquipmentScrap .permanentScrapRow'),
        'the permanent-surplus entry has no misleading rows after only first copies remain');
      Engine.saveGame();return checks;
    })()`);
    console.log('PASS: real Shift+click opens and cancels batch recycling; live packing invalidates stale keyboard submissions');
    console.log(protectionChecks.map(label=>'PASS: '+label).join('\n'));
    await page('Page.reload');ready=false;
    for(let i=0;i<100;i++){
      ready=await evaluate('!!(window.Engine&&Engine.activeModule&&window.Path&&Path.panel)');
      if(ready)break;await pause(100);
    }
    assert.ok(ready,'game did not initialize after recycling save/reload');
    await evaluate(`(async function() {
      clearTimeout(Engine._incomeTimeout);AudioEngine.playSound=AudioEngine.playBackgroundMusic=AudioEngine.playEventMusic=function(){};
      Engine.travelTo(Path);await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
      if($SM.get('game.scrapRemainders["demon stone"]')!==20||$SM.get('stores["demon stone"]')!==11||
        $SM.get('stores["flame blade"]')!==1||!Path.isEquipped('flame blade'))
        throw Error('refresh lost material remainder, refund or protected equipped weapon');
      const permanent=['waterskin','cask','water tank','water cycle','rucksack','wagon','convoy','cargo crow',
        'l armour','i armour','s armour','wind armour','compass'];
      if(permanent.some(key=>$SM.get('stores["'+key+'"]')!==1))throw Error('refresh lost protected permanent equipment');
    })()`);
    console.log('PASS: actual page refresh keeps low-cost remainder, stone refund, equipped weapon and thirteen protected permanent copies');
    const saveScreenshot=async name=>{
      await evaluate(`(async function() {
        await new Promise(resolve=>$('.eventPanel,#nichirinForgeOverlay').promise().done(resolve));
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const panel=document.querySelector('.talentCardsEvent,#nichirinForgePanel');
        if(!panel)throw Error('no finished dialog available for visual capture');
        for(let node=panel;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)<.99)
          throw Error('dialog opacity chain is not fully visible for screenshot');
        const bg=getComputedStyle(panel).backgroundColor;
        if(bg==='transparent'||bg==='rgba(0, 0, 0, 0)')throw Error('dialog background is transparent');
        if(panel.scrollWidth>panel.clientWidth+1)throw Error('dialog has horizontal overflow');
        if(panel.classList.contains('talentCardsEvent')) {
          const card=panel.querySelector('.talentChoiceCard'),button=panel.querySelector('.talentCardSelect');
          if(getComputedStyle(card).backgroundColor==='rgba(0, 0, 0, 0)')throw Error('talent card background is transparent');
          if(button&&Math.abs(button.getBoundingClientRect().width-card.clientWidth+24)>3)
            throw Error('talent card action does not fill its usable card width');
        }
      })()`);
      const captured=await page('Page.captureScreenshot',{format:'png'}),file=path.join(profile,name+'.png');
      fs.writeFileSync(file,Buffer.from(captured.data,'base64'));console.log('SCREENSHOT: '+file);
    };
    for(const theme of ['light','dark']) {
      await page('Emulation.setDeviceMetricsOverride',{width:1315,height:938,deviceScaleFactor:1,mobile:false});
      await evaluate(`(async function() {
        const dark=${theme==='dark'};
        if(Engine.isLightsOff()!==dark)Engine.turnLightsOff();
        for(let i=0;i<100&&Engine.isLightsOff()!==dark;i++)await new Promise(resolve=>setTimeout(resolve,25));
        if(Engine.isLightsOff()!==dark)throw Error('theme did not initialize');
        Engine.travelTo(Fabricator);await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
        $('#openNichirinForge').trigger('click');
      })()`);
      for(const height of [600,938]) {
        await page('Emulation.setDeviceMetricsOverride',{width:1315,height,deviceScaleFactor:1,mobile:false});
        await evaluate(`(function() {
          const panel=document.getElementById('nichirinForgePanel'),rect=panel.getBoundingClientRect();
          if(rect.top<0||rect.bottom>innerHeight||!document.getElementById('forgeRiskAccepted'))throw Error('forge dialog is clipped');
          document.getElementById('cancelNichirinForge').scrollIntoView({block:'nearest'});
          const cancel=document.getElementById('cancelNichirinForge').getBoundingClientRect();
          if(cancel.top<rect.top||cancel.bottom>rect.bottom)throw Error('final forge dialog action cannot scroll into view');
          panel.scrollTop=0;
        })()`);
      }
      await saveScreenshot('nichirin-forge-'+theme);
      await evaluate(`(function() {
        NichirinForge.close(false);$('body').addClass('noMask');Engine.activeModule=Space;Space.done=false;World.dead=false;
        $SM.set('game.castleMeta.talentCap',20,true);$SM.set('character.infinityTalents',{},true);
        Space.TALENTS.forEach(t=>Space.setTalentLevel(t.id,10));World.setHp(World.getMaxHealth());
        window.__talentProgress=0;window.__originalAfterNode=Space.afterNode;Space.afterNode=()=>{window.__talentProgress++;};
        Engine._resetHotkeys();Space._offerTalent();
      })()`);
      for(const height of [600,938]) {
        await page('Emulation.setDeviceMetricsOverride',{width:1315,height,deviceScaleFactor:1,mobile:false});
        await evaluate(`(function() {
          const panel=document.querySelector('.talentCardsEvent'),cards=[...panel.querySelectorAll('.talentChoiceCard')],rect=panel.getBoundingClientRect();
          if(cards.length!==3||rect.top<0||rect.bottom>innerHeight)throw Error('three reward cards or panel geometry is incorrect');
          const color=getComputedStyle(panel).color,background=getComputedStyle(panel).backgroundColor;
          if(color===background||getComputedStyle(panel.querySelector('#description')).color!==color)throw Error('talent introduction lost theme contrast');
          for(let i=0;i<cards.length;i++) {
            const card=cards[i],id=card.getAttribute('data-talent'),button=card.querySelector('.talentCardSelect');
            if(getComputedStyle(card).borderTopStyle==='none'||!card.querySelector('.talentCardName')||
              !card.querySelector('.talentCardLevel').textContent.includes('Lv.10 → Lv.11')||!card.querySelector('.talentCardBenefits strong')||
              !card.querySelector('.talentCardInheritance')||button.getAttribute('data-hotkey')!==String(i+1)||
              button.getAttribute('role')!=='button'||button.tabIndex!==0)throw Error('talent card lacks independent accessible benefit content: '+id);
            button.scrollIntoView({block:'nearest'});
            const b=button.getBoundingClientRect();
            if(b.top<rect.top||b.bottom>rect.bottom)throw Error('talent select button clipped after scrolling');
            const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
            if(hit!==button&&!button.contains(hit))throw Error('talent select button covered');
            if(getComputedStyle(button).color!==color)throw Error('talent selection button lost theme contrast');
          }
          panel.scrollTop=0;
          window.__talentFirst=cards[0].getAttribute('data-talent');
        })()`);
      }
      await saveScreenshot('talent-reward-cards-'+theme);
      await page('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1',windowsVirtualKeyCode:49});
      await page('Input.dispatchKeyEvent',{type:'keyUp',key:'1',code:'Digit1',windowsVirtualKeyCode:49});
      await pause(250);
      await evaluate(`(async function() {
        for(let i=0;i<100&&Events.activeEvent();i++)await new Promise(resolve=>setTimeout(resolve,25));
        if(Space.getTalentLevel(window.__talentFirst)!==11||window.__talentProgress!==1||Events.activeEvent())
          throw Error('actual number hotkey did not choose exactly one reward');
        Space.triggerHashiraEncounter();
        const cards=document.querySelectorAll('.talentCardsEvent .talentChoiceCard');
        if(cards.length!==1||!cards[0].querySelector('#accept')||!cards[0].querySelector('.talentCardBenefits strong'))
          throw Error('Hashira lesson does not use the independent actionable card');
        window.__hashiraTalent=cards[0].getAttribute('data-talent');window.__hashiraLevel=Space.getTalentLevel(window.__hashiraTalent);
        document.getElementById('accept').focus();
      })()`);
      await saveScreenshot('talent-hashira-card-'+theme);
      await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await pause(250);
      await evaluate(`(async function() {
        for(let i=0;i<100&&Events.activeEvent();i++)await new Promise(resolve=>setTimeout(resolve,25));
        if(Space.getTalentLevel(window.__hashiraTalent)!==window.__hashiraLevel+1||window.__talentProgress!==2||Events.activeEvent())
          throw Error('native Enter did not apply the original Hashira card choice');
        Space.triggerShrine();
        const cards=document.querySelectorAll('.talentCardsEvent .talentChoiceCard');
        if(cards.length!==6||[...cards].some(card=>card.querySelector('.talentCardSelect')||!card.querySelector('.talentCardRandom')))
          throw Error('shrine random candidates do not have six clear non-selectable cards');
        window.__shrineTotal=Space.TALENTS.reduce((sum,t)=>sum+Space.getTalentLevel(t.id),0);window.__shrineHealth=World.health;
      })()`);
      await saveScreenshot('talent-shrine-cards-'+theme);
      await nativeClick('#offer');await pause(250);
      await evaluate(`(async function() {
        for(let i=0;i<100&&Events.activeEvent();i++)await new Promise(resolve=>setTimeout(resolve,25));
        if(Space.TALENTS.reduce((sum,t)=>sum+Space.getTalentLevel(t.id),0)!==window.__shrineTotal+1||
          World.health>=window.__shrineHealth||window.__talentProgress!==3||Events.activeEvent())
          throw Error('actual shrine card footer did not charge health and grant one random reward');
        Space.afterNode=window.__originalAfterNode;Engine.activeModule=Path;$('body').removeClass('noMask');
      })()`);
      console.log('PASS: '+theme+' reward/shrine/Hashira cards are separate, readable and scrollable at 600/938 heights; actual number hotkey, native Enter and shrine click preserve rewards');
    }
    for (const theme of ['light','dark']) {
      await page('Emulation.setDeviceMetricsOverride',{width:1315,height:938,deviceScaleFactor:1,mobile:false});
      await evaluate(`(async function() {
        const dark=${theme==='dark'};
        if(Engine.isLightsOff()!==dark)Engine.turnLightsOff();
        for(let i=0;i<100&&Engine.isLightsOff()!==dark;i++)await new Promise(resolve=>setTimeout(resolve,25));
        Engine.travelTo(Room);await new Promise(resolve=>$('#locationSlider').promise().done(resolve));
        clearTimeout(Events._eventTimeout);clearTimeout(Engine._incomeTimeout);
        $SM.set('game.swordsmithVillageDone',true,true);$SM.set('game.swordsmithChapterDone',false,true);
        $SM.set('game.swordsmithBlueprintGranted',true,true);$SM.set('game.pillarConvocationDone',false,true);
        $SM.set('character.blueprints',{'wisteria oil':false,'wind armour':true},true);
        $SM.set('game.campaignClaims',Object.fromEntries(EarlyGame.milestones().filter(task=>!['pillars','castle'].includes(task.id)).map(task=>[task.id,true])),true);
        EarlyGame.render();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        if(EarlyGame.milestone().id!=='pillars')throw Error('blueprint fixture does not show stage twenty');
      })()`);
      for(const height of [600,938]) {
        await page('Emulation.setDeviceMetricsOverride',{width:1315,height,deviceScaleFactor:1,mobile:false});
        await evaluate(`(function() {
          const button=document.querySelector('#roomPanel .smithBlueprintClaim'),box=button.closest('.earlyGameTask');
          button.scrollIntoView({block:'nearest'});const rect=button.getBoundingClientRect();
          if(button.disabled||!$(button).is(':visible')||rect.top<0||rect.bottom>innerHeight)throw Error('blueprint claim is not reachable at desktop height '+innerHeight);
          const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
          if(hit!==button&&!button.contains(hit))throw Error('blueprint claim is covered');
          if(getComputedStyle(button).color!==getComputedStyle(box).color)throw Error('blueprint claim lost theme contrast');
        })()`);
      }
      const shot=await page('Page.captureScreenshot',{format:'png'}),file=path.join(profile,'blueprint-claim-'+theme+'.png');
      fs.writeFileSync(file,Buffer.from(shot.data,'base64'));console.log('SCREENSHOT: '+file);
      await nativeClick('#roomPanel .smithBlueprintClaim');
      await evaluate(`(function() {
        if(!$SM.get('character.blueprints["wisteria oil"]')||$('#roomPanel .smithBlueprintClaim').is(':visible'))throw Error('native blueprint claim did not unlock the recipe or hide the completed action');
      })()`);
      await nativeClick('#roomPanel .pillarTrainingStart');
      await evaluate(`(function() {
        if(Events.activeEvent()?.id!=='pillarConvocation'||$SM.get('game.pillarConvocationDone'))throw Error('manual training did not start or wrongly completed the task');
      })()`);
      await nativeClick('#choose');
      await nativeClick('#leave');
      await evaluate(`(async function() {
        for(let i=0;i<100&&Events.activeEvent();i++)await new Promise(resolve=>setTimeout(resolve,25));
        if(Events.activeEvent()||$SM.get('game.pillarConvocationDone')||document.querySelector('#roomPanel .pillarTrainingStart').disabled)throw Error('cancelled training is not immediately reopenable');
        $SM.set('stores["cured meat"]',50);$SM.set('stores.torch',1);
      })()`);
      await nativeClick('#roomPanel .pillarTrainingStart');
      await nativeClick('#choose');
      await nativeClick('#review');
      await evaluate(`(function() {
        if(!$SM.get('game.pillarConvocationDone')||$SM.get('stores["cured meat"]')!==0||$SM.get('stores.torch')!==0)throw Error('manual training did not charge exact warehouse costs and complete');
      })()`);
      await nativeClick('#rest');
      await evaluate(`(async function() {
        for(let i=0;i<100&&Events.activeEvent();i++)await new Promise(resolve=>setTimeout(resolve,25));
        if(Events.activeEvent())throw Error('training completion panel did not close');
      })()`);
      console.log('PASS: '+theme+' current-stage blueprint claim is readable, reachable at 600/938 heights, and works with native pointer input');
    }
    assert.deepEqual(errors, [], 'Uncaught browser errors');
  } finally {
    if (call && socket?.readyState === WebSocket.OPEN) { try { await call('Browser.close'); } catch {} }
    socket?.close(); browser.kill(); server.closeAllConnections(); server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
