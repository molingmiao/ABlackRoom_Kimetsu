#!/usr/bin/env node
/**
 * sync-dist.cjs — 同步工作区资源到 dist/，同时 strip 掉标记为 /* @strip:xxx-start *\/ 的开发专用块
 *
 * 用法：node tools/sync-dist.cjs（本地包增量同步，保留 exe / zip）
 *       node tools/sync-dist.cjs --web（重建纯网页发布目录）
 *
 * 打包禁忌：
 *   - 测试模式（tester）按钮/面板绝不能进入正式发布包。
 *     在 script/engine.js 里被 /* @strip:tester-start *\/ ... /* @strip:tester-end *\/ 包围，
 *     本脚本会在同步时把这类块整段替换成"[stripped]"注释。
 *   - config.testerMode 若存档里已开启也需要在打包版禁用，交给运行时代码判断即可（此处只裁 UI）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = fs.realpathSync(process.cwd());
const DIST = path.join(ROOT, 'dist');
const WEB_MODE = process.argv.includes('--web');
const WEB_EXTENSIONS = new Set([
	'.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
	'.flac', '.mp3', '.ogg', '.wav', '.woff', '.woff2', '.ttf', '.otf', '.eot',
]);

// 需要同步的文件（源→dst 相对路径一致）
const FILES = [
	'index.html',
	'favicon.ico',
	'browserWarning.html',
	'mobileWarning.html',
	'LICENSE.md',
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
	if (!fs.existsSync(src)) {
		if (WEB_MODE) throw new Error('Missing required web asset: ' + rel);
		return;
	}
	if (WEB_MODE) {
		if (fs.lstatSync(src).isSymbolicLink()) throw new Error('Web assets cannot be symbolic links: ' + rel);
		if (!FILES.includes(rel) && !WEB_EXTENSIONS.has(path.extname(rel).toLowerCase())) return;
	}
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
	if (WEB_MODE && fs.lstatSync(abs).isSymbolicLink()) throw new Error('Web asset directories cannot be symbolic links: ' + rel);
	const entries = fs.readdirSync(abs, { withFileTypes: true });
	for (const e of entries) {
		if (WEB_MODE && (e.name.startsWith('.') || ['node_modules', 'tools'].includes(e.name))) continue;
		const sub = path.join(rel, e.name).replace(/\\/g, '/');
		if (WEB_MODE && e.isSymbolicLink()) throw new Error('Web assets cannot be symbolic links: ' + sub);
		if (e.isDirectory()) walkDir(sub);
		else if (e.isFile()) copyFile(sub);
	}
}

function cleanWebOutput() {
	// Only the repository's fixed dist/ is disposable. Reject other working directories
	// and junctions/symlinks before any recursive removal (especially on Windows).
	const scriptRoot = fs.realpathSync(path.resolve(__dirname, '..'));
	if (ROOT !== scriptRoot || path.dirname(DIST) !== ROOT || path.basename(DIST) !== 'dist') {
		throw new Error('Refusing to clean a web output outside this repository');
	}
	if (fs.existsSync(DIST)) {
		const stat = fs.lstatSync(DIST);
		if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(DIST) !== DIST) {
			throw new Error('Refusing to clean a redirected or non-directory dist');
		}
		fs.rmSync(DIST, { recursive: true, force: true });
	}
}

function main() {
	if (WEB_MODE) cleanWebOutput();
	console.log('[sync-dist] syncing workspace → dist/, stripping @strip:* blocks ...');
	fs.mkdirSync(DIST, { recursive: true });
	FILES.forEach(copyFile);
	DIRS.forEach(walkDir);
	console.log('[sync-dist] done.');
}

main();
