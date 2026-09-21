function thresholdEntries(thresholds) {
  // 空字符串（用户清空了输入框）不发送，由后端回退到缺省值
  return Object.entries(thresholds || {}).filter(([, v]) => v !== '' && v != null)
}

export async function compareFiles(srtFile, scriptFile, thresholds) {
  const fd = new FormData()
  fd.append('srt', srtFile)
  fd.append('script', scriptFile)
  for (const [k, v] of thresholdEntries(thresholds)) fd.append(k, v)
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
  const qs = new URLSearchParams(thresholdEntries(thresholds)).toString()
  const res = await fetch('/api/sample' + (qs ? `?${qs}` : ''))
  if (!res.ok) {
    let msg = '示例加载失败'
    try {
      const j = await res.json()
      if (j.detail) msg = j.detail
    } catch { /* 保留默认信息 */ }
    throw new Error(msg)
  }
  return res.json()
}
