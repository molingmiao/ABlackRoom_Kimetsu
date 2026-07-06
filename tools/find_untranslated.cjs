#!/usr/bin/env node
// 扫描 script/ 下所有 _('...') 字面量，对比 lang/zh_cn/strings.js 的翻译表
// 列出未翻译的条目。用法：node tools/find_untranslated.cjs

const fs = require('fs');
const path = require('path');

// 加载翻译表
let table = {};
global._ = { setTranslation: (o) => { table = o; } };
eval(fs.readFileSync('lang/zh_cn/strings.js', 'utf8'));

// 扫描所有 .js 文件
function* walk(dir) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) yield* walk(p);
		else if (e.isFile() && e.name.endsWith('.js')) yield p;
	}
}

// 匹配 _('...') 或 _("...")，捕获里面的字面量
// 注意：跳过模板字符串里的 ${...}（这种是动态生成的）
const RE = /\b_\(\s*(['"])((?:\\.|(?!\1).)*?)\1\s*\)/g;

const missing = new Map();  // key → list of file paths

for (const f of walk('script')) {
	const text = fs.readFileSync(f, 'utf8');
	let m;
	while ((m = RE.exec(text)) !== null) {
		// 反转义 \' \" \\
		const raw = m[2].replace(/\\(.)/g, '$1');
		if (raw.length === 0) continue;
		if (raw.includes('${')) continue;  // 模板字符串
		if (table[raw] !== undefined) continue;
		if (!missing.has(raw)) missing.set(raw, []);
		missing.get(raw).push(f.replace(/\\/g, '/'));
	}
}

console.log(`untranslated entries: ${missing.size}\n`);

// 按文件分组输出
const byFile = new Map();
for (const [key, files] of missing) {
	for (const f of files) {
		if (!byFile.has(f)) byFile.set(f, new Set());
		byFile.get(f).add(key);
	}
}

const sortedFiles = [...byFile.entries()].sort((a, b) => b[1].size - a[1].size);
for (const [f, keys] of sortedFiles) {
	console.log(`\n[${keys.size}]  ${f}`);
	let i = 0;
	for (const k of keys) {
		if (i++ >= 6) { console.log(`     ... and ${keys.size - 6} more`); break; }
		console.log(`     ${JSON.stringify(k).slice(0, 90)}`);
	}
}
