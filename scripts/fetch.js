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

// 辅助函数：判断场内证券交易所前缀（50/51/52/56/58/60/68 -> sh, 15/16/18/30 -> sz）
function getSecCode(code) {
  if (!code) return null;
  if (/^(50|51|52|56|58|60|68)/.test(code)) return 'sh' + code;
  if (/^(15|16|18|30)/.test(code)) return 'sz' + code;
  return null;
}

// 批量抓取基金前日/最新收盘价格或单位净值（优先场内ETF/LOF，无场内则取场外基金净值）
// 场内：东方财富 push2delay 批量行情接口优先（f2=最新价/f18=昨收/f12=代码/f14=名称，JSON 无日期需探针补齐）
//       东财限流/返回空时自动回退腾讯 qt.gtimg.cn 批量接口（GBK 文本，parts[1]=名称/[3]=最新/[4]=昨收/[30]=日期）
// 场外：东方财富天天基金历史净值接口（逐只查询，需 Referer）
async function fetchFundPrices(indexes) {
  const prices = {}; // code -> { price, name, type, date }
  const secCodes = [];
  const allOutCodes = Array.from(new Set(indexes.map(i => i.fundFcode).filter(Boolean)));

  for (const idx of indexes) {
    const sec = getSecCode(idx.fundCode);
    if (sec) secCodes.push(sec);
  }

  // 1. 批量查场内（东财 push2delay ulist.np，无需 token/Referer，延迟版避开直连限制）
  if (secCodes.length > 0) {
    try {
      // sh -> 1.xxxxxx，sz -> 0.xxxxxx
      const secids = secCodes.map(s => (s.startsWith('sh') ? '1.' : '0.') + s.slice(2)).join(',');
      const url = `https://push2delay.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=${secids}&fields=f2,f3,f4,f12,f14,f18`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const list = json?.data?.diff || [];
        if (Array.isArray(list) && list.length === 0) {
          console.warn(`⚠️ 东财 push2delay 返回空 diff（共 ${secCodes.length} 只），回退腾讯行情兜底`);
        } else {
          for (const it of list) {
            const code = String(it.f12);
            const nowPrice = Number(it.f2);
            const prevClose = Number(it.f18);
            if (Number.isFinite(nowPrice) && nowPrice > 0) {
              prices[code] = {
                nowPrice,
                prevClose: Number.isFinite(prevClose) ? prevClose : null,
                name: it.f14 || '',
                type: '场内',
                date: null, // 东财接口不带日期，由下方探针统一补齐
              };
            }
          }
        }
      } else {
        console.warn(`⚠️ 东财 push2delay HTTP ${res.status}，回退腾讯行情兜底`);
      }
    } catch (e) {
      console.warn('⚠️ 场内行情批量获取失败（东财），回退腾讯行情兜底:', e.message);
    }

    // 1.0 腾讯行情兜底：东财空结果/失败时，用腾讯批量接口补齐全部场内价格（实测 61/61 全命中）
    const missing = secCodes.filter(s => !prices[s.slice(2)]);
    if (missing.length > 0) {
      try {
        const BATCH_T = 30;
        for (let i = 0; i < missing.length; i += BATCH_T) {
          const chunk = missing.slice(i, i + BATCH_T);
          const res = await fetch('https://qt.gtimg.cn/q=' + chunk.join(','));
          if (!res.ok) continue;
          const text = await res.text();
          for (const line of text.trim().split(';')) {
            const m = line.match(/v_(sh|sz)\d+="([^"]*)"/);
            if (!m) continue;
            const code = m[0].match(/v_(?:sh|sz)(\d+)/)?.[1];
            if (!code) continue;
            const parts = m[2].split('~');
            const nowPrice = Number(parts[3]);
            const prevClose = Number(parts[4]);
            const dateRaw = parts[30] || '';
            if (Number.isFinite(nowPrice) && nowPrice > 0) {
              prices[code] = {
                nowPrice,
                prevClose: Number.isFinite(prevClose) && prevClose > 0 ? prevClose : null,
                name: parts[1] || '',
                type: '场内',
                date: dateRaw ? dateRaw.slice(0, 8) : null, // 腾讯自带交易日，无需探针
              };
            }
          }
        }
        const got = missing.filter(s => prices[s.slice(2)]).length;
        console.log(`ℹ️ 腾讯行情兜底补齐场内 ${got}/${missing.length} 只`);
      } catch (e) {
        console.warn('⚠️ 腾讯行情兜底失败:', e.message);
      }
    }
  }

  // 1.1 场内价格日期探针：东财接口无日期字段，用腾讯行情查上证指数当前交易日统一补齐
  //     （探针返回的时间戳与各 ETF 同属一个交易日；腾讯兜底的价格已自带日期会被覆盖为同一交易日，无损）
  if (Object.keys(prices).length > 0) {
    try {
      const probe = await fetch('https://qt.gtimg.cn/q=sh000001');
      if (probe.ok) {
        const text = await probe.text();
        const m = text.match(/v_sh000001="([^"]+)"/);
        if (m) {
          const parts = m[1].split('~');
          const dateRaw = parts[30] || '';
          const pDate = dateRaw ? dateRaw.slice(0, 8) : null;
          for (const code of Object.keys(prices)) {
            prices[code].date = pDate;
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ 场内价格日期探针失败:', e.message);
    }
  }

  // 2. 场外基金净值（东财天天基金历史净值接口，逐只查询，10 只并发分批）
  if (allOutCodes.length > 0) {
    const BATCH = 10;
    for (let i = 0; i < allOutCodes.length; i += BATCH) {
      const batch = allOutCodes.slice(i, i + BATCH);
      await Promise.all(batch.map(async (fcode) => {
        try {
          const res = await fetch(`https://api.fund.eastmoney.com/f10/lsjz?fundCode=${fcode}&pageIndex=1&pageSize=2`, {
            headers: { 'Referer': 'https://fundf10.eastmoney.com/' },
          });
          if (!res.ok) return;
          const text = await res.text();
          const json = JSON.parse(text.replace(/^\uFEFF/, '')); // 去除 BOM
          const list = json?.Data?.LSJZList || [];
          if (list.length === 0) return;
          const nav = parseFloat(list[0].DWJZ); // 最新单位净值
          const navDate = list[0].FSRQ ? list[0].FSRQ.replace(/-/g, '') : null; // YYYYMMDD
          const prevClose = list.length > 1 ? parseFloat(list[1].DWJZ) : null; // 前一交易日净值
          // 守卫：净值日期明显过期（早于前一年）视为基金已停披露，忽略防止展示过期价格
          const curYear = parseInt(beijingDateStr(new Date()).slice(0, 4), 10);
          const navYear = navDate ? parseInt(navDate.slice(0, 4), 10) : 0;
          if (!isNaN(nav) && nav > 0 && navYear >= curYear - 1) {
            prices['f_' + fcode] = {
              nowPrice: nav,
              prevClose: isNaN(prevClose) ? null : prevClose,
              name: '',
              type: '场外',
              date: navDate,
            };
          }
        } catch (e) {
          console.warn(`⚠️ 场外基金 ${fcode} 净值获取失败:`, e.message);
        }
      }));
    }
  }

  return prices;
}

// 读取或初始化历史索引
function readHistoryIndex() {
  if (!fs.existsSync(HIST_INDEX)) return { dates: [] };
  try {
    return JSON.parse(fs.readFileSync(HIST_INDEX, 'utf-8'));
  } catch {
    // 索引文件损坏（如 git rebase 冲突残留）时，扫描快照目录重建日期索引，避免丢失历史
    if (fs.existsSync(HIST_DIR)) {
      try {
        const dates = fs.readdirSync(HIST_DIR)
          .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
          .map(f => f.slice(0, 10))
          .sort();
        return { dates };
      } catch {}
    }
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

const CSI_FALLBACKS = {
  '931139': { pb: 3.07, yield: 0.0407 }, // 消费50（乐咕历史稳态，页面限流时兜底）
  '930743': { pb: 4.17, yield: 0.0133 }, // 生物科技
  '931187': { pb: 3.5, yield: 0.008 },   // 科技100
  '930050': { pb: 1.5, yield: 0.02 },    // 中证A500（宽基，乐咕/蛋卷均无数据，参考稳态值）
  '000698': { pb: 4.5, yield: 0.003 }    // 科创100（高成长，参考稳态值）
};

// 中证官网 indexCsiDsPe 接口需无交易所前缀的纯指数代码：
// SH000300 -> 000300；SZ399997 -> 399997；CSIH30533 -> H30533；CSI931139 -> 931139；
// HKHSCEI/SP500/NDX 等境外指数保持原样（官网无数据，调用方需自行跳过）
function normalizeCsiCode(code) {
  if (/^SH\d+$/.test(code) || /^SZ\d+$/.test(code)) return code.slice(2);
  if (/^CSI/.test(code)) return code.slice(3); // CSIH30533->H30533, CSI931139->931139
  return code;
}

async function fetchLeguleguMeta(indexCode) {
  try {
    // 乐咕 index-basic 接口后缀规则：SH 老指数 000xxx.SH、SZ 399xxx.SZ、中证新指数 93xxxx.CSI
    let lgCode = indexCode;
    if (/^SH\d+$/.test(indexCode)) lgCode = `${indexCode.slice(2)}.SH`;
    else if (/^SZ\d+$/.test(indexCode)) lgCode = `${indexCode.slice(2)}.SZ`;
    else if (/^CSI/.test(indexCode)) lgCode = `${indexCode.slice(3)}.CSI`;
    else lgCode = `${indexCode}.CSI`; // 已无前缀的 93xxxx
    const res = await fetch(`https://legulegu.com/stockdata/index-basic?indexCode=${lgCode}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/meta name="description" content="([^"]+)"/);
    if (!m) return null;
    const content = m[1];
    const pbMatch = content.match(/加权平均市净率[：:][\s]*([\d.]+)/);
    const divMatch = content.match(/加权平均股息率[：:][\s]*([\d.%]+)/);

    let pb = pbMatch ? parseFloat(pbMatch[1]) : null;
    let yieldVal = divMatch ? parseFloat(divMatch[1]) : null;

    if (pb === 0) pb = null;
    if (yieldVal === 0) yieldVal = null;
    if (yieldVal != null) {
      yieldVal = yieldVal / 100;
    }
    return { pb, yield: yieldVal };
  } catch (e) {
    console.warn(`⚠️ Legulegu fetch failed for ${code}:`, e.message);
    return null;
  }
}

async function main() {
  const items = await fetchDanjuan();
  const now = new Date();
  const dateStr = beijingDateStr(now);
  // 蛋卷估值 date 形如 "08-17"，归档按抓取日（北京）区分
  const dataDate = items[0]?.date ?? '';
  const valuationYear = now.getFullYear();
  const targetDateIntStr = `${valuationYear}${dataDate.replace('-', '')}`; // e.g. "20260817"

  // 同日重复运行跳过：若今天（北京）已生成过历史快照（如手动触发重复跑、或 Actions
  // 与手动触发撞车），则直接跳过，避免生成两个相同归档日的快照。注意这里必须按「归档日
  // dateStr」判断而非「蛋卷估值日期 dataDate」：周末后首个交易日（如周一）蛋卷返回的估值
  // 日期仍是上周五的值，dataDate 与最近快照相同，但此时周一属于新的交易日、应正常生成
  // 周一归档（展示上一交易日估值），让筛选器能回溯到周一。仅当本归档日已写过才跳过。
  const historyIdx = readHistoryIndex();
  const historyDates = historyIdx.dates || [];
  if (historyDates.length > 0) {
    const lastDate = historyDates[historyDates.length - 1];
    if (dateStr === lastDate) {
      console.log(`ℹ️ 归档日 ${dateStr} 已存在（与最近快照相同）=> 同日重复运行，跳过更新，等待下一交易日的新估值。`);
      return;
    }
  }

  const fundPrices = await fetchFundPrices(config.indexes);

  // 自建补源 (csindex) 异步并行抓取与计算
  const csindexCfgs = config.indexes.filter(idx => idx.source === 'csindex');
  const csindexData = {};

  await Promise.all(csindexCfgs.map(async (cfg) => {
    const code = cfg.index_code;
    const csiCode = normalizeCsiCode(code); // 官网需无前缀
    try {
      // CSI P/E History
      const peRes = await fetch(`https://www.csindex.com.cn/csindex-home/perf/indexCsiDsPe?indexCode=${csiCode}`);
      let pe = null;
      let pe_percentile = null;
      let tradeDate = null;
      if (peRes.ok) {
        const peResJson = await peRes.json();
        const peList = peResJson.data;
        if (Array.isArray(peList) && peList.length > 0) {
          peList.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
          const latest = peList[peList.length - 1];
          pe = latest.peg;
          tradeDate = latest.tradeDate;
          
          const historySlice = peList.slice(-1220).map(item => item.peg);
          const count = historySlice.filter(v => v < pe).length;
          pe_percentile = historySlice.length > 0 ? count / historySlice.length : null;
        }
      }

      // Legulegu Meta（乐咕对老中证指数多无值，失败走 FALLBACK 或回退蛋卷）
      let legu = await fetchLeguleguMeta(code);
      if (!legu || !legu.pb) {
        legu = CSI_FALLBACKS[code] || { pb: null, yield: null };
      }

      let roe = null;
      if (pe && legu.pb) {
        roe = legu.pb / pe;
      }

      let formattedDate = '';
      if (tradeDate) {
        formattedDate = `${tradeDate.slice(4, 6)}-${tradeDate.slice(6, 8)}`;
      }

      csindexData[code] = {
        pe,
        pe_percentile,
        pb: legu.pb,
        yeild: legu.yield,
        roe,
        date: formattedDate,
        csiCode,
      };
      console.log(`   成功自建补源 ${cfg.name} (${code}): PE=${pe}, PE百分位=${((pe_percentile || 0) * 100).toFixed(2)}%, PB=${legu.pb ?? '-'}, 股息率=${((legu.yield || 0) * 100).toFixed(2)}%`);
    } catch (e) {
      console.error(`❌ 自建补源 ${cfg.name} (${code}) 失败:`, e.message);
    }
  }));

  const byCode = new Map(items.map((i) => [i.index_code, i]));
  const market = marketStar(items, config.starBenchmark);

  const results = [];
  for (const cfg of config.indexes) {
    let raw = byCode.get(cfg.index_code);
    if (cfg.source === 'csindex' && csindexData[cfg.index_code]) {
      const data = csindexData[cfg.index_code];
      // PE/百分位/日期用官网剔除亏损口径；PB/股息率/ROE 优先乐咕，缺失则回退蛋卷原值
      raw = {
        index_code: cfg.index_code,
        pe: data.pe,
        pb: data.pb ?? raw?.pb ?? null,
        pe_percentile: data.pe_percentile,
        pb_percentile: raw?.pb_percentile ?? null,
        roe: data.roe ?? raw?.roe ?? null,
        yeild: data.yeild ?? raw?.yeild ?? null,
        date: data.date,
      };
    }
    const method = cfg.method;
    const percentile = raw
      ? methodPercentile(raw, method)
      : null;
    const color = raw ? judgeColor(raw, method, cfg) : 'gray';
    const star = raw ? starFromPercentile(percentile) : null;
    const ep = epOf(raw?.pe);
    const epAdj = adjustedEp(raw, cfg);

    // 价格优先场内：有场内代码则只用场内价（避免场外联接净值 1.x 元与场内 3~4 元量级差异误导），
    // 场内缺失展示 NA；仅当指数本身没有场内基金（fundCode 为空）时才取场外单位净值。
    let fundPriceInfo = null;
    let priceType = null;
    let priceCode = null;
    if (cfg.fundCode) {
      fundPriceInfo = fundPrices[cfg.fundCode] || null;
      priceType = '场内';
      priceCode = cfg.fundCode;
    } else if (cfg.fundFcode) {
      fundPriceInfo = fundPrices['f_' + cfg.fundFcode] || null;
      priceType = '场外';
      priceCode = cfg.fundFcode;
    }

    let closePrice = null;
    let priceDate = null;
    if (fundPriceInfo) {
      const pDate = fundPriceInfo.date; // YYYYMMDD
      if (pDate === targetDateIntStr) {
        closePrice = fundPriceInfo.nowPrice;
        priceDate = pDate;
      } else if (pDate > targetDateIntStr) {
        closePrice = fundPriceInfo.prevClose ?? fundPriceInfo.nowPrice;
        priceDate = targetDateIntStr;
      } else {
        closePrice = fundPriceInfo.nowPrice;
        priceDate = pDate;
      }
    }

    let formattedPriceDate = null;
    if (priceDate) {
      formattedPriceDate = `${priceDate.slice(0, 4)}-${priceDate.slice(4, 6)}-${priceDate.slice(6, 8)}`;
    }

    results.push({
      index_code: cfg.index_code,
      name: cfg.name,
      method,
      section: cfg.section,
      hold: !!cfg.hold,
      fundCode: cfg.fundCode || null, // 场内基金代码
      fundFcode: cfg.fundFcode || null, // 场外基金代码
      closePrice: closePrice ? Number(closePrice.toFixed(4)) : null, // 严格对齐估值日期的价格
      priceType: fundPriceInfo ? priceType : null,
      priceCode: fundPriceInfo ? priceCode : null,
      priceDate: formattedPriceDate,
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
      source: cfg.source || (raw ? 'danjuan' : 'missing'),
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
    bonds: config.bonds || [],
    fixedIncomeOther: config.fixedIncomeOther || [],
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
