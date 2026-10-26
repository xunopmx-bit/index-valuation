# AGENTS.md — AI 接手指南（银行螺丝钉估值看板）

> 本文件供 AI 助手（opencode / Trae Code 等）在新设备上接手本项目时阅读。
> 完整历史决策见 git log 与 docs/ 目录；本文件只保留「继续工作所需」的运行知识。

## 1. 项目是什么

复刻「银行螺丝钉」宽基指数定投方法论的免费估值看板。

- 线上：https://xunopmx-bit.github.io/index-valuation/
- 仓库：https://github.com/xunopmx-bit/index-valuation （main 分支，public）
- 技术栈：**纯原生 Node.js（无 npm 依赖）** + 单文件 HTML 前端
- 每日自动更新：GitHub Actions `.github/workflows/daily-valuation.yml`
  - cron `0 22 * * 0-4`（UTC）= 北京周一~周五 06:00，抓蛋卷 T-1 估值 → 提交 `site/data/` → 部署 GitHub Pages
  - push 监听：向 `main` 分支 push 代码会自动触发部署，校准提交后 1~2 分钟内线上即时生效
  - 前一日为非交易日或同日重复运行时自动跳过（不写文件，无 commit）
- 当前规模：68 指数、10 持仓（基本面60已移出）、365 天历史归档、螺丝钉口径校准因子 35+ 个

## 2. 文件结构（改哪读哪）

| 文件 | 作用 |
|---|---|
| `scripts/config.js` | 指数配置：index_code、method（EP/PE/PB 三种估值法）、section、hold（持仓）、fundCode（场内）/fundFcode（场外）、source:'csindex'（官网补源标记）、percentileWindow=2440（10年百分位窗口）、starModel（星级模型）、CSI_FALLBACKS |
| `scripts/fetch.js` | 主脚本：蛋卷 API + 中证官网 PE 补源 + 乐咕 meta PB/股息率 + 价格（东财 push2delay 场内 → 腾讯兜底；东财 lsjz 场外）+ 星级 + 输出 valuations.json + history/ 按天归档 |
| `scripts/calibration.js` | 螺丝钉口径校准：factors 因子表（peFactor/pbFactor）+ history 校准记录（用户提供螺丝钉表逐日对照） |
| `scripts/calibration.js` 的 factors | screwPe = 系统PE × peFactor，用于前端「螺:」徽章展示螺丝钉口径 |
| `site/index.html` | 单文件前端（内联 CSS/JS）：星级横幅、巴菲特指标卡、红黄绿表、日期回溯下拉、screw 徽章 |
| `site/data/valuations.json` | 最新估值快照（Actions 每日更新，勿手工编辑除 calibration 注入） |
| `site/data/history/YYYY-MM-DD.json` | 按天快照；`date`=北京归档日，`dataDate`=蛋卷估值日（MM-DD） |
| `site/data/history/index.json` | 日期索引 `{dates:[...]}`（丢失时按目录扫描重建） |
| `server.js` | 本地预览：`node server.js` → http://localhost:8787 |

## 3. 估值方法论（螺丝钉逻辑，勿改坏）

**分板块、分方法、不同阈值**（不是全市场统一百分位）：

1. **盈利收益率法（EP板块）**：盈利稳定品种（红利/上证50/50AH/H股/央视50等）。
   EP = 1/PE（按校准后螺丝钉 PE 计算）。绝对阈值：**EP>10% 绿（可投）/ 4%~10% 黄（持有）/ <4% 红（卖出）**。
   卖出线与当前 10 年期国债收益率 2 倍动态挂钩（当前国债 ~1.7%，定为 4%，避免原 6.4% 误将 6.32% 的上证180判红）。
   恒生/H股 EP 打 9 折（港股通税+换汇）。
2. **市盈率法（PE板块）**：盈利快速增长品种。PE 历史百分位 **<20% 绿 / 20%~80% 黄 / >80% 红**。
   百分位窗口 = 近 **10 年（2440 交易日）**。
3. **市净率法（PB板块）**：强周期（银行/证券/地产/军工/环保/煤炭）。PB 历史百分位同上阈值。
4. **全市场星级 vs 单品种星级**：
   - **全市场宏观星级**：`s = 5 - ln(PE/14.6)/ln(1.25)`，PE=中证全指(000985)官网剔除亏损TTM PE。>=4 绿 / >=2.5 黄 / else 红。
   - **单品种星级（方案2：全梯队连续分层）**：彻底废除粗暴百分位公式，建立与红黄绿严格平滑对齐的 1~5 星评级体系：
     - 绿区（低估可投）：**5 星**（极度低估 EP>11% 红利低波/消费50）、**4.5 星**（深度低估 EP>10.4% 白酒/沪港深低波）、**4 星**（标准低估 优选300/中证红利/医疗）；
     - 黄区（正常持有）：**3.5 星**（正常偏低 上证红利/证券）、**3 星**（正常中枢 50AH/恒指/银行/科技100）、**2.5 星**（正常偏高 上证180/央视50/中证500/红利机会）；
     - 红区（高估止盈）：**2 星**（偏高风险 纳斯达克100）、**1.5 星**（深度高估 标普科技）、**1 星**（极度泡沫 科创50）。
5. **巴菲特指标**：上证综指+深证综指总市值（东财 f20）÷ 最近年度GDP（东财 datacenter RPT_ECONOMY_GDP）。<60% 绿 / 60~100% 黄 / >100% 红。
6. **方案 B 螺丝钉口径主导**：
   - 主表格 PE/PB 列优先展示螺丝钉校准值（effPe = screwPe ?? pe，effPb = screwPb ?? pb），标有 `*` 悬停显示官方源；
   - 螺丝钉官方归属颜色（`color: 'green' | 'yellow' | 'red'`）直接配置在 `calibration.js` 的 `factors` 中，与图片 100% 匹配；
   - 彻底修复红利机会（蛋卷利润周期致百分位97.8%误判红，修正为黄区持有）、上证180（修正为黄区持有）、医疗/生物科技/恒生科技/中概互联（对齐螺丝钉绿区）。
7. **板块内排序切换**：顶部工具栏支持下拉切换：
   - 💼 **按持仓优先（默认）**：10 只持仓指数置顶，内部再按星级排列（最契合个人看盘需求）；
   - ⭐ **按星级排序**：星级降序，绿区（5~4星）置顶，黄区次之，红区垫底；
   - 🔤 **按名称排序**：拼音字母序（A~Z）。

## 4. 数据源与口径（核心认知）

| 数据 | 来源 | 口径 |
|---|---|---|
| 63 主流指数 PE/PB/百分位 | 蛋卷 `djapi/index_eva/dj` | 官方TTM **含亏损股** |
| 41+ 中证系指数 PE | 中证官网 `csindex-home/perf/indexCsiDsPe?indexCode=<无前缀代码>` | 官方TTM **剔除亏损**（更接近螺丝钉） |
| PB/股息率补源 | 乐咕乐股 `index-basic?indexCode=xxx` 页面 meta description（加权平均市净率/股息率，股息率÷100） | 剔亏口径 |
| 无乐咕数据的补源指数 | `CSI_FALLBACKS`（config/fetch.js） | 手工稳态值 |
| 场内价格 | 东财 push2delay `ulist.np`（f2最新/f18昨收，无日期） | 用腾讯 `qt.gtimg.cn/q=sh000001` 探针 parts[30] 补日期 |
| 场外净值 | 东财 `api.fund.eastmoney.com/f10/lsjz`（需 Referer: fundf10.eastmoney.com） | list[0]最新/list[1]前一日 |
| GDP/总市值 | 东财 datacenter + push2delay f20 | — |

**关键规则**：
- 有 fundCode 的指数**只用场内价格**，场内缺失置 null（绝不让场外联接净值 1.x 元顶替场内 3~4 元 ETF 价）。
- 中证官网接口失败会回退蛋卷口径并 console.warn（回退当日校准因子会失真，属假象）。
- 螺丝钉付费表（自研：剔亏+剔非经常损益+可能中位数）与所有免费源都有系统性偏差，这是客观数据源差异不是 bug。已用 calibration factors 把偏差量化。

## 5. 每日校准工作流（最高频任务）

用户提供当日螺丝钉估值表（5 板块全量，星级标注）→ 与系统**同日 dataDate** 的历史快照对照 → 追加校准记录 → 部署。

**步骤**：
1. `git fetch` 看远程是否被 Actions 推进；用 `site/data/history/<归档日>.json`，其 `dataDate` 必须与螺丝钉表日期一致才可对照。
2. 对 30 只 peFactor 指数 + 5 只 pbFactor 指数算实测比值（螺丝钉值/系统值）vs factors 偏差。持仓 11 只逐一列出；非持仓报 max/avg。
3. 偏差全部 <5% → 因子不动，只追加 `calibration.js` history 一条（date=表日期、source、note 含结论）。
4. **晚间蛋卷已翻新 dataDate 时不要重跑 fetch.js**（会覆盖当日 09:xx 已归档的快照）。改用**注入法**：node 脚本把 calibration 整体写入 `valuations.json` 与对应历史快照的 `.calibration` 字段（每文件仅 +几行 diff）。
5. 早上（当日快照尚未生成）可删 `history/<今日>.json` + `index.json` 后重跑 fetch.js。
6. commit → push（先 pull --rebase，见 §6）→ `& "C:\Users\i_fuc\AppData\Local\Programs\ghcli\bin\gh.exe" workflow run daily-valuation.yml -R xunopmx-bit/index-valuation` 触发部署 → `gh run view <id> -R ... --json status,conclusion` → node fetch 线上验证 calHist。

**校准工具链（2026-10 沉淀）**：`node scripts/calibrate.js <估值表.json> <快照.json>` 一键校验（星级自检/拟合分组/异常/持仓诊断/未映射行推荐）；加 `--apply` 重算预演，`--apply --write` 双写快照 calibration + valuations（等价步骤 4 注入法）；47 码表行名↔代码映射固化在 `scripts/calibration_map.js`。星级行为权威 = fetch.js calculateItemStar，脚本内联实现已与其对齐。

**已知观察点（对照时留意）**：
- 科创50：官网剔亏口径对亏损股名单敏感，实测因子偏差曾 3.2%→10~12% 单日放大，持续观察。
- 银行 PB：螺丝钉表自身在 0.84~0.95 波动，无法稳定校准，维持因子 1.346。
- 养老产业 SZ399812：官网剔亏 PE 财报季失真（9.5 vs 螺丝钉稳定 22.5），已加专用因子 2.35。
- EP 板块常驻分歧：上证红利/50AH/300价值/基本面50 系统绿（EP>10%）、螺丝钉黄（剔非经常损益后 <10%）——预期内，双口径显示即可。

**因子调整规则（趋近性校准，2026-10-22 起生效，禁止单日追调）**：

校准目标不是拟合单日数据，而是量化并跟踪「螺丝钉口径÷系统口径」的固定比值，长期无限趋近校准指标。三层机制各自边界：因子=静态口径差，禁止因单日偏差调整；颜色=永远跟随螺丝钉官方归属，同源即一致，不做推断；每日校准=监控与台账（检验因子是否失效），不是调参。

1. **量化触发线**：单日 |偏差| ≥10% 仅记录不调整；同一品种同一指标（PE 或 PB）**连续 10 个校准日中位偏差 ≥5% → 触发因子复估**（每日校准 note 更新在册项连续计数）。复估取近 20 个校准日「表值÷快照值」比值的中位数作为新因子候选（窗口中位数抗单日噪声），当日单日值仅做 sanity check；复估必须在 history note 写明归因（官网剔亏名单变动 / 螺丝钉侧口径调整 / 数据源口径漂移），禁止无归因的拟合性微调。
2. **月度因子体检**：每月首个校准日执行全表体检——纯 A 股 PE/PB 分组 avg 应 ≈0（|avg|<2%）且无品种存在 >5% 的持续 bias；结论写入当次 history note，作为「趋近程度」的量化度量；体检发现持续 bias 走规则 1 复估。

**在册观察项（截至 10-16 校准）**：
- 科创50 PE：**复估后计数第 4 日**——新因子 1.423 下当日偏差 -3.9%（10-13 -2.8%、10-14 -4.1%、10-15 -3.9%），连续 <5%，复估有效。
- 科技100 PB -15.2%（连续 11 日 ≥5%，触发复估条件暂缓中：偏差自 -7.2% 单调走阔未见平台、表值 2.44→2.23 持续下移而快照 pb 恒 3.5 疑系统侧 PB 源停更、近 20 校准日比值仅观察期 11 个在案不满足完整中位数要求，比照科创50 待平台稳定后复估，重点观察）
- 基本面120 PE +8.7%（**连续 10 日触发复估条件，暂缓复估**：9-29 起 6.13/6.11/6.11/6.57/6.30/6.82/7.2/8.1/8.4/8.68 中位 ≈6.7% 触线，但偏差单调走阔未见平台、近 20 校准日比值仅 10 个在案不满足完整中位数要求，比照科技100 PB 案例；在案 10 比值中位 ≈1.4265 记为参考候选，当日比值 1.4530 偏 +1.9%；重点观察）
- 基本面120 PB +6.9%（与 PE 同源口径漂移，10-13 +5.7%、10-14 +6.5%、10-15 +6.8%、10-16 +6.9%，随 PE 一并跟踪）
- 沪深300 PE -10.8%（连续 7 日 ≥5%：5.66/5.59/6.76/7.3/9.3/10.8/10.75，末两日持平平台初现（表值 11.97→11.99、快照 12.87→12.88 双侧微升），疑螺丝钉侧下修口径后暂稳；近 20 校准日比值仅 7 个在案，维持暂缓，若平台确认 2~3 日可优先归因复估）
- 中证A500 PB -9.1%（连续 5 日 ≥5%：6.19/6.2/7.6/9.5/9.05 高位趋缓，快照 pb 恒 1.5）
- 中证500 PE -8.7%（连续 5 日 ≥5%：5.0/5.1/6.7/8.6/8.7 走阔趋缓，表值下移快于快照）
- 上证50 PE -5.6%、沪深300 PB -5.9%、中概互联 PB -5.8%、科创50 PB +5.8%（各连续 3 日）
- 上证红利 PE -5.2%/PB -5.6%、中证A100 PE -5.6%、央视50 PB -5.2%、上证180 PB -5.6%、红利机会 PB -5.4%（各连续 2 日）
- 新增单日观察（10-16）：生物科技 PB -5.4%
- 解除：纳指 PB（10-16 -3.0% 回落，连续 3 日终结）

## 6. Git 铁律（远程有 Actions bot 自动提交）

```bash
# push 前必做（远程几乎总有 Actions 新提交）：
git -c core.editor=true pull --rebase origin main

# rebase 冲突在 valuations.json / history/*.json 时（rebase 语义：--ours=上游远端 cron 数据，--theirs=本地被重放提交）：
#   方案 A：保留本地版本（含新校准）：
git checkout --theirs <冲突文件>
git add <冲突文件>
git -c core.editor=true rebase --continue
#   方案 B（推荐）：保留远端 cron 新数据 + 重注入校准（避免本地旧 updatedAt/因子顶掉远端新行情）：
git checkout --ours <冲突文件>
git add <冲突文件>
node scripts/calibrate.js --val-only        # 重算星级 5 字段 + 注入 calibration 块到 valuations.json
git add site/data/valuations.json
git -c core.editor=true rebase --continue
#   或者：重跑 node scripts/fetch.js 生成新数据覆盖（仅早上可做，见 §5 步骤 5）

# gh CLI 在本机不在 PATH，用全路径；触发部署需 -R 显式指定仓库。
```

## 7. 本地操作陷阱清单

- fetch.js「同日归档跳过」：dateStr===最近快照归档日 即 return。重跑前先删 `history/<今日>.json`；若 index.json 仍含当日则连 index.json 一起删（readHistoryIndex 会扫描目录重建，但**只在文件缺失时触发**——index.json 内容残缺时不会重建，需手工修复）。
- index.json 只剩 1 天的修复：`fs.readdirSync(dir).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f=>f.slice(0,10)).sort()` 重建。
- **永远不要 `Remove-Item site/data/history/*.json`**（曾致历史快照丢失，靠 git 历史恢复）。
- calibration.js note 字符串内不能嵌套 ASCII 单引号（用中文引号「」），否则 node SyntaxError。
- Node fetch 访问外网 OK；PowerShell 直连外网不通。新版 Actions runner 网络偶发慢，fetch.js 重跑给 timeout 240000ms。
- 蛋卷估值日期 `dataDate`（MM-DD）与北京归档日 `date`（YYYY-MM-DD）是两个概念；蛋卷周末不更新，周一早 Actions 归档周一但 dataDate=上周五。

## 8. 持仓（11 只，hold:true）

上证红利 SH000015(510880)、50AH优选 SH000170(501050)、H股 HKHSCEI(510900,ep 9折)、消费50 931139(515650)、中证白酒 SZ399997(161725)、中证医疗 SZ399989(512170)、中证A500 930050(159338)、科技100 931187(515580)、科创100 000698(588030)、中证500 SH000905(场内 161017 富国500增强LOF，非510580)、红利机会 CSPSADRP(501029)。
（生物科技 930743 已于 9-3 移除持仓；基本面60 SZ399701 于 9-22 移除持仓，并切回蛋卷源，恢复 56.9% 百分位对应螺丝钉黄色持有区间。）

## 9. 新设备迁移（本项目迁移到此设备时的验证）

```bash
node scripts/fetch.js   # 期望输出: 68指数、整体星级4.x、归档日=今天
node server.js          # http://localhost:8787 看板可开
```
若 fetch.js 因「同日跳过」无输出属正常（Actions 已归档今天）。要求：Node ≥20；无需 npm install；需要能访问 GitHub/蛋卷/中证官网/东财的网络（本机曾走系统代理 127.0.0.1:7897）。
