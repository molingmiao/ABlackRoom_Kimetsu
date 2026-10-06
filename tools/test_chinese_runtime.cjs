const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const espree = require('espree');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const languageLoader = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .find(match => match[1].includes('var lang =') && match[1].includes('document.write'))?.[1];
assert.ok(languageLoader, 'the real page language loader must be found');
function loadPageLanguage(language) {
  const loaded = [], c = { location: { search: language ? '?lang=' + language : '' }, localStorage: {} };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(read('lib/translate.js'), c);
  c.document = { write(markup) {
    const script = markup.match(/<script\s+src="([^"]+)"/);
    if (!script) return;
    loaded.push(script[1]);
    vm.runInContext(read(script[1]), c, { filename: script[1] });
  } };
  vm.runInContext(languageLoader, c, { filename: 'index.html language loader' });
  return { c, loaded };
}
const { c, loaded } = loadPageLanguage('zh_cn'), tr = c._;
assert.ok(loaded.includes('lang/zh_cn/runtime_updates.js'), 'runtime translations must be included by the actual page');
assert.ok(loaded.includes('lang/zh_cn/nichirin_forge.js'));
assert.equal(loadPageLanguage().c._('buy {0}', '药剂'), '购买药剂', 'default Chinese uses the same actual loader');

const cases = [
  ['scrapped {0} {1} ({2})', [2, tr('nichirin blade flame'), '钢 ×12；余料30%'], '已回收日轮刀【炎】 ×2（返还：钢 ×12；余料30%）'],
  ['buy {0}', [tr('medicine')], '购买药剂'],
  ['bought {0} {1}', [3, tr('medicine')], '已购买药剂 ×3'],
  ['progress: {0}/{1}', [7, 10], '进度：7/10'],
  ['reward: {0}', ['鳞片 ×15'], '奖励：鳞片 ×15'],
  ['Floor {0} / {1}', [18, 100], '楼层：18 / 100'],
  ['hotkeys: QWERTY attack · 1-6 heal / potion', [], '快捷键：QWERTY 攻击 · 1–6 回复／用药'],
  ['explorer +15% hp', [], '探索者：生命上限 +15%'],
  ['depth +{0} hp', [21], '深层修炼：生命上限 +21'],
  ['depth +{0}% dmg', [12], '深层修炼：伤害 +12%'],
  ['depth +{0}% dr', [8], '深层修炼：减伤 +8%'],
  ['floors traversed: {0}', [123], '累计通过楼层：123'],
  ['the swarm leaves behind {0} more opportunities to take on a new edge.', [3], '鬼群留下了 3 次修炼选择机会。'],
  [' [x{0} fights]', [3], '〔持续 3 场战斗〕'],
  ['you gulp down {0} {1} — {2}{3}', ['强力药水', '（增益）', '伤害提升', tr(' [x{0} fights]', 3)], '你喝下强力药水（增益）——伤害提升〔持续 3 场战斗〕'],
  ['the merchant exchanges fur for demon scales.', [], '商人用鬼的鳞片换取毛皮。'],
  ['the merchant hands over a bundle of demon claws.', [], '商人递来一捆牙齿。']
];
for (const [key, args, expected] of cases) assert.equal(tr(key, ...args), expected, key);
const forms = { water:'水', flame:'炎', thunder:'雷', beast:'兽', insect:'虫', sound:'音', mist:'霞',
  wind:'风', stone:'岩', flower:'花', love:'恋', serpent:'蛇', sun:'日', moon:'月' };
for (const [id, label] of Object.entries(forms)) {
  assert.equal(tr('nichirin blade ' + id), '日轮刀【' + label + '】');
  assert.equal(tr('supreme nichirin blade ' + id), '极日轮刀【' + label + '】');
}
assert.equal(tr('flame blade'), tr('nichirin blade flame'), 'historical flame labels use the canonical short name');
assert.match(tr('flame style mechanics', 18), /18%/);
assert.equal(tr('flame style mechanics', 18).includes('炎刃'), false, 'merged equipment is not described as two separate items');

const brands = new Set(['facebook', 'google+', 'twitter', 'reddit']);
const missing = [], enemies = new Set(), genericEnemies = new Set();
let literalCalls = 0;
function walk(node, file) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === '_'
    && node.arguments[0]?.type === 'Literal') {
    const key = node.arguments[0].value;
    if (typeof key === 'string' && /[a-z]/i.test(key) && !/[\u3400-\u9fff]/.test(key) && !brands.has(key)) {
      literalCalls++;
      if (tr(key) === key) missing.push(file + ':' + node.loc.start.line + ' ' + JSON.stringify(key));
      // Check actual formatted calls, including Unicode-escaped source literals.
      if (node.arguments.length > 1 && !node.arguments.some(arg => arg.type === 'SpreadElement')) {
        const args = node.arguments.slice(1).map((_, index) => '参数' + index);
        const value = tr(key, ...args);
        assert.equal(/undefined|\{\d+\}/.test(value), false, file + ':' + node.loc.start.line + ' loses formatted arguments');
      }
    }
  }
  if (node.type === 'Property' && (node.key.name === 'enemy' || node.key.value === 'enemy') && node.value.type === 'Literal') {
    const key = node.value.value;
    if (typeof key === 'string' && /[a-z]/i.test(key)) enemies.add(key);
  }
  if (node.type === 'VariableDeclarator' && node.id.name === 'enemyNames' && node.init?.type === 'ArrayExpression') {
    node.init.elements.filter(value => value?.type === 'Literal').forEach(value => genericEnemies.add(value.value));
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'range') continue;
    if (Array.isArray(value)) value.forEach(child => walk(child, file));
    else if (value && typeof value === 'object') walk(value, file);
  }
}
function scan(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const file = dir + '/' + entry.name;
    if (entry.isDirectory()) scan(file);
    else if (entry.name.endsWith('.js')) walk(espree.parse(read(file), { ecmaVersion:'latest', sourceType:'script', loc:true }), file);
  }
}
scan('script');
assert.deepEqual(missing, [], 'all static English runtime keys must be translated by the page dictionaries');
for (const enemy of enemies) assert.notEqual(tr(enemy), enemy, 'dynamic enemy label missing: ' + enemy);
for (const enemy of genericEnemies) {
  assert.notEqual(tr(enemy), enemy);
  assert.match(tr('elite ' + enemy), /^精英·[^a-z]+$/i, 'legacy concatenated elite label: ' + enemy);
}
const english = loadPageLanguage('en');
assert.deepEqual(english.loaded, [], 'Chinese-only extensions are never loaded for English');
assert.equal(english.c._('scrapped {0} {1} ({2})', 2, 'blade', 'steel 12'), 'scrapped 2 blade (steel 12)');
console.log(`PASS: actual index language loader, 17 full formatted keys, 28 short blade labels, ${literalCalls} static calls, ${enemies.size} dynamic enemies and generic elites; English defaults unchanged.`);
