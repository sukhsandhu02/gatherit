import React from 'react';
import Svg, { Rect, Circle } from 'react-native-svg';

interface LogoMarkProps {
  size?: number;
}

/**
 * Gather brand mark: points converging on a central lens.
 * Matches web/src/components/Logo.tsx exactly.
 */
export function LogoMark({ size = 44 }: LogoMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect width="40" height="40" rx="12" fill="#2447f0" />
      <Circle
        cx="20"
        cy="20"
        r="11"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeDasharray="52, 17"
        strokeLinecap="round"
        transform="rotate(-70 20 20)"
      />
      <Circle cx="20" cy="20" r="4.2" fill="#ffffff" />
      <Circle cx="31" cy="10.5" r="2.4" fill="#8dacff" />
    </Svg>
  );
}
