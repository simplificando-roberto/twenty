import { type DownloadXlsxParams } from 'twenty-sdk/front-component';

export const FRONT_COMPONENT_DOWNLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const FRONT_COMPONENT_XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const XLSX_ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

const sanitizeXlsxFilename = (filename: string): string => {
  const sanitized = filename
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_')
    .replace(/\.+$/g, '')
    .trim()
    .slice(0, 240);

  return sanitized.toLowerCase().endsWith('.xlsx')
    ? sanitized
    : 'resultado-loang.xlsx';
};

const decodeValidatedXlsx = (contentBase64: string): Uint8Array => {
  const normalized = contentBase64.replace(/\s/g, '');
  const maxBase64Length = 4 * Math.ceil(FRONT_COMPONENT_DOWNLOAD_MAX_BYTES / 3);

  if (
    normalized.length === 0 ||
    normalized.length > maxBase64Length ||
    normalized.length % 4 !== 0 ||
    !BASE64_PATTERN.test(normalized)
  ) {
    throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
  }

  let binary: string;
  try {
    binary = atob(normalized);
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
  return bytes;
};

export const downloadBase64FileFromFrontComponent = ({
  filename,
  contentBase64,
  mimeType,
}: DownloadXlsxParams): void => {
  if (mimeType !== FRONT_COMPONENT_XLSX_MIME_TYPE) {
    throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
  }

  const bytes = decodeValidatedXlsx(contentBase64);
  const blobBytes = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(blobBytes).set(bytes);
  const blob = new Blob([blobBytes], {
    type: FRONT_COMPONENT_XLSX_MIME_TYPE,
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = sanitizeXlsxFilename(filename);
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};
