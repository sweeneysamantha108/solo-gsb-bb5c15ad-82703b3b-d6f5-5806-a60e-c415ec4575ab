"""时间轴质量审计。

在文字核校之外，按字幕块独立计算三类时间轴问题，阈值均可由调用方配置：

- ``overlap`` 起止重叠：相邻两块，前一块的结束时间晚于后一块的开始时间；
- ``gap``     异常空隙：相邻两块之间长时间没有字幕（超过允许的留白阈值）；
- ``cps``     阅读过快：单块字符数 / 显示秒数得到 CPS（characters per second），
              超过上限意味着观众来不及读完。

每条问题都带类型、时间码、实测数值与可操作的修改建议，供前端展示与导出复用。
"""
from __future__ import annotations

from .srt_parser import Cue, format_ms

#: 缺省阈值（前端表单同值，可一键恢复）
DEFAULT_THRESHOLDS = {
    'overlap_ms': 1,      # 相邻块重叠达到 1ms 即报告（0 容忍任何重叠）
    'gap_ms': 3000,       # 块间空隙大于 3s 视为异常留白
    'max_cps': 15.0,      # 单块阅读速度上限：15 字/秒
}

_EXCERPT_LIMIT = 160


def normalize_thresholds(overlap_ms=None, gap_ms=None, max_cps=None) -> dict:
    """把外部入参（可能为 None / 字符串）归一化为受校阈值字典。"""
    overlap = DEFAULT_THRESHOLDS['overlap_ms'] if overlap_ms is None else overlap_ms
    gap = DEFAULT_THRESHOLDS['gap_ms'] if gap_ms is None else gap_ms
    cps = DEFAULT_THRESHOLDS['max_cps'] if max_cps is None else max_cps
    try:
        overlap, gap, cps = int(overlap), int(gap), float(cps)
    except (TypeError, ValueError) as exc:
        raise ValueError('时间轴阈值必须是数字') from exc
    if overlap < 0 or gap < 0:
        raise ValueError('重叠 / 空隙阈值不能为负')
    if cps <= 0:
        raise ValueError('CPS 上限必须大于 0')
    return {'overlap_ms': overlap, 'gap_ms': gap, 'max_cps': cps}


def _visible_len(text: str) -> int:
    """有效字符数：样式标签在 SRT 解析阶段已剔除，这里只需忽略换行/空白。"""
    return len(''.join(text.split()))


def _excerpt(cues: list[Cue], cs: int, ce: int) -> str:
    text = ' ⏎ '.join(cues[i].text.replace('\n', ' ') for i in range(cs, ce + 1))
    return text[:_EXCERPT_LIMIT] + ('…' if len(text) > _EXCERPT_LIMIT else '')


def audit_timeline(cues: list[Cue], thresholds: dict) -> list[dict]:
    """按字幕块顺序审计时间轴，返回时间轴问题列表（已按时间排序）。"""
    th = normalize_thresholds(
        thresholds.get('overlap_ms'), thresholds.get('gap_ms'),
        thresholds.get('max_cps'))
    issues: list[dict] = []

    def add(d: dict) -> None:
        d['id'] = f't{len(issues) + 1}'
        issues.append(d)

    for i, cue in enumerate(cues):
        # ---- 单块阅读速度 CPS ------------------------------------------------
        duration_ms = cue.end_ms - cue.start_ms
        chars = _visible_len(cue.text)
        if duration_ms > 0 and chars > 0:
            cps = chars / (duration_ms / 1000.0)
            if cps > th['max_cps']:
                need_s = chars / th['max_cps']
                add({
                    'type': 'cps',
                    'timecode': f'{format_ms(cue.start_ms)} --> {format_ms(cue.end_ms)}',
                    'start_ms': cue.start_ms,
                    'end_ms': cue.end_ms,
                    'cue': i,
                    'cue_end': i,
                    'value': round(cps, 1),
                    'value_text': f'{cps:.1f} 字/秒（{chars} 字 / {duration_ms / 1000:.2f} 秒）',
                    'suggestion': (
                        f'阅读速度 {cps:.1f} 字/秒，超过上限 {th["max_cps"]:g} 字/秒；'
                        f'建议将显示时长延长到至少 {need_s:.2f} 秒，或把该块拆成多块。'),
                    'subtitle_excerpt': _excerpt(cues, i, i),
                })

        # ---- 与下一块之间的重叠 / 空隙 ---------------------------------------
        if i + 1 >= len(cues):
            continue
        nxt = cues[i + 1]
        overlap = cue.end_ms - nxt.start_ms
        if overlap >= th['overlap_ms'] and overlap > 0:
            add({
                'type': 'overlap',
                'timecode': f'{format_ms(nxt.start_ms)} --> {format_ms(cue.end_ms)}',
                'start_ms': nxt.start_ms,
                'end_ms': cue.end_ms,
                'cue': i,
                'cue_end': i + 1,
                'value': overlap,
                'value_text': f'重叠 {overlap} ms',
                'suggestion': (
                    f'第 {i + 1} 块结束比第 {i + 2} 块开始还晚 {overlap} ms；'
                    f'建议把第 {i + 2} 块开始时间后移，'
                    f'或将第 {i + 1} 块截断到 {format_ms(nxt.start_ms)} 之前结束。'),
                'subtitle_excerpt': _excerpt(cues, i, i + 1),
            })
        else:
            gap = nxt.start_ms - cue.end_ms
            if gap > th['gap_ms']:
                add({
                    'type': 'gap',
                    'timecode': f'{format_ms(cue.end_ms)} --> {format_ms(nxt.start_ms)}',
                    'start_ms': cue.end_ms,
                    'end_ms': nxt.start_ms,
                    'cue': i,
                    'cue_end': i + 1,
                    'value': gap,
                    'value_text': f'空隙 {gap / 1000:.2f} 秒',
                    'suggestion': (
                        f'第 {i + 1}、{i + 2} 块之间有 {gap / 1000:.1f} 秒没有字幕'
                        f'（阈值 {th["gap_ms"]} ms）；如非有意留白，'
                        f'建议收紧相邻块时间码，或在该段补充字幕。'),
                    'subtitle_excerpt': _excerpt(cues, i, i + 1),
                })

    return issues
