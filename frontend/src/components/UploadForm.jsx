import { useState } from 'react'
import ThresholdForm from './ThresholdForm'
import { compareFiles, loadSample } from '../api'

export default function UploadForm({ onResult, onError, thresholds, onThresholdsChange, onThresholdsReset }) {
  const [srtFile, setSrtFile] = useState(null)
  const [scriptFile, setScriptFile] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!srtFile || !scriptFile || busy) return
    setBusy(true)
    onError(null)
    try {
      const result = await compareFiles(srtFile, scriptFile, thresholds)
      onResult(result, { kind: 'upload', srt: srtFile, script: scriptFile })
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function useSample() {
    if (busy) return
    setBusy(true)
    onError(null)
    try {
      onResult(await loadSample(thresholds), { kind: 'sample' })
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="upload-page">
      <form className="upload-card" onSubmit={submit}>
        <h1>字幕核校工具</h1>
        <p className="hint">
          上传 SRT 字幕与校对稿，系统自动归一化标点与空白、跨字幕块做词序对齐，
          识别缺词、多词、错序与错词；同时审计时间轴质量（起止重叠、异常空隙、
          阅读速度），生成带时间码的核校清单。
        </p>

        <label className="file-field">
          <span className="file-label">SRT 字幕文件</span>
          <input
            type="file"
            accept=".srt,.txt"
            onChange={(e) => setSrtFile(e.target.files[0] || null)}
          />
          <span className="file-name">{srtFile ? srtFile.name : '未选择文件'}</span>
        </label>

        <label className="file-field">
          <span className="file-label">校对稿（纯文本）</span>
          <input
            type="file"
            accept=".txt,.text,.md,.srt"
            onChange={(e) => setScriptFile(e.target.files[0] || null)}
          />
          <span className="file-name">{scriptFile ? scriptFile.name : '未选择文件'}</span>
        </label>

        <details className="thresholds">
          <summary>时间轴审计阈值（可选）</summary>
          <ThresholdForm
            value={thresholds}
            onChange={onThresholdsChange}
            onReset={onThresholdsReset}
          />
        </details>

        <div className="upload-actions">
          <button type="submit" className="primary" disabled={!srtFile || !scriptFile || busy}>
            {busy ? '比对中…' : '开始比对'}
          </button>
          <button type="button" onClick={useSample} disabled={busy}>
            使用内置示例
          </button>
        </div>
      </form>
    </div>
  )
}
