export async function compareFiles(srtFile, scriptFile, thresholds) {
  const fd = new FormData()
  fd.append('srt', srtFile)
  fd.append('script', scriptFile)
  fd.append('overlap_ms', String(thresholds.overlap_ms))
  fd.append('gap_ms', String(thresholds.gap_ms))
  fd.append('max_cps', String(thresholds.max_cps))
  const res = await fetch('/api/compare', { method: 'POST', body: fd })
  if (!res.ok) {
    let msg = `比对失败（HTTP ${res.status}）`
    try {
      const j = await res.json()
      if (j.detail) msg = j.detail
    } catch { /* 保留默认信息 */ }
    throw new Error(msg)
  }
  return res.json()
}

export async function loadSample(thresholds) {
  const q = new URLSearchParams({
    overlap_ms: String(thresholds.overlap_ms),
    gap_ms: String(thresholds.gap_ms),
    max_cps: String(thresholds.max_cps),
  })
  const res = await fetch(`/api/sample?${q.toString()}`)
  if (!res.ok) throw new Error('示例加载失败')
  return res.json()
}
