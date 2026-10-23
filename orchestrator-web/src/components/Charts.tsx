import type { SeriesPoint } from '../types'

interface SparkProps {
  points: SeriesPoint[]
  width?: number
  height?: number
  color?: string
}

/** 호출 수를 작은 선 그래프로 (부서 목록·skill 표용) */
export function Sparkline({ points, width = 84, height = 26, color = '#6aa9ff' }: SparkProps) {
  const values = points.map((p) => p.calls)
  const max = Math.max(...values, 1)
  const step = width / Math.max(values.length - 1, 1)
  const y = (v: number) => height - 2 - (v / max) * (height - 4)
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const empty = values.every((v) => v === 0)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="호출 수 추이">
      <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="#2a2a2a" />
      {!empty && (
        <>
          <path d={`${path} L${width},${height - 1} L0,${height - 1} Z`} fill={color} opacity=".16" />
          <path d={path} fill="none" stroke={color} strokeWidth="1.6" />
        </>
      )}
    </svg>
  )
}

interface BarsProps {
  points: SeriesPoint[]
  height?: number
}

/** 최근 10분 호출 수 막대(오류가 있으면 빨갛게)와 평균 응답 시간 선 */
export function UsageChart({ points, height = 130 }: BarsProps) {
  const width = 640
  const max = Math.max(...points.map((p) => p.calls), 1)
  const latMax = Math.max(...points.map((p) => p.avg_ms ?? 0), 1)
  const slot = width / points.length
  const barW = slot * 0.62
  const bars = points.map((p, i) => {
    const total = (p.calls / max) * (height - 22)
    const bad = (p.errors / max) * (height - 22)
    const x = i * slot + (slot - barW) / 2
    return (
      <g key={p.t}>
        <title>{`${new Date(p.t).toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul' })} · 호출 ${p.calls}건${p.errors ? ` (오류 ${p.errors})` : ''}${p.avg_ms !== null ? ` · 평균 ${p.avg_ms}ms` : ''}`}</title>
        <rect x={x} y={height - 4 - total} width={barW} height={Math.max(total, 0)} rx="2" fill="#3b82f6" opacity=".85" />
        {bad > 0 && <rect x={x} y={height - 4 - bad} width={barW} height={bad} rx="2" fill="#ff6b6b" />}
      </g>
    )
  })
  const line = points
    .map((p, i) =>
      p.avg_ms === null ? null : `${i * slot + slot / 2},${height - 4 - (p.avg_ms / latMax) * (height - 22)}`,
    )
    .filter((v): v is string => v !== null)
  const empty = points.every((p) => p.calls === 0)
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="부서 호출 사용량">
      <line x1="0" y1={height - 3} x2={width} y2={height - 3} stroke="#2a2a2a" />
      {bars}
      {line.length > 1 && <polyline points={line.join(' ')} fill="none" stroke="#ffd23f" strokeWidth="1.6" />}
      {empty && (
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#666" fontSize="13">
          아직 호출이 없어요. 장애를 주입하면 쌓여요.
        </text>
      )}
    </svg>
  )
}
