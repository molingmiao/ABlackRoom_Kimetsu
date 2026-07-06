// 切除 space.js 中残留的旧飞船动作代码段
// 范围：从第一个 "// ---- MUZAN BOSS FIGHT ----" 后的 "return Space.SHIP_SPEED;" 开始
// 到第二个 "// ---- MUZAN BOSS FIGHT ----" 之前结束
const fs = require('fs');
const path = 'script/space.js';
let text = fs.readFileSync(path, 'utf8');

const startMarker = '// ---- MUZAN BOSS FIGHT ----\nreturn Space.SHIP_SPEED;';
const endMarker = '// ---- MUZAN BOSS FIGHT ----\n\ntriggerMuzan: function() {';

const startIdx = text.indexOf(startMarker);
const endIdx = text.indexOf(endMarker);

if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
	console.error('markers not found:', startIdx, endIdx);
	process.exit(1);
}

// 保留第一个 marker（在我新代码末尾），删掉到第二个 marker 之前
const keepStart = startIdx + '// ---- MUZAN BOSS FIGHT ----\n'.length;
const before = text.substring(0, keepStart);
const after = '\n\ttriggerMuzan: function() {' + text.substring(endIdx + endMarker.length);

fs.writeFileSync(path, before + after);
console.log('trimmed', endIdx - keepStart, 'bytes of orphan code');
