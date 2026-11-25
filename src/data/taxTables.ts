/**
 * 税表数据（按国家/地区与年度）。
 *
 * 口径约定（与 src/wasm/bridge.ts EstimateTaxInput 对齐）：
 * - standardDeduction 为当地货币/年的标准扣除（或等效免征额），在 note 中注明本币口径；
 * - bands 作用于「应纳税所得额 = max(0, 总收入 − standardDeduction)」，lower 升序，
 *   第 i 档覆盖 [lower_i, lower_{i+1})，末档到 +∞，rate 为小数形式；
 * - 中国官方按「全额累进 + 速算扣除数」计算，结果与本表「分段累进」完全一致，
 *   原速算表已按 ask 要求写入 note；
 * - 各国均未含社保/国民保险/地方税/附加税等，详见各表 note。
 *
 * 每套 note 均含固定声明（年度句随表内 year 同步：「内置简化税率表，基于 {年度} 年公开税档，
 * 不构成税务建议」——US/DE 表升 2026 后各表声明为对应年度字面量）。
 * 查证方式：WebSearch/WebFetch 官方与权威来源（见各 note），2026-11 查证。
 */
import type { TaxTable } from "./types";

/**
 * @data-meta
 *   YEAR: === 各表结构化 year 字段（L2 机读一致，check:data 组 K3 断言；头块省略 YEAR）
 *   CHECKED_AT: T1–T5=2026-11-24（官方直读/采值轮）；T6/T8/T9=2026-11（查证轮复核受限）；T7=2026-11
 *   SOURCE_TYPE: T1/T4/T6/T8/T9=official；T2/T3=media（Rev. Proc. 2025-32 经 Tax Foundation 转载核对）；T5/T7=official
 *   EXPIRY: L2（法规/税表类——表内 year 落后当前适用年度即提示）
 *   SOURCE: 逐表内联（见各条目上方 @data-meta 单行注释与 note）
 */
/** 税表区域固定声明（需求固定文案；每套税表 note 首句均含本声明，UI 据 disclaimerIncluded 去重显示） */
export const TAX_TABLE_DISCLAIMER = "内置简化税率表，基于 2025/2026 年公开税档（逐表年份见表内 note 首句），不构成税务建议。";

export const TAX_TABLES: TaxTable[] = [
  {
    // @data-meta YEAR=2025 CHECKED_AT=2026-11-24 SOURCE_TYPE=official EXPIRY=L2
    // （个税法税率表 2019 起施行、延续不变；审计日未见修法迹象）
    countryCode: "CN",
    name: "中国综合所得税率（年度）",
    year: 2025,
    // 减除费用 6 万元/年（个税起征点每月 5,000 元）；专项扣除（三险一金）与
    // 专项附加扣除未纳入本简化表
    standardDeduction: 60000,
    bands: [
      { lower: 0, rate: 0.03 },
      { lower: 36000, rate: 0.1 },
      { lower: 144000, rate: 0.2 },
      { lower: 300000, rate: 0.25 },
      { lower: 420000, rate: 0.3 },
      { lower: 660000, rate: 0.35 },
      { lower: 960000, rate: 0.45 },
    ],
    disclaimerIncluded: true,
    note:
      "内置简化税率表，基于 2025 年公开税档，不构成税务建议。" +
      "来源：财政部/国家税务总局《个人所得税法》综合所得税率表（2019 年起施行，2025 年延续不变；上海市税务局官网发布口径，2025 年查证）。" +
      "口径：年度应纳税所得额 = 综合所得 − 60,000 元减除费用 −（简化未纳入的）专项扣除与专项附加扣除；本表 bands 为等效分段累进。" +
      "原速算扣除数表（全年，级数/区间/税率/速算扣除数）：1 / ≤36,000 元 / 3% / 0；" +
      "2 / 36,000–144,000 元 / 10% / 2,520；3 / 144,000–300,000 元 / 20% / 16,920；" +
      "4 / 300,000–420,000 元 / 25% / 31,920；5 / 420,000–660,000 元 / 30% / 52,920；" +
      "6 / 660,000–960,000 元 / 35% / 85,920；7 / >960,000 元 / 45% / 181,920。" +
      "按月累计预扣法使用的预扣率表与年度表一致（速算扣除数为按月换算口径）；" +
      "本表分段累进计算结果与「全额累进 − 速算扣除数」完全一致。" +
      "不含经营所得、劳务报酬单独计税等其他税目，不含年终奖单独计税选择。",
  },
  {
    // @data-meta YEAR=2026 CHECKED_AT=2026-11-24 SOURCE_TYPE=media EXPIRY=L2
    // （Rev. Proc. 2025-32 经 Tax Foundation 整理页转载核对；表值原始查证轮 2025-11）
    countryCode: "US",
    name: "美国联邦所得税（2026，单身）",
    year: 2026,
    // IRS Rev. Proc. 2025-32（2025-10 发布）：2026 税年标准扣除 16,100 美元
    standardDeduction: 16100,
    bands: [
      { lower: 0, rate: 0.1 },
      { lower: 12400, rate: 0.12 },
      { lower: 50400, rate: 0.22 },
      { lower: 105700, rate: 0.24 },
      { lower: 201775, rate: 0.32 },
      { lower: 256225, rate: 0.35 },
      { lower: 640600, rate: 0.37 },
    ],
    disclaimerIncluded: true,
    note:
      "内置简化税率表，基于 2026 年公开税档，不构成税务建议。" +
      "来源：IRS Rev. Proc. 2025-32（2026 税档，2025-10 发布，经 Tax Foundation 整理页转载核对，2026-11-24 读取）。" +
      "口径：七档边际税率作用于应税所得（gross − standardDeduction），bands 即官方税档本身。" +
      "不含州/地方所得税、长期资本利得特殊税率、FICA 工薪税、替代性最低税（AMT）。",
  },
  {
    // @data-meta YEAR=2026 CHECKED_AT=2026-11-24 SOURCE_TYPE=media EXPIRY=L2
    // （同 T2：Rev. Proc. 2025-32 经 Tax Foundation 转载核对）
    countryCode: "US",
    name: "美国联邦所得税（2026，已婚合并申报）",
    year: 2026,
    // IRS Rev. Proc. 2025-32：2026 税年已婚合并申报标准扣除 32,200 美元
    standardDeduction: 32200,
    bands: [
      { lower: 0, rate: 0.1 },
      { lower: 24800, rate: 0.12 },
      { lower: 100800, rate: 0.22 },
      { lower: 211400, rate: 0.24 },
      { lower: 403550, rate: 0.32 },
      { lower: 512450, rate: 0.35 },
      { lower: 768700, rate: 0.37 },
    ],
    disclaimerIncluded: true,
    note:
      "内置简化税率表，基于 2026 年公开税档，不构成税务建议。" +
      "来源：IRS Rev. Proc. 2025-32（2026 税档，2025-10 发布，经 Tax Foundation 整理页转载核对，2026-11-24 读取）。" +
      "口径：已婚合并申报（Married Filing Jointly）税档，作用于应税所得（gross − standardDeduction）。" +
      "不含州/地方所得税、长期资本利得特殊税率、FICA 工薪税、AMT；户主（Head of Household）等申报状态未提供。",
  },
  {
    // @data-meta YEAR=2025 CHECKED_AT=2026-11-24 SOURCE_TYPE=official EXPIRY=L2
    // （GOV.UK 官方页直读：2026/27 年度免税额与税档上限冻结延续、数值零变化，year 标注顺延登记）
    countryCode: "GB",
    name: "英国个人所得税（2025/26，英格兰·威尔士·北爱尔兰）",
    year: 2025,
    // 个人免税额（Personal Allowance），英格兰/威尔士/北爱尔兰口径
    standardDeduction: 12570,
    bands: [
      { lower: 0, rate: 0.2 },
      { lower: 37700, rate: 0.4 },
      { lower: 112570, rate: 0.45 },
    ],
    disclaimerIncluded: true,
    note:
      "内置简化税率表，基于 2025 年公开税档，不构成税务建议。" +
      "来源：GOV.UK「Income Tax rates and Personal Allowances」与英国下议院图书馆 2025/26 年度税率简报（2025-11 查证）。" +
      "口径：个人免税额 12,570 英镑自 2021/22 年度冻结至今；bands 作用于免税后应税所得：" +
      "0–37,700 英镑 20%（基本税率，对应总收入 ≤50,270）、37,700–112,570 英镑 40%（高税率，对应总收入 ≤125,140）、以上 45%（附加税率）。" +
      "未含：苏格兰另设税档（与 EWN 不同）、国民保险（NIC）、股息税率、免税额 100,000 英镑以上递减（taper）规则。",
  },
  {
    // @data-meta YEAR=2026 CHECKED_AT=2026-11-24 SOURCE_TYPE=official EXPIRY=L2
    // （§32a EStG 官方法条库 gesetze-im-internet.de 直读；2026 公式全段重推）
    countryCode: "DE",
    name: "德国所得税（2026，单身基础税率）",
    year: 2026,
    // Grundfreibetrag（基础免税额）2026 = 12,348 欧；本表 bands 作用于 zvE − 12,348
    standardDeduction: 12348,
    bands: [
      { lower: 0, rate: 0.154 },
      { lower: 1817, rate: 0.189 },
      { lower: 3634, rate: 0.219 },
      { lower: 5451, rate: 0.258 },
      { lower: 18472, rate: 0.307 },
      { lower: 31491, rate: 0.353 },
      { lower: 44511, rate: 0.397 },
      { lower: 57530, rate: 0.42 },
      { lower: 265478, rate: 0.45 },
    ],
    disclaimerIncluded: true,
    note:
      "内置简化税率表，基于 2026 年公开税档，不构成税务建议。" +
      "来源：《德国所得税法》§32a EStG 2026 年度官方公式（gesetze-im-internet.de 官方法条库直读，2026-11-24）：" +
      "zvE ≤12,348 欧：0；12,349–17,799 欧：(914.51·y+1,400)·y；17,800–69,878 欧：(173.10·z+2,397)·z+1,034.87；" +
      "69,879–277,825 欧：0.42·zvE−11,135.63；≥277,826 欧：0.45·zvE−19,470.38（y、z 为超额部分的万分数）。" +
      "口径：官方公式含两段二次曲线，无法用线性分段精确表达；本表 bands 为对官方公式的分段线性近似" +
      "（分段点承 2025 表同构：首段区间三等分 + 次段区间逐半中点 + 区界整段，每段税率经数值扫描微调——" +
      "以割线斜率为初值、对相邻段联合网格搜索极小化最大相对偏差），标准扣除按 Grundfreibetrag 12,348 欧建模。" +
      "近似精度（已对 200–300,000 欧应税所得逐点扫描验证）：应税所得 >3,000 欧时与官方公式偏差 ≤2%" +
      "（实测最大约 1.6%）；<3,000 欧的低收入段相对偏差可达约 10%（对应税额金额通常 <30 欧元）。" +
      "未含：夫妻拆分制（Splitting）、团结附加税（Soli 5.5%，高收入起征）、教会税、社保缴费、子女免税额。",
  },
  {
    // @data-meta YEAR=2025 CHECKED_AT=2026-11 SOURCE_TYPE=official EXPIRY=L2（复核受限：令和8年度税改调整未能核验，以在案令和7年度口径展示）
    countryCode: "JP",
    name: "日本所得税（2025，工薪综合课税）",
    year: 2025,
    // 工薪者合计最低扣除 = 给与所得控除最低保障 65 万円 + 基礎控除 58 万円（令和 7 年分改革后）
    standardDeduction: 1230000,
    bands: [
      { lower: 0, rate: 0.05 },
      { lower: 1950000, rate: 0.1 },
      { lower: 3300000, rate: 0.2 },
      { lower: 6950000, rate: 0.23 },
      { lower: 9000000, rate: 0.33 },
      { lower: 18000000, rate: 0.4 },
      { lower: 40000000, rate: 0.45 },
    ],
    disclaimerIncluded: true,
    note:
      "内置简化税率表，基于 2025 年公开税档，不构成税务建议。" +
      "来源：日本国税庁 / 令和 7 年度（2025）税制改正（财务省税制改正大綱），2025-11 查证。" +
      "口径：七档税率作用于课税总所得；2025 年改革将基礎控除由 48 万円升至 58 万円（合计所得 ≤2,350 万円，超过部分维持 48 万円）、" +
      "給与所得控除最低保障由 55 万円升至 65 万円；本表 standardDeduction 取两者合计 123 万円（工薪者最低保障组合）。" +
      "简化偏差：給与所得控除实际随收入递增至 195 万円（工薪者合计扣除最高约 253 万円），中高收入者实际税负低于本表输出；" +
      "低所得者的基礎控除特例（合计所得 ≤132 万円时基礎控除最高 95 万円）未建模。" +
      "未含：復興特別所得税（税额 ×2.1%）、住民税（约 10% 平准比例 + 均等割）——实际综合税负明显高于本表输出。",
  },
  {
    // @data-meta YEAR=2025 CHECKED_AT=2026-11 SOURCE_TYPE=official EXPIRY=L2（复核受限：IRAS 官方页直读未达，YA2024 起结构延续的在案口径；YA2027 变动触发点=2027-02 预算案）
    countryCode: "SG",
    name: "新加坡个人所得税（YA 2025，税务居民）",
    year: 2025,
    // 新加坡无「标准扣除」概念：官方首 20,000 新元为 0% 税档，等效建模为扣除，
    // bands 相应整体下移 20,000 新元
    standardDeduction: 20000,
    bands: [
      { lower: 0, rate: 0.02 },
      { lower: 10000, rate: 0.035 },
      { lower: 20000, rate: 0.07 },
      { lower: 60000, rate: 0.115 },
      { lower: 100000, rate: 0.15 },
      { lower: 140000, rate: 0.18 },
      { lower: 180000, rate: 0.19 },
      { lower: 220000, rate: 0.195 },
      { lower: 260000, rate: 0.2 },
      { lower: 300000, rate: 0.22 },
      { lower: 480000, rate: 0.23 },
      { lower: 980000, rate: 0.24 },
    ],
    disclaimerIncluded: true,
    note:
      "内置简化税率表，基于 2025 年公开税档，不构成税务建议。" +
      "来源：新加坡税务局（IRAS）个人税率页（该结构自 YA 2024 起适用并延续至 YA 2025/YA 2026；2025-11 查证）。" +
      "口径：YA（评税年度）2025 对应 2024 收入年度；官方 13 档（首 20,000 新元 0% → 24%），本表将其等效建模为" +
      "standardDeduction 20,000 新元 + 12 档 bands（档位整体下移 20,000，计算结果与官方逐档一致）。" +
      "未含：个人减免（earned income relief 1,000 新元等各项 relief）、YA2025 个人所得税回扣（60%，上限 500 新元）、非税务居民（15%/24%）税率。",
  },
  {
    // @data-meta YEAR=2025 CHECKED_AT=2026-11 SOURCE_TYPE=official EXPIRY=L2（复核受限：ATO 官方页 403，2026–27 财年税率未能复核，以在案 2024–25（=2025–26）口径展示）
    countryCode: "AU",
    name: "澳大利亚个人所得税（2024–25 财年，居民）",
    year: 2025,
    // 免税额（tax-free threshold）18,200 澳元/财年；bands 作用于应税所得 − 18,200
    standardDeduction: 18200,
    bands: [
      { lower: 0, rate: 0.16 },
      { lower: 26800, rate: 0.3 },
      { lower: 116800, rate: 0.37 },
      { lower: 171800, rate: 0.45 },
    ],
    disclaimerIncluded: true,
    note:
      "内置简化税率表，基于 2025 年公开税档，不构成税务建议。" +
      "来源：澳大利亚税务局（ATO）居民个人税率页：2024–25 与 2025–26 财年税率相同" +
      "（0–18,200 免税；18,201–45,000 16%；45,001–135,000 30%；135,001–190,000 37%；190,001+ 45%；2025-11 查证）。" +
      "口径：澳大利亚财政年度为 7 月 1 日至次年 6 月 30 日，本表 year=2025 指代 2024–25 财年（2025–26 财年税率相同）；" +
      "bands 作用于免税额后的应税所得（如 26,800 = 45,000 − 18,200）。" +
      "未含：Medicare 征费（2%）、低收入所得税抵免（LITO）、非居民税率、HECS/HELP 学贷偿还。",
  },
  {
    // @data-meta YEAR=2025 CHECKED_AT=2026-11 SOURCE_TYPE=official EXPIRY=L2（复核受限：CRA 2026 税年指数化公告未能核验，以在案 2025 口径展示；每年 11 月前后为固定复核点）
    countryCode: "CA",
    name: "加拿大联邦所得税（2025）",
    year: 2025,
    // 基本个人免税额（BPA）2025 最高额 16,129 加元（净收入 ≤177,882 加元时适用）；
    // 实为非退税抵免，此处简化为应税所得扣除（见 note）
    standardDeduction: 16129,
    bands: [
      { lower: 0, rate: 0.145 },
      { lower: 57375, rate: 0.205 },
      { lower: 114750, rate: 0.26 },
      { lower: 177882, rate: 0.29 },
      { lower: 253414, rate: 0.33 },
    ],
    disclaimerIncluded: true,
    note:
      "内置简化税率表，基于 2025 年公开税档，不构成税务建议。" +
      "来源：加拿大税务局（CRA）2025 年联邦税档（指数化因子 2.7%）：57,375 / 114,750 / 177,882 / 253,414 加元；" +
      "2025-07-01 起最低档税率由 15% 降至 14%，2025 全年按混合税率 14.5% 适用（CRA 口径；2025-11 查证）。" +
      "口径：BPA（16,129 加元）在税法中为按最低税率的非退税抵免（≈16,129 × 14.5% 抵税），本表简化为应税所得扣除——" +
      "对适用高档税率者略高估减免额；净收入超过 177,882 加元后 BPA 递减机制未建模。" +
      "未含：各省/地方所得税（各省另有独立税档）、CPP/QPP 与 EI 缴费、加拿大儿童福利等抵免。",
  },
];
