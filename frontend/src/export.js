const TYPE_LABEL = {
  missing: '缺词',
  extra: '多词',
  misorder: '错序',
  replace: '错词',
  overlap: '起止重叠',
  gap: '异常空隙',
  cps: '阅读过快',
  timeline: '时间轴审计',
}

export function typeLabel(t) {
  return TYPE_LABEL[t] || t
}

/** 时间轴审计问题的数值展示（重叠/空隙为毫秒，CPS 为字/秒）。 */
export function issueValue(it) {
  if (it.category !== 'timeline') return ''
  if (it.type === 'cps') return it.value == null ? '∞ 字/秒' : `${it.value} 字/秒`
  return `${it.value} ms`
}

function csvCell(v) {
  return '"' + String(v ?? '').replaceAll('"', '""') + '"'
}

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function rows(issues) {
  return issues.map((it, i) => it.category === 'timeline'
    ? [
      i + 1,
      typeLabel(it.type),
      it.timecode,
      it.detail,
      '—',
      issueValue(it),
      it.suggestion,
      it.subtitle_excerpt,
      '—',
    ]
    : [
      i + 1,
      typeLabel(it.type),
      it.timecode,
      it.subtitle_tokens.join('') || '—',
      it.script_tokens.join('') || '—',
      '—',
      '—',
      it.subtitle_excerpt,
      it.script_excerpt,
    ])
}

const HEAD = ['序号', '类型', '时间码', '字幕问题片段', '校对稿对应片段', '数值', '建议', '字幕上下文', '校对稿上下文']

export function exportCSV(issues) {
  // 带 BOM，保证 Excel 打开中文不乱码
  const csv = '\ufeff' + [HEAD, ...rows(issues)]
    .map((r) => r.map(csvCell).join(','))
    .join('\r\n')
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), '字幕核校清单.csv')
}

export function exportMarkdown(issues) {
  const esc = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
  const lines = [
    '# 字幕核校清单',
    '',
    `| ${HEAD.join(' | ')} |`,
    `| ${HEAD.map(() => '---').join(' | ')} |`,
    ...rows(issues).map((r) => `| ${r.map(esc).join(' | ')} |`),
    '',
  ]
  download(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), '字幕核校清单.md')
}
