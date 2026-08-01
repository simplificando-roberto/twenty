import {
  downloadBase64FileFromFrontComponent,
  FRONT_COMPONENT_DOWNLOAD_MAX_BYTES,
  FRONT_COMPONENT_XLSX_MIME_TYPE,
} from '@/front-components/utils/downloadBase64FileFromFrontComponent';

const XLSX_BASE64 = 'UEsDBAECAwQ=';

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

    const bytes = Buffer.alloc(FRONT_COMPONENT_DOWNLOAD_MAX_BYTES);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);

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
    const bytes = Buffer.alloc(FRONT_COMPONENT_DOWNLOAD_MAX_BYTES + 1);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);

    expect(() =>
      downloadBase64FileFromFrontComponent({
        filename: 'demasiado-grande.xlsx',
        contentBase64: bytes.toString('base64'),
        mimeType: FRONT_COMPONENT_XLSX_MIME_TYPE,
      }),
    ).toThrow('FRONT_COMPONENT_DOWNLOAD_INVALID');
  });
});
