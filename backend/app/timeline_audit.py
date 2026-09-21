"""时间轴质量审计：按字幕块检查起止重叠、块间异常空隙与阅读速度（CPS）。

与文本差异核校相互独立：只依赖字幕块的时间码与文本长度，
依据可配置阈值生成带类型、时间码、数值与建议的问题。
"""
from __future__ import annotations

from .srt_parser import Cue, format_ms

#: 缺省阈值（前端「恢复默认」与此保持一致）
DEFAULT_THRESHOLDS = {
    'max_cps': 20.0,        # 阅读速度上限（字/秒，按非空白字符计）
    'max_gap_ms': 2000,     # 相邻字幕块允许的最大空隙（毫秒）
    'max_overlap_ms': 0,    # 相邻字幕块允许的重叠容限（毫秒）
}

_LIMITS = {
    'max_cps': (0, 100, '阅读速度上限需在 0~100 字/秒之间'),
    'max_gap_ms': (0, 3_600_000, '块间空隙上限需在 0~3600000 毫秒之间'),
    'max_overlap_ms': (0, 60_000, '起止重叠容限需在 0~60000 毫秒之间'),
}


def parse_thresholds(max_cps=None, max_gap_ms=None, max_overlap_ms=None) -> dict:
    """归并缺省值并校验阈值；非法值抛出 ValueError。"""
    th = {
        'max_cps': float(DEFAULT_THRESHOLDS['max_cps'] if max_cps is None else max_cps),
        'max_gap_ms': int(round(float(DEFAULT_THRESHOLDS['max_gap_ms'] if max_gap_ms is None else max_gap_ms))),
        'max_overlap_ms': int(round(float(DEFAULT_THRESHOLDS['max_overlap_ms'] if max_overlap_ms is None else max_overlap_ms))),
    }
    for key, (lo, hi, msg) in _LIMITS.items():
        ok = lo < th[key] <= hi if key == 'max_cps' else lo <= th[key] <= hi
        if not ok:
            raise ValueError(msg)
    return th


def _visible_len(text: str) -> int:
    """CPS 计数字符数：非空白字符（含标点，与行业惯例一致）。"""
    return sum(1 for ch in text if not ch.isspace())


def _cue_excerpt(cues: list[Cue], cs: int, ce: int) -> str:
    text = ' ⏎ '.join(cues[i].text.replace('\n', ' ') for i in range(cs, ce + 1))
    return text[:160] + ('…' if len(text) > 160 else '')


def _timecode(start_ms: int, end_ms: int) -> str:
    return (format_ms(start_ms) if start_ms == end_ms
            else f'{format_ms(start_ms)} --> {format_ms(end_ms)}')


def audit_timeline(cues: list[Cue], th: dict) -> list[dict]:
    """逐块审计时间轴，返回问题列表（id 由调用方统一编号）。"""
    issues: list[dict] = []

    def add(itype: str, cs: int, ce: int, start_ms: int, end_ms: int,
            value, detail: str, suggestion: str):
        issues.append({
            'category': 'timeline',
            'type': itype,
            'timecode': _timecode(start_ms, end_ms),
            'start_ms': start_ms,
            'end_ms': end_ms,
            'cue': cs,
            'cue_end': ce,
            'value': value,
            'detail': detail,
            'suggestion': suggestion,
            'subtitle_excerpt': _cue_excerpt(cues, cs, ce),
        })

    # ---- 阅读速度（CPS）：逐块检查 ----------------------------------------
    for i, cue in enumerate(cues):
        dur_ms = cue.end_ms - cue.start_ms
        n = _visible_len(cue.text)
        if dur_ms <= 0:
            add('cps', i, i, cue.start_ms, cue.end_ms, None,
                f'第 {i + 1} 块时长为零或负值（{n} 字），无法保证可读',
                '为该字幕块设置合理的起止时间，确保观众有足够的阅读时间。')
            continue
        cps = round(n * 1000 / dur_ms, 1)
        if cps > th['max_cps']:
            add('cps', i, i, cue.start_ms, cue.end_ms, cps,
                f'第 {i + 1} 块阅读速度 {cps} 字/秒，超过上限 {th["max_cps"]:g} 字/秒',
                '拆分为多个字幕块或延长显示时长，把阅读速度降到阈值以下。')

    # ---- 相邻块：起止重叠 / 异常空隙 ---------------------------------------
    for i in range(len(cues) - 1):
        cur, nxt = cues[i], cues[i + 1]
        overlap = cur.end_ms - nxt.start_ms
        if overlap > th['max_overlap_ms']:
            add('overlap', i, i + 1, nxt.start_ms, cur.end_ms, overlap,
                f'第 {i + 1} 块与第 {i + 2} 块起止重叠 {overlap} ms',
                '缩短上一块的结束时间或推迟下一块的开始时间，避免两块同时显示。')
        gap = nxt.start_ms - cur.end_ms
        if gap > th['max_gap_ms']:
            add('gap', i, i + 1, cur.end_ms, nxt.start_ms, gap,
                f'第 {i + 1} 块与第 {i + 2} 块之间空隙 {gap} ms',
                '确认此处是否遗漏字幕；若无遗漏，可适当延长相邻块的显示时长。')

    return issues
