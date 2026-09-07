const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let modal = true;
const attack = { key: 'q', clicks: 0 };
const heal = { key: '1', clicks: 0 };
const background = { key: '1', clicks: 0 };
function selection(items) {
  return {
    length: items.length,
    first: () => selection(items.slice(0, 1)),
    find: selector => selection([attack, heal].filter(b => selector.includes('"' + b.key + '"'))),
    get: () => items,
    hasClass: () => !!items[0].disabled,
    data: () => !!items[0].cooldown,
    trigger: () => { items[0].clicks++; }
  };
}
const context = {
  _: s => s,
  window: {}, document: { activeElement: null },
  $: arg => {
    if (typeof arg === 'function') return; // Do not initialize the whole game.
    if (typeof arg !== 'string') return selection([arg]);
    if (arg === '.eventPanel:visible') return selection(modal ? [{}] : []);
    return selection([background].filter(b => arg.includes('"' + b.key + '"')));
  }
};
vm.createContext(context);
for (const file of ['engine.js', 'events.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../script', file), 'utf8'), context);
}
const Engine = context.Engine = context.window.Engine;
function event(key, extra = {}) {
  return { key, preventDefault() {}, stopPropagation() { this.stopped = true; }, ...extra };
}
function press(key, extra) {
  const down = event(key, extra);
  Engine._hotkeyKeyDown(down);
  Engine._hotkeyKeyUp(event(key));
  return down;
}
for (const key of ['q', '1']) {
  press(key); press(key);
}
assert.equal(attack.clicks, 2);
assert.equal(heal.clicks, 2);
Engine._hotkeyKeyDown(event('q'));
Engine._hotkeyKeyDown(event('q'));
assert.equal(attack.clicks, 3, 'holding a key must not repeat attacks');
Engine._resetHotkeys();
press('q');
assert.equal(attack.clicks, 4, 'window blur clears stuck keys');
heal.disabled = true;
press('1');
assert.equal(heal.clicks, 2);
assert.equal(background.clicks, 0, 'disabled combat heal must not use background supplies');
heal.disabled = false;
heal.cooldown = true;
press('1');
assert.equal(heal.clicks, 2);
heal.cooldown = false;
context.document.activeElement = { tagName: 'INPUT' };
press('q');
context.document.activeElement = null;
press('q', { ctrlKey: true });
press('q', { isComposing: true });
assert.equal(attack.clicks, 4, 'typing and browser shortcuts must not attack');
modal = false;
press('1');
assert.equal(background.clicks, 1);
assert.equal(press('w').stopped, undefined, 'unmatched W must remain available for movement');
let moduleKeyUps = 0;
Engine.activeModule = { keyUp() { moduleKeyUps++; } };
Engine.keyUp(event('w'));
assert.equal(moduleKeyUps, 1);

context._ = s => s;
context.Path = { outfit: {} };
context.Button = {
  Button: function() { return { addClass() {} }; },
  setDisabled(button, disabled) { button.disabled = disabled; }
};
for (const amount of [undefined, 0, 1, 3]) {
  context.Path.outfit['wisteria oil'] = amount;
  assert.equal(!!context.Events.createUseHypoButton().disabled, !amount);
}
console.log('PASS: repeated attacks/heals, held keys, blur reset, cooldowns, modal isolation, typing, movement, and oil availability.');
