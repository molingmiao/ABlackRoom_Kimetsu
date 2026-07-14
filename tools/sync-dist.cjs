#!/usr/bin/env node
/**
 * sync-dist.cjs — 同步工作区资源到 dist/，同时 strip 掉标记为 /* @strip:xxx-start *\/ 的开发专用块
 *
 * 用法：node tools/sync-dist.cjs
 *
 * 打包禁忌：
 *   - 测试模式（tester）按钮/面板绝不能进入正式发布包。
 *     在 script/engine.js 里被 /* @strip:tester-start *\/ ... /* @strip:tester-end *\/ 包围，
 *     本脚本会在同步时把这类块整段替换成"[stripped]"注释。
 *   - config.testerMode 若存档里已开启也需要在打包版禁用，交给运行时代码判断即可（此处只裁 UI）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

// 需要同步的文件（源→dst 相对路径一致）
const FILES = [
	'index.html',
	'CHANGELOG.md',
	'lang/zh_cn/strings.js',
	'lang/zh_cn/main.css',
];
// 需要整个目录同步的：
const DIRS = [
	'css',
	'script',
	'img',
	'audio',
	'lang',
	'lib',
];

// strip 正则：匹配 /* @strip:name-start */ ... /* @strip:name-end */
const STRIP_RE = /\/\*\s*@strip:([a-zA-Z0-9_-]+)-start\s*\*\/[\s\S]*?\/\*\s*@strip:\1-end\s*\*\//g;

function stripIfNeeded(srcPath, content) {
	if (!srcPath.endsWith('.js') && !srcPath.endsWith('.css') && !srcPath.endsWith('.html')) return content;
	if (!STRIP_RE.test(content)) return content;
	STRIP_RE.lastIndex = 0;
	return content.replace(STRIP_RE, function (_m, name) {
		return '/* [stripped: ' + name + '] */';
	});
}

function copyFile(rel) {
	const src = path.join(ROOT, rel);
	const dst = path.join(DIST, rel);
	if (!fs.existsSync(src)) return;
	fs.mkdirSync(path.dirname(dst), { recursive: true });
	let content = fs.readFileSync(src);
	// 只对文本类做 strip
	if (rel.endsWith('.js') || rel.endsWith('.css') || rel.endsWith('.html')) {
		const before = content.toString('utf8');
		const after = stripIfNeeded(rel, before);
		if (after !== before) console.log('[sync] STRIPPED: ' + rel);
		content = Buffer.from(after, 'utf8');
	}
	fs.writeFileSync(dst, content);
}

function walkDir(rel) {
	const abs = path.join(ROOT, rel);
	if (!fs.existsSync(abs)) return;
	const entries = fs.readdirSync(abs, { withFileTypes: true });
	for (const e of entries) {
		const sub = path.join(rel, e.name).replace(/\\/g, '/');
		if (e.isDirectory()) walkDir(sub);
		else copyFile(sub);
	}
}

function main() {
	console.log('[sync-dist] syncing workspace → dist/, stripping @strip:* blocks ...');
	fs.mkdirSync(DIST, { recursive: true });
	FILES.forEach(copyFile);
	DIRS.forEach(walkDir);
	console.log('[sync-dist] done.');
}

main();
