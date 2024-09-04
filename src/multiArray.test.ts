import { expect, test, describe } from 'vitest';
import { MultiArray } from './multiArray';

describe('MultiArray', () => {
  test('constructor initializes with correct dimensions and initial value', () => {
    const arr = new MultiArray([2, 3], false);
    expect(arr.get(0, 0)).toBe(false);
    expect(arr.get(1, 2)).toBe(false);
  });

  test('set and get methods work correctly', () => {
    const arr = new MultiArray([2, 2], 0);
    arr.set(5, 0, 1);
    expect(arr.get(0, 1)).toBe(5);
  });

  test('basic 2d array operations work correctly', () => {
    const arr = new MultiArray([5, 3], false);
    expect(arr.get(0, 0)).toBe(false);
    expect(arr.get(1, 0)).toBe(false);
    arr.set(true, 0, 0);
    arr.set(true, 1, 0);
    expect(arr.get(0, 0)).toBe(true);
    expect(arr.get(1, 0)).toBe(true);
    expect(arr.get(2, 0)).toBe(false);
    expect(arr.get(3, 0)).toBe(false);
  });

  test('copy method creates a new instance with the same data', () => {
    const arr = new MultiArray([2, 2], 0);
    arr.set(1, 0, 0);
    arr.set(2, 1, 1);
    const copy = arr.copy();
    expect(copy.get(0, 0)).toBe(1);
    expect(copy.get(1, 1)).toBe(2);
    expect(copy).not.toBe(arr);
  });

  test('valueOf method returns correct nested array representation', () => {
    const arr = new MultiArray([2, 3], 0);
    arr.set(1, 0, 1);
    arr.set(2, 1, 2);
    expect(arr.valueOf()).toEqual([
      [0, 1, 0],
      [0, 0, 2],
    ]);
  });

  test('iterator works correctly', () => {
    const arr = new MultiArray([2, 3], 0);
    arr.set(1, 0, 1);
    arr.set(2, 1, 2);
    const result = Array.from(arr);
    expect(result).toEqual([
      [0, 1, 0],
      [0, 0, 2],
    ]);
  });

  test('toString method returns correct string representation', () => {
    const arr = new MultiArray([2, 3], 0);
    arr.set(1, 0, 1);
    arr.set(2, 1, 2);
    expect(arr.toString()).toBe('[0, 1, 0]\n[0, 0, 2]');
  });

  test('throws error for invalid indices', () => {
    const arr = new MultiArray([2, 2], 0);
    expect(() => arr.get(2, 0)).toThrow('Index out of bounds');
    expect(() => arr.set(1, 0, 2)).toThrow('Index out of bounds');
  });

  test('toString method handles N dimensions correctly', () => {
    const arr2D = new MultiArray([2, 3], 0);
    arr2D.set(1, 0, 1);
    arr2D.set(2, 1, 2);
    expect(arr2D.toString()).toBe('[\n  [0, 1, 0],\n  [0, 0, 2]\n]');

    const arr3D = new MultiArray([2, 2, 2], 0);
    arr3D.set(1, 0, 0, 0);
    arr3D.set(2, 1, 1, 1);
    expect(arr3D.toString()).toBe(
      '[\n  [\n    [1, 0],\n    [0, 0]\n  ],\n  [\n    [0, 0],\n    [0, 2]\n  ]\n]'
    );

    const arr4D = new MultiArray([2, 2, 2, 2], 0);
    arr4D.set(1, 0, 0, 0, 0);
    arr4D.set(2, 1, 1, 1, 1);
    expect(arr4D.toString()).toBe(
      '[\n  [\n    [\n      [1, 0],\n      [0, 0]\n    ],\n    [\n      [0, 0],\n      [0, 0]\n    ]\n  ],\n  [\n    [\n      [0, 0],\n      [0, 0]\n    ],\n    [\n      [0, 0],\n      [0, 2]\n    ]\n  ]\n]'
    );
  });
});
