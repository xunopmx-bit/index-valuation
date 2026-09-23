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
  - 前一日为非交易日或同日重复运行时自动跳过（不写文件，无 commit）
- 当前规模：68 指数、12 持仓、365 天历史归档、螺丝钉口径校准因子 35 个

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
   EP = 1/PE。绝对阈值：**EP>10% 绿（可投）/ 6.4%~10% 黄（持有）/ <6.4% 红（卖出）**。
   恒生/H股 EP 打 9 折（港股通税+换汇）。
2. **市盈率法（PE板块）**：盈利快速增长品种。PE 历史百分位 **<20% 绿 / 20%~80% 黄 / >80% 红**。
   百分位窗口 = 近 **10 年（2440 交易日）**（5 年窗口过短过敏感，曾致中证500 判红与螺丝钉黄分歧，已修复）。
3. **市净率法（PB板块）**：强周期（银行/证券/地产/军工/环保/煤炭）。PB 历史百分位同上阈值。
4. **市场星级**：`s = 5 - ln(PE/14.6)/ln(1.25)`，PE=中证全指(000985)官网剔除亏损TTM PE。
   锚点验证：2024熊底 PE=11.94→5.9星；2026-08-31 PE=18.27→4星；2015顶 PE=31.64→1.5星。
   4~5星可投、3星暂停申购、1~2星不可买。前端 >=4 绿 / >=2.5 黄 / else 红。
5. **巴菲特指标**：上证综指+深证综指总市值（东财 f20）÷ 最近年度GDP（东财 datacenter RPT_ECONOMY_GDP）。<60% 绿 / 60~100% 黄 / >100% 红。
6. **方案 B 螺丝钉口径主导**：主表格 PE/PB 列优先展示螺丝钉校准值（effPe = screwPe ?? pe），悬停显示官方源数值；EP 板块根据螺丝钉 PE 计算 EP，使状态颜色与螺丝钉判断完全对齐（用户明确决策方案 B，使长期校准成果真正落地到看板核心数值中）。

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

**已知观察点（对照时留意）**：
- 科创50：官网剔亏口径对亏损股名单敏感，实测因子偏差曾 3.2%→10~12% 单日放大，持续观察。
- 银行 PB：螺丝钉表自身在 0.84~0.95 波动，无法稳定校准，维持因子 1.346。
- 养老产业 SZ399812：官网剔亏 PE 财报季失真（9.5 vs 螺丝钉稳定 22.5），已加专用因子 2.35。
- EP 板块常驻分歧：上证红利/50AH/300价值/基本面50 系统绿（EP>10%）、螺丝钉黄（剔非经常损益后 <10%）——预期内，双口径显示即可。

## 6. Git 铁律（远程有 Actions bot 自动提交）

```bash
# push 前必做（远程几乎总有 Actions 新提交）：
git -c core.editor=true pull --rebase origin main

# rebase 冲突在 valuations.json / history/*.json 时：
#   要保留自己的版本（含新校准）：
git checkout --theirs <冲突文件>
git add <冲突文件>
git -c core.editor=true rebase --continue
#   或者：重跑 node scripts/fetch.js 生成新数据覆盖（仅早上可做，见 §5.4）

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
