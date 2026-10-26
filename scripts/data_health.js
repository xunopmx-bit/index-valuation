/**
 * data_health.js —— 每日估值快照数据体检（入库前预检）
 *
 * 背景：蛋卷/中证源偶发单日坏数据（如 10-20 50AH优选 PE/PB/EP/ROE/股息率/百分位
 *       多字段同日大幅跳变且数值自洽），同源恒等式（ep≈1/pe、roe≈pb/pe）无法发现。
 *       唯一可靠探针是与前一交易日快照的跨日跳变：正常日间变动远小于阈值，
 *       单日源故障必然表现为多字段同时大幅跳变。
 *
 * 用法：
 *   node scripts/data_health.js                              体检最新快照 vs 前一快照
 *   node scripts/data_health.js 2026-10-20.json              体检指定快照（自动取目录内前一日）
 *   node scripts/data_health.js <cur.json> --prev <prev.json>   显式指定前一日快照
 *
 * 检查项（对两日共有 index_code 逐一）：
 *   跨日跳变（报警）：|peΔ|>15%、|pbΔ|>10%、|epΔ|/|roeΔ|/|yieldΔ|>20%（相对变化）、
 *                     |percentileΔ|>0.12（绝对变化）
 *   域检查（报警）：pe≤0 且前日 pe>0（PE 一日内正转零几乎必为坏数据；
 *                   长期亏损指数 pe=0 为稳定状态）
 *   稳定状态（提示，不计报警）：percentile<0.02 或 >0.98、pe≤0 但前日亦然——
 *                   历史极值/长期亏损是跨日稳定的正常特征，突变已由跳变检查覆盖
 *
 * 退出码：0 = 通过；1 = 报警；2 = 输入错误。
 */

const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '..', 'site', 'data', 'history');
// 阈值：pe 15% / pb 10% / ep·roe·yield 20%（相对），percentile 0.12（绝对）
const TH = { pe: 0.15, pb: 0.10, ratio: 0.20, pct: 0.12 };

const REL_FIELDS = [
  ['pe', TH.pe, 'PE'],
  ['pb', TH.pb, 'PB'],
  ['ep', TH.ratio, 'EP'],
  ['roe', TH.ratio, 'ROE'],
  ['yield', TH.ratio, '股息率'],
];

function listHistory(dir) {
  return fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
}

function resolveInput(file) {
  if (fs.existsSync(file)) return path.resolve(file);
  const inHistory = path.join(HISTORY_DIR, file);
  if (fs.existsSync(inHistory)) return inHistory;
  console.error(`找不到 ${file}`);
  process.exit(2);
}

function loadJson(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(j.indexes)) throw new Error(`${file}: 缺少 indexes 数组`);
  return j;
}

function main() {
  const argv = process.argv.slice(2);
  let curFile = null, prevFile = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--prev') prevFile = argv[++i];
    else if (curFile) { console.error('多余的位置参数：' + argv[i]); process.exit(2); }
    else curFile = argv[i];
  }

  if (!curFile) {
    const files = listHistory(HISTORY_DIR);
    if (files.length < 2) { console.error('history 目录快照不足 2 个，无法跨日比对。'); process.exit(2); }
    curFile = path.join(HISTORY_DIR, files[files.length - 1]);
    prevFile = path.join(HISTORY_DIR, files[files.length - 2]);
  } else {
    curFile = resolveInput(curFile);
    if (!prevFile) {
      const dir = path.dirname(curFile);
      const files = listHistory(dir);
      const idx = files.indexOf(path.basename(curFile));
      if (idx < 0) { console.error(`${path.basename(curFile)} 不在 ${dir} 快照序列中（需 YYYY-MM-DD.json 命名）`); process.exit(2); }
      if (idx === 0) { console.error(`${path.basename(curFile)} 是目录内最早快照，无前一日可比（可用 --prev 显式指定）。`); process.exit(2); }
      prevFile = path.join(dir, files[idx - 1]);
    } else {
      prevFile = resolveInput(prevFile);
    }
  }

  const cur = loadJson(curFile);
  const prev = loadJson(prevFile);
  console.log(`数据体检：${path.basename(curFile)}（dataDate ${cur.dataDate || '?'}） vs ${path.basename(prevFile)}（dataDate ${prev.dataDate || '?'}）`);

  const curMap = new Map(cur.indexes.map((x) => [x.index_code, x]));
  const prevMap = new Map(prev.indexes.map((x) => [x.index_code, x]));
  const warns = [], notes = [];
  let compared = 0, skipped = 0;

  for (const [code, c] of curMap) {
    const p = prevMap.get(code);
    if (!p) { console.log(`  [新增] ${c.name}(${code}) 前日无记录，跳过跨日比对`); skipped++; continue; }
    compared++;
    for (const [f, th, label] of REL_FIELDS) {
      const a = c[f], b = p[f];
      if (a == null || b == null || b === 0) continue;
      const d = (a - b) / Math.abs(b);
      if (Math.abs(d) > th) {
        warns.push(`[跳变] ${c.name}(${code}) ${label} ${b} → ${a}（${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}%，阈值 ${(th * 100).toFixed(0)}%）`);
      }
    }
    if (c.percentile != null && p.percentile != null) {
      const d = c.percentile - p.percentile;
      if (Math.abs(d) > TH.pct) {
        warns.push(`[跳变] ${c.name}(${code}) 百分位 ${p.percentile} → ${c.percentile}（${d > 0 ? '+' : ''}${d.toFixed(2)}，阈值 ${TH.pct}）`);
      }
    }
    if (c.pe != null && c.pe <= 0) {
      const msg = `[域错] ${c.name}(${code}) pe=${c.pe} ≤ 0（前日 pe=${p.pe}）`;
      if (p.pe != null && p.pe > 0) warns.push(msg);
      else notes.push(`  [提示·稳定] ${c.name}(${code}) pe=${c.pe}（前日亦 ≤0，长期亏损状态）`);
    }
    if (c.percentile != null && (c.percentile < 0.02 || c.percentile > 0.98)) {
      notes.push(`  [提示·极值] ${c.name}(${code}) percentile=${c.percentile}（历史极端水平，突变由跳变检查覆盖）`);
    }
  }
  for (const [code, p] of prevMap) {
    if (!curMap.has(code)) { console.log(`  [缺失] ${p.name}(${code}) 今日无记录`); skipped++; }
  }

  for (const n of notes) console.log(n);
  for (const w of warns) console.error('  ' + w);
  console.log(`跨日比对 ${compared} 码，单侧缺失/新增 ${skipped} 码，提示 ${notes.length} 条，报警 ${warns.length} 条`);
  if (warns.length) {
    console.error('数据体检未通过：请人工复核上述报警并核对源站，勿直接入库。');
    process.exit(1);
  }
  console.log('数据体检通过。');
}

main();
