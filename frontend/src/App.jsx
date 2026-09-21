import { useMemo, useState } from 'react'
import UploadForm from './components/UploadForm'
import StatsBar from './components/StatsBar'
import TimelinePane from './components/TimelinePane'
import ScriptPane from './components/ScriptPane'
import IssueList from './components/IssueList'
import { exportCSV, exportMarkdown } from './export'
import { loadThresholds, saveThresholds } from './timeline'

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [activeId, setActiveId] = useState(null)
  const [thresholds, setThresholds] = useState(loadThresholds)

  const issuesById = useMemo(() => {
    const map = {}
    for (const it of data?.issues || []) map[it.id] = it
    for (const it of data?.timeline_issues || []) map[it.id] = it
    return map
  }, [data])

  // 文字问题与时间轴问题合并；“全部”视图下按时间码统一排序
  const filtered = useMemo(() => {
    const text = data?.issues || []
    const tl = data?.timeline_issues || []
    if (filter === 'timeline') return [...tl]
    const picked = filter === 'all' ? text : text.filter((it) => it.type === filter)
    if (filter !== 'all') return picked
    return [...picked, ...tl].sort(
      (a, b) => a.start_ms - b.start_ms
        || a.end_ms - b.end_ms
        || (typeof a.id === 'number' ? -1 : 1),
    )
  }, [data, filter])

  function changeThresholds(next) {
    setThresholds(next)
    saveThresholds(next)
  }

  function handleResult(result) {
    setData(result)
    if (result.thresholds) {
      setThresholds(result.thresholds)
      saveThresholds(result.thresholds)
    }
    setFilter('all')
    setActiveId(null)
  }

  if (!data) {
    return (
      <>
        {error && <div className="toast">{error}</div>}
        <UploadForm
          thresholds={thresholds}
          onThresholdsChange={changeThresholds}
          onResult={handleResult}
          onError={setError}
        />
      </>
    )
  }

  const totalAll = data.stats.total + (data.stats.timeline_total || 0)

  return (
    <div className="app">
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

      {totalAll === 0 && (
        <div className="banner-ok">
          ✅ 未发现差异：字幕与校对稿在词序层面完全一致，且时间轴通过全部质量审计。
        </div>
      )}

      <main className="layout">
        <IssueList issues={filtered} activeId={activeId} onActivate={setActiveId} />
        <TimelinePane data={data} issuesById={issuesById} activeId={activeId} onActivate={setActiveId} />
        <ScriptPane data={data} issuesById={issuesById} activeId={activeId} onActivate={setActiveId} />
      </main>
    </div>
  )
}
