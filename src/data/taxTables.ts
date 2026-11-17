/**
 * 税表数据（按国家/地区与年度）。
 *
 * TODO(数据研究员): 填充真实税表 —— standardDeduction / bands（lower 升序，
 * rate 为小数形式）/ note（口径与来源），并保证整项目可编译。
 * 当前为类型化空占位。
 */
import type { TaxTable } from "./types";

export const TAX_TABLES: TaxTable[] = [];
