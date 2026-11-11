/**
 * color_scan.js —— 螺丝钉估值表截图色区自动比对
 *
 * 用途：替代「人工逐行比对切片背景色」环节。扫描截图每行背景色（绿/黄/红），
 *       压缩为色段序列，与 calibration.js 因子色（按表行序）比对，输出分歧定位。
 *
 * 用法：
 *   node scripts/color_scan.js <img1.png> [img2.png ...]                  扫描：输出色段序列
 *   node scripts/color_scan.js <img...> --check <table.json>              扫描 + 行级比对（DP 全局行数分配对齐）
 *   node scripts/color_scan.js <img...> --check <table.json> --strict     同上，另将 0 行噪声段视为失败
 *
 * 输入约束：8-bit RGB/RGBA 非隔行 PNG（System.Drawing/常规截图默认格式）。
 *           原始 JPG 截图需先转 PNG（PowerShell: 详见 AGENTS.md §5）。
 *           多片按表格从上到下的顺序传入。
 *
 * 算法：
 *   1. 纯 node 解码 PNG（zlib inflate + filter 还原，无外部依赖）；
 *   2. 每行取中间 60% 宽度像素做 HSV 分类（白/黑/灰跳过，浅色底 hue 分绿黄红），
 *      行级多数票定行色；3. 行序列 run-length 压缩为色段；
 *   4. --check：表行名 → calibration_map.js 反查 code → calibration.js factors 色作期望；
 *      带色约束的序列对齐 DP——每段可占 n 行（n 在 h/rowH 附近枚举），
 *      代价 = 高度残差² + 失配行数×大惩罚，约束 Σn=表行数；rowH 网格搜索取总代价最小，
 *      展开色段为行序列后逐行比对；未收录行视作通配（任意色均可）。
 *      色序列约束可消除「分节表头处 ±1 行跨节滑移」造成的伪分歧（见 rowLevelCheck 注释）。
 *
 * 退出码：0 = 通过；1 = 发现分歧/失配；2 = 输入错误。
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const cal = require('./calibration.js');
const MAP = require('./calibration_map.js');

// 反向映射：表行名 -> index_code
const NAME2CODE = {};
for (const [code, name] of Object.entries(MAP)) {
  if (NAME2CODE[name] != null) console.error(`警告：行名重复映射 ${name}：${NAME2CODE[name]} / ${code}`);
  NAME2CODE[name] = code;
}

// ---------- PNG 解码 ----------

function decodePNG(buf, file) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(sig)) {
    throw new Error(`${file}: 非 PNG 文件（JPG 请先转 PNG）`);
  }
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`${file}: 不支持的 PNG（bitDepth=${bitDepth} colorType=${colorType}，仅支持 8bit RGB/RGBA）`);
  }
  if (interlace) throw new Error(`${file}: 不支持隔行 PNG`);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  if (raw.length < height * (stride + 1)) throw new Error(`${file}: IDAT 数据不完整`);
  const out = Buffer.alloc(width * height * 3);
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const ft = raw[p++];
    raw.copy(cur, 0, p, p + stride);
    p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];
      if (ft === 1) v = (v + a) & 0xff;
      else if (ft === 2) v = (v + b) & 0xff;
      else if (ft === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (ft === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      cur[i] = v;
    }
    for (let x = 0; x < width; x++) {
      const q = (y * width + x) * 3;
      out[q] = cur[x * bpp];
      out[q + 1] = cur[x * bpp + 1];
      out[q + 2] = cur[x * bpp + 2];
    }
    cur.copy(prev);
  }
  return { width, height, rgb: out };
}

// ---------- HSV 分类与行色判定 ----------

function classifyPixel(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const v = mx / 255;
  const s = mx === 0 ? 0 : (mx - mn) / mx;
  if (v < 0.5 || s < 0.04) return null; // 黑/灰/白（文字、留白、边框）
  const d = mx - mn;
  let h;
  if (mx === r) h = 60 * (((g - b) / d) % 6);
  else if (mx === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  if (h < 20 || h >= 345) return 'red';
  if (h < 70) return 'yellow';
  if (h < 200) return 'green';
  return 'other';
}

function rowColors(img) {
  const { width, height, rgb } = img;
  const x0 = Math.floor(width * 0.15), x1 = Math.floor(width * 0.85);
  const colors = new Array(height);
  for (let y = 0; y < height; y++) {
    const votes = { green: 0, yellow: 0, red: 0, other: 0 };
    for (let x = x0; x < x1; x++) {
      const q = (y * width + x) * 3;
      const c = classifyPixel(rgb[q], rgb[q + 1], rgb[q + 2]);
      if (c) votes[c]++;
    }
    const n = x1 - x0;
    let best = null, bestN = 0;
    for (const k of ['green', 'yellow', 'red', 'other']) {
      if (votes[k] > bestN) { best = k; bestN = votes[k]; }
    }
    colors[y] = bestN >= n * 0.5 ? best : 'white';
  }
  return colors;
}

// ---------- 段压缩 ----------

function segments(colors) {
  const segs = [];
  for (let y = 0; y < colors.length; y++) {
    const c = colors[y];
    const last = segs[segs.length - 1];
    if (last && last.color === c) last.h++;
    else segs.push({ color: c, h: 1 });
  }
  return segs;
}

// ---------- --check：与因子色比对 ----------

function expectedFromTable(tableFile) {
  const table = JSON.parse(fs.readFileSync(tableFile, 'utf8'));
  const rows = table.rows || [];
  const known = [];
  const wilds = [];
  for (const r of rows) {
    const code = NAME2CODE[r.name];
    if (code && cal.factors[code]) known.push({ name: r.name, code, color: cal.factors[code].color });
    else wilds.push(r.name);
  }
  return { rows, known, wilds };
}

function rowLevelCheck(segs, tableFile, strict) {
  // 行级比对：分节感知的行数分配。
  //   1. 分组：显著白段（高 ≥ SECTION_MIN，即分节标题/表头/说明区）与 other 段处切分，
  //      把色段划为若干「节」；节内小间隙（几像素行距）不切分；
  //   2. 组间：每组行数 n_g 初值 = round(组色高/rowH)，再贪心微调至 Σn_g = 表行数；
  //   3. 组内：用「组内局部行高」H_g/n_g 逐段独立取整（该节内行高一致，取整准确），
  //      再贪心微调至 Σ = n_g；
  //   4. rowH 网格搜索，按「色冲突行数优先、拟残差次之」选最优方案。
  //
  // 为什么不用全局 DP：旧版对全部色段做一次全局拟合（最小化 Σ(h−n·rowH)²），
  // 在螺丝钉表「市盈率段与市净率段之间插入分节表头」处两节行高天然不均
  // （10-28 表 PE 绿段 34.8px/行、PB 黄段 39.2px/行），全局最优会把 PE 段末行挪给 PB 段
  // 来平均化残差，导致科创50 被判入下一节、证券行业再下一节（10-27/10-28 连续两轮
  // 2 处伪分歧）；若在此基础上叠加色约束，DP 还会跨白段把科创50 解释成 PB 绿段
  // （回归测试实证），伪解更隐蔽。分节切分后跨节挪动在结构上不可能发生。
  const SECTION_MIN = 30;
  const groups = [];
  let cur = [];
  for (const s of segs) {
    if (s.color === 'white' || s.color === 'other') {
      if (s.color === 'other' || s.h >= SECTION_MIN) {
        if (cur.length) { groups.push(cur); cur = []; }
      }
      continue;
    }
    cur.push(s);
  }
  if (cur.length) groups.push(cur);
  const cs = groups.flat();
  const totalH = cs.reduce((a, s) => a + s.h, 0);
  const table = JSON.parse(fs.readFileSync(tableFile, 'utf8'));
  const rows = table.rows || [];
  const totalRows = rows.length;
  if (!cs.length || !totalRows) {
    console.error('色段为空或表无行，终止严格比对。');
    return false;
  }
  const base = totalH / totalRows;
  const gH = groups.map((g) => g.reduce((a, s) => a + s.h, 0));

  // 组行数：初值取整后贪心微调至闭合
  function allocGroups(rh) {
    const n = gH.map((H) => Math.max(0, Math.round(H / rh)));
    let sum = n.reduce((a, b) => a + b, 0);
    let guard = 0;
    while (sum !== totalRows && guard++ < totalRows * 4) {
      const dir = sum < totalRows ? 1 : -1;
      let pick = -1, bestD = Infinity;
      for (let i = 0; i < gH.length; i++) {
        if (dir < 0 && n[i] === 0) continue;
        const d = (gH[i] - (n[i] + dir) * rh) ** 2 - (gH[i] - n[i] * rh) ** 2;
        if (d < bestD) { bestD = d; pick = i; }
      }
      if (pick < 0) return null;
      n[pick] += dir;
      sum += dir;
    }
    return sum === totalRows ? n : null;
  }

  // 组内段行数：局部行高取整后贪心微调至 nG
  function allocInGroup(g, nG) {
    if (nG <= 0) return g.map(() => 0);
    const H = g.reduce((a, s) => a + s.h, 0);
    const lrh = H / nG;
    const n = g.map((s) => Math.max(0, Math.round(s.h / lrh)));
    let sum = n.reduce((a, b) => a + b, 0);
    let guard = 0;
    while (sum !== nG && guard++ < nG * 4) {
      const dir = sum < nG ? 1 : -1;
      let pick = -1, bestD = Infinity;
      for (let i = 0; i < g.length; i++) {
        if (dir < 0 && n[i] === 0) continue;
        const d = (g[i].h - (n[i] + dir) * lrh) ** 2 - (g[i].h - n[i] * lrh) ** 2;
        if (d < bestD) { bestD = d; pick = i; }
      }
      if (pick < 0) return null;
      n[pick] += dir;
      sum += dir;
    }
    return sum === nG ? n : null;
  }

  function build(rh) {
    const gn = allocGroups(rh);
    if (!gn) return null;
    const alloc = [];
    const expanded = [];
    for (let gi = 0; gi < groups.length; gi++) {
      const na = allocInGroup(groups[gi], gn[gi]);
      if (!na) return null;
      alloc.push(na);
      groups[gi].forEach((s, i) => { for (let j = 0; j < na[i]; j++) expanded.push(s.color); });
    }
    if (expanded.length !== totalRows) return null;
    let bad = 0;
    for (let i = 0; i < rows.length; i++) {
      const code = NAME2CODE[rows[i].name];
      const e = code && cal.factors[code] ? cal.factors[code].color : null;
      if (e && e !== expanded[i]) bad++;
    }
    // 拟合残差用组内局部行高计算（全局行高会不公平地惩罚高行高小节）
    let cost = 0;
    for (let gi = 0; gi < groups.length; gi++) {
      const nG = gn[gi];
      if (!nG) { cost += groups[gi].reduce((a, s) => a + s.h * s.h, 0); continue; }
      const lrh = gH[gi] / nG;
      groups[gi].forEach((s, i) => { cost += (s.h - alloc[gi][i] * lrh) ** 2; });
    }
    return { gn, alloc, expanded, bad, cost };
  }

  let best = null;
  for (let rh = base * 0.94; rh <= base * 1.06 + 1e-9; rh += 0.25) {
    const r = build(rh);
    if (!r) continue;
    const better = !best || r.bad < best.bad ||
      (r.bad === best.bad && (r.cost < best.cost - 1e-6 ||
        (Math.abs(r.cost - best.cost) <= 1e-6 && Math.abs(rh - base) < Math.abs(best.rowH - base))));
    if (better) best = { ...r, rowH: rh };
  }
  if (!best) {
    console.error('分配无解（行高搜索区间内无法闭合到表行数），请人工复核切片顺序与完整性。');
    return false;
  }
  const flatAlloc = best.alloc.flat();
  console.log('  分组：' + groups.map((g, i) => `第${i + 1}节[${g.map((s) => s.color[0].toUpperCase()).join('')}]→${best.gn[i]}行`).join(' '));
  console.log('  段分配：' + cs.map((s, i) => `${s.color[0].toUpperCase()}×${flatAlloc[i]}(${s.h}px)`).join(' '));
  console.log(`分段取整：色区总高 ${totalH}px，最优行高 ${best.rowH.toFixed(2)}px（基准 ${base.toFixed(1)}px），拟合残差 ${best.cost.toFixed(0)}px²，展开 ${best.expanded.length} 行 = 表 ${totalRows} 行`);
  let maxResid = 0, noise = 0;
  cs.forEach((s, i) => {
    maxResid = Math.max(maxResid, Math.abs(s.h - flatAlloc[i] * best.rowH));
    if (flatAlloc[i] === 0) { noise++; console.error(`  注意：色段 ${s.color}×${s.h}px 被判 0 行（噪声段）`); }
  });
  console.log(`  段拟合最大残差 ${maxResid.toFixed(1)}px（跨节行高差异属正常，如分节表头导致）`);
  if (strict && noise) {
    console.error(`--strict：${noise} 个 0 行噪声段判为失败。`);
    return false;
  }
  let bad = 0;
  for (let i = 0; i < rows.length; i++) {
    const code = NAME2CODE[rows[i].name];
    const e = code && cal.factors[code] ? cal.factors[code].color : null;
    if (e && e !== best.expanded[i]) {
      console.error(`分歧：第 ${i + 1} 行「${rows[i].name}」因子色=${e}，图=${best.expanded[i]}`);
      bad++;
    }
  }
  if (bad) {
    console.error(`严格比对发现 ${bad} 处分歧。`);
    return false;
  }
  console.log(`严格比对通过：全部已知色逐行一致。`);
  return true;
}

// ---------- 主流程 ----------

function main() {
  const argv = process.argv.slice(2);
  let checkFile = null, strict = false;
  const imgs = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') checkFile = argv[++i];
    else if (argv[i] === '--strict') strict = true;
    else imgs.push(argv[i]);
  }
  if (!imgs.length) {
    console.error('用法：node scripts/color_scan.js <img1.png> [img2.png ...] [--check table.json] [--strict]');
    process.exit(2);
  }
  const allSegs = [];
  for (const f of imgs) {
    const img = decodePNG(fs.readFileSync(f), path.basename(f));
    const segs = segments(rowColors(img));
    console.error(`[${path.basename(f)}] ${img.width}×${img.height}，${segs.length} 段`);
    allSegs.push(...segs);
  }
  // 跨片合并相邻同色段
  const merged = [];
  for (const s of allSegs) {
    const last = merged[merged.length - 1];
    if (last && last.color === s.color) last.h += s.h;
    else merged.push({ ...s });
  }
  if (!checkFile) {
    console.log('全图色段序列（color × 行数px）：');
    for (const s of merged) console.log(`  ${s.color.padEnd(6)} ×${s.h}`);
    const g = merged.filter((s) => s.color === 'green').reduce((a, s) => a + s.h, 0);
    const y = merged.filter((s) => s.color === 'yellow').reduce((a, s) => a + s.h, 0);
    const r = merged.filter((s) => s.color === 'red').reduce((a, s) => a + s.h, 0);
    const o = merged.filter((s) => s.color === 'other').reduce((a, s) => a + s.h, 0);
    console.log(`合计：green ${g}px、yellow ${y}px、red ${r}px、other ${o}px`);
    return;
  }
  const { known, wilds } = expectedFromTable(checkFile);
  console.log(`表 ${known.length + wilds.length} 行：已知色 ${known.length}、未收录通配 ${wilds.length}`);
  const ok = rowLevelCheck(merged, checkFile, strict);
  process.exit(ok ? 0 : 1);
}

main();
