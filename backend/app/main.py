"""FastAPI 入口：上传 SRT 与校对稿，返回核校结果；同时托管前端静态文件。"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .analyzer import build_comparison
from .srt_parser import decode_bytes, parse_srt
from .timeline_audit import DEFAULT_THRESHOLDS, normalize_thresholds

app = FastAPI(title='字幕核校', version='1.1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

_BASE = Path(__file__).resolve().parent


def _find_dir(name: str) -> Path | None:
    for p in (_BASE.parent / name, _BASE.parent.parent / name):
        if p.is_dir():
            return p
    return None


@app.get('/api/health')
def health():
    return {'status': 'ok'}


@app.get('/api/thresholds')
def get_thresholds():
    """时间轴审计的缺省阈值，供前端恢复缺省值。"""
    return dict(DEFAULT_THRESHOLDS)


def _read_thresholds(overlap_ms, gap_ms, max_cps) -> dict:
    """空字符串视为未填写（走缺省），非法值转成 400。"""
    try:
        return normalize_thresholds(
            overlap_ms if overlap_ms not in (None, '') else None,
            gap_ms if gap_ms not in (None, '') else None,
            max_cps if max_cps not in (None, '') else None,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post('/api/compare')
async def compare(
    srt: UploadFile = File(...),
    script: UploadFile = File(...),
    overlap_ms: str | None = Form(None),
    gap_ms: str | None = Form(None),
    max_cps: str | None = Form(None),
):
    """上传 SRT 字幕文件与校对稿文本，返回对齐核校与时间轴审计结果。"""
    try:
        srt_text = decode_bytes(await srt.read())
        script_text = decode_bytes(await script.read())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f'文件读取失败：{exc}') from exc

    cues = parse_srt(srt_text)
    if not cues:
        raise HTTPException(400, 'SRT 解析失败：未找到有效字幕块')
    if not script_text.strip():
        raise HTTPException(400, '校对稿为空')

    thresholds = _read_thresholds(overlap_ms, gap_ms, max_cps)
    try:
        return build_comparison(cues, script_text, thresholds)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get('/api/sample')
def sample(overlap_ms: int | None = None, gap_ms: int | None = None,
           max_cps: float | None = None):
    """加载内置示例，便于快速体验；阈值参数与 /api/compare 同义。"""
    samples = _find_dir('samples')
    if not samples:
        raise HTTPException(404, '示例文件不存在')
    try:
        srt_text = (samples / 'sample.srt').read_text(encoding='utf-8')
        script_text = (samples / 'sample_script.txt').read_text(encoding='utf-8')
    except OSError as exc:
        raise HTTPException(404, f'示例文件缺失：{exc}') from exc
    thresholds = _read_thresholds(overlap_ms, gap_ms, max_cps)
    return build_comparison(parse_srt(srt_text), script_text, thresholds)


# 前端静态文件（Docker 中由构建阶段生成；API 路由优先于该挂载）
_static = _BASE.parent / 'static'
if _static.is_dir():
    app.mount('/', StaticFiles(directory=_static, html=True), name='static')
