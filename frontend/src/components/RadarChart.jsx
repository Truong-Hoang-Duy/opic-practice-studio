import React from 'react';
import { useLanguage } from '../context/LanguageContext';

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
  const { isVi, pick } = useLanguage();
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
              className={ring === 5 ? "fill-slate-100/80 dark:fill-slate-900/50 stroke-slate-300/70 dark:stroke-slate-700/60" : "fill-none stroke-slate-300/60 dark:stroke-slate-700/50"}
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
              className="stroke-slate-300/70 dark:stroke-slate-700/60"
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
          opacity="0.8"
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
              fill="#0ea5e9"
              className="stroke-white dark:stroke-slate-900"
              strokeWidth="2"
            />
          );
        })}

        {/* Labels (Fixed crisp light & dark contrast!) */}
        {axes.map((axis, i) => {
          const angle = (Math.PI * 2 / totalAxes) * i - (Math.PI / 2);
          const labelDist = radius + 24;
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
              className="text-[10px] font-medium"
            >
              <tspan x={lx} dy="-0.4em" className="font-bold fill-slate-700 dark:fill-slate-100">
                {isVi ? axis.vi : axis.label}
              </tspan>
              <tspan x={lx} dy="1.25em" className="text-[9.5px] fill-sky-600 dark:fill-sky-400 font-extrabold">
                {val.toFixed(1)}/5
              </tspan>
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
          <span className="w-3 h-3 rounded bg-sky-500/30 border border-sky-500 inline-block" />
          <span>{pick('Điểm của bạn', 'Your Performance')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
          <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-500 inline-block" />
          <span>{pick('Mốc chuẩn (4.0 / 5)', 'Reference (4.0 / 5)')}</span>
        </div>
      </div>
    </div>
  );
};
