/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface BarcodeGeneratorProps {
  value: string;
  sku?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({ value, sku, size = 'md' }) => {
  // Generate pseudo-deterministic bar weights based on the character code of the value
  const generateBars = () => {
    const bars: number[] = [];
    const seedString = value + (sku || '');
    for (let i = 0; i < 40; i++) {
      const charCode = seedString.charCodeAt(i % seedString.length) || 13;
      // alternate black and white bar widths (1 to 4 pixels)
      const width = (charCode % 3) + 1;
      bars.push(width);
    }
    return bars;
  };

  const bars = generateBars();

  const getContainerWidth = () => {
    switch (size) {
      case 'sm': return 'w-28 h-8';
      case 'lg': return 'w-48 h-18';
      default: return 'w-40 h-12';
    }
  };

  return (
    <div className="flex flex-col items-center bg-white border border-gray-100 p-2 rounded-lg inline-block shadow-inner">
      {/* 1. Barcode Line Block */}
      <div className={`flex items-stretch bg-black ${getContainerWidth()} overflow-hidden rounded-sm`}>
        {bars.map((weight, index) => {
          const isBlack = index % 2 === 0;
          return (
            <div
              key={index}
              style={{ flexGrow: weight }}
              className={`${isBlack ? 'bg-black' : 'bg-white'}`}
            />
          );
        })}
      </div>

      {/* 2. Numeric EAN Representation Label */}
      <span className="font-mono text-[10px] tracking-widest text-gray-800 mt-1 font-semibold">
        {value}
      </span>
    </div>
  );
};

// Generates an interactive mock/dynamic vector QR code segment
export const QRGenerator: React.FC<{ value: string; size?: number }> = ({ value, size = 110 }) => {
  // Generates unique micro matrix clusters based on name strings
  const getMatrixPattern = () => {
    const matrix: boolean[][] = [];
    const hash = value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let row = 0; row < 15; row++) {
      matrix[row] = [];
      for (let col = 0; col < 15; col++) {
        // Corners must be solid finders
        const isFinder = (
          (row < 4 && col < 4) || // Top Left
          (row < 4 && col >= 11) || // Top Right
          (row >= 11 && col < 4) // Bottom Left
        );

        if (isFinder) {
          // Finder ring format
          const isRingHole = (row === 1 || row === 2) && (col === 1 || col === 2 || col === 12 || col === 13);
          const isRightRingHole = (row === 12 || row === 11) && (col === 1 || col === 2);
          matrix[row][col] = !(isRingHole || isRightRingHole);
        } else {
          // Semi-random deterministic grid dots
          matrix[row][col] = (row * col + hash + (row % 3) * (col % 4)) % 2 === 0;
        }
      }
    }
    return matrix;
  };

  const matrix = getMatrixPattern();

  return (
    <div className="flex flex-col items-center bg-white border border-gray-100 p-2.5 rounded-xl shadow-sm inline-block">
      <div 
        style={{ width: size, height: size }} 
        className="grid grid-cols-15 gap-[1px] bg-white p-1 select-none"
      >
        {matrix.map((row, rIdx) => 
          row.map((active, cIdx) => (
            <div 
              key={`${rIdx}-${cIdx}`} 
              className={`rounded-[1px] transition duration-150 ${active ? 'bg-gray-900' : 'bg-white'}`}
            />
          ))
        )}
      </div>
      <span className="font-mono text-[9px] tracking-tight text-gray-400 mt-1.5 uppercase font-medium">
        Scan QR Pay/Ref
      </span>
    </div>
  );
};
