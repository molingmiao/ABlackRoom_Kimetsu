#!/usr/bin/env node
// 零依赖的最小静态文件服务器 + 浏览器自动启动 launcher。
//
// 用法 1（开发）：node tools/static-server.cjs
// 用法 2（pkg 打包后）：双击生成的 .exe
//
// 打包说明：
//   pkg 打包后 process.pkg 为 truthy；此时 __dirname 是虚拟 /snapshot/...，
//   游戏资源用 exe 所在目录（process.execPath 的目录）作根。
//   即"绿色版"模式 — exe 旁边放着 index.html / css/ / script/ / 等。
//
// 环境变量：
//   PORT=8081（默认端口）
//   NO_OPEN=1（不自动开浏览器，仅启动 server）

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');

const PORT = Number(process.env.PORT) || 8081;
// 判断是否为打包后的 exe（Node SEA 或旧版 pkg），此时用 exe 所在目录作根；
// 普通 node 运行则用当前工作目录。
function _isPackagedExe() {
	if (process.pkg) return true; // 旧 pkg 兼容
	try {
		// Node SEA 官方检测：require('node:sea').isSea()
		var sea = require('node:sea');
		if (sea && typeof sea.isSea === 'function' && sea.isSea()) return true;
	} catch (e) { /* Node <20 或未开启 SEA */ }
	return false;
}
const ROOT = _isPackagedExe()
	? path.dirname(process.execPath)
	: process.cwd();

// 启动器版本；打包时由 build-exe.cjs 用 package.json.version 替换占位符
const LAUNCHER_VERSION = '__LAUNCHER_VERSION__';
// 联络方式；打包时可覆盖
const CONTACT_INFO = '__CONTACT_INFO__';

function readGameVersion() {
	try {
		const p = path.join(ROOT, 'version.txt');
		if (!fs.existsSync(p)) return null;
		return fs.readFileSync(p, 'utf8').trim().split(/\s+/)[0];
	} catch (e) { return null; }
}

function compareVersion(a, b) {
	if (!a) return -1;
	const pa = String(a).split('.').map(function (n) { return parseInt(n, 10) || 0; });
	const pb = String(b).split('.').map(function (n) { return parseInt(n, 10) || 0; });
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const va = pa[i] || 0, vb = pb[i] || 0;
		if (va !== vb) return va - vb;
	}
	return 0;
}

function checkVersion() {
	// 开发模式（占位符未替换）跳过
	if (LAUNCHER_VERSION.indexOf('__') === 0) return null;
	const game = readGameVersion();
	if (game === LAUNCHER_VERSION) return null;
	return { launcher: LAUNCHER_VERSION, game: game || '(未安装 version.txt)' };
}

function renderMismatchHtml(mm) {
	const isOld = compareVersion(mm.game, mm.launcher) < 0;
	const diagnosis = isOld
		? '你的<b>游戏文件版本落后</b>于启动器要求的版本。请联系作者索取最新<b>补丁包</b>更新游戏文件。'
		: '你的<b>启动器版本落后</b>于当前游戏文件版本。请联系作者索取最新的<b>完整安装包</b>。';
	const contact = CONTACT_INFO.indexOf('__') === 0
		? '（作者未在打包时填写联系方式）'
		: CONTACT_INFO.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
	return '<!DOCTYPE html><html lang="zh-cn"><head><meta charset="utf-8"><title>版本不匹配</title>' +
		'<style>body{font-family:"Microsoft YaHei",system-ui,sans-serif;background:#fafafa;color:#222;max-width:640px;margin:60px auto;padding:20px;}' +
		'h1{color:#c0392b;margin-top:0;}' +
		'.box{border:2px solid #c0392b;padding:16px 24px;border-radius:6px;background:#fff;margin:20px 0;}' +
		'.row{display:flex;justify-content:space-between;padding:6px 0;font-size:15px;}' +
		'.badge{display:inline-block;padding:2px 12px;border-radius:3px;font-size:13px;font-family:Consolas,monospace;}' +
		'.b-cur{background:#eee;color:#666;} .b-need{background:#c0392b;color:#fff;}' +
		'.contact{background:#fff8dc;border-left:4px solid #d4a017;padding:12px 16px;margin:24px 0;}' +
		'a.continue{color:#888;font-size:12px;} p{line-height:1.6;}</style></head><body>' +
		'<h1>版本不匹配 — 无法启动游戏</h1>' +
		'<div class="box">' +
		'<div class="row"><b>启动器要求版本</b><span class="badge b-need">' + mm.launcher + '</span></div>' +
		'<div class="row"><b>游戏文件当前版本</b><span class="badge b-cur">' + mm.game + '</span></div>' +
		'</div>' +
		'<p>' + diagnosis + '</p>' +
		'<div class="contact"><b>联系方式</b><br>' + contact + '</div>' +
		'<p><a class="continue" href="/index.html?nocheck=1">忽略警告继续（不推荐，可能出现运行异常）</a></p>' +
		'</body></html>';
}

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.mjs': 'application/javascript; charset=utf-8',
	'.cjs': 'application/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.flac': 'audio/flac',
	'.mp3': 'audio/mpeg',
	'.ogg': 'audio/ogg',
	'.wav': 'audio/wav',
	'.txt': 'text/plain; charset=utf-8',
	'.po': 'text/plain; charset=utf-8',
	'.pot': 'text/plain; charset=utf-8',
};

function sendError(res, code, msg) {
	res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
	res.end(msg);
}

function openInBrowser(url) {
	if (process.env.NO_OPEN === '1') return;
	const platform = process.platform;
	let cmd;
	if (platform === 'win32') {
		// "" empty title required by start when URL has spaces
		cmd = `start "" "${url}"`;
	} else if (platform === 'darwin') {
		cmd = `open "${url}"`;
	} else {
		cmd = `xdg-open "${url}"`;
	}
	exec(cmd, (err) => {
		if (err) console.error('[launcher] failed to open browser:', err.message);
	});
}

const server = http.createServer((req, res) => {
	const parsed = url.parse(req.url, true);
	let pathname = decodeURIComponent(parsed.pathname || '/');
	if (pathname === '/') pathname = '/index.html';

	// 版本检查页（launcher 内嵌，不落盘）
	if (pathname === '/__version_check__') {
		const mm = checkVersion();
		if (!mm) {
			res.writeHead(302, { Location: '/index.html' });
			return res.end();
		}
		const html = renderMismatchHtml(mm);
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
		return res.end(html);
	}

	// 首次进入 index：若版本不匹配 → 跳版本检查页；带 ?nocheck=1 可强绕过
	if (pathname === '/index.html' && parsed.query.nocheck !== '1') {
		const mm = checkVersion();
		if (mm) {
			res.writeHead(302, { Location: '/__version_check__' });
			return res.end();
		}
	}

	// 防穿越攻击：把请求路径 join 到 ROOT 之后必须仍在 ROOT 之内
	const safePath = path.normalize(path.join(ROOT, pathname));
	if (!safePath.startsWith(ROOT)) {
		return sendError(res, 403, 'forbidden');
	}

	fs.stat(safePath, (err, stat) => {
		if (err || !stat.isFile()) return sendError(res, 404, 'not found: ' + pathname);
		const ext = path.extname(safePath).toLowerCase();
		const contentType = MIME[ext] || 'application/octet-stream';
		const cacheControl = ext === '.html' ? 'no-cache' : 'public, max-age=300';
		res.writeHead(200, {
			'Content-Type': contentType,
			'Cache-Control': cacheControl,
			'Content-Length': stat.size,
		});
		fs.createReadStream(safePath).pipe(res);
	});
});

server.on('error', (err) => {
	if (err.code === 'EADDRINUSE') {
		console.error(`[launcher] port ${PORT} is already in use. set PORT=NNNN to use a different port.`);
		process.exit(1);
	}
	throw err;
});

server.listen(PORT, () => {
	const url = `http://localhost:${PORT}/`;
	console.log(`[launcher] listening on ${url}`);
	console.log(`[launcher] serving root = ${ROOT}`);
	const isSea = LAUNCHER_VERSION.indexOf('__') !== 0;
	if (isSea) {
		const gv = readGameVersion();
		console.log(`[launcher] launcher version = ${LAUNCHER_VERSION}`);
		console.log(`[launcher] game version     = ${gv || '(未找到 version.txt)'}`);
		const mm = checkVersion();
		if (mm) console.warn(`[launcher] !! 版本不匹配，将跳转到版本提示页`);
	}
	// pkg 模式下自动开浏览器
	if (process.pkg || isSea) {
		console.log('[launcher] opening browser...');
		openInBrowser(url);
	}
});
