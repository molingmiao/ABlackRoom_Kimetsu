// 把 tools/translations_batchN.cjs 里的 key->value 映射追加到 lang/zh_cn/strings.js
// 用法：node tools/apply_translations.cjs tools/translations_batch1.cjs
// （已存在的 key 会被新值覆盖，因为 JS object literal 后写的赢）

const fs = require('fs');
const path = require('path');

const batchPath = process.argv[2];
if (!batchPath) {
	console.error('usage: node tools/apply_translations.cjs <batch-file.cjs>');
	process.exit(1);
}

const translations = require(path.resolve(batchPath));
const stringsPath = path.resolve('lang/zh_cn/strings.js');
let text = fs.readFileSync(stringsPath, 'utf8');

// 末尾结构是 ...\n"last entry": "...",\n});\n
// 我们找到最后的 "});\n" 并在它前面插入新条目
const endMarker = '});';
const lastIdx = text.lastIndexOf(endMarker);
if (lastIdx === -1) {
	console.error('cannot find closing "});" in strings.js');
	process.exit(1);
}

// 检查前面那条是否以逗号结尾；如果不是，需要补一个逗号
let head = text.slice(0, lastIdx);
const trimHead = head.replace(/\s+$/, '');
const tail = text.slice(lastIdx);

const needComma = !trimHead.endsWith(',');

// 构造插入块
const lines = [];
for (const [k, v] of Object.entries(translations)) {
	// 把 key/value 安全 JSON 化
	lines.push('\t' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',');
}
// 去掉最后一个逗号，保证语法干净
if (lines.length > 0) {
	lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
}

const insertBlock = (needComma ? ',' : '') + '\n\n\t/* === appended by tools/apply_translations.cjs === */\n' + lines.join('\n') + '\n';

const newText = trimHead + insertBlock + '\n' + tail;
fs.writeFileSync(stringsPath, newText, 'utf8');

console.log(`appended ${Object.keys(translations).length} entries from ${batchPath}`);
