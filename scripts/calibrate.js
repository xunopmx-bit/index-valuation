/**
 * calibrate.js —— 螺丝钉估值表校准一键流水线（verify → apply → 双写）
 *
 * 用法：
 *   node scripts/calibrate.js <table.json> <snapshot.json>                 校验（只读）
 *   node scripts/calibrate.js <table.json> <snapshot.json> --apply         校验 + 重算预演（不写盘）
 *   node scripts/calibrate.js <table.json> <snapshot.json> --apply --write 校验 + 重算 + 双写快照与 valuations
 *   node scripts/calibrate.js --val-only                                   仅向 valuations.json 重算并注入校准块（直接写）
 *
 * 选项：
 *   --date YYYY-MM-DD  校验 calibration.history 最新日期（不一致则 exit 1）
 *   --out <file>       报告落盘
 *
 * 表 JSON 格式（螺丝钉估值表人工整理）：
 *   { "rows": [ { "name": "沪深300", "pe": 12.88, "pb": 1.38, "ep": null, "ps": null, "color": "绿色" }, ... ] }
 *   - name 为表行名，须与 calibration_map.js 的值一致（否则走快照名精确匹配兜底）；
 *   - color 中英文均可（绿/绿色/green 等）；ep/ps 可选。
 *
 * 口径对齐 fetch.js（勿两处漂移）：
 *   - 因子应用（fetch.js 因子段）：screwPe/screwPb = raw × 因子（Number(x.toFixed(4))）；
 *     cal.color 同时覆盖 screwColor 与 color；peFactor 为空且条目本有键时置 null（不新增键）；
 *   - 星级：calculateItemStar（fetch.js）逐分支等价内联为 starOf，epDiscount 取逐指数配置；
 *   - PB 组平均含市销率行（系统 pb 字段存市销率，用 devPs 口径）；devEp = 表EP × screwPe − 1，
 *     即 表EP ÷ (1/screwPe) − 1，仅作次级诊断。
 */

const fs = require('fs');
const path = require('path');

const cal = require('./calibration.js');
const MAP = require('./calibration_map.js');
const config = require('./config.js');

const VAL_FILE = path.resolve(__dirname, '..', 'site', 'data', 'valuations.json');
const OVERSEAS = new Set(['HKHSI', 'HKHSCEI', 'NDX', 'SP500', 'SPHCMSHP', 'HKHSTECH', 'CSIH30533']);
const STAR_FIELDS = ['screwPe', 'screwPb', 'screwColor', 'color', 'star'];

// 逐指数 epDiscount（现仅 HKHSI / HKHSCEI = 0.9），星级 EP 分支使用
const EP_DISCOUNT = {};
for (const it of config.indexes) {
  if (it.epDiscount != null) EP_DISCOUNT[it.index_code] = it.epDiscount;
}

// ---------- 工具 ----------

function normColor(c) {
  if (c == null) return null;
  const s = String(c).toLowerCase();
  if (s.includes('绿')) return 'green';
  if (s.includes('黄')) return 'yellow';
  if (s.includes('红')) return 'red';
  return s === 'green' || s === 'yellow' || s === 'red' ? s : null;
}

function median(arr) {
  const a = arr.filter((x) => x != null && Number.isFinite(x)).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function avg(arr) {
  const a = arr.filter((x) => x != null && Number.isFinite(x));
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
}

function fmtPct(x) {
  return x == null ? '—' : (x >= 0 ? '+' : '') + (x * 100).toFixed(2) + '%';
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error('读取 ' + file + ' 失败：' + e.message);
  }
}

// 写盘：保持 2 空格缩进；原文件有尾换行则保留
function writeJson(file, obj) {
  let raw = '';
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (_) {
    /* 新文件，无尾换行参照 */
  }
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
}

// calculateItemStar 等价内联（口径：fetch.js 星级函数）；color 优先取 screwColor（因子归属色）
function starOf(it, epDiscount) {
  const color = it.screwColor || it.color;
  if (color === 'gray' || (!it.pe && !it.screwPe && it.percentile == null)) return null;

  const effPe = it.screwPe || it.pe;
  let ep = null;
  if (it.method === 'EP' && effPe) {
    ep = 1 / effPe;
    if (epDiscount) ep *= epDiscount;
  } else if (it.epAdj != null) {
    ep = it.epAdj;
  }

  const p = it.percentile != null ? it.percentile : 0.5;

  if (color === 'green') {
    if (it.method === 'EP' && ep != null) {
      if (ep >= 0.11) return 5; // 极度低估
      if (ep >= 0.104) return 4.5; // 深度低估
      return 4; // 标准低估
    } else {
      if (p <= 0.1) return 5;
      if (p <= 0.2) return 4.5;
      return 4;
    }
  } else if (color === 'yellow') {
    if (it.method === 'EP' && ep != null) {
      if (ep >= 0.085) return 3.5; // 正常偏低
      if (ep >= 0.07) return 3; // 正常中枢
      return 2.5; // 正常偏高
    } else {
      if (p <= 0.4) return 3.5;
      if (p <= 0.65) return 3;
      return 2.5;
    }
  } else if (color === 'red') {
    if (effPe >= 70 || p >= 0.95) return 1; // 极度泡沫
    if (effPe >= 35 || p >= 0.88) return 1.5; // 深度高估
    return 2; // 偏高风险
  }

  return 3;
}

// ---------- 核心动作 ----------

// 因子重算（口径：fetch.js 因子应用段）：直接改写条目并输出变更 diff
function recompute(list, label, say) {
  let touched = 0;
  let changed = 0;
  for (const it of list) {
    const f = cal.factors[it.index_code];
    if (!f) continue;
    touched++;
    const before = {};
    for (const k of STAR_FIELDS) before[k] = it[k];

    if (f.peFactor && it.pe) it.screwPe = Number((it.pe * f.peFactor).toFixed(4));
    else if (Object.prototype.hasOwnProperty.call(it, 'screwPe')) it.screwPe = null;
    if (f.pbFactor && it.pb) it.screwPb = Number((it.pb * f.pbFactor).toFixed(4));
    else if (Object.prototype.hasOwnProperty.call(it, 'screwPb')) it.screwPb = null;
    if (f.color) {
      it.screwColor = f.color;
      it.color = f.color;
    }
    it.star = starOf(it, EP_DISCOUNT[it.index_code]);

    const diffs = [];
    for (const k of STAR_FIELDS) {
      if (before[k] !== it[k]) diffs.push(k + ' ' + JSON.stringify(before[k]) + ' → ' + JSON.stringify(it[k]));
    }
    if (diffs.length) {
      changed++;
      say('  ' + it.index_code + ' ' + it.name + ': ' + diffs.join('；'));
    }
  }
  say(label + '：重算 ' + touched + ' 条，变更 ' + changed + ' 条');
  return { touched, changed };
}

function buildCalBlock(nowIso) {
  return {
    history: cal.history,
    updatedAt: nowIso,
    factorCount: Object.keys(cal.factors).length,
    latestNote: cal.history[cal.history.length - 1].note,
  };
}

// valuations 注入：逐键赋值（保留块内其余键），并清理 cron 归档残留的 2 键形态（note）
function injectValuations(val, nowIso) {
  const block = val.calibration || (val.calibration = {});
  const b = buildCalBlock(nowIso);
  block.history = b.history;
  block.updatedAt = b.updatedAt;
  block.factorCount = b.factorCount;
  block.latestNote = b.latestNote;
  delete block.note;
}

// 校验（只读）：行匹配、偏差、分组、异常、持仓、缺行、未映射推荐、星级自检
function verify(tableFile, snapFile, table, snap, say) {
  const rows = table.rows || [];
  const items = snap.indexes || [];
  const byCode = new Map(items.map((it) => [it.index_code, it]));

  // 行名 → 代码：映射表优先，快照名精确匹配兜底
  const revMap = {};
  for (const [code, name] of Object.entries(MAP)) revMap[name] = code;

  const results = [];
  const unmapped = [];
  const used = new Set();

  for (const row of rows) {
    let code = revMap[row.name];
    let it = code ? byCode.get(code) : null;
    if (!it) {
      it = items.find((x) => x.name === row.name && cal.factors[x.index_code]);
      code = it ? it.index_code : null;
    }
    if (!code || !cal.factors[code]) {
      unmapped.push(row);
      continue;
    }
    used.add(code);
    const f = cal.factors[code];
    const tPe = row.pe != null ? row.pe : row.ep ? 1 / row.ep : null;
    const screwPe = f.peFactor && it.pe != null ? Number((it.pe * f.peFactor).toFixed(4)) : null;
    const screwPb = f.pbFactor && it.pb != null ? Number((it.pb * f.pbFactor).toFixed(4)) : null;
    const devP = tPe != null && screwPe ? tPe / screwPe - 1 : null;
    const devPb = row.pb != null && screwPb ? row.pb / screwPb - 1 : null;
    const devPs = row.ps != null && screwPb ? row.ps / screwPb - 1 : null;
    const devEp = row.ep != null && screwPe ? row.ep * screwPe - 1 : null;
    const colorDiff = normColor(row.color) !== it.screwColor;
    results.push({ row, code, it, devP, devPb, devPs, devEp, pbDev: devPs != null ? devPs : devPb, colorDiff });
  }

  say('════ 校准校验 ════');
  say('表 ' + tableFile + '（' + rows.length + ' 行） · 快照 ' + snapFile + '（' + items.length + ' 条）');
  say('匹配 ' + results.length + ' 行 / 未匹配 ' + unmapped.length + ' 行 / 表中缺行 ' + (Object.keys(cal.factors).length - used.size) + ' 条');

  say('── 行明细 ──');
  for (const r of results) {
    const parts = ['devP ' + fmtPct(r.devP), 'devPb ' + fmtPct(r.devPb)];
    if (r.devPs != null) parts.push('devPs ' + fmtPct(r.devPs));
    if (r.devEp != null) parts.push('devEp ' + fmtPct(r.devEp));
    parts.push(r.colorDiff ? '色差! 表=' + normColor(r.row.color) + ' 系统=' + r.it.screwColor : '色 ✓');
    say('  ' + r.row.name + ' ' + r.code + '（现值 pe=' + r.it.pe + ' pb=' + r.it.pb + '）  ' + parts.join('  '));
  }

  const missing = Object.keys(cal.factors).filter((c) => !used.has(c));
  if (missing.length) {
    say('── 表中缺行（' + missing.length + ' 条）──');
    say('  ' + missing.join('、'));
  }

  say('── 拟合分组（avg 偏差，PB 组含市销率口径）──');
  for (const [label, key] of [
    ['PE', 'devP'],
    ['PB', 'pbDev'],
  ]) {
    for (const [gname, pred] of [
      ['纯A', (r) => !OVERSEAS.has(r.code)],
      ['港美', (r) => OVERSEAS.has(r.code)],
    ]) {
      const g = avg(results.filter(pred).map((r) => r[key]));
      say('  ' + label + ' ' + gname + ': avg ' + fmtPct(g) + '（' + results.filter(pred).filter((r) => r[key] != null).length + ' 条）');
    }
  }

  say('── 异常（|偏差| ≥ 5%）──');
  const peFlags = results.filter((r) => r.devP != null && Math.abs(r.devP) >= 0.05);
  const pbFlags = results.filter((r) => r.devPb != null && Math.abs(r.devPb) >= 0.05); // 市销率行 devPb 为空，天然排除
  const psFlags = results.filter((r) => r.devPs != null && Math.abs(r.devPs) >= 0.05);
  if (!peFlags.length && !pbFlags.length && !psFlags.length) say('  （无）');
  if (peFlags.length) say('  PE: ' + peFlags.map((r) => r.row.name + ' ' + r.code + ' ' + fmtPct(r.devP)).join('；'));
  if (pbFlags.length) say('  PB: ' + pbFlags.map((r) => r.row.name + ' ' + r.code + ' ' + fmtPct(r.devPb)).join('；'));
  if (psFlags.length) say('  市销率: ' + psFlags.map((r) => r.row.name + ' ' + r.code + ' ' + fmtPct(r.devPs)).join('；'));

  const colorDiffs = results.filter((r) => r.colorDiff);
  if (colorDiffs.length) {
    say('── 色差（表色 vs 因子归属色）──');
    for (const r of colorDiffs) say('  ' + r.row.name + ' ' + r.code + ': 表=' + normColor(r.row.color) + ' 系统=' + r.it.screwColor);
  } else {
    say('── 色差：无 ──');
  }

  // 持仓诊断：PE 偏差优先，市销率行取 PB 字段口径
  const holdRows = results
    .filter((r) => r.it.hold)
    .map((r) => ({ r, dev: r.devP != null ? r.devP : r.pbDev }))
    .filter((x) => x.dev != null);
  say('── 持仓诊断（hold 条目）──');
  if (holdRows.length) {
    say(
      '  ' +
        holdRows.length +
        ' 条: avg ' +
        fmtPct(avg(holdRows.map((x) => x.dev))) +
        ' · 中位 ' +
        fmtPct(median(holdRows.map((x) => x.dev))) +
        '（' +
        holdRows.map((x) => x.r.code).join('、') +
        '）'
    );
  } else {
    say('  （表中无持仓行或持仓行无对应偏差）');
  }

  // 未映射行推荐：按隐含因子与现有因子中位数的联合偏差取最近 3 个候选，需人工确认
  if (unmapped.length) {
    const peFacs = Object.values(cal.factors)
      .map((f) => f.peFactor)
      .filter((x) => x != null);
    const pbFacs = Object.values(cal.factors)
      .map((f) => f.pbFactor)
      .filter((x) => x != null);
    const medPe = median(peFacs);
    const medPb = median(pbFacs);
    const cands = items.filter((it) => !cal.factors[it.index_code]);
    say('── 未映射行推荐（需人工确认后回填 calibration_map.js）──');
    for (const row of unmapped) {
      if (!cands.length) {
        say('  「' + row.name + '」无候选（快照中已无未映射条目）');
        continue;
      }
      const scored = cands
        .map((it) => {
          const peF = row.pe != null && it.pe ? row.pe / it.pe : null;
          const pbF = row.pb != null && it.pb ? row.pb / it.pb : null;
          const joint = (peF != null ? Math.abs(peF - medPe) : 0) + (pbF != null ? Math.abs(pbF - medPb) : 0);
          return { code: it.index_code, name: it.name, joint };
        })
        .sort((a, b) => a.joint - b.joint)
        .slice(0, 3);
      say('  「' + row.name + '」: ' + scored.map((s) => s.code + '（' + s.name + '）联合偏差 ' + s.joint.toFixed(3)).join(' | '));
    }
  }

  // 星级自检：用存量字段重算 vs it.star
  let starOk = 0;
  const starBad = [];
  for (const it of items) {
    if (!it.screwColor) continue;
    const s = starOf(it, EP_DISCOUNT[it.index_code]);
    if (s === it.star) starOk++;
    else starBad.push(it.index_code + ': 现存 ' + it.star + ' → 重算 ' + s);
  }
  say('── 星级自检（有 screwColor 条目，存量字段重算）──');
  say('  ' + starOk + ' OK / ' + starBad.length + ' 不符' + (starBad.length ? '：' + starBad.join('；') : ''));

  return { matched: results.length, unmapped: unmapped.length, missing: missing.length };
}

// ---------- CLI 与主流程 ----------

function usage() {
  console.log(
    [
      '用法:',
      '  node scripts/calibrate.js <table.json> <snapshot.json>                 校验（只读）',
      '  node scripts/calibrate.js <table.json> <snapshot.json> --apply         校验 + 重算预演（不写盘）',
      '  node scripts/calibrate.js <table.json> <snapshot.json> --apply --write 校验 + 重算 + 双写快照与 valuations',
      '  node scripts/calibrate.js --val-only                                   仅向 valuations.json 重算并注入校准块（直接写）',
      '选项:',
      '  --date YYYY-MM-DD  校验 calibration.history 最新日期（不一致则 exit 1）',
      '  --out <file>       报告落盘',
    ].join('\n')
  );
}

const argv = process.argv.slice(2);
const flags = { apply: false, write: false, valOnly: false, date: null, out: null };
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--apply') flags.apply = true;
  else if (a === '--write') flags.write = true;
  else if (a === '--val-only') flags.valOnly = true;
  else if (a === '--date') {
    flags.date = argv[++i];
    if (!flags.date) {
      console.error('错误: --date 需要值（YYYY-MM-DD）');
      process.exit(1);
    }
  } else if (a === '--out') {
    flags.out = argv[++i];
    if (!flags.out) {
      console.error('错误: --out 需要文件路径');
      process.exit(1);
    }
  } else if (a.startsWith('--')) {
    console.error('未知选项: ' + a);
    usage();
    process.exit(1);
  } else {
    pos.push(a);
  }
}
if (flags.write && !flags.apply) {
  console.error('错误: --write 需与 --apply 配合使用');
  process.exit(1);
}
if (!flags.valOnly && pos.length < 2) {
  usage();
  process.exit(1);
}

const report = [];
const say = (line) => report.push(line);

function finish(code) {
  for (const line of report) console.log(line);
  if (flags.out) {
    fs.writeFileSync(flags.out, report.join('\n') + '\n');
    console.log('报告已写入 ' + flags.out);
  }
  process.exit(code);
}

function main() {
  // 1) --date 校验
  if (flags.date) {
    const latest = cal.history[cal.history.length - 1];
    if (!latest || latest.date !== flags.date) {
      throw new Error('--date 不匹配：calibration.history 最新日期为 ' + (latest ? latest.date : '（空）') + '，传入 ' + flags.date);
    }
    say('日期校验 OK: ' + latest.date);
  }

  const nowIso = new Date().toISOString();
  let table = null;
  let snap = null;

  // 2) verify（给了表 + 快照参数时）
  if (pos.length >= 2) {
    table = readJson(pos[0]);
    snap = readJson(pos[1]);
    verify(pos[0], pos[1], table, snap, say);
  }

  // 3) --apply：重算预演；--write 时双写快照与 valuations
  if (flags.apply) {
    if (!snap) throw new Error('--apply 需要表与快照两个参数');
    say('── apply 重算预演 ──');
    recompute(snap.indexes || [], '快照', say);
    const val = readJson(VAL_FILE);
    recompute(val.indexes || [], 'valuations', say);
    if (flags.write) {
      snap.calibration = buildCalBlock(nowIso);
      injectValuations(val, nowIso);
      writeJson(pos[1], snap);
      writeJson(VAL_FILE, val);
      say('已双写: ' + pos[1]);
      say('        ' + VAL_FILE + '（calibration.updatedAt = ' + nowIso + '）');
    } else {
      say('（dry-run 未写盘；确认无误后加 --write 执行双写）');
    }
  }

  // 4) --val-only：仅重算 + 注入 valuations（直接写；表/快照参数可省，给了则已先跑 verify）
  if (flags.valOnly) {
    const val = readJson(VAL_FILE);
    say('── val-only：valuations 重算 + 注入校准块 ──');
    recompute(val.indexes || [], 'valuations', say);
    injectValuations(val, nowIso);
    writeJson(VAL_FILE, val);
    say('已写盘: ' + VAL_FILE + '（calibration.updatedAt = ' + nowIso + '）');
  }
}

try {
  main();
  finish(0);
} catch (e) {
  report.push('错误: ' + (e && e.message ? e.message : String(e)));
  finish(1);
}
