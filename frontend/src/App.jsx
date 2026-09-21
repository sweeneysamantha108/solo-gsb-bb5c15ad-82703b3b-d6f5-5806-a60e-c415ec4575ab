import { useMemo, useState } from 'react'
import UploadForm from './components/UploadForm'
import StatsBar from './components/StatsBar'
import ThresholdForm from './components/ThresholdForm'
import TimelinePane from './components/TimelinePane'
import ScriptPane from './components/ScriptPane'
import IssueList from './components/IssueList'
import { exportCSV, exportMarkdown } from './export'
import { DEFAULT_THRESHOLDS } from './thresholds'
import { compareFiles, loadSample } from './api'

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [activeId, setActiveId] = useState(null)
  // 阈值与比对来源独立于结果保存：重新比对 / 重新上传后阈值仍然保留
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [source, setSource] = useState(null)
  const [busy, setBusy] = useState(false)

  const issuesById = useMemo(() => {
    const map = {}
    for (const it of data?.issues || []) map[it.id] = it
    return map
  }, [data])

  const filtered = useMemo(
    () => (data?.issues || []).filter((it) =>
      filter === 'all'
      || (filter === 'timeline' ? it.category === 'timeline' : it.type === filter)),
    [data, filter],
  )

  function handleThresholdChange(key, val) {
    setThresholds((t) => ({ ...t, [key]: val }))
  }

  function handleResult(result, src) {
    setData(result)
    setSource(src)
    setFilter('all')
    setActiveId(null)
    // 回显后端实际生效的阈值（如留空字段回落到缺省值）
    if (result.thresholds) setThresholds((t) => ({ ...t, ...result.thresholds }))
  }

  async function recompare() {
    if (!source || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = source.kind === 'sample'
        ? await loadSample(thresholds)
        : await compareFiles(source.srt, source.script, thresholds)
      handleResult(result, source)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!data) {
    return (
      <>
        {error && <div className="toast">{error}</div>}
        <UploadForm
          onResult={handleResult}
          onError={setError}
          thresholds={thresholds}
          onThresholdsChange={handleThresholdChange}
          onThresholdsReset={() => setThresholds(DEFAULT_THRESHOLDS)}
        />
      </>
    )
  }

  return (
    <div className="app">
      {error && <div className="toast">{error}</div>}
      <header className="topbar">
        <h1>字幕核校工具</h1>
        <div className="topbar-actions">
          <button onClick={() => exportCSV(filtered)} disabled={!filtered.length}>
            导出 CSV 清单
          </button>
          <button onClick={() => exportMarkdown(filtered)} disabled={!filtered.length}>
            导出 Markdown
          </button>
          <button onClick={() => setData(null)}>重新上传</button>
        </div>
      </header>

      <StatsBar stats={data.stats} filter={filter} onFilter={setFilter} />

      <section className="audit-bar">
        <span className="audit-title">时间轴审计阈值</span>
        <ThresholdForm
          value={thresholds}
          onChange={handleThresholdChange}
          onReset={() => setThresholds(DEFAULT_THRESHOLDS)}
          onApply={recompare}
          applying={busy}
        />
      </section>

      {data.issues.length === 0 && (
        <div className="banner-ok">✅ 未发现差异：字幕与校对稿词序一致，时间轴审计也无异常。</div>
      )}

      <main className="layout">
        <IssueList issues={filtered} activeId={activeId} onActivate={setActiveId} />
        <TimelinePane data={data} issuesById={issuesById} activeId={activeId} onActivate={setActiveId} />
        <ScriptPane data={data} issuesById={issuesById} activeId={activeId} onActivate={setActiveId} />
      </main>
    </div>
  )
}
