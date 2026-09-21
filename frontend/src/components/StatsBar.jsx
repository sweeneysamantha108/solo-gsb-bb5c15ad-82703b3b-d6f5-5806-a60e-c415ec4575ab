import { TIMELINE_TYPE_LABEL } from '../timeline'

const FILTERS = [
  ['all', '全部'],
  ['missing', '缺词'],
  ['extra', '多词'],
  ['misorder', '错序'],
  ['replace', '错词'],
  ['timeline', '时间轴审计'],
]

const TL_TYPES = ['overlap', 'gap', 'cps']
const TEXT_LABEL = { missing: '缺词', extra: '多词', misorder: '错序', replace: '错词' }

export default function StatsBar({ stats, filter, onFilter }) {
  const counts = {
    all: stats.total + (stats.timeline_total || 0),
    missing: stats.missing,
    extra: stats.extra,
    misorder: stats.misorder,
    replace: stats.replace,
    timeline: stats.timeline_total || 0,
  }
  const tlDetail = TL_TYPES.map((t) => `${TIMELINE_TYPE_LABEL[t]} ${stats[t] || 0}`).join(' · ')
  return (
    <div className="stats-bar">
      {FILTERS.map(([key, label]) => (
        <button
          key={key}
          className={`chip chip-${key} ${filter === key ? 'on' : ''}`}
          onClick={() => onFilter(key)}
          title={key === 'timeline' ? tlDetail : key === 'all' ? '显示全部问题' : `只看「${TEXT_LABEL[key]}」`}
        >
          {label}
          <b>{counts[key]}</b>
        </button>
      ))}
      <span className="stats-meta">
        字幕块 {stats.cue_count} · 字幕词 {stats.subtitle_tokens} · 校对稿词 {stats.script_tokens}
        {stats.timeline_total ? ` · ${tlDetail}` : ''}
      </span>
    </div>
  )
}
