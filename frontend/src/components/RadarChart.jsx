import React from 'react';

export const RadarChart = ({
  scores = {
    fluency_and_length: 3.5,
    tense_control: 3.0,
    organization: 4.0,
    vocabulary: 3.2,
    grammar: 3.0,
    task_completion: 4.5
  },
  size = 320
}) => {
  const axes = [
    { key: "fluency_and_length", label: "Fluency & Length", vi: "Trôi chảy" },
    { key: "tense_control", label: "Tense Control", vi: "Kiểm soát thì" },
    { key: "organization", label: "Organization", vi: "Bố cục" },
    { key: "vocabulary", label: "Vocabulary", vi: "Từ vựng" },
    { key: "grammar", label: "Grammar", vi: "Ngữ pháp" },
    { key: "task_completion", label: "Task Completion", vi: "Hoàn thành đề" }
  ];

  const totalAxes = axes.length;
  const center = size / 2;
  const radius = (size / 2) - 45;
  const maxScore = 5.0;

  const getCoordinates = (index, value) => {
    const angle = (Math.PI * 2 / totalAxes) * index - (Math.PI / 2);
    const r = (value / maxScore) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Generate web rings (levels 1 to 5)
  const rings = [1, 2, 3, 4, 5];

  // User polygon points
  const userPoints = axes.map((axis, i) => {
    const val = scores[axis.key] || 0;
    const { x, y } = getCoordinates(i, val);
    return `${x},${y}`;
  }).join(" ");

  // Target IH polygon points (constant 4.0)
  const ihTargetPoints = axes.map((_, i) => {
    const { x, y } = getCoordinates(i, 4.0);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background Web Rings */}
        {rings.map((ring) => {
          const ringPoints = axes.map((_, i) => {
            const { x, y } = getCoordinates(i, ring);
            return `${x},${y}`;
          }).join(" ");
          return (
            <polygon
              key={ring}
              points={ringPoints}
              fill={ring === 5 ? "rgba(15, 23, 42, 0.4)" : "none"}
              stroke="rgba(148, 163, 184, 0.15)"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis Lines */}
        {axes.map((_, i) => {
          const { x, y } = getCoordinates(i, maxScore);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth="1"
            />
          );
        })}

        {/* Target IH Reference Line (Dashed Emerald) */}
        <polygon
          points={ihTargetPoints}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.6"
        />

        {/* User Score Filled Polygon */}
        <polygon
          points={userPoints}
          fill="rgba(14, 165, 233, 0.25)"
          stroke="#0ea5e9"
          strokeWidth="2.5"
        />

        {/* User Score Data Dots */}
        {axes.map((axis, i) => {
          const val = scores[axis.key] || 0;
          const { x, y } = getCoordinates(i, val);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              fill="#38bdf8"
              stroke="#0f172a"
              strokeWidth="2"
            />
          );
        })}

        {/* Labels */}
        {axes.map((axis, i) => {
          const angle = (Math.PI * 2 / totalAxes) * i - (Math.PI / 2);
          const labelDist = radius + 22;
          const lx = center + labelDist * Math.cos(angle);
          const ly = center + labelDist * Math.sin(angle);

          const val = scores[axis.key] || 0;
          return (
            <text
              key={i}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-medium fill-slate-300"
            >
              <tspan x={lx} dy="-0.4em" className="font-semibold fill-white">{axis.label}</tspan>
              <tspan x={lx} dy="1.2em" className="text-[9px] fill-sky-400 font-bold">{val.toFixed(1)}/5</tspan>
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className="w-3 h-3 rounded bg-sky-500/30 border border-sky-400 inline-block" />
          <span>Your Performance</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-400 inline-block" />
          <span>Reference benchmark (4.0 / 5)</span>
        </div>
      </div>
    </div>
  );
};
