/**
 * i18next 初始化（react-i18next）。
 * - 三份语言资源：zh-CN（基准键表）/ zh-Hant / en，见 src/i18n/locales/；
 * - 语言检测顺序：localStorage（键 wf-lang）→ navigator.language → 默认 zh-CN；
 * - 切换语言统一走 i18next.changeLanguage + persistLanguage（写 localStorage 与
 *   <html lang>），Arco 组件库语言包由 main.tsx 的 ArcoLocaleGate 随之切换；
 * - 数据层长注释（税表速算表、城市数据来源等）属数据口径，暂不纳入多语言。
 */
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import zhCN from "./locales/zh-CN";
import zhHant from "./locales/zh-Hant";
import en from "./locales/en";

const STORAGE_KEY = "wf-lang";
/** 支持的语言（与三份资源文件一一对应） */
export const SUPPORTED_LANGS = ["zh-CN", "zh-Hant", "en"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/** 语言检测：localStorage → navigator.language → zh-CN */
function detectInitialLang(): SupportedLang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (SUPPORTED_LANGS as readonly string[]).includes(saved)) return saved as SupportedLang;
  } catch {
    // localStorage 不可用（隐私模式等）时走 navigator 检测
  }
  const nav = (typeof navigator !== "undefined" ? navigator.language : "zh-CN").toLowerCase();
  if (nav.startsWith("zh-tw") || nav.startsWith("zh-hk") || nav.startsWith("zh-hant")) return "zh-Hant";
  if (nav.startsWith("zh")) return "zh-CN";
  return "en";
}

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources: {
      "zh-CN": { translation: zhCN },
      "zh-Hant": { translation: zhHant },
      en: { translation: en },
    },
    lng: detectInitialLang(),
    fallbackLng: "zh-CN",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

/** 持久化语言选择：写 localStorage 并同步 <html lang> */
export function persistLanguage(lng: SupportedLang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // 忽略持久化失败（语言仍会在当前会话生效）
  }
  document.documentElement.lang = lng;
}

// 首次加载即同步 <html lang>
document.documentElement.lang = i18next.language;

export default i18next;
