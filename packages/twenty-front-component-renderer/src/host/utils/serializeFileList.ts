import { isNumber, isObject, isString } from '@sniptt/guards';

import { type SerializedFileData } from '@/types/SerializedFileData';

type SerializeFileListOptions = {
  includeContent?: boolean;
  maxTotalContentBytes?: number;
};

export const serializeFileList = (
  files: unknown,
  options: SerializeFileListOptions = {},
): SerializedFileData[] | undefined => {
  if (!isObject(files)) {
    return undefined;
  }
  const fileListLike = files as { length?: unknown } & Record<number, unknown>;
  if (!isNumber(fileListLike.length)) {
    return undefined;
  }

  const serialized: SerializedFileData[] = [];
  const contentCandidates: Blob[] = [];
  for (let index = 0; index < fileListLike.length; index++) {
    const file = fileListLike[index];
    if (!isObject(file)) {
      continue;
    }
    const fileRecord = file as Record<string, unknown>;
    if (
      !isString(fileRecord.name) ||
      !isNumber(fileRecord.size) ||
      !isString(fileRecord.type) ||
      !isNumber(fileRecord.lastModified)
    ) {
      continue;
    }
    serialized.push({
      name: fileRecord.name,
      size: fileRecord.size,
      type: fileRecord.type,
      lastModified: fileRecord.lastModified,
    });

    if (typeof Blob !== 'undefined' && file instanceof Blob) {
      contentCandidates.push(file);
    }
  }

  const totalContentBytes = contentCandidates.reduce(
    (total, file) => total + file.size,
    0,
  );
  const canForwardAllContent =
    options.includeContent === true &&
    contentCandidates.length === serialized.length &&
    (options.maxTotalContentBytes === undefined ||
      totalContentBytes <= options.maxTotalContentBytes);

  if (canForwardAllContent) {
    for (let index = 0; index < serialized.length; index++) {
      const serializedFile = serialized[index];
      const content = contentCandidates[index];
      if (serializedFile !== undefined && content !== undefined) {
        serializedFile.content = content;
      }
    }
  }

  return serialized;
};
