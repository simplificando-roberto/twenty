import { serializeFileList } from '../serializeFileList';

const validFile = {
  name: 'report.csv',
  size: 42,
  type: 'text/csv',
  lastModified: 1700000000000,
};

describe('serializeFileList', () => {
  it('should return undefined for a non-object', () => {
    expect(serializeFileList(null)).toBeUndefined();
    expect(serializeFileList('files')).toBeUndefined();
  });

  it('should return undefined when there is no numeric length', () => {
    expect(serializeFileList({})).toBeUndefined();
  });

  it('should serialize only the safe metadata of each file', () => {
    const result = serializeFileList({
      length: 1,
      0: { ...validFile, arrayBuffer: () => {} },
    });

    expect(result).toEqual([validFile]);
  });

  it('should forward content only when explicitly requested', () => {
    const file = new File(['content'], validFile.name, {
      type: validFile.type,
      lastModified: validFile.lastModified,
    });

    expect(
      serializeFileList({ length: 1, 0: file }, { includeContent: true }),
    ).toEqual([
      {
        ...validFile,
        size: file.size,
        content: file,
      },
    ]);
    expect(serializeFileList({ length: 1, 0: file })).toEqual([
      { ...validFile, size: file.size },
    ]);
  });

  it('should enforce the total forwarded content limit', () => {
    const file = new File(['content'], validFile.name, {
      type: validFile.type,
      lastModified: validFile.lastModified,
    });

    expect(
      serializeFileList(
        { length: 1, 0: file },
        { includeContent: true, maxTotalContentBytes: file.size - 1 },
      ),
    ).toEqual([{ ...validFile, size: file.size }]);
  });

  it('should not partially forward a file list over the total limit', () => {
    const first = new File(['first'], 'first.csv', { type: 'text/csv' });
    const second = new File(['second'], 'second.csv', { type: 'text/csv' });

    const result = serializeFileList(
      { length: 2, 0: first, 1: second },
      { includeContent: true, maxTotalContentBytes: first.size },
    );

    expect(result).toEqual([
      {
        name: first.name,
        size: first.size,
        type: first.type,
        lastModified: first.lastModified,
      },
      {
        name: second.name,
        size: second.size,
        type: second.type,
        lastModified: second.lastModified,
      },
    ]);
  });

  it('should skip entries missing required fields', () => {
    const result = serializeFileList({
      length: 2,
      0: validFile,
      1: { name: 'incomplete' },
    });

    expect(result).toEqual([validFile]);
  });
});
