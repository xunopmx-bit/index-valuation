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
    { index_code: "SZ399317", method: "PE", section: "市盈率法", name: "国证A指", fundFcode: "005414" },
    { index_code: "CSPSADRP", method: "PE", section: "市盈率法", hold: true, name: "红利机会", fundCode: "501029", fundFcode: "501029" },
    { index_code: "SZ399701", method: "PE", section: "市盈率法", hold: true, name: "基本面60", fundCode: "159916", fundFcode: "530015" },
    { index_code: "SZ399702", method: "PE", section: "市盈率法", name: "基本面120", fundCode: "159910", fundFcode: "070023" },
    { index_code: "SZ399997", method: "PE", section: "市盈率法", hold: true, name: "中证白酒", fundCode: "161725", fundFcode: "161725" },
    { index_code: "SZ399989", method: "PE", section: "市盈率法", hold: true, name: "中证医疗", fundCode: "512170", fundFcode: "001417" },
    { index_code: "SH000991", method: "PE", section: "市盈率法", name: "全指医药", fundCode: "159938", fundFcode: "001180" },
    { index_code: "SH000978", method: "PE", section: "市盈率法", name: "医药100", fundFcode: "001550" },
    { index_code: "SH000932", method: "PE", section: "市盈率法", name: "主要消费", fundCode: "510630", fundFcode: "000248" },
    { index_code: "SH000989", method: "PE", section: "市盈率法", name: "全指可选", fundCode: "159936", fundFcode: "001133" },
    { index_code: "SZ399396", method: "PE", section: "市盈率法", name: "国证食品", fundCode: "159862", fundFcode: "160222" },
    { index_code: "SH000919", method: "EP", section: "盈利收益率法", name: "300价值", fundCode: "562320", fundFcode: "310398" },
    { index_code: "SZ399324", method: "PE", section: "市盈率法", name: "深证红利", fundCode: "159905", fundFcode: "481012" },
    { index_code: "SZ399812", method: "PE", section: "市盈率法", name: "养老产业", fundCode: "516560", fundFcode: "000968" },
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
    { index_code: "CSI931142", method: "PE", section: "市盈率法", name: "东证竞争", fundFcode: "007658" },
    { index_code: "CSI931157", method: "EP", section: "盈利收益率法", name: "沪港深红利低波", fundFcode: "007751" },
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
    { index_code: "HKHSSCNE", method: "PE", section: "海外市场", name: "新经济", fundCode: "513320" },
    { index_code: "CSIH30094", method: "PE", section: "市盈率法", name: "消费红利", fundFcode: "008928" },
    { index_code: "931139", method: "PE", section: "市盈率法", hold: true, name: "消费50", fundCode: "515650", fundFcode: "014208", source: "csindex" },
    { index_code: "930743", method: "PE", section: "市盈率法", hold: true, name: "生物科技", fundCode: "159837", fundFcode: "011117", source: "csindex" },
    { index_code: "931187", method: "PE", section: "市盈率法", hold: true, name: "科技100", fundCode: "515580", fundFcode: "008399", source: "csindex" },
  ],

  // ============ 人民币债券估值表（银行螺丝钉专属固收板块） ============
  bonds: [
    {
      name: "3-5年期国开债",
      code: "CDB35",
      type: "政策金融债",
      strategy: "流动性储备/防守底仓",
      duration: 3.46,
      ytm: 0.01509,
      ret1y: 0.0250,
      ret3y: 0.03159,
      ret5y: 0.03439,
      maxDrawdown5y: -0.0123,
      fundFcode: "014101",
      baseDate: "2011-12-31",
      desc: "中短期高等级政金债，波动小，近5年最大回撤仅-1.23%，适合作为防守现金流与随时加仓股票的子弹库"
    },
    {
      name: "3-5年期政金债",
      code: "PFB35",
      type: "政策金融债",
      strategy: "流动性储备/防守底仓",
      duration: 3.44,
      ytm: 0.01509,
      ret1y: 0.02529,
      ret3y: 0.03180,
      ret5y: 0.03450,
      maxDrawdown5y: -0.01209,
      fundFcode: "011983",
      baseDate: "2011-12-31",
      desc: "国家信用背书，免税且收益稳健，与3-5年国开债类似，适合作为极低波动的防守底仓"
    },
    {
      name: "5年期国债",
      code: "CGB5",
      type: "国债",
      strategy: "稳健防守/中期平衡",
      duration: 4.32,
      ytm: 0.0137,
      ret1y: 0.0270,
      ret3y: 0.0348,
      ret5y: 0.0346,
      maxDrawdown5y: -0.0143,
      fundCode: "511010",
      fundFcode: "511010",
      baseDate: "2007-12-31",
      desc: "中期纯国债指数ETF，国家主权信用，流动性极佳，适合股债平衡策略的中期稳健配置"
    },
    {
      name: "中债-新综合",
      code: "CBI_COMP",
      type: "综合债券",
      strategy: "全市场综合配置",
      duration: 5.68,
      ytm: 0.0160,
      ret1y: 0.0260,
      ret3y: 0.0411,
      ret5y: 0.0411,
      maxDrawdown5y: -0.0173,
      fundCode: "161119",
      fundFcode: "161119",
      baseDate: "2001-12-31",
      desc: "覆盖中国债券全市场的旗舰综合指数，兼顾收益与流动性，5年年化4.11%，经典固收底仓标的"
    },
    {
      name: "7-10年期政金债",
      code: "PFB710",
      type: "长期政金债",
      strategy: "中长久期波段/增厚收益",
      duration: 7.38,
      ytm: 0.0163,
      ret1y: 0.0318,
      ret3y: 0.0487,
      ret5y: 0.0491,
      maxDrawdown5y: -0.02439,
      fundCode: "511520",
      fundFcode: "018266",
      baseDate: "2011-12-31",
      desc: "久期适中偏长，5年年化达4.91%，适合在利率下行期博取资本利得，回撤可控（5年最大-2.4%）"
    },
    {
      name: "10年期国债",
      code: "CGB10",
      type: "长期国债",
      strategy: "长久期资产/宏观利率晴雨表",
      duration: 7.58,
      ytm: 0.0157,
      ret1y: 0.0325,
      ret3y: 0.04849,
      ret5y: 0.04529,
      maxDrawdown5y: -0.02149,
      fundCode: "511260",
      fundFcode: "511260",
      baseDate: "2008-12-31",
      desc: "全市场无风险利率核心锚，兼具收益性与进攻性，是股债性价比衡量与长期利率对冲的基准"
    },
    {
      name: "30年期国债",
      code: "CGB30",
      type: "超长期国债",
      strategy: "超长久期进攻/降息周期利器",
      duration: 20.34,
      ytm: 0.0213,
      ret1y: 0.0020,
      ret3y: 0.0764,
      ret5y: 0.0762,
      maxDrawdown5y: -0.08519,
      fundCode: "511090",
      fundFcode: "511090",
      baseDate: "2010-12-31",
      desc: "超大久期（20.3年），利率每降1%价格约涨20%，5年年化超7.6%，但波动与回撤极大（近5年回撤-8.5%），适合专业波段操作"
    }
  ],

  // 固定收益补充品种
  fixedIncomeOther: [
    { name: "可转债基金", type: "可转债", fundFcode: "519977", desc: "股债二象性，下有债底保护，上有股票上涨弹性" },
    { name: "美国房地产REITs", type: "海外REITs", fundCode: "VNQ", fundFcode: "000179", yield: 0.0354, desc: "海外优质商业地产收租，股息率约3.5%，与国内股市相关性低" },
    { name: "货币基金", type: "现金管理", fundFcode: "003474", desc: "极高流动性，随时用于股票大跌时的补仓弹药" }
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
