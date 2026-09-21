import { useEffect, useRef } from 'react'
import { isTimelineIssue, typeLabel } from '../export'

/** 问题清单：按类型筛选，点击条目联动字幕时间轴与校对稿。 */
export default function IssueList({ issues, activeId, onActivate }) {
  const ref = useRef(null)

  useEffect(() => {
    if (activeId == null) return
    const el = ref.current?.querySelector(`[data-issue="${CSS.escape(String(activeId))}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeId])

  if (issues.length === 0) {
    return (
      <div className="pane issue-pane" ref={ref}>
        <div className="pane-title">问题清单</div>
        <div className="empty">✅ 当前筛选条件下没有问题</div>
      </div>
    )
  }

  return (
    <div className="pane issue-pane" ref={ref}>
      <div className="pane-title">问题清单（{issues.length}）</div>
      {issues.map((it) => (
        isTimelineIssue(it)
          ? <TimelineCard key={it.id} it={it} active={activeId === it.id} onActivate={onActivate} />
          : <TextCard key={it.id} it={it} active={activeId === it.id} onActivate={onActivate} />
      ))}
    </div>
  )
}

function TimelineCard({ it, active, onActivate }) {
  return (
    <button
      data-issue={it.id}
      className={`issue-card tl-card ${active ? 'active' : ''}`}
      onClick={() => onActivate(it.id)}
    >
      <div className="issue-head">
        <span className={`badge badge-${it.type}`}>{typeLabel(it.type)}</span>
        <span className="issue-time">{it.timecode}</span>
        <span className="issue-id">{it.id.toUpperCase()}</span>
      </div>
      <div className="tl-value">{it.value_text}</div>
      <div className="issue-ctx">相邻字幕：{it.subtitle_excerpt}</div>
      <div className="issue-ctx tl-suggest">建议：{it.suggestion}</div>
    </button>
  )
}

function TextCard({ it, active, onActivate }) {
  return (
    <button
      data-issue={it.id}
      className={`issue-card ${active ? 'active' : ''}`}
      onClick={() => onActivate(it.id)}
    >
      <div className="issue-head">
        <span className={`badge badge-${it.type}`}>{typeLabel(it.type)}</span>
        <span className="issue-time">{it.timecode}</span>
        <span className="issue-id">#{it.id}</span>
      </div>
      <div className="issue-diff">
        <div className="diff-row">
          <span className="diff-tag sub">字幕</span>
          <span className="diff-text">{it.subtitle_tokens.join('') || '（缺）'}</span>
        </div>
        <div className="diff-row">
          <span className="diff-tag ref">校对稿</span>
          <span className="diff-text">{it.script_tokens.join('') || '（无）'}</span>
        </div>
      </div>
      <div className="issue-ctx">字幕：{it.subtitle_excerpt}</div>
      <div className="issue-ctx">稿件：{it.script_excerpt}</div>
    </button>
  )
}
