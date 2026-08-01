import {
  downloadBase64FileFromFrontComponent,
  FRONT_COMPONENT_DOWNLOAD_MAX_BYTES,
  FRONT_COMPONENT_XLSX_MIME_TYPE,
} from '@/front-components/utils/downloadBase64FileFromFrontComponent';
import { utils, write } from 'xlsx-ugnis';

const crc32 = (data: Buffer): number => {
  let crc = 0xffffffff;
  for (const value of data) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createStoredXlsxZipAtSize = (targetSize: number): Buffer => {
  const entries = [
    {
      name: '[Content_Types].xml',
      data: Buffer.from(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: Buffer.from(
        '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>',
      ),
    },
    { name: 'padding.bin', data: Buffer.alloc(0) },
  ];
  const fixedSize =
    entries.reduce(
      (size, entry) =>
        size + 30 + Buffer.byteLength(entry.name) + entry.data.length,
      0,
    ) +
    entries.reduce(
      (size, entry) => size + 46 + Buffer.byteLength(entry.name),
      0,
    ) +
    22;
  const paddingLength = targetSize - fixedSize;
  if (paddingLength < 0) throw new Error('Target ZIP size is too small');
  entries[2].data = Buffer.alloc(paddingLength, 0x61);

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const filename = Buffer.from(entry.name, 'utf8');
    const checksum = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    localParts.push(localHeader, filename, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(filename.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, filename);

    localOffset += localHeader.length + filename.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localOffset, 16);

  const archive = Buffer.concat([...localParts, centralDirectory, eocd]);
  expect(archive.length).toBe(targetSize);
  return archive;
};

const createRealXlsxBase64 = (): string => {
  const workbook = utils.book_new();
  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet([['Estado'], ['Válido']]),
    'Resultado',
  );
  return Buffer.from(
    write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
  ).toString('base64');
};

const XLSX_BASE64 = createRealXlsxBase64();
const FAKE_XLSX_BYTES = Buffer.alloc(256);
FAKE_XLSX_BYTES.set([0x50, 0x4b, 0x03, 0x04]);
FAKE_XLSX_BYTES.write('[Content_Types].xml', 16, 'ascii');
FAKE_XLSX_BYTES.write('xl/workbook.xml', 64, 'ascii');

describe('downloadBase64FileFromFrontComponent', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (URL as Partial<typeof URL>).createObjectURL;
    delete (URL as Partial<typeof URL>).revokeObjectURL;
  });

  it('creates the XLSX Blob in the host and starts a download', () => {
    const click = jest.fn();
    const remove = jest.fn();
    const anchor = { href: '', download: '', rel: '', click, remove };
    jest
      .spyOn(document, 'createElement')
      .mockReturnValue(anchor as unknown as HTMLAnchorElement);
    const appendChild = jest
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);
    const createObjectURL = jest.fn().mockReturnValue('blob:host/xlsx');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    jest.spyOn(window, 'setTimeout').mockImplementation((handler) => {
      if (typeof handler === 'function') handler();
      return 1;
    });

    downloadBase64FileFromFrontComponent({
      filename: '../validos.xlsx',
      contentBase64: XLSX_BASE64,
      mimeType: FRONT_COMPONENT_XLSX_MIME_TYPE,
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchor.href).toBe('blob:host/xlsx');
    expect(anchor.download).toBe('.._validos.xlsx');
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:host/xlsx');

    delete (URL as Partial<typeof URL>).createObjectURL;
    delete (URL as Partial<typeof URL>).revokeObjectURL;
  });

  it('cleans the host anchor and Blob URL when the browser click fails', () => {
    const remove = jest.fn();
    const anchor = {
      href: '',
      download: '',
      rel: '',
      click: jest.fn(() => {
        throw new Error('click failed');
      }),
      remove,
    };
    jest
      .spyOn(document, 'createElement')
      .mockReturnValue(anchor as unknown as HTMLAnchorElement);
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn().mockReturnValue('blob:host/failure'),
    });
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    jest.spyOn(window, 'setTimeout').mockImplementation((handler) => {
      if (typeof handler === 'function') handler();
      return 1;
    });

    expect(() =>
      downloadBase64FileFromFrontComponent({
        filename: 'resultado.xlsx',
        contentBase64: XLSX_BASE64,
        mimeType: FRONT_COMPONENT_XLSX_MIME_TYPE,
      }),
    ).toThrow('click failed');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:host/failure');
  });

  it.each([
    {
      filename: 'x.xlsx',
      contentBase64: 'not-base64',
      mimeType: FRONT_COMPONENT_XLSX_MIME_TYPE,
    },
    {
      filename: 'x.xlsx',
      contentBase64: 'AAEC',
      mimeType: FRONT_COMPONENT_XLSX_MIME_TYPE,
    },
    {
      filename: 'x.xlsx',
      contentBase64: ` ${XLSX_BASE64}`,
      mimeType: FRONT_COMPONENT_XLSX_MIME_TYPE,
    },
    {
      filename: 'x.xlsx',
      contentBase64: FAKE_XLSX_BYTES.toString('base64'),
      mimeType: FRONT_COMPONENT_XLSX_MIME_TYPE,
    },
    { filename: 'x.xlsx', contentBase64: XLSX_BASE64, mimeType: 'text/html' },
  ])('rejects invalid or non-XLSX download input', (input) => {
    expect(() => downloadBase64FileFromFrontComponent(input)).toThrow(
      'FRONT_COMPONENT_DOWNLOAD_INVALID',
    );
  });

  it('accepts an XLSX payload exactly at the host limit', () => {
    const anchor = {
      href: '',
      download: '',
      rel: '',
      click: jest.fn(),
      remove: jest.fn(),
    };
    jest
      .spyOn(document, 'createElement')
      .mockReturnValue(anchor as unknown as HTMLAnchorElement);
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn().mockReturnValue('blob:host/max-xlsx'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    jest.spyOn(window, 'setTimeout').mockReturnValue(1);

    const bytes = createStoredXlsxZipAtSize(FRONT_COMPONENT_DOWNLOAD_MAX_BYTES);

    expect(() =>
      downloadBase64FileFromFrontComponent({
        filename: 'limite.xlsx',
        contentBase64: bytes.toString('base64'),
        mimeType: FRONT_COMPONENT_XLSX_MIME_TYPE,
      }),
    ).not.toThrow();

    delete (URL as Partial<typeof URL>).createObjectURL;
    delete (URL as Partial<typeof URL>).revokeObjectURL;
  });

  it('rejects an XLSX payload one byte over the host limit', () => {
    const bytes = createStoredXlsxZipAtSize(
      FRONT_COMPONENT_DOWNLOAD_MAX_BYTES + 1,
    );

    expect(() =>
      downloadBase64FileFromFrontComponent({
        filename: 'demasiado-grande.xlsx',
        contentBase64: bytes.toString('base64'),
        mimeType: FRONT_COMPONENT_XLSX_MIME_TYPE,
      }),
    ).toThrow('FRONT_COMPONENT_DOWNLOAD_INVALID');
  });
});
