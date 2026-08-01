import { type DownloadXlsxParams } from 'twenty-sdk/front-component';

export const FRONT_COMPONENT_DOWNLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const FRONT_COMPONENT_XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const XLSX_ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const XLSX_REQUIRED_ARCHIVE_ENTRIES = [
  '[Content_Types].xml',
  'xl/workbook.xml',
];
const FRONT_COMPONENT_DOWNLOAD_MAX_FILENAME_LENGTH = 240;

export type PreparedFrontComponentXlsxDownload = {
  bytes: Uint8Array;
  filename: string;
};

const containsAscii = (bytes: Uint8Array, text: string): boolean => {
  const textBytes = Array.from(text, (character) => character.charCodeAt(0));

  search: for (
    let start = 0;
    start <= bytes.length - textBytes.length;
    start += 1
  ) {
    for (let offset = 0; offset < textBytes.length; offset += 1) {
      if (bytes[start + offset] !== textBytes[offset]) {
        continue search;
      }
    }
    return true;
  }

  return false;
};

const sanitizeXlsxFilename = (filename: string): string => {
  const sanitized = filename
    .replace(
      /[\\/:*?"<>|\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
      '_',
    )
    .replace(/\.+$/g, '')
    .trim()
    .slice(0, FRONT_COMPONENT_DOWNLOAD_MAX_FILENAME_LENGTH);

  return sanitized.toLowerCase().endsWith('.xlsx')
    ? sanitized
    : 'download.xlsx';
};

const decodeValidatedXlsx = (contentBase64: string): Uint8Array => {
  const maxBase64Length = 4 * Math.ceil(FRONT_COMPONENT_DOWNLOAD_MAX_BYTES / 3);

  if (
    contentBase64.length === 0 ||
    contentBase64.length > maxBase64Length ||
    contentBase64.length % 4 !== 0 ||
    !BASE64_PATTERN.test(contentBase64)
  ) {
    throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
  }

  let binary: string;
  try {
    binary = atob(contentBase64);
  } catch {
    throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
  }

  if (
    binary.length === 0 ||
    binary.length > FRONT_COMPONENT_DOWNLOAD_MAX_BYTES ||
    XLSX_ZIP_SIGNATURE.some(
      (expected, index) => binary.charCodeAt(index) !== expected,
    )
  ) {
    throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  if (
    XLSX_REQUIRED_ARCHIVE_ENTRIES.some(
      (entryName) => !containsAscii(bytes, entryName),
    )
  ) {
    throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
  }

  return bytes;
};

export const prepareXlsxDownloadFromFrontComponent = (
  params: DownloadXlsxParams,
): PreparedFrontComponentXlsxDownload => {
  if (
    typeof params !== 'object' ||
    params === null ||
    typeof params.filename !== 'string' ||
    params.filename.length === 0 ||
    params.filename.length > FRONT_COMPONENT_DOWNLOAD_MAX_FILENAME_LENGTH ||
    typeof params.contentBase64 !== 'string' ||
    typeof params.mimeType !== 'string'
  ) {
    throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
  }

  const { filename, contentBase64, mimeType } = params;

  if (mimeType !== FRONT_COMPONENT_XLSX_MIME_TYPE) {
    throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
  }

  return {
    bytes: decodeValidatedXlsx(contentBase64),
    filename: sanitizeXlsxFilename(filename),
  };
};

export const downloadPreparedXlsxFromFrontComponent = ({
  bytes,
  filename,
}: PreparedFrontComponentXlsxDownload): void => {
  const blobBytes = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(blobBytes).set(bytes);
  const blob = new Blob([blobBytes], {
    type: FRONT_COMPONENT_XLSX_MIME_TYPE,
  });
  const objectUrl = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | undefined;

  try {
    anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor?.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
};

export const downloadBase64FileFromFrontComponent = (
  params: DownloadXlsxParams,
): void => {
  downloadPreparedXlsxFromFrontComponent(
    prepareXlsxDownloadFromFrontComponent(params),
  );
};
