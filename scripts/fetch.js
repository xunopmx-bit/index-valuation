// 数据抓取与估值计算主脚本
// 1. 从蛋卷基金 API 拉取指数估值数据
// 2. 按 config 中每个指数的方法（EP/PE/PB）计算红黄绿、星级
// 3. 输出 data/valuations.json 供前端使用
const fs = require('fs');
const path = require('path');
const config = require('./config');

const DANJUAN_API = 'https://danjuanfunds.com/djapi/index_eva/dj';
const OUT_DIR = path.join(__dirname, '..', 'site', 'data');
const OUT_FILE = path.join(OUT_DIR, 'valuations.json');
const HIST_DIR = path.join(OUT_DIR, 'history');
const HIST_INDEX = path.join(HIST_DIR, 'index.json');
const MAX_DAYS = 365; // 保留最近365天历史

async function fetchDanjuan() {
  const res = await fetch(DANJUAN_API, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Referer': 'https://danjuanfunds.com/',
    },
  });
  if (!res.ok) throw new Error(`蛋卷API请求失败: HTTP ${res.status}`);
  const json = await res.json();
  if (json.result_code !== 0 || !json.data?.items) {
    throw new Error(`蛋卷API返回异常: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json.data.items;
}

// 各估值方法对应的判断指标百分位
// EP法（盈利稳定/红利类）：本质是看盈利收益率=1/PE，用 PE 百分位反映贵贱
// PE法（宽基/消费/医药）：参考PE百分位
// PB法（强周期/重资产）：参考PB百分位
function methodPercentile(item, method) {
  if (method === 'PB') return item.pb_percentile;
  return item.pe_percentile; // EP 与 PE 方法均用 PE 百分位
}

// 盈利收益率 = 1/PE，港股指数打9折（港股通分红税+换汇费用侵蚀收益）
function adjustedEp(item, cfg) {
  const ep = epOf(item?.pe);
  if (ep == null) return null;
  const discount = cfg?.epDiscount ?? 1;
  return ep * discount;
}

// 红黄绿判断：EP 法用绝对阈值，PE/PB 法用历史百分位阈值
function judgeColor(item, method, cfg) {
  if (method === 'EP') {
    const ep = adjustedEp(item, cfg);
    if (ep == null) return 'gray';
    const { buy, sell } = config.epThreshold;
    if (ep > buy) return 'green';          // 盈利收益率 >10% → 低估可投
    if (ep < sell) return 'red';           // 盈利收益率 <6.4% → 高估卖出
    return 'yellow';                        // 6.4%~10% → 持有
  }
  const p = methodPercentile(item, method);
  if (p == null) return 'gray';
  const { low, high } = config.colorThreshold;
  if (p < low) return 'green';        // 低估
  if (p > high) return 'red';         // 高估
  return 'yellow';                     // 正常
}

// 板块内排序：优先绿、黄、红，其次星级降序（越高越值得投）
function sortSection(items) {
  const colorRank = { green: 0, yellow: 1, red: 2, gray: 3 };
  return [...items].sort((a, b) => {
    const ra = colorRank[a.color] ?? 3;
    const rb = colorRank[b.color] ?? 3;
    if (ra !== rb) return ra - rb;
    return (b.star ?? 0) - (a.star ?? 0);
  });
}

// 星级评分：基于历史百分位映射到 1~5 星（半星粒度）
// 低估（<20%）= 4-5星，正常（20-80%）= 3星，高估（>80%）= 1-2星
function starFromPercentile(p) {
  if (p === null || p === undefined) return null;
  // p=0 → 5星，p=1 → 1星，线性映射到 0.5 星粒度
  const star = 5 - p * 4; // 0~1 → 5~1
  // 半星取整：0.25 以下舍，0.25-0.75 进半星，以上进整星
  let rounded = Math.round(star * 2) / 2;
  rounded = Math.max(1, Math.min(5, rounded));
  return rounded;
}

// 整体市场星级：基准指数百分位加权平均（等权）
function marketStar(apiItems, benchmarkCodes) {
  const items = benchmarkCodes
    .map((c) => apiItems.find((i) => i.index_code === c))
    .filter(Boolean);
  if (!items.length) return null;
  const pcts = items.map((i) => {
    // 宽基（沪深300/中证500）盈利稳定，参考PE百分位
    return i.pe_percentile ?? 1;
  });
  const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  return { star: starFromPercentile(avg), avgPercentile: avg };
}

// 盈利收益率 = 1/PE（EP 类方法核心指标）
function epOf(pe) {
  if (!pe) return null;
  return 1 / pe;
}

// 北京时间日期字符串（UTC+8），用于历史归档与展示
function beijingDateStr(d) {
  const bj = new Date(d.getTime() + 8 * 3600 * 1000);
  return bj.toISOString().slice(0, 10);
}

// 读取或初始化历史索引
function readHistoryIndex() {
  if (!fs.existsSync(HIST_INDEX)) return { dates: [] };
  try {
    return JSON.parse(fs.readFileSync(HIST_INDEX, 'utf-8'));
  } catch {
    return { dates: [] };
  }
}

// 写入当天历史快照，并清理超过365天的旧数据
function saveHistory(dateStr, output) {
  if (!fs.existsSync(HIST_DIR)) fs.mkdirSync(HIST_DIR, { recursive: true });
  const index = readHistoryIndex();
  const { dates } = index;

  // 若当天快照已存在则覆盖（同一天重跑）
  if (!dates.includes(dateStr)) dates.push(dateStr);
  dates.sort(); // 升序

  // 写入当天快照（快照内 date 字段保持原始估值日期）
  fs.writeFileSync(path.join(HIST_DIR, `${dateStr}.json`), JSON.stringify(output, null, 2), 'utf-8');

  // 清理超出365天的旧快照
  while (dates.length > MAX_DAYS) {
    const old = dates.shift();
    try { fs.unlinkSync(path.join(HIST_DIR, `${old}.json`)); } catch {}
  }

  fs.writeFileSync(HIST_INDEX, JSON.stringify({ dates }, null, 2), 'utf-8');
  console.log(`   历史快照: ${HIST_DIR}\\${dateStr}.json（共 ${dates.length} 天，上限 ${MAX_DAYS} 天）`);
}

async function main() {
  const items = await fetchDanjuan();
  const now = new Date();
  const dateStr = beijingDateStr(now);
  // 蛋卷估值 date 形如 "08-17"，归档按抓取日（北京）区分
  const dataDate = items[0]?.date ?? '';

  const byCode = new Map(items.map((i) => [i.index_code, i]));
  const market = marketStar(items, config.starBenchmark);

  const results = [];
  for (const cfg of config.indexes) {
    const raw = byCode.get(cfg.index_code);
    const method = cfg.method;
    const percentile = raw
      ? methodPercentile(raw, method)
      : null;
    const color = raw ? judgeColor(raw, method, cfg) : 'gray';
    const star = raw ? starFromPercentile(percentile) : null;
    const ep = epOf(raw?.pe);
    const epAdj = adjustedEp(raw, cfg);

    results.push({
      index_code: cfg.index_code,
      name: cfg.name,
      method,
      section: cfg.section,
      hold: !!cfg.hold,
      fundCode: cfg.fundCode || null, // 场内基金代码
      fundFcode: cfg.fundFcode || null, // 场外基金代码
      pe: raw?.pe ?? null,
      pb: raw?.pb ?? null,
      ep: ep ? Number(ep.toFixed(4)) : null,
      epAdj: epAdj ? Number(epAdj.toFixed(4)) : null, // 调整后盈利收益率（港股打9折）
      roe: raw?.roe ?? null,
      yield: raw?.yeild ?? null, // 股息率
      pe_percentile: raw?.pe_percentile ?? null,
      pb_percentile: raw?.pb_percentile ?? null,
      percentile: percentile !== null && percentile !== undefined ? Number(percentile.toFixed(4)) : null,
      color,
      star,
      date: raw?.date ?? dateStr,
      source: raw ? 'danjuan' : 'missing',
    });
  }

  // 板块排序（按 config 中顺序）
  const sectionOrder = [];
  for (const r of results) if (!sectionOrder.includes(r.section)) sectionOrder.push(r.section);

  // 每个板块内按 绿→黄→红 优先、其次星级降序 排序（每天随数据动态变动）
  const sorted = [];
  for (const sec of sectionOrder) {
    sorted.push(...sortSection(results.filter((r) => r.section === sec)));
  }

  const output = {
    generated_at: now.toISOString(),
    date: dateStr,           // 归档日期（北京时间抓取日）
    dataDate,                // 原始估值日期（蛋卷，如 "08-17"）
    source: 'danjuanfunds.com/djapi/index_eva/dj',
    market: {
      star: market?.star ?? null,
      avgPercentile: market?.avgPercentile ?? null,
      benchmark: config.starBenchmark,
    },
    thresholds: { ...config.colorThreshold, ...config.epThreshold },
    sections: sectionOrder,
    indexes: sorted,
    invest: {
      monthly: config.investFormula.amount,
      formula: '应投金额 = 上月实际投入 × (上期便宜度 / 当期便宜度)²',
      lowColor: config.colorThreshold.low,
      highColor: config.colorThreshold.high,
    },
  };

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
  saveHistory(dateStr, output);
  console.log(`✅ 已生成 ${OUT_FILE}`);
  console.log(`   指数数: ${results.length}，整体星级: ${market?.star ?? '-'}，归档日期: ${dateStr}，估值日期: ${dataDate || '-'}`);
}

main().catch((e) => {
  console.error('❌ 脚本执行失败:', e.message);
  process.exit(1);
});
