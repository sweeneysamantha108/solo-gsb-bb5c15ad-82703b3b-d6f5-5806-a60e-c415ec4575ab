/** 时间轴审计阈值：缺省值与后端 DEFAULT_THRESHOLDS 保持一致。 */
export const DEFAULT_THRESHOLDS = {
  max_cps: 20,
  max_gap_ms: 2000,
  max_overlap_ms: 0,
}

export const THRESHOLD_FIELDS = [
  { key: 'max_cps', label: '阅读速度上限', unit: '字/秒', min: 1, step: 0.5 },
  { key: 'max_gap_ms', label: '块间空隙上限', unit: '毫秒', min: 0, step: 100 },
  { key: 'max_overlap_ms', label: '起止重叠容限', unit: '毫秒', min: 0, step: 50 },
]
