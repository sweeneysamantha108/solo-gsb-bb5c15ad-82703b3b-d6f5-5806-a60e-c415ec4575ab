import { THRESHOLD_FIELDS } from '../thresholds'

/**
 * 时间轴审计阈值表单。受控组件：值由父组件持有，
 * 重新比对后不会被重置；「恢复默认」可一键回到缺省值。
 */
export default function ThresholdForm({ value, onChange, onReset, onApply, applying = false }) {
  return (
    <div className="threshold-form">
      {THRESHOLD_FIELDS.map((f) => (
        <label key={f.key} className="threshold-field">
          <span className="threshold-label">{f.label}</span>
          <input
            type="number"
            min={f.min}
            step={f.step}
            value={value[f.key]}
            onChange={(e) => onChange(f.key, e.target.value)}
          />
          <span className="threshold-unit">{f.unit}</span>
        </label>
      ))}
      <div className="threshold-actions">
        {onApply && (
          <button type="button" className="primary" onClick={onApply} disabled={applying}>
            {applying ? '比对中…' : '重新比对'}
          </button>
        )}
        <button type="button" onClick={onReset} title={`恢复缺省值`}>
          恢复默认
        </button>
      </div>
    </div>
  )
}
