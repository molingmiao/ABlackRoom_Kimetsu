#!/usr/bin/env node
/**
 * build-exe.cjs - 用 Node 20 内置 SEA (Single Executable Application) 打包成 .exe
 *
 * 工作流（Windows）：
 *   1. node --experimental-sea-config sea-config.json  → dist/sea-prep.blob
 *   2. 复制 node.exe → dist/wisteria-hall.exe
 *   3. postject 注入 blob 到 wisteria-hall.exe
 *   4. （可选）signtool 删除签名以避免 Windows 拒绝运行修改后的 exe
 *
 * 输出：dist/wisteria-hall.exe（约 90MB，含 Node runtime）
 *
 * 接收者使用：
 *   把 wisteria-hall.exe 和游戏资源（index.html、css/、script/、img/、audio/、lang/）放同目录
 *   双击 wisteria-hall.exe，自动启动 server + 打开浏览器
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const OUT_EXE = path.join(DIST, 'wisteria-hall.exe');
const BLOB = path.join(DIST, 'sea-prep.blob');
const SEA_CONFIG = path.join(ROOT, 'sea-config.json');
const TMP_DIR = path.join(DIST, '.build-tmp');
const TMP_LAUNCHER = path.join(TMP_DIR, 'static-server.cjs');
const TMP_SEA_CONFIG = path.join(TMP_DIR, 'sea-config.json');

// 从 package.json 读版本；写入 launcher 占位符 + dist/version.txt
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = PKG.version;
// 联系方式：从 env 覆盖，用于打包时嵌入版本不匹配提示页
const CONTACT = process.env.CONTACT_INFO || '请通过原发布渠道联系作者获取补丁';

function log(msg) { console.log('[build-exe] ' + msg); }

function prepareTempLauncher() {
	log('preparing versioned launcher (v' + VERSION + ') ...');
	fs.mkdirSync(TMP_DIR, { recursive: true });
	const src = fs.readFileSync(path.join(ROOT, 'tools', 'static-server.cjs'), 'utf8');
	const patched = src
		.replace(/__LAUNCHER_VERSION__/g, VERSION)
		.replace(/__CONTACT_INFO__/g, CONTACT);
	if (patched === src) throw new Error('LAUNCHER_VERSION / CONTACT_INFO 占位符替换失败');
	fs.writeFileSync(TMP_LAUNCHER, patched, 'utf8');
	const cfg = {
		main: TMP_LAUNCHER.replace(/\\/g, '/'),
		output: BLOB.replace(/\\/g, '/'),
		disableExperimentalSEAWarning: true,
		useSnapshot: false,
		useCodeCache: false
	};
	fs.writeFileSync(TMP_SEA_CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
}

function writeVersionFile() {
	const vp = path.join(DIST, 'version.txt');
	fs.writeFileSync(vp, VERSION + '\n', 'utf8');
	log('wrote ' + vp + ' = ' + VERSION);
}

function step1_genBlob() {
	log('step 1: generating SEA blob...');
	fs.mkdirSync(DIST, { recursive: true });
	if (fs.existsSync(BLOB)) fs.unlinkSync(BLOB);
	execSync(`node --experimental-sea-config "${TMP_SEA_CONFIG}"`, { stdio: 'inherit' });
	if (!fs.existsSync(BLOB)) throw new Error('blob not produced');
	log('  → ' + BLOB + ' (' + fs.statSync(BLOB).size + ' bytes)');
}

function step2_copyNode() {
	log('step 2: copying node.exe → wisteria-hall.exe...');
	const nodePath = process.execPath;
	fs.copyFileSync(nodePath, OUT_EXE);
	log('  → ' + OUT_EXE + ' (' + fs.statSync(OUT_EXE).size + ' bytes)');
}

function step3_injectBlob() {
	log('step 3: injecting blob via postject...');
	const postject = path.join(ROOT, 'node_modules', 'postject', 'dist', 'cli.js');
	if (!fs.existsSync(postject)) throw new Error('postject not found - run: node tools/install-no-npm.cjs postject@^1');
	const args = [
		postject,
		OUT_EXE,
		'NODE_SEA_BLOB',
		BLOB,
		'--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
	];
	const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
	if (r.status !== 0) throw new Error('postject failed (exit ' + r.status + ')');
	log('  → blob injected');
}

function main() {
	log('building Single Executable Application...');
	log('  Node version: ' + process.version);
	log('  Platform: ' + process.platform + ' ' + process.arch);
	log('  Package version: ' + VERSION);

	prepareTempLauncher();
	writeVersionFile();
	step1_genBlob();
	step2_copyNode();
	step3_injectBlob();

	// 清理临时目录
	try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch (e) { /* ignore */ }

	log('');
	log('=== BUILD SUCCESS ===');
	log('output: ' + OUT_EXE);
	log('version: ' + VERSION + '  (written to dist/version.txt)');
	log('');
	log('distribution: zip up the exe + the game folder contents:');
	log('  wisteria-hall.exe');
	log('  version.txt');
	log('  index.html');
	log('  css/  script/  img/  audio/  lang/  lib/');
	log('');
	log('test: cd dist && wisteria-hall.exe (game folder must be alongside)');
}

main();
