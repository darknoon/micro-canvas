import { describe, test, expect } from 'vitest';
import { parseCommands } from './bezier';

describe('bezier', () => {
  test('parses from svg path with absolute commands', () => {
    const path = 'M 100 100 C 150 50 200 150 250 100 L 300 150 Q 350 200 400 150 Z';
    expect(parseCommands(path)).toEqual([
      { type: 'moveTo', x: 100, y: 100 },
      {
        type: 'cubicCurveTo',
        controlX1: 150,
        controlY1: 50,
        controlX2: 200,
        controlY2: 150,
        x: 250,
        y: 100,
      },
      { type: 'lineTo', x: 300, y: 150 },
      { type: 'quadraticCurveTo', controlX: 350, controlY: 200, x: 400, y: 150 },
      { type: 'closePath' },
    ]);
  });

  test('parses from svg path with relative commands', () => {
    const path = 'm 100 100 c 50 -50 100 50 150 0 l 50 50 q 50 50 100 0 z';
    expect(parseCommands(path)).toEqual([
      { type: 'moveTo', x: 100, y: 100 },
      {
        type: 'cubicCurveTo',
        controlX1: 150,
        controlY1: 50,
        controlX2: 200,
        controlY2: 150,
        x: 250,
        y: 100,
      },
      { type: 'lineTo', x: 300, y: 150 },
      { type: 'quadraticCurveTo', controlX: 350, controlY: 200, x: 400, y: 150 },
      { type: 'closePath' },
    ]);
  });

  test('parses from svg path with mixed absolute and relative commands', () => {
    const path = 'M 100 100 c 50 -50 100 50 150 0 L 300 150 q 50 50 100 0 Z';
    expect(parseCommands(path)).toEqual([
      { type: 'moveTo', x: 100, y: 100 },
      {
        type: 'cubicCurveTo',
        controlX1: 150,
        controlY1: 50,
        controlX2: 200,
        controlY2: 150,
        x: 250,
        y: 100,
      },
      { type: 'lineTo', x: 300, y: 150 },
      { type: 'quadraticCurveTo', controlX: 350, controlY: 200, x: 400, y: 150 },
      { type: 'closePath' },
    ]);
  });
});
