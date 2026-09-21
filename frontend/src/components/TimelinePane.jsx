import { useEffect, useMemo, useRef } from 'react'
import { isTimelineIssue } from '../export'

/** 字幕时间轴：按块展示，问题 token 高亮，点击高亮或徽标可联动定位。 */
export default function TimelinePane({ data, issuesById, activeId, onActivate }) {
  const ref = useRef(null)

  // 时间轴审计问题 -> 相关字幕块序号
  const tlByCue = useMemo(() => {
    const m = {}
    for (const it of data.timeline_issues || []) {
      for (let c = it.cue; c <= it.cue_end; c++) {
        (m[c] ||= []).push(it)
      }
    }
    return m
  }, [data])

  useEffect(() => {
    if (activeId == null) return
    const el = ref.current?.querySelector(`[data-issue="${CSS.escape(String(activeId))}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeId])

  const activeTl = isTimelineIssue(activeId) ? issuesById[activeId] : null

  return (
    <div className="pane" ref={ref}>
      <div className="pane-title">字幕时间轴</div>
      {data.cues.map((cue) => {
        const marks = data.cue_marks[cue.i] || []
        const issueIds = data.cue_issues[cue.i] || []
        const tlIssues = tlByCue[cue.i] || []
        const inActiveRange = activeTl && cue.i >= activeTl.cue && cue.i <= activeTl.cue_end
        return (
          <div
            key={cue.i}
            className={`cue ${issueIds.length ? 'has-issue' : ''} ${inActiveRange ? 'tl-active' : ''}`}
            data-cue={cue.i}
          >
            <div className="cue-head">
              <span className="cue-time">{cue.start} → {cue.end}</span>
              <span className="cue-badges">
                {tlIssues.map((it) => (
                  <button
                    key={it.id}
                    data-issue={it.id}
                    className={`dot dot-${it.type} ${activeId === it.id ? 'active' : ''}`}
                    title={`${it.id.toUpperCase()} ${it.value_text}`}
                    onClick={() => onActivate(it.id)}
                  />
                ))}
                {issueIds.map((id) => (
                  <button
                    key={id}
                    data-issue={id}
                    className={`dot dot-${issuesById[id].type} ${activeId === id ? 'active' : ''}`}
                    title={`#${id} ${issuesById[id].type}`}
                    onClick={() => onActivate(id)}
                  />
                ))}
              </span>
            </div>
            <div className="cue-text">{renderText(cue.text, marks, issuesById, activeId, onActivate)}</div>
            {tlIssues.map((it) => (
              <button
                key={`tl-${it.id}`}
                data-issue={it.id}
                className={`tl-flag tl-flag-${it.type} ${activeId === it.id ? 'active' : ''}`}
                onClick={() => onActivate(it.id)}
              >
                ⏱ {it.value_text}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function renderText(text, marks, issuesById, activeId, onActivate) {
  if (!marks.length) return text
  const sorted = [...marks].sort((x, y) => x.s - y.s)
  const out = []
  let pos = 0
  sorted.forEach((m, k) => {
    if (m.s > pos) out.push(text.slice(pos, m.s))
    const type = issuesById[m.issue]?.type
    out.push(
      <mark
        key={k}
        data-issue={m.issue}
        className={`tk tk-${type} ${activeId === m.issue ? 'active' : ''}`}
        onClick={() => onActivate(m.issue)}
      >
        {text.slice(m.s, m.e)}
      </mark>,
    )
    pos = m.e
  })
  if (pos < text.length) out.push(text.slice(pos))
  return out
}
