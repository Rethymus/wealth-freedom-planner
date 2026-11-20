/**
 * 场景对比表位图导出（P4 ③，docs/p4-spec.md §8；零新依赖——原生 Canvas 2D +
 * canvas.toBlob + <a download>，不引入任何 html2canvas 类大依赖，尺寸预算红线内）。
 *
 * 版式（p4-spec §8.2 契约）：
 * - DPR = min(2, devicePixelRatio || 1) 整图缩放；ctx.scale 后一律按 CSS 像素绘制；
 * - 页边距 24、指标列宽 150、情景列宽 130（列名超宽 measureText 逐列省略号截断）；
 * - 行高 36、表头行高 52、总宽下限 560（不足由页边距均摊补足）、
 *   总高 = 52 + 8×36 + 16 + 页脚 56 + 页边距；
 * - 页脚：发丝线分隔 + 两行——工具名（app.title，加粗）与 t("scenario.exportNote")
 *   （「本地计算 · 不构成投资建议」，次要色）；
 * - 配色取入参 tokens（resolveThemeTokens 输出，当前生效主题与色盲友好档）：
 *   页底 tokens.bgPage、正文 tokens.textPrimary、次要 tokens.textSecondary、
 *   失败列头 tokens.fall、发丝线 tokens.hairlineCard；
 *   表头带按主题取实底近似（浅 #FFFFFF / 深 #232324——位图无 backdrop-filter，
 *   取卡底 rgba 的不透明近似：浅色卡底为白系透明、深色卡底近似 #232324 组件库二级底）；
 * - 字体：12/13px system-ui 栈（与 global.css body 字体栈一致的通用前缀）。
 * 导出为静态快照（不含滚动与 sticky 首列效果）；values 已是 ⑤ 换算后的屏显字符串，
 * 导出与屏显逐字符一致。
 */

/** 对比列（复用 ScenarioPanel 的 CompareCol 形状子集；字符串已含换算后的符号与千分位） */
export interface ExportColumn {
  name: string;
  failed: boolean;
  values: string[];
}

export interface ExportBitmapParams {
  /** 页脚首行（app.title） */
  title: string;
  /** 指标行名（行序即表序） */
  metricLabels: string[];
  /** 已保存情景列 */
  columns: ExportColumn[];
  /** 页脚两行文案 */
  footerLines: [string, string];
  /** 当前生效令牌（resolveThemeTokens(theme, colorBlindFriendly)） */
  tokens: {
    bgPage: string;
    textPrimary: string;
    textSecondary: string;
    fall: string;
    hairlineCard: string;
  };
  theme: "light" | "dark";
}

/** 通用无衬线字体栈前缀（与 global.css body 字体栈一致的 system-ui 前缀） */
const FONT_STACK = 'system-ui, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif';
const MARGIN = 24;
const METRIC_COL_WIDTH = 150;
const SCENARIO_COL_WIDTH = 130;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 52;
const GAP_TABLE_FOOTER = 16;
const FOOTER_HEIGHT = 56;
const MIN_TABLE_WIDTH = 560;

/** 文本省略号截断：maxWidth 内放不下时尾部截断补 …（逐列 measureText 收窄口径） */
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 0 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/**
 * 手绘对比表位图。行数以 metricLabels.length 为准（当前固定 8；
 * values 短行以「—」兜底，防数据层行数漂移导致越界）。
 */
export function buildScenarioTableBitmap(params: ExportBitmapParams): HTMLCanvasElement {
  const { title, metricLabels, columns, footerLines, tokens, theme } = params;
  const rowCount = metricLabels.length;

  // 表格内容宽 + 页边距；不足下限时差值均摊进左右页边距
  const tableWidth = METRIC_COL_WIDTH + columns.length * SCENARIO_COL_WIDTH;
  const extra = Math.max(0, MIN_TABLE_WIDTH - (tableWidth + MARGIN * 2));
  const marginX = MARGIN + extra / 2;
  const cssWidth = tableWidth + marginX * 2;
  const cssHeight = HEADER_HEIGHT + rowCount * ROW_HEIGHT + GAP_TABLE_FOOTER + FOOTER_HEIGHT + MARGIN * 2;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.scale(dpr, dpr);

  // 页底
  ctx.fillStyle = tokens.bgPage;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  // 表头带（实底近似：位图无 backdrop-filter；浅 #FFFFFF / 深 #232324）
  const headerBand: [number, number, number, number] = [marginX, MARGIN, tableWidth, HEADER_HEIGHT];
  ctx.fillStyle = theme === "dark" ? "#232324" : "#FFFFFF";
  ctx.fillRect(...headerBand);
  // 表头带外框 + 行分隔发丝线
  ctx.strokeStyle = tokens.hairlineCard;
  ctx.lineWidth = 1;
  ctx.strokeRect(headerBand[0] + 0.5, headerBand[1] + 0.5, tableWidth - 1, HEADER_HEIGHT - 1);

  const metricRight = marginX + METRIC_COL_WIDTH;

  // 列头：情景名（失败列跌色；超宽省略号截断）
  ctx.textBaseline = "middle";
  ctx.font = `bold 13px ${FONT_STACK}`;
  columns.forEach((col, i) => {
    const x = metricRight + i * SCENARIO_COL_WIDTH;
    ctx.fillStyle = col.failed ? tokens.fall : tokens.textPrimary;
    ctx.fillText(
      truncateText(ctx, col.name, SCENARIO_COL_WIDTH - 16),
      x + 8,
      MARGIN + HEADER_HEIGHT / 2,
    );
  });

  // 指标行：行名（左列）+ 数值（各情景列右对齐，与屏显表对齐口径一致）
  ctx.font = `12px ${FONT_STACK}`;
  for (let r = 0; r < rowCount; r += 1) {
    const y = MARGIN + HEADER_HEIGHT + r * ROW_HEIGHT;
    // 行分隔发丝线
    ctx.strokeStyle = tokens.hairlineCard;
    ctx.beginPath();
    ctx.moveTo(marginX + 0.5, y + ROW_HEIGHT - 0.5);
    ctx.lineTo(marginX + tableWidth - 0.5, y + ROW_HEIGHT - 0.5);
    ctx.stroke();
    // 行名
    ctx.fillStyle = tokens.textSecondary;
    ctx.fillText(
      truncateText(ctx, metricLabels[r] ?? "", METRIC_COL_WIDTH - 16),
      marginX + 8,
      y + ROW_HEIGHT / 2,
    );
    // 数值：右对齐（列右缘 - 8）；失败列整行已由列头标注，值仍逐列渲染（「—」）
    for (let c = 0; c < columns.length; c += 1) {
      const col = columns[c];
      const text = col.values[r] ?? "—";
      const xRight = metricRight + c * SCENARIO_COL_WIDTH + SCENARIO_COL_WIDTH - 8;
      ctx.fillStyle = tokens.textPrimary;
      ctx.fillText(text, xRight - ctx.measureText(text).width, y + ROW_HEIGHT / 2);
    }
  }

  // 页脚：发丝线分隔 + 两行（工具名加粗 + 免责注次要色）
  const footerTop = MARGIN + HEADER_HEIGHT + rowCount * ROW_HEIGHT + GAP_TABLE_FOOTER;
  ctx.strokeStyle = tokens.hairlineCard;
  ctx.beginPath();
  ctx.moveTo(marginX + 0.5, footerTop + 0.5);
  ctx.lineTo(marginX + tableWidth - 0.5, footerTop + 0.5);
  ctx.stroke();
  ctx.font = `bold 13px ${FONT_STACK}`;
  ctx.fillStyle = tokens.textPrimary;
  ctx.fillText(title, marginX + 8, footerTop + 20);
  ctx.font = `12px ${FONT_STACK}`;
  ctx.fillStyle = tokens.textSecondary;
  ctx.fillText(footerLines[1], marginX + 8, footerTop + 42);

  return canvas;
}

/**
 * Canvas → PNG Blob → <a download> 触发保存（须在用户手势调用链内完成，Safari 下载
 * 手势约束满足）；toBlob 为 null / 异常返回 false（调用方 Message.error 兜底）。
 */
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          done(false);
          return;
        }
        try {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          // 释放对象 URL（延迟一拍防取消点击前的加载）
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          done(true);
        } catch {
          done(false);
        }
      }, "image/png");
    } catch {
      done(false);
    }
  });
}

/** 导出文件名：wealth-scenarios-YYYYMMDD-HHmm.png（本地时间） */
export function buildExportFilename(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `wealth-scenarios-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.png`;
}
