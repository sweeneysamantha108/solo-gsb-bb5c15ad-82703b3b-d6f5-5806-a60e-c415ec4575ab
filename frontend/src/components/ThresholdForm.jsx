import { THRESHOLD_FIELDS } from '../timeline'

/** 时间轴审计阈值表单：受控组件，数值在重新比对间由父级保留，可一键恢复缺省。 */
export default function ThresholdForm({ values, onChange, onReset }) {
  return (
    <details className="threshold-box">
      <summary>时间轴审计阈值</summary>
      <div className="threshold-grid">
        {THRESHOLD_FIELDS.map((f) => (
          <label key={f.key} className="threshold-field" title={f.hint}>
            <span>{f.label}</span>
            <input
              type="number"
              min={f.min}
              step={f.step}
              value={values[f.key]}
              onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <button type="button" className="threshold-reset" onClick={onReset}>
        恢复缺省值
      </button>
    </details>
  )
}
