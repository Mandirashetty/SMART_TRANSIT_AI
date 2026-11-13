import React from 'react';
import { TransitBus } from '../types';

interface Props {
  bus: TransitBus;
}

export const BusIllustration: React.FC<Props> = ({ bus }) => {
  const accentColor =
    bus.status === 'on_time'
      ? '#16A34A'
      : bus.status === 'delayed'
        ? '#D97706'
        : '#DC2626';

  const bodyGradientId = `busGrad-${bus.id}`;

  return (
    <svg
      viewBox="0 0 320 130"
      className="w-full max-w-[320px] h-auto select-none"
      role="img"
      aria-label={`Illustration of ${bus.name} (${bus.reg_number})`}
    >
      <defs>
        <linearGradient id={bodyGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>

      {/* Road surface */}
      <rect x="8" y="106" width="304" height="8" rx="4" fill="#E2E8F0" />
      <line x1="20" y1="110" x2="300" y2="110" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="8 6" />

      {/* Bus shadow */}
      <ellipse cx="160" cy="107" rx="126" ry="5" fill="#CBD5E1" opacity="0.6" />

      {/* Main coach body */}
      <rect x="24" y="22" width="268" height="76" rx="14" fill={`url(#${bodyGradientId})`} />
      {/* Roof AC & beacon bar */}
      <rect x="70" y="15" width="120" height="7" rx="3.5" fill="#1E293B" />
      <circle cx="268" cy="20" r="4" fill={accentColor} />

      {/* Upper stripe */}
      <rect x="24" y="64" width="268" height="7" fill="#E0E7FF" opacity="0.9" />

      {/* Windows */}
      <rect x="36" y="32" width="36" height="26" rx="4" fill="#EFF6FF" />
      <rect x="78" y="32" width="36" height="26" rx="4" fill="#EFF6FF" />
      <rect x="120" y="32" width="36" height="26" rx="4" fill="#EFF6FF" />
      <rect x="162" y="32" width="36" height="26" rx="4" fill="#EFF6FF" />
      <rect x="204" y="32" width="36" height="26" rx="4" fill="#EFF6FF" />
      {/* Windshield */}
      <path d="M248 32 H278 C284 32 288 36 288 42 V58 H248 V32 Z" fill="#DBEAFE" />

      {/* Door */}
      <rect x="218" y="64" width="22" height="34" rx="2" fill="#1E3A8A" stroke="#93C5FD" strokeWidth="1" />

      {/* Registration plate */}
      <rect x="108" y="75" width="92" height="16" rx="3" fill="#FFFFFF" />
      <text
        x="154"
        y="86"
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="700"
        fontFamily="JetBrains Mono, monospace"
        fill="#0F172A"
      >
        {bus.reg_number}
      </text>

      {/* Headlight & Taillight */}
      <rect x="285" y="76" width="8" height="10" rx="2" fill="#FEF08A" />
      <rect x="21" y="76" width="5" height="12" rx="1.5" fill="#F87171" />

      {/* Wheels */}
      <circle cx="76" cy="99" r="14" fill="#0F172A" />
      <circle cx="76" cy="99" r="6.5" fill="#94A3B8" />
      <circle cx="242" cy="99" r="14" fill="#0F172A" />
      <circle cx="242" cy="99" r="6.5" fill="#94A3B8" />
    </svg>
  );
};
