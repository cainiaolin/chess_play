// Pikafish 引擎下载脚本
// 为什么单独成脚本：引擎二进制约 51MB 且不入 git（.gitignore 排除 server/engines/），
// 首次部署或换机器时需要一键获取并自检。
// 用法：cd server && node scripts/download-pikafish.mjs
import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, rmSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const ENGINES_DIR = resolve(process.cwd(), 'engines');
const TARGET_EXE = join(ENGINES_DIR, 'pikafish.exe');
// GitHub 直连失败时可用的镜像前缀（按顺序依次尝试）
const MIRROR_PREFIXES = ['', 'https://ghproxy.net/', 'https://gh-proxy.com/'];

function info(msg) { console.log(`[pikafish] ${msg}`); }
function fail(msg) { console.error(`[pikafish] 错误: ${msg}`); process.exit(1); }

async function fetchLatestAsset() {
  info('查询 Pikafish 最新版本…');
  const res = await fetch('https://api.github.com/repos/official-pikafish/Pikafish/releases/latest');
  if (!res.ok) fail(`GitHub API 请求失败: HTTP ${res.status}`);
  const release = await res.json();
  const asset = (release.assets || []).find(a => a.name.toLowerCase().endsWith('.7z'));
  if (!asset) fail(`Release ${release.tag_name} 中未找到 7z 资产`);
  info(`最新版本: ${release.tag_name}（${asset.name}, ${(asset.size / 1048576).toFixed(1)} MB）`);
  return asset.browser_download_url;
}

async function download(url, dest) {
  for (const prefix of MIRROR_PREFIXES) {
    const target = `${prefix}${url}`;
    info(`下载: ${target}`);
    try {
      const res = await fetch(target, { redirect: 'follow' });
      if (!res.ok || !res.body) { info(`  该源不可用 (HTTP ${res.status})，换下一个`); continue; }
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      return;
    } catch (err) {
      info(`  该源失败: ${err.message}，换下一个`);
    }
  }
  fail('所有下载源均失败，请检查网络后重试');
}

// 用 Windows 自带的 bsdtar（libarchive）解 7z，避免要求用户安装 7-Zip
function extract7z(archive, destDir) {
  const tar = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  if (!existsSync(tar)) fail('未找到系统 tar.exe，请安装 7-Zip 后手动解压到 server/engines/pikafish.exe');
  const result = spawnSync(tar, ['-xf', archive, '-C', destDir], { stdio: 'pipe' });
  if (result.status !== 0) {
    fail(`tar 解压失败 (exit ${result.status}): ${result.stderr}\n请安装 7-Zip 手动解压 ${archive}`);
  }
}

function findWindowsBinary(dir) {
  // Pikafish 通用包内含多平台二进制；优先无 SIMD 后缀的通用构建（运行时自动检测 CPU 特性）
  const candidates = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      const lower = name.toLowerCase();
      if (lower.endsWith('.exe') && lower.includes('windows') && lower.includes('x86-64')) {
        const plain = !/vnni|avx512|avx-512|avx2/.test(lower);
        candidates.push({ full, plain });
      }
    }
  };
  walk(dir);
  const best = candidates.find(c => c.plain) || candidates[0];
  return best?.full;
}

function findNnueFile(dir) {
  // NNUE 神经网络权重必须与 exe 同目录，缺失时引擎启动即退出
  const candidates = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (name.toLowerCase().endsWith('.nnue')) candidates.push(full);
    }
  };
  walk(dir);
  return candidates[0];
}

async function main() {
  if (existsSync(TARGET_EXE) && existsSync(join(ENGINES_DIR, 'pikafish.nnue'))) {
    info(`已存在 ${TARGET_EXE}，如需重新下载请先删除该文件`);
    return;
  }
  mkdirSync(ENGINES_DIR, { recursive: true });
  const tmpDir = join(ENGINES_DIR, '.tmp');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  const assetUrl = await fetchLatestAsset();
  const archive = join(tmpDir, 'pikafish.7z');
  await download(assetUrl, archive);

  info('解压中…');
  extract7z(archive, tmpDir);
  const binary = findWindowsBinary(tmpDir);
  if (!binary) fail('解压后未找到 Windows x86-64 二进制，请手动检查 .tmp 目录');
  const nnue = findNnueFile(tmpDir);
  if (!nnue) fail('解压后未找到 .nnue 权重文件，请手动检查 .tmp 目录');

  copyFileSync(binary, TARGET_EXE);
  copyFileSync(nnue, join(ENGINES_DIR, 'pikafish.nnue'));
  rmSync(tmpDir, { recursive: true, force: true });
  info(`已安装: ${TARGET_EXE}`);

  // 自检：UCI 握手确认可执行 + 打印 UCI_Elo 边界（难度映射的依据）
  info('自检: UCI 握手…');
  const p = spawnSync(TARGET_EXE, [], { input: 'uci\nquit\n', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
  const out = p.stdout ? p.stdout.toString() : '';
  if (!out.includes('uciok')) fail(`引擎自检失败，输出:\n${out.slice(0, 2000)}\n若被杀毒软件拦截，请将 ${TARGET_EXE} 加入白名单后重试`);
  const eloLine = out.split('\n').find(l => l.includes('UCI_Elo'));
  info(`自检通过 (uciok)${eloLine ? `，${eloLine.trim().replace(/^option name /, '')}` : ''}`);
  info('完成。人机对战"引擎"模式已可用（也可用 ENGINE_PATH 环境变量指向其它引擎二进制）');
}

main().catch(err => fail(err.stack || String(err)));
