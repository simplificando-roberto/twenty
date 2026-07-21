import { useCallback } from 'react';

import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { AppPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { useNavigateApp } from '~/hooks/useNavigateApp';

export const useCreateAndOpenCampaign = () => {
  const navigateApp = useNavigateApp();
  const { createOneRecord: createMessageCampaign } = useCreateOneRecord({
    objectNameSingular: 'messageCampaign',
  });

  const createAndOpenCampaign = useCallback(async () => {
    const createdCampaign = await createMessageCampaign({
      status: 'DRAFT',
    });

    if (!isDefined(createdCampaign)) {
      return;
    }

    navigateApp(AppPath.RecordShowPage, {
      objectNameSingular: 'messageCampaign',
      objectRecordId: createdCampaign.id,
    });
  }, [createMessageCampaign, navigateApp]);

  return { createAndOpenCampaign };
};
