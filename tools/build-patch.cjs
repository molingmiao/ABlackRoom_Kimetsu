#!/usr/bin/env node
/**
 * build-patch.cjs - 生成增量补丁包
 *
 * 输出：dist/wisteria-hall-patch-YYYY-MM-DD.zip
 *   内含：
 *     updater.cmd    双击入口
 *     updater.ps1    主逻辑（检查进程 / 询问 / 解压 / 询问启动）
 *     patch.zip      变动文件（保持相对路径）
 *     README.txt     使用说明
 *
 * 用户流程：
 *   1. 下载补丁 zip
 *   2. 解压到任意位置
 *   3. 把解压出来的 3~4 个文件复制到 wisteria-hall.exe 所在目录
 *   4. 双击 updater.cmd
 *   5. 按提示操作
 *
 * 修改 CHANGED 数组即可增删补丁文件。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

// 读版本号
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = PKG.version;

// ==== 本次补丁的变动文件（相对 ROOT） ====
// 注意：'version.txt' 由本脚本临时生成到 dist/version.txt，然后作为特殊补丁项加入
const CHANGED = [
	'script/notifications.js',
	'script/outside.js',
	'script/path.js',
	'script/events.js',
	'script/events/room.js',
	'script/world.js',
	'css/main.css',
	'css/dark.css',
	'css/outside.css',
	'css/path.css',
	'lang/zh_cn/strings.js',
	'CHANGELOG.md'
];

const DATE = new Date().toISOString().slice(0, 10);
const PATCH_STAGING = path.join(DIST, 'patch-staging');
const RELEASE_STAGING = path.join(DIST, 'patch-release');
const OUT_ZIP = path.join(DIST, `wisteria-hall-patch-v${VERSION}-${DATE}.zip`);

const UPDATER_CMD = `@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0updater.ps1"
`;

const UPDATER_PS1 = `$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  紫藤庄园 - 补丁更新程序 (v${VERSION}, ${DATE})" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 定位游戏 exe
$exePath = Join-Path $dir 'wisteria-hall.exe'
if (-not (Test-Path $exePath)) {
    Write-Host "[错误] 当前目录未找到 wisteria-hall.exe" -ForegroundColor Red
    Write-Host "请将补丁的 updater.cmd / updater.ps1 / patch.zip 复制到游戏文件夹后再运行。"
    Read-Host "按回车退出"
    exit 1
}

# 检查游戏进程
$proc = Get-Process -Name 'wisteria-hall' -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "[!] 检测到游戏正在运行 (wisteria-hall.exe)" -ForegroundColor Yellow
    $ans = Read-Host "是否关闭游戏进程以继续更新？(Y/N)"
    if ($ans -notmatch '^[yY]') {
        Write-Host "已取消更新。请先手动关闭游戏后再运行本程序。"
        Read-Host "按回车退出"
        exit 0
    }
    Write-Host "正在关闭游戏进程..."
    try {
        $proc | Stop-Process -Force
        Start-Sleep -Seconds 1
    } catch {
        Write-Host "[X] 关闭进程失败：$($_.Exception.Message)" -ForegroundColor Red
        Read-Host "按回车退出"
        exit 1
    }
}

# 也顺带清一下可能残留的 node 服务器（launcher 派生的）
Get-Process -Name 'node' -ErrorAction SilentlyContinue | Where-Object {
    try { $_.Path -and (Split-Path $_.Path -Parent) -eq $dir } catch { $false }
} | ForEach-Object {
    Write-Host "关闭残留服务器进程 pid=$($_.Id) ..."
    try { $_ | Stop-Process -Force } catch {}
}

# 解压补丁
$patchZip = Join-Path $dir 'patch.zip'
if (-not (Test-Path $patchZip)) {
    Write-Host "[错误] 找不到 patch.zip" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

Write-Host ""
Write-Host "正在解压补丁到游戏目录..."
try {
    Expand-Archive -Path $patchZip -DestinationPath $dir -Force
} catch {
    Write-Host "[X] 解压失败：$($_.Exception.Message)" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  [OK] 更新完成" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

$launch = Read-Host "是否立即启动游戏？(Y/N)"
if ($launch -match '^[yY]') {
    Write-Host "启动 wisteria-hall.exe ..."
    Start-Process -FilePath $exePath -WorkingDirectory $dir
} else {
    Write-Host "已完成更新，可稍后手动双击 wisteria-hall.exe 启动。"
}

Write-Host ""
Read-Host "按回车退出"
`;

const PATCH_README = `紫藤庄园 - 补丁更新包 (v${VERSION}, ${DATE})

使用方法：
  1. 解压本压缩包，得到 updater.cmd / updater.ps1 / patch.zip 三个文件
  2. 将它们复制到你的 wisteria-hall.exe 所在的游戏文件夹
  3. 双击 updater.cmd
  4. 按提示确认是否关闭游戏、是否重新启动

如果 PowerShell 弹出权限提示，请允许执行。
存档保存在浏览器本地 (localStorage)，覆盖游戏文件不会影响进度。

本补丁将游戏文件升级到 v${VERSION}。
如果你的启动器 wisteria-hall.exe 版本 < v${VERSION}，
即使打了补丁也会提示"启动器版本落后"，需要作者提供新的完整安装包。

变更内容详见 CHANGELOG.md（补丁应用后会写入游戏目录）。
`;

function log(msg) { console.log('[build-patch] ' + msg); }

function rimraf(p) {
	if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function stagePatchFiles() {
	log('staging changed files → ' + PATCH_STAGING);
	rimraf(PATCH_STAGING);
	fs.mkdirSync(PATCH_STAGING, { recursive: true });

	let missing = [];
	for (const rel of CHANGED) {
		const src = path.join(ROOT, rel);
		if (!fs.existsSync(src)) { missing.push(rel); continue; }
		const dst = path.join(PATCH_STAGING, rel);
		fs.mkdirSync(path.dirname(dst), { recursive: true });
		fs.copyFileSync(src, dst);
		log('  + ' + rel);
	}
	if (missing.length) {
		throw new Error('missing files: ' + missing.join(', '));
	}
	// 版本文件：从 package.json.version 生成，确保补丁应用后 version.txt 是新版本
	fs.writeFileSync(path.join(PATCH_STAGING, 'version.txt'), VERSION + '\n', 'utf8');
	log('  + version.txt (v' + VERSION + ')');
}

function zipPatch() {
	const staged = PATCH_STAGING.replace(/\\/g, '\\\\');
	const dest = path.join(RELEASE_STAGING, 'patch.zip').replace(/\\/g, '\\\\');
	log('packing patch.zip ...');
	const cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${staged}\\*' -DestinationPath '${dest}' -Force"`;
	execSync(cmd, { stdio: 'inherit' });
}

function stageRelease() {
	log('staging release files → ' + RELEASE_STAGING);
	rimraf(RELEASE_STAGING);
	fs.mkdirSync(RELEASE_STAGING, { recursive: true });
	// updater.cmd 用 UTF-8 with BOM 便于 Windows 识别
	fs.writeFileSync(path.join(RELEASE_STAGING, 'updater.cmd'), '\uFEFF' + UPDATER_CMD, 'utf8');
	fs.writeFileSync(path.join(RELEASE_STAGING, 'updater.ps1'), '\uFEFF' + UPDATER_PS1, 'utf8');
	fs.writeFileSync(path.join(RELEASE_STAGING, 'README.txt'), '\uFEFF' + PATCH_README, 'utf8');
}

function zipRelease() {
	if (fs.existsSync(OUT_ZIP)) fs.unlinkSync(OUT_ZIP);
	const src = RELEASE_STAGING.replace(/\\/g, '\\\\');
	const dst = OUT_ZIP.replace(/\\/g, '\\\\');
	log('packing release → ' + OUT_ZIP);
	const cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${src}\\*' -DestinationPath '${dst}' -Force"`;
	execSync(cmd, { stdio: 'inherit' });
}

function cleanup() {
	rimraf(PATCH_STAGING);
	rimraf(RELEASE_STAGING);
}

function main() {
	log('=== build patch package ===');
	log('version: v' + VERSION);
	log('date: ' + DATE);
	log('files: ' + CHANGED.length);
	stagePatchFiles();
	stageRelease();
	zipPatch();
	zipRelease();
	const size = fs.statSync(OUT_ZIP).size;
	log('');
	log('=== BUILD SUCCESS ===');
	log('output: ' + OUT_ZIP);
	log('size:   ' + (size / 1024).toFixed(1) + ' KB');
	cleanup();
}

main();
