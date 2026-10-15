'use client';

import React from 'react';

interface WeatherData {
  location: string;
  temperature: number;
  apparent_temperature?: number;
  humidity?: number;
  wind_speed?: number;
  condition: string;
  observed_at?: string;
}

export default function WeatherDisplay({ data, onClose }: { data: WeatherData; onClose: () => void }) {
  return (
    <section className="relative w-full max-w-md border border-neon-cyan/50 bg-black/80 p-7 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
      <button onClick={onClose} className="absolute -right-4 -top-4 h-8 w-8 rounded-full border border-neon-cyan bg-black text-neon-cyan hover:bg-neon-cyan hover:text-black">×</button>
      <p className="text-xs tracking-[0.3em] text-neon-cyan/70">CURRENT WEATHER</p>
      <h3 className="mt-2 text-2xl font-bold text-neon-cyan" style={{ fontFamily: 'Orbitron' }}>{data.location}</h3>
      <div className="my-6 flex items-end gap-4">
        <span className="text-7xl font-bold text-neon-cyan">{data.temperature}°</span>
        <span className="mb-2 text-lg text-neon-cyan/80">{data.condition}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-neon-cyan/30 pt-4 text-center text-sm text-neon-cyan/80">
        <div><p className="text-[10px] text-neon-cyan/50">FEELS LIKE</p>{data.apparent_temperature ?? '-'}°C</div>
        <div><p className="text-[10px] text-neon-cyan/50">HUMIDITY</p>{data.humidity ?? '-'}%</div>
        <div><p className="text-[10px] text-neon-cyan/50">WIND</p>{data.wind_speed ?? '-'} km/h</div>
      </div>
    </section>
  );
}
