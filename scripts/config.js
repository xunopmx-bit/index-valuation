// 指数估值方法配置
// method: 'EP' 盈利收益率法（盈利稳定品种） / 'PE' 市盈率法（盈利快速成长/宽基/消费医药） / 'PB' 市净率法（强周期/重资产行业）
// section: 展示板块分组
// hold: 用户实际持仓/定投标的
// fundCode: 场内基金代码, fundFcode: 场外基金代码

module.exports = {
  indexes: [
    // ============ 盈利收益率法板块（盈利稳定品种，EP>10%可投） ============
    { index_code: "SH000015", method: "EP", section: "盈利收益率法", hold: true, name: "上证红利", fundCode: "510880", fundFcode: "012761" },
    { index_code: "SH000925", method: "EP", section: "盈利收益率法", name: "基本面50", fundCode: "512750", fundFcode: "160716" },
    { index_code: "SH000170", method: "EP", section: "盈利收益率法", hold: true, name: "50AH优选", fundCode: "501050", fundFcode: "501050" },
    { index_code: "HKHSCEI", method: "EP", section: "盈利收益率法", hold: true, name: "H股指数", fundCode: "510900", fundFcode: "110031", epDiscount: 0.9 },
    { index_code: "HKHSI", method: "EP", section: "盈利收益率法", name: "恒生指数", fundCode: "159920", fundFcode: "000071", epDiscount: 0.9 },
    { index_code: "SH000016", method: "EP", section: "盈利收益率法", name: "上证50", fundCode: "510100", fundFcode: "110003" },
    { index_code: "SZ399550", method: "EP", section: "盈利收益率法", name: "央视50", fundCode: "159965", fundFcode: "217027" },
    { index_code: "SH000010", method: "EP", section: "盈利收益率法", name: "上证180", fundCode: "510180", fundFcode: "040180" },
    { index_code: "SH000922", method: "EP", section: "盈利收益率法", name: "中证红利", fundCode: "515080", fundFcode: "012644" },
    { index_code: "CSIH30269", method: "EP", section: "盈利收益率法", name: "红利低波", fundCode: "512890", fundFcode: "007466" },
    { index_code: "CSI930740", method: "EP", section: "盈利收益率法", name: "300红利LV", fundCode: "512530", fundFcode: "007606" },

    // ============ 市盈率法板块（博格公式，盈利快速成长/宽基/消费医药） ============
    { index_code: "SH000300", method: "PE", section: "市盈率法", name: "沪深300", fundCode: "510310", fundFcode: "021832" },
    { index_code: "SH000905", method: "PE", section: "市盈率法", hold: true, name: "中证500", fundCode: "510580", fundFcode: "011964" },
    { index_code: "SH000852", method: "PE", section: "市盈率法", name: "中证1000", fundCode: "159633", fundFcode: "024091" },
    { index_code: "SZ399006", method: "PE", section: "市盈率法", name: "创业板指", fundCode: "159915", fundFcode: "161022" },
    { index_code: "SH000688", method: "PE", section: "市盈率法", name: "科创50", fundCode: "588280", fundFcode: "021484" },
    { index_code: "SH000903", method: "PE", section: "市盈率法", name: "中证100", fundCode: "512910", fundFcode: "213010" },
    { index_code: "SZ399001", method: "PE", section: "市盈率法", name: "深证成指", fundCode: "159943", fundFcode: "163109" },
    { index_code: "SZ399330", method: "PE", section: "市盈率法", name: "深证100", fundCode: "159901", fundFcode: "161227" },
    { index_code: "SZ399317", method: "PE", section: "市盈率法", name: "国证A指", fundCode: "005414", fundFcode: "005414" },
    { index_code: "CSPSADRP", method: "PE", section: "市盈率法", hold: true, name: "红利机会", fundCode: "501029", fundFcode: "501029" },
    { index_code: "SZ399701", method: "PE", section: "市盈率法", hold: true, name: "基本面60", fundCode: "159916", fundFcode: "530015" },
    { index_code: "SZ399702", method: "PE", section: "市盈率法", name: "基本面120", fundCode: "159910", fundFcode: "070023" },
    { index_code: "SZ399997", method: "PE", section: "市盈率法", hold: true, name: "中证白酒", fundCode: "161725", fundFcode: "161725" },
    { index_code: "SZ399989", method: "PE", section: "市盈率法", hold: true, name: "中证医疗", fundCode: "512170", fundFcode: "001417" },
    { index_code: "SH000991", method: "PE", section: "市盈率法", name: "全指医药", fundCode: "512010", fundFcode: "001180" },
    { index_code: "SH000978", method: "PE", section: "市盈率法", name: "医药100", fundCode: "159938", fundFcode: "001550" },
    { index_code: "SH000932", method: "PE", section: "市盈率法", name: "主要消费", fundCode: "510630", fundFcode: "000248" },
    { index_code: "SH000989", method: "PE", section: "市盈率法", name: "全指可选", fundCode: "159936", fundFcode: "001133" },
    { index_code: "SZ399396", method: "PE", section: "市盈率法", name: "国证食品", fundCode: "159862", fundFcode: "160222" },
    { index_code: "SH000919", method: "PE", section: "市盈率法", name: "300价值", fundCode: "562320", fundFcode: "310398" },
    { index_code: "SZ399324", method: "PE", section: "市盈率法", name: "深证红利", fundCode: "159905", fundFcode: "481012" },
    { index_code: "SZ399812", method: "PE", section: "市盈率法", name: "养老产业", fundCode: "516860", fundFcode: "000968" },
    { index_code: "CSIH30533", method: "PE", section: "市盈率法", name: "中概互联50", fundCode: "513050", fundFcode: "006327" },
    { index_code: "CSIH11136", method: "PE", section: "市盈率法", name: "中国互联", fundCode: "164906", fundFcode: "164906" },
    { index_code: "HKHSTECH", method: "PE", section: "市盈率法", name: "恒生科技", fundCode: "513180", fundFcode: "012349" },
    { index_code: "CSI931087", method: "PE", section: "市盈率法", name: "科技龙头", fundCode: "515000", fundFcode: "007873" },
    { index_code: "SH000993", method: "PE", section: "市盈率法", name: "全指信息", fundCode: "512330", fundFcode: "002974" },
    { index_code: "CSI930652", method: "PE", section: "市盈率法", name: "中证电子", fundCode: "515260", fundFcode: "012651" },
    { index_code: "SZ399610", method: "PE", section: "市盈率法", name: "TMT50", fundCode: "159909", fundFcode: "160224" },
    { index_code: "CSI931079", method: "PE", section: "市盈率法", name: "5G通讯", fundCode: "515050", fundFcode: "008086" },
    { index_code: "SZ399417", method: "PE", section: "市盈率法", name: "新能源车", fundCode: "515030", fundFcode: "160225" },
    { index_code: "SZ399971", method: "PE", section: "市盈率法", name: "中证传媒", fundCode: "512980", fundFcode: "004752" },
    { index_code: "SZ399998", method: "PB", section: "市净率法", name: "中证煤炭", fundCode: "515220", fundFcode: "008279" },
    { index_code: "CSI931142", method: "PE", section: "市盈率法", name: "东证竞争", fundCode: "515110", fundFcode: "007658" },
    { index_code: "CSI931157", method: "PE", section: "市盈率法", name: "红利成长LV", fundCode: "515880", fundFcode: "007751" },
    { index_code: "SH000827", method: "PB", section: "市净率法", name: "中证环保", fundCode: "512580", fundFcode: "001064" },
    { index_code: "CSI930782", method: "PE", section: "市盈率法", name: "500低波", fundCode: "512260", fundFcode: "003318" },
    { index_code: "HSFML25", method: "PE", section: "市盈率法", name: "香港大盘", fundCode: "501301", fundFcode: "501301" },
    { index_code: "SPHCMSHP", method: "PE", section: "市盈率法", name: "香港中小", fundCode: "501021", fundFcode: "501021" },
    { index_code: "CSI716567", method: "PE", section: "市盈率法", name: "MSCI中国", fundCode: "512160", fundFcode: "006314" },

    // ============ 市净率法板块（强周期/重资产行业） ============
    { index_code: "SZ399986", method: "PB", section: "市净率法", name: "中证银行", fundCode: "512800", fundFcode: "001594" },
    { index_code: "SZ399975", method: "PB", section: "市净率法", name: "证券公司", fundCode: "512000", fundFcode: "007992" },
    { index_code: "SZ399393", method: "PB", section: "市净率法", name: "国证地产", fundCode: "512200", fundFcode: "160218" },
    { index_code: "SZ399967", method: "PB", section: "市净率法", name: "中证军工", fundCode: "512680", fundFcode: "161024" },

    // ============ 海外市场（市盈率法） ============
    { index_code: "SP500", method: "PE", section: "海外市场", name: "标普500", fundCode: "513500", fundFcode: "050025" },
    { index_code: "NDX", method: "PE", section: "海外市场", name: "纳斯达克100", fundCode: "513100", fundFcode: "040046" },
    { index_code: "GDAXI", method: "PE", section: "海外市场", name: "德国DAX", fundCode: "513030", fundFcode: "000614" },
    { index_code: "935600", method: "PE", section: "海外市场", name: "MSCI印度", fundCode: "164824", fundFcode: "164824" },
    { index_code: "SPACEVCP", method: "PE", section: "海外市场", name: "标普价值", fundCode: "501310", fundFcode: "501310" },
    { index_code: "SPCQVCP", method: "PE", section: "海外市场", name: "标普质量", fundCode: "501069", fundFcode: "501069" },
    { index_code: "HKHSSCNE", method: "PE", section: "海外市场", name: "新经济", fundCode: "501312", fundFcode: "501312" },
    { index_code: "CSIH30094", method: "PE", section: "市盈率法", name: "消费红利", fundCode: "159928", fundFcode: "008928" },

    // ============ 用户标的但数据源缺失（需扩展） ============
    // 科技100（515580/010202）、生物科技、消费50 —— 蛋卷API无数据，后续补源
  ],

  // 整体市场星级基准（用户认可口径：沪深300+中证500+中证800 加权）
  // 蛋卷无中证800，用 沪深300 + 中证500 等权近似
  starBenchmark: ["SH000300", "SH000905"],

  // 红黄绿阈值（按历史百分位，适用于 PE/PB 方法）
  colorThreshold: { low: 0.2, high: 0.8 },

  // 盈利收益率法（EP）绝对阈值（格雷厄姆法标准，来源于《指数基金投资指南》）
  // EP > 10% → 低估可投(绿)；6.4% ~ 10% → 持有(黄)；< 6.4% → 卖出(红)
  epThreshold: { buy: 0.10, sell: 0.064 },

  // 港股指数盈利收益率折扣（港股通分红税+换汇费用侵蚀收益，参考值9折）
  epDiscount: 0.9,

  // 强周期单品种仓位上限
  pbSingleLimit: 0.10,

  // 加仓公式（定期不定额）
  // 应投金额 = 上月实际投入 × (上期便宜度 / 当期便宜度)²
  investFormula: {
    base: "monthly",
    amount: 8000, // 默认月定投总额，可配置
    exponent: 2
  }
};
