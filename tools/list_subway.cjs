// 列出含 subway / 地铁 / 站台 的全部 strings.js 翻译条目
const fs = require('fs');
const t = fs.readFileSync('lang/zh_cn/strings.js', 'utf8');

const patterns = [/subway/i, /地铁/, /站台/];
const RE = /"((?:\\.|[^"\\])*)":\s*"((?:\\.|[^"\\])*)"/g;
let m;
const out = [];
while ((m = RE.exec(t)) !== null) {
	const key = m[1], val = m[2];
	if (patterns.some(p => p.test(key) || p.test(val))) {
		out.push({ key: key.slice(0, 80), val: val.slice(0, 100) });
	}
}
console.log('found', out.length, 'entries');
out.forEach(o => console.log('  K:', o.key, '\n    V:', o.val));
