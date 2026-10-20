'use client';

import React from 'react';

interface ChartDisplayProps {
  data: {
    title: string;
    labels: string[];
    values: number[];
    chart_type: 'bar' | 'line' | 'pie';
    series?: Array<{ name: string; values: number[] }>;
  };
  onClose: () => void;
}

export default function ChartDisplay({ data, onClose }: ChartDisplayProps) {
  const series = data.series?.length ? data.series : [{ name: data.title, values: data.values }];
  const allValues = series.flatMap((item) => item.values);
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const range = maxVal - minVal || 1;
  const linePoints = (values: number[]) => values.map((value, index) => {
    const x = data.values.length === 1 ? 50 : (index / (data.values.length - 1)) * 100;
    const y = 94 - ((value - minVal) / range) * 82;
    return `${x},${y}`;
  }).join(' ');
  const lineColors = ['#ff00ff', '#00f0ff', '#00ff41', '#facc15', '#fb7185'];

  return (
    <div className="w-full max-w-2xl p-6 relative border border-neon-magenta/50 rounded bg-black/80 shadow-[0_0_20px_rgba(255,0,255,0.2)]">
      <button 
        onClick={onClose}
        className="absolute -top-4 -right-4 w-8 h-8 bg-black border border-neon-magenta text-neon-magenta rounded-full flex items-center justify-center hover:bg-neon-magenta hover:text-black transition-colors z-20"
      >
        ×
      </button>
      
      <h3 className="text-neon-magenta text-xl mb-6 font-bold tracking-widest" style={{ fontFamily: 'Orbitron' }}>
        {data.title}
      </h3>

      {series.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {series.map((item, index) => (
            <span key={item.name} className="flex items-center gap-1.5" style={{ color: lineColors[index % lineColors.length] }}>
              <i className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: lineColors[index % lineColors.length] }} />
              {item.name}
            </span>
          ))}
        </div>
      )}
      
      {data.chart_type === 'line' ? (
        <div className="relative h-64 border-b border-l border-neon-magenta/30">
          <div className="absolute -left-1 -top-5 text-xs text-neon-magenta/70">{maxVal}</div>
          <div className="absolute -left-1 -bottom-5 text-xs text-neon-magenta/70">{minVal}</div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label={data.title}>
            {series.map((item, seriesIndex) => (
              <g key={item.name} style={{ color: lineColors[seriesIndex % lineColors.length] }}>
                <polyline points={linePoints(item.values)} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                {item.values.map((value, index) => {
                  const x = item.values.length === 1 ? 50 : (index / (item.values.length - 1)) * 100;
                  const y = 94 - ((value - minVal) / range) * 82;
                  return <circle key={index} cx={x} cy={y} r="1.35" fill="currentColor" />;
                })}
              </g>
            ))}
          </svg>
          <div className="absolute inset-x-0 -bottom-8 flex justify-between text-[10px] text-neon-magenta/70">
            <span>{data.labels[0]}</span>
            <span>{data.labels[Math.floor(data.labels.length / 2)]}</span>
            <span>{data.labels[data.labels.length - 1]}</span>
          </div>
        </div>
      ) : (
        <div className="h-64 flex items-end justify-between gap-2 border-b border-l border-neon-magenta/30 pb-2 pl-2">
          {data.values.map((val, idx) => (
            <div key={idx} className="flex flex-col items-center flex-1 group">
              <div className="opacity-0 group-hover:opacity-100 text-xs text-neon-magenta mb-2 transition-opacity">{val}</div>
              <div className="w-full bg-neon-magenta/60 hover:bg-neon-magenta transition-all" style={{ height: `${(val / maxVal) * 100}%` }} />
              <div className="text-xs text-neon-magenta/70 mt-2 truncate w-full text-center">{data.labels[idx]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
