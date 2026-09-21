// 时间轴审计相关常量与本地持久化（与后端 DEFAULT_THRESHOLDS 保持一致）

export const DEFAULT_THRESHOLDS = {
  overlap_ms: 1, // 相邻块重叠达到该毫秒数即报告（0 = 容忍首尾相接）
  gap_ms: 3000, // 块间空隙大于该毫秒数视为异常留白
  max_cps: 15, // 单块阅读速度上限（字/秒）
}

export const THRESHOLD_FIELDS = [
  { key: 'overlap_ms', label: '重叠容忍 (ms)', min: 0, step: 1, integer: true,
    hint: '前一块结束晚于后一块开始达该毫秒数即报「起止重叠」' },
  { key: 'gap_ms', label: '最大空隙 (ms)', min: 0, step: 100, integer: true,
    hint: '相邻块之间超过该时长没有字幕即报「异常空隙」' },
  { key: 'max_cps', label: 'CPS 上限 (字/秒)', min: 0.1, step: 0.5, integer: false,
    hint: '单块字符数除以显示秒数超过该值即报「阅读过快」' },
]

export const TIMELINE_TYPE_LABEL = {
  overlap: '起止重叠',
  gap: '异常空隙',
  cps: '阅读过快',
}

const STORAGE_KEY = 'timeline-thresholds'

export function loadThresholds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_THRESHOLDS }
    const saved = JSON.parse(raw)
    return { ...DEFAULT_THRESHOLDS, ...sanitize(saved) }
  } catch {
    return { ...DEFAULT_THRESHOLDS }
  }
}

export function saveThresholds(values) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
  } catch { /* 隐私模式等场景忽略 */ }
}

export function sanitize(values) {
  const out = {}
  for (const f of THRESHOLD_FIELDS) {
    const v = Number(values[f.key])
    if (!Number.isFinite(v) || v < f.min) {
      out[f.key] = DEFAULT_THRESHOLDS[f.key]
    } else {
      out[f.key] = f.integer ? Math.round(v) : v
    }
  }
  return out
}
