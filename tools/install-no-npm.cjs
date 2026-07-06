#!/usr/bin/env node
/**
 * install-no-npm.cjs — 不依赖 `npm install` 的依赖安装器。
 *
 * 适用场景：公司代理或某些环境里 `npm install` 卡住/超时，但能直连下载文件
 * （`https://registry.npmjs.org/<pkg>/-/<pkg>-<ver>.tgz`）。
 *
 * 工作流程：
 *   1. 读取项目根的 package.json，收集 dependencies + devDependencies
 *   2. 递归从 npm registry 抓 packument JSON，按 semver 范围解析每个 dep 的版本
 *   3. 下载 tarball (.tgz) 到 .npm-cache/，调用系统 tar.exe 解压到 node_modules/<pkg>/
 *   4. 对每个 dep 重复同样流程（深度优先，幂等：已安装即跳过）
 *
 * 用法：node tools/install-no-npm.cjs [包名@版本范围 ...]
 *   - 无参数：从 package.json 安装全部 deps + devDeps
 *   - 有参数：只安装指定的包（例如 `node tools/install-no-npm.cjs eslint@^10 prettier@^3`）
 *
 * 注意：
 *   - 这是个简化实现，semver 解析覆盖 ^/~/精确/范围/* 等常见形式
 *   - 不处理 peerDependencies（npm v7+ 自动装，这里跳过避免依赖爆炸）
 *   - 不处理 optionalDependencies、bundledDependencies
 *   - 不写 package-lock.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const REGISTRY = process.env.NPM_REGISTRY || 'https://registry.npmjs.org';
const ROOT = process.cwd();
const NODE_MODULES = path.join(ROOT, 'node_modules');
const CACHE_DIR = path.join(ROOT, '.npm-cache');

// 公司内网通常用自签名根 CA 做 HTTPS 中间人解密；Node 默认不读系统 CA，
// 会以 "self-signed certificate in certificate chain" 报错。把 rejectUnauthorized
// 置 false 让 Node 接受任何证书。注意：仅适合受信内网，外网环境不要这样做。
const HTTPS_OPTS = {
	rejectUnauthorized: process.env.INSTALL_STRICT_TLS === '1',
};

// 已 resolve 的包（避免重复装 + 防循环依赖）：name → version
const installed = new Map();
// packument 缓存
const packumentCache = new Map();

// ---------- 工具函数 ----------

function log(msg, color) {
	const colors = { green: 32, yellow: 33, red: 31, cyan: 36, gray: 90 };
	const c = colors[color];
	if (c && process.stdout.isTTY) console.log(`\x1b[${c}m${msg}\x1b[0m`);
	else console.log(msg);
}

function ensureDir(p) {
	fs.mkdirSync(p, { recursive: true });
}

function httpGetJson(url) {
	return new Promise((resolve, reject) => {
		const opts = { ...HTTPS_OPTS, headers: { Accept: 'application/json', 'User-Agent': 'install-no-npm' } };
		https.get(url, opts, (res) => {
			if (res.statusCode === 301 || res.statusCode === 302) {
				return httpGetJson(res.headers.location).then(resolve, reject);
			}
			if (res.statusCode !== 200) {
				return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
			}
			let body = '';
			res.setEncoding('utf8');
			res.on('data', (c) => (body += c));
			res.on('end', () => {
				try {
					resolve(JSON.parse(body));
				} catch (e) {
					reject(e);
				}
			});
		}).on('error', reject);
	});
}

function httpGetFile(url, dest) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest);
		const opts = { ...HTTPS_OPTS, headers: { 'User-Agent': 'install-no-npm' } };
		https.get(url, opts, (res) => {
			if (res.statusCode === 301 || res.statusCode === 302) {
				file.close();
				fs.unlinkSync(dest);
				return httpGetFile(res.headers.location, dest).then(resolve, reject);
			}
			if (res.statusCode !== 200) {
				file.close();
				try { fs.unlinkSync(dest); } catch (_) {}
				return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
			}
			res.pipe(file);
			file.on('finish', () => file.close(resolve));
		}).on('error', (err) => {
			file.close();
			try { fs.unlinkSync(dest); } catch (_) {}
			reject(err);
		});
	});
}

// ---------- semver 极简解析 ----------
// 支持：精确（1.2.3）、^1.2.3、~1.2.3、>=1.2.3、>1.2.3、<=、<、*、X.x.x

function parseVersion(v) {
	const m = String(v).match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
	if (!m) return null;
	return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || '' };
}

function cmpVersion(a, b) {
	if (a.major !== b.major) return a.major - b.major;
	if (a.minor !== b.minor) return a.minor - b.minor;
	if (a.patch !== b.patch) return a.patch - b.patch;
	// 预发布版本排序：有 pre 的小于无 pre 的
	if (a.pre && !b.pre) return -1;
	if (!a.pre && b.pre) return 1;
	if (a.pre === b.pre) return 0;
	return a.pre < b.pre ? -1 : 1;
}

function satisfies(versionStr, rangeStr) {
	const ver = parseVersion(versionStr);
	if (!ver) return false;
	const range = String(rangeStr || '*').trim();

	// 跳过预发布版本，除非范围里也明确写了 pre
	if (ver.pre && !range.includes('-')) return false;

	if (range === '' || range === '*' || range === 'latest' || range === 'x') return true;

	// 多约束："^1.2.3 || ^2.0.0"
	if (range.includes('||')) {
		return range.split('||').some((r) => satisfies(versionStr, r.trim()));
	}

	// 复合范围："^1.2.3 <1.5.0"
	if (range.includes(' ')) {
		return range.split(/\s+/).every((r) => satisfies(versionStr, r));
	}

	// "1.2.3 - 2.0.0"
	if (range.includes(' - ')) {
		const [lo, hi] = range.split(' - ');
		return satisfies(versionStr, '>=' + lo) && satisfies(versionStr, '<=' + hi);
	}

	let m;
	if ((m = range.match(/^\^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/))) {
		const major = +m[1], minor = +(m[2] || 0), patch = +(m[3] || 0);
		if (major > 0) {
			return ver.major === major && cmpVersion(ver, { major, minor, patch, pre: m[4] || '' }) >= 0;
		} else if (minor > 0) {
			return ver.major === 0 && ver.minor === minor && cmpVersion(ver, { major, minor, patch, pre: m[4] || '' }) >= 0;
		}
		return ver.major === 0 && ver.minor === 0 && ver.patch === patch;
	}
	if ((m = range.match(/^~(\d+)(?:\.(\d+))?(?:\.(\d+))?/))) {
		const major = +m[1], minor = +(m[2] || 0), patch = +(m[3] || 0);
		return ver.major === major && ver.minor === minor && ver.patch >= patch;
	}
	if ((m = range.match(/^>=\s*(\S+)/))) return cmpVersion(ver, parseVersion(m[1])) >= 0;
	if ((m = range.match(/^>\s*(\S+)/))) return cmpVersion(ver, parseVersion(m[1])) > 0;
	if ((m = range.match(/^<=\s*(\S+)/))) return cmpVersion(ver, parseVersion(m[1])) <= 0;
	if ((m = range.match(/^<\s*(\S+)/))) return cmpVersion(ver, parseVersion(m[1])) < 0;
	if ((m = range.match(/^=?\s*(\d+\.\d+\.\d+)/))) return versionStr === m[1];

	// X.x / X.X.x 形式
	if ((m = range.match(/^(\d+)\.(x|\*)$/))) return ver.major === +m[1];
	if ((m = range.match(/^(\d+)\.(\d+)\.(x|\*)$/))) return ver.major === +m[1] && ver.minor === +m[2];

	// 落到精确匹配
	return versionStr === range;
}

async function getPackument(name) {
	if (packumentCache.has(name)) return packumentCache.get(name);
	const url = REGISTRY + '/' + encodeURIComponent(name).replace(/%40/g, '@').replace(/%2F/g, '/');
	const data = await httpGetJson(url);
	packumentCache.set(name, data);
	return data;
}

function pickVersion(packument, range) {
	const versions = Object.keys(packument.versions || {});
	const candidates = versions
		.map((v) => ({ v, parsed: parseVersion(v) }))
		.filter((x) => x.parsed && satisfies(x.v, range));
	if (candidates.length === 0) {
		// 退回到 dist-tags.latest 作为兜底
		const latest = packument['dist-tags'] && packument['dist-tags'].latest;
		if (latest) return latest;
		throw new Error(`no version of ${packument.name} satisfies ${range}`);
	}
	candidates.sort((a, b) => cmpVersion(a.parsed, b.parsed));
	return candidates[candidates.length - 1].v;
}

// ---------- 安装单个包 ----------

function createBinShims(name, packageJsonPath, targetDir) {
	// 读 package.json 的 bin 字段，在 node_modules/.bin/ 下创建 Windows shim
	let pkg;
	try {
		pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	} catch (_) {
		return;
	}
	if (!pkg.bin) return;
	const binMap = typeof pkg.bin === 'string'
		? { [pkg.name.split('/').pop()]: pkg.bin }
		: pkg.bin;
	const dotBin = path.join(NODE_MODULES, '.bin');
	ensureDir(dotBin);
	for (const [cmdName, binRel] of Object.entries(binMap)) {
		const target = path.join(targetDir, binRel);
		// Windows .cmd shim
		const cmdShim = `@echo off\r\nnode "${target}" %*\r\n`;
		fs.writeFileSync(path.join(dotBin, cmdName + '.cmd'), cmdShim);
		// POSIX shell shim（在 npm scripts 跨平台时有用）
		const shShim = `#!/bin/sh\nbasedir=$(dirname "$(echo "$0" | sed -e 's,\\\\,/,g')")\nexec node "$basedir/../${name}/${binRel.replace(/\\\\/g, '/')}" "$@"\n`;
		fs.writeFileSync(path.join(dotBin, cmdName), shShim);
		try { fs.chmodSync(path.join(dotBin, cmdName), 0o755); } catch (_) {}
	}
}

async function installPackage(name, range, depth) {
	const indent = '  '.repeat(depth);
	const targetDir = path.join(NODE_MODULES, ...name.split('/'));

	// 已安装且 package.json 在 → 跳过
	if (installed.has(name)) {
		return installed.get(name);
	}
	if (fs.existsSync(path.join(targetDir, 'package.json'))) {
		try {
			const existing = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
			if (satisfies(existing.version, range)) {
				installed.set(name, existing.version);
				log(`${indent}✓ ${name}@${existing.version} (cached)`, 'gray');
				// 即便缓存命中也补 bin shim 与递归 deps：
				// 之前漏装的 transitive deps 在这里会被补齐
				createBinShims(name, path.join(targetDir, 'package.json'), targetDir);
				const cachedDeps = existing.dependencies || {};
				for (const [depName, depRange] of Object.entries(cachedDeps)) {
					await installPackage(depName, depRange, depth + 1);
				}
				return existing.version;
			}
		} catch (_) {}
	}

	const packument = await getPackument(name);
	const version = pickVersion(packument, range);
	const manifest = packument.versions[version];
	const tarballUrl = manifest.dist.tarball;

	// 下载 tarball 到 cache
	ensureDir(CACHE_DIR);
	const tarballName = `${name.replace('/', '-')}-${version}.tgz`;
	const tarballPath = path.join(CACHE_DIR, tarballName);
	if (!fs.existsSync(tarballPath)) {
		await httpGetFile(tarballUrl, tarballPath);
	}

	// 解压到 node_modules/<name>/
	ensureDir(targetDir);
	// tar.exe 解压时会生成 package/ 顶层目录；用 --strip-components=1 去掉
	execSync(`tar -xzf "${tarballPath}" -C "${targetDir}" --strip-components=1`, { stdio: 'pipe' });

	installed.set(name, version);
	log(`${indent}✓ ${name}@${version}`, 'green');

	// 创建 bin shim
	createBinShims(name, path.join(targetDir, 'package.json'), targetDir);

	// 递归装 dependencies
	const deps = manifest.dependencies || {};
	for (const [depName, depRange] of Object.entries(deps)) {
		await installPackage(depName, depRange, depth + 1);
	}
	return version;
}

// ---------- 主入口 ----------

async function main() {
	const pkgPath = path.join(ROOT, 'package.json');
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

	let rootDeps;
	if (process.argv.length > 2) {
		// 命令行参数模式：name@range
		rootDeps = {};
		for (let i = 2; i < process.argv.length; i++) {
			const arg = process.argv[i];
			const at = arg.lastIndexOf('@');
			if (at <= 0) {
				rootDeps[arg] = '*';
			} else {
				rootDeps[arg.slice(0, at)] = arg.slice(at + 1);
			}
		}
	} else {
		// package.json 模式
		rootDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
	}

	log(`[install-no-npm] registry: ${REGISTRY}`, 'cyan');
	log(`[install-no-npm] root packages: ${Object.keys(rootDeps).length}`, 'cyan');
	log(`[install-no-npm] node_modules: ${NODE_MODULES}`, 'cyan');
	ensureDir(NODE_MODULES);

	const start = Date.now();
	for (const [name, range] of Object.entries(rootDeps)) {
		try {
			await installPackage(name, range, 0);
		} catch (e) {
			log(`[install-no-npm] FAILED ${name}@${range}: ${e.message}`, 'red');
		}
	}
	const seconds = Math.round((Date.now() - start) / 1000);
	log(`\n[install-no-npm] done in ${seconds}s. Installed ${installed.size} packages.`, 'green');
	log(`[install-no-npm] cache dir: ${CACHE_DIR} (safe to delete)`, 'gray');
}

main().catch((e) => {
	log('[install-no-npm] FATAL: ' + (e.stack || e.message), 'red');
	process.exit(1);
});
