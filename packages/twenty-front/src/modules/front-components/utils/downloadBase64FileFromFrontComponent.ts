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
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_MIN_SIZE = 22;
const ZIP_MAX_COMMENT_LENGTH = 65_535;

export type PreparedFrontComponentXlsxDownload = {
  bytes: Uint8Array;
  filename: string;
};

const assertValidXlsxArchiveEntries = (bytes: Uint8Array): void => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimumEocdOffset = Math.max(
    0,
    bytes.length -
      ZIP_END_OF_CENTRAL_DIRECTORY_MIN_SIZE -
      ZIP_MAX_COMMENT_LENGTH,
  );
  let eocdOffset = -1;

  for (
    let offset = bytes.length - ZIP_END_OF_CENTRAL_DIRECTORY_MIN_SIZE;
    offset >= minimumEocdOffset;
    offset -= 1
  ) {
    if (
      view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE &&
      offset +
        ZIP_END_OF_CENTRAL_DIRECTORY_MIN_SIZE +
        view.getUint16(offset + 20, true) ===
        bytes.length
    ) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
  }

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    totalEntries === 0 ||
    totalEntries === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff ||
    centralDirectoryOffset + centralDirectorySize !== eocdOffset
  ) {
    throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
  }

  const requiredEntries = new Set(XLSX_REQUIRED_ARCHIVE_ENTRIES);
  let centralOffset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (
      centralOffset + 46 > eocdOffset ||
      view.getUint32(centralOffset, true) !==
        ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE
    ) {
      throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
    }

    const filenameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localHeaderOffset = view.getUint32(centralOffset + 42, true);
    const filenameStart = centralOffset + 46;
    const filenameEnd = filenameStart + filenameLength;
    const nextCentralOffset = filenameEnd + extraLength + commentLength;

    if (
      filenameLength === 0 ||
      nextCentralOffset > eocdOffset ||
      localHeaderOffset + 30 > centralDirectoryOffset ||
      view.getUint32(localHeaderOffset, true) !==
        ZIP_LOCAL_FILE_HEADER_SIGNATURE
    ) {
      throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
    }

    const localFilenameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const localFilenameStart = localHeaderOffset + 30;
    const localFilenameEnd = localFilenameStart + localFilenameLength;

    if (
      localFilenameLength !== filenameLength ||
      localFilenameEnd + localExtraLength > centralDirectoryOffset
    ) {
      throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
    }

    for (let index = 0; index < filenameLength; index += 1) {
      if (bytes[filenameStart + index] !== bytes[localFilenameStart + index]) {
        throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
      }
    }

    for (const requiredEntry of requiredEntries) {
      if (
        requiredEntry.length === filenameLength &&
        Array.from(requiredEntry).every(
          (character, index) =>
            bytes[filenameStart + index] === character.charCodeAt(0),
        )
      ) {
        requiredEntries.delete(requiredEntry);
        break;
      }
    }
    centralOffset = nextCentralOffset;
  }

  if (
    centralOffset !== eocdOffset ||
    centralOffset !== centralDirectoryOffset + centralDirectorySize ||
    requiredEntries.size > 0
  ) {
    throw new Error('FRONT_COMPONENT_DOWNLOAD_INVALID');
  }
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

  assertValidXlsxArchiveEntries(bytes);

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
