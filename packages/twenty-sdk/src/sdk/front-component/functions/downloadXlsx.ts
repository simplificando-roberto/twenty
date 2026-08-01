import { isDefined } from 'twenty-shared/utils';

import {
  type DownloadXlsxFunction,
  frontComponentHostCommunicationApi,
} from '../globals/frontComponentHostCommunicationApi';

export const downloadXlsx: DownloadXlsxFunction = (params) => {
  const downloadXlsxFunction = frontComponentHostCommunicationApi.downloadXlsx;

  if (!isDefined(downloadXlsxFunction)) {
    throw new Error('downloadXlsxFunction is not set');
  }

  return downloadXlsxFunction(params);
};
