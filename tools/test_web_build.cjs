// Dependency-free publication regression. Fixtures stay in a disposable temp directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const roots = ['index.html', 'favicon.ico', 'browserWarning.html', 'mobileWarning.html', 'LICENSE.md', 'CHANGELOG.md'];
const directories = ['css', 'script', 'img', 'audio', 'lang', 'lib'];
const extensions = new Set(['.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.flac', '.mp3', '.ogg', '.wav', '.woff', '.woff2', '.ttf', '.otf', '.eot']);

function filesIn(dir, prefix = '') {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    assert.ok(!entry.isSymbolicLink(), 'No redirected published asset: ' + relative);
    if (entry.isDirectory()) result.push(...filesIn(path.join(dir, entry.name), relative + '/'));
    else result.push(relative);
  }
  return result;
}

function checkPublication(dist) {
  const files = filesIn(dist);
  for (const file of files) {
    assert.ok(!file.split('/').some(part => part.startsWith('.') || ['node_modules', 'tools'].includes(part)),
      'No hidden, dependency, or tool files: ' + file);
    assert.ok(roots.includes(file) || (directories.includes(file.split('/')[0]) && extensions.has(path.extname(file).toLowerCase())),
      'Only browser assets are published: ' + file);
  }
  for (const file of roots) assert.ok(fs.existsSync(path.join(dist, file)), 'Required root asset: ' + file);
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  assert.ok(!/<script\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\//i.test(html),
    'Required scripts must load from the same site, without an external CDN');
  // Ignore inline code constructing language-dependent URLs; validate actual static tags.
  const staticHtml = html.replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, '');
  for (const match of staticHtml.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const asset = match[1].split(/[?#]/)[0];
    if (!asset || /^(?:https?:)?\/\//.test(asset)) continue;
    assert.ok(fs.existsSync(path.join(dist, asset)), 'Referenced page asset: ' + asset);
  }
  assert.ok(fs.existsSync(path.join(dist, 'lib/jquery.min.js')), 'jQuery works without an external CDN');
  assert.ok(fs.existsSync(path.join(dist, 'lang/langs.js')), 'Language registry is present');
  for (const language of fs.readdirSync(path.join(repo, 'lang'), { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    for (const file of filesIn(path.join(repo, 'lang', language.name)).filter(file => /\.(?:js|css)$/.test(file))) {
      assert.ok(fs.existsSync(path.join(dist, 'lang', language.name, file)), 'Dynamic language asset: ' + language.name + '/' + file);
    }
  }
  const audio = fs.readFileSync(path.join(dist, 'script/audioLibrary.js'), 'utf8');
  for (const match of audio.matchAll(/["'](audio\/[^"']+)["']/g)) {
    assert.ok(fs.existsSync(path.join(dist, match[1])), 'Referenced audio: ' + match[1]);
  }
  const engine = fs.readFileSync(path.join(dist, 'script/engine.js'), 'utf8');
  assert.ok(engine.includes('[stripped: tester]'), 'Developer tester blocks were stripped');
  assert.ok(!engine.includes(".attr('id', 'testerPanel')"), 'Tester UI is absent');
  assert.ok(!engine.includes("if($SM.get('config.testerMode', true))"), 'Saved tester mode cannot enable itself');
  for (const file of files.filter(file => /\.(?:js|css|html)$/.test(file))) {
    assert.ok(!/\/\*\s*@strip:[a-zA-Z0-9_-]+-start/.test(fs.readFileSync(path.join(dist, file), 'utf8')),
      'No unstripped development blocks: ' + file);
  }
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'kimetsu-web-build-'));
const fixtureRepo = path.join(fixture, 'repo');
const fixtureDist = path.join(fixtureRepo, 'dist');
const outside = path.join(fixture, 'outside');
function runBuild(cwd = fixtureRepo, web = true) {
  return spawnSync(process.execPath, [path.join(fixtureRepo, 'tools/sync-dist.cjs'), ...(web ? ['--web'] : [])],
    { cwd, encoding: 'utf8' });
}
function writeFixture(relative, value = 'not a web asset') {
  const target = path.join(fixtureRepo, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}

try {
  fs.mkdirSync(fixtureRepo);
  for (const file of roots) fs.copyFileSync(path.join(repo, file), path.join(fixtureRepo, file));
  for (const directory of directories) fs.cpSync(path.join(repo, directory), path.join(fixtureRepo, directory), { recursive: true });
  fs.mkdirSync(path.join(fixtureRepo, 'tools'));
  fs.copyFileSync(path.join(repo, 'tools/sync-dist.cjs'), path.join(fixtureRepo, 'tools/sync-dist.cjs'));
  for (const file of ['dist/wisteria-hall.exe', 'dist/archive.zip', 'dist/sea-prep.blob', 'dist/version.txt',
    'dist/old-script.js', '.env', '.git/config', 'node_modules/private/index.js', 'script/installer.exe',
    'script/nested/archive.zip', 'script/.env', 'script/node_modules/private.js']) writeFixture(file);
  let result = runBuild(fixtureRepo, false);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(fixtureDist, 'wisteria-hall.exe')), 'Default local sync preserves the launcher');
  assert.ok(fs.existsSync(path.join(fixtureDist, 'version.txt')), 'Default local sync preserves launcher version');
  result = runBuild();
  assert.equal(result.status, 0, result.stderr);
  checkPublication(fixtureDist);
  assert.ok(!fs.existsSync(path.join(fixtureDist, 'old-script.js')), 'Web builds remove stale output');

  fs.mkdirSync(path.join(outside, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(outside, 'dist', 'keep.txt'), 'must not be deleted');
  result = runBuild(outside);
  assert.notEqual(result.status, 0, 'Wrong working directory is refused');
  assert.equal(fs.readFileSync(path.join(outside, 'dist', 'keep.txt'), 'utf8'), 'must not be deleted');

  // Directory junctions can be created without elevated permissions on Windows.
  fs.rmSync(fixtureDist, { recursive: true, force: true });
  fs.symlinkSync(outside, fixtureDist, process.platform === 'win32' ? 'junction' : 'dir');
  result = runBuild();
  assert.notEqual(result.status, 0, 'Redirected output is refused before cleanup');
  assert.equal(fs.readFileSync(path.join(outside, 'dist', 'keep.txt'), 'utf8'), 'must not be deleted');
  fs.unlinkSync(fixtureDist);
  fs.symlinkSync(outside, path.join(fixtureRepo, 'script', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  result = runBuild();
  assert.notEqual(result.status, 0, 'Redirected source assets cannot publish outside content');
  assert.match(result.stderr, /symbolic links/);

  if (fs.existsSync(path.join(repo, 'dist'))) checkPublication(path.join(repo, 'dist'));
  console.log('PASS web publication: asset completeness, tester stripping, clean allowlist, local package preservation, and path escape protection');
} finally {
  // This exact disposable path was allocated above; never remove the repository or an inferred root.
  assert.equal(path.dirname(fixture), os.tmpdir());
  assert.ok(path.basename(fixture).startsWith('kimetsu-web-build-'));
  fs.rmSync(fixture, { recursive: true, force: true });
}
