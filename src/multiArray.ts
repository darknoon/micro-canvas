// A really basic n-dimensional array class

export class MultiArray<T extends { toString: () => string }> {
  // TODO: use Uint8Array, Float32Array, etc + dtype for performance

  private data: T[];
  private dimensions: number[];

  get dtype(): string {
    if (this.dimensions.length === 0 || this.dimensions[0] === 0) {
      throw new Error('Cannot determine dtype of empty array');
    }
    const d0 = this.data[0];
    return typeof d0;
  }

  constructor(dimensions: number[], initialValue: T) {
    this.dimensions = dimensions;
    const totalSize = dimensions.reduce((acc, dim) => acc * dim, 1);
    this.data = new Array(totalSize).fill(initialValue);
  }

  private calculateIndex(indices: number[]): number {
    if (indices.length !== this.dimensions.length) {
      throw new Error('Invalid number of indices');
    }

    let index = 0;
    let multiplier = 1;

    for (let i = this.dimensions.length - 1; i >= 0; i--) {
      if (indices[i] < 0 || indices[i] >= this.dimensions[i]) {
        throw new Error('Index out of bounds');
      }
      index += indices[i] * multiplier;
      multiplier *= this.dimensions[i];
    }

    return index;
  }

  get(...indices: number[]): T {
    const index = this.calculateIndex(indices);
    return this.data[index];
  }

  set(value: T, ...indices: number[]): void {
    const index = this.calculateIndex(indices);
    this.data[index] = value;
  }

  copy(): MultiArray<T> {
    const newArray = new MultiArray<T>(this.dimensions, this.data[0]);
    newArray.data = [...this.data];
    return newArray;
  }

  valueOf(): T[][] {
    if (this.dimensions.length === 0) {
      return [];
    }

    const result: T[][] = [];
    for (let i = 0; i < this.dimensions[0]; i++) {
      const row: T[] = [];
      for (let j = 0; j < this.dimensions[1]; j++) {
        row.push(this.get(i, j));
      }
      result.push(row);
    }

    return result;
  }

  *[Symbol.iterator](): IterableIterator<T[]> {
    for (let i = 0; i < this.dimensions[0]; i++) {
      const row: T[] = [];
      for (let j = 0; j < this.dimensions[1]; j++) {
        row.push(this.get(i, j));
      }
      yield row;
    }
  }

  toString(indent: string = ''): string {
    if (this.dimensions.length === 0 || this.dimensions[0] === 0) {
      return '[]';
    }

    const isLastDimension = this.dimensions.length === 1;
    const result: string[] = [];
    const childIndent = indent + '  ';

    if (isLastDimension) {
      result.push('[');
      for (let i = 0; i < this.dimensions[0]; i++) {
        result.push(this.data[i].toString());
        if (i < this.dimensions[0] - 1) result.push(', ');
      }
      result.push(']');
    } else {
      result.push('[\n');
      for (let i = 0; i < this.dimensions[0]; i++) {
        const subArray = new MultiArray<T>(this.dimensions.slice(1), this.data[0]);
        const startIndex = i * subArray.data.length;
        subArray.data = this.data.slice(startIndex, startIndex + subArray.data.length);
        result.push(childIndent + subArray.toString(childIndent));
        if (i < this.dimensions[0] - 1) result.push(',\n');
      }
      result.push('\n' + indent + ']');
    }

    return result.join('');
  }
}
