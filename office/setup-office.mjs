#!/usr/bin/env node
// 자동화 오피스 설정: office/projects.json 의 프로젝트를 한 폴더에 clone 하고,
// 각각을 pixel-agents Directory + Area(방)로 등록한다.
//
//   node office/setup-office.mjs [--root <폴더>] [--force]
//
//   --root   프로젝트를 모아 둘 폴더 (기본: ~/agent-office)
//   --force  pixel-agents 서버가 실행 중이어도 진행 (권장하지 않음)
//
// 건드리는 파일 (처음 바꾸기 전에 *.bak-<시각> 백업):
//   ~/.pixel-agents/config.json  directories + areaMappings (vscode/standalone 둘 다)
//   ~/.pixel-agents/layout.json  areas (방 정의만 추가. 어떤 타일이 방인지는 Layout 편집기에서 칠한다)
// 여러 번 실행해도 같은 결과가 된다. 이미 clone 된 폴더는 건드리지 않는다.

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const expandHome = (p) => (p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p);

const root = path.resolve(expandHome(argValue('--root') ?? path.join(os.homedir(), 'agent-office')));
const force = args.includes('--force');
const paDir = path.join(os.homedir(), '.pixel-agents');
const configPath = path.join(paDir, 'config.json');
const layoutPath = path.join(paDir, 'layout.json');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

const { projects } = JSON.parse(fs.readFileSync(path.join(here, 'projects.json'), 'utf-8'));

function serverRunning() {
  try {
    const { pid } = JSON.parse(fs.readFileSync(path.join(paDir, 'server.json'), 'utf-8'));
    if (typeof pid !== 'number') return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error(`✗ ${file} 을(를) 읽을 수 없습니다 (${err.message}). 손대지 않고 중단합니다.`);
    process.exit(1);
  }
}

function writeJson(file, data) {
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak-${stamp}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

// ── 0. 서버가 돌고 있으면 우리 변경을 덮어쓸 수 있으니 멈춘 뒤 실행 ──
if (serverRunning() && !force) {
  console.error(
    '✗ pixel-agents 서버가 실행 중입니다 (VS Code 패널 또는 npx pixel-agents).\n' +
      '  닫은 뒤 다시 실행하세요. 그대로 진행하려면 --force.',
  );
  process.exit(1);
}

// ── 1. 프로젝트 clone ──
fs.mkdirSync(root, { recursive: true });
const ready = [];
for (const p of projects) {
  const dir = path.join(root, p.folder);
  if (fs.existsSync(dir)) {
    console.log(`• ${p.name}: ${dir} (이미 있음)`);
    ready.push({ ...p, dir });
    continue;
  }
  try {
    execFileSync('git', ['clone', `https://github.com/${p.repo}.git`, dir], { stdio: 'inherit' });
    console.log(`✓ ${p.name}: ${dir} (clone)`);
    ready.push({ ...p, dir });
  } catch {
    console.error(`✗ ${p.name}: ${p.repo} clone 실패 — 저장소 존재/접근 권한을 확인하세요. 이 프로젝트는 건너뜁니다.`);
  }
}

// ── 2. config.json: Directory + Area 매핑 ──
const config = readJson(configPath, {});
const configBefore = JSON.stringify(config);
const sameDir = (a, b) =>
  process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b);
config.directories = Array.isArray(config.directories) ? config.directories : [];
for (const p of ready) {
  config.directories = config.directories.filter((d) => d.name !== p.name && !sameDir(d.path, p.dir));
  config.directories.push({ name: p.name, path: p.dir });
}
for (const ns of ['vscode', 'standalone']) {
  config[ns] = config[ns] && typeof config[ns] === 'object' ? config[ns] : {};
  const mappings = config[ns].areaMappings && typeof config[ns].areaMappings === 'object' ? config[ns].areaMappings : {};
  for (const p of ready) mappings[p.name] = [p.area];
  config[ns].areaMappings = mappings;
  config[ns].showAreas = true;
}
if (JSON.stringify(config) !== configBefore) {
  writeJson(configPath, config);
  console.log(`✓ ${configPath}: Directory ${ready.length}개 + Area 매핑 등록`);
} else {
  console.log(`• ${configPath}: 이미 최신`);
}

// ── 3. layout.json: 방(Area) 정의 ──
const layout = readJson(layoutPath, null);
if (!layout) {
  console.log(
    `! ${layoutPath} 이(가) 아직 없습니다. 오피스를 한 번 열어 레이아웃을 저장한 뒤 이 스크립트를 다시 실행하면 방이 추가됩니다.`,
  );
} else {
  layout.areas = Array.isArray(layout.areas) ? layout.areas : [];
  let added = 0;
  for (const p of ready) {
    if (!layout.areas.some((a) => a.label === p.area)) {
      layout.areas.push({ label: p.area, color: p.color });
      added++;
    }
  }
  if (added > 0) {
    writeJson(layoutPath, layout);
    console.log(`✓ ${layoutPath}: 방 ${added}개 추가`);
  } else {
    console.log(`• ${layoutPath}: 방이 이미 모두 있음`);
  }
}

console.log(`
다음 단계:
  1. pixel-agents 를 연다 (VS Code 패널 또는 npx pixel-agents).
  2. Layout → Area 도구에서 방마다 책상·의자가 있는 구역을 칠하고 Save.
     (${ready.map((p) => p.area).join(', ')})
  3. + (launch) 에서 Directory 를 골라 에이전트를 실행하면 그 방의 자리에 앉는다.
`);
