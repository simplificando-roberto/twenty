import { useMutation } from '@apollo/client/react';
import { useCallback, useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { isNonEmptyString } from '@sniptt/guards';

import { SAVE_MESSAGE_CAMPAIGN_DRAFT } from '@/activities/emails/graphql/mutations/saveMessageCampaignDraft';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { t } from '@lingui/core/macro';
import { isDefined } from 'twenty-shared/utils';
import {
  type SaveMessageCampaignDraftMutation,
  type SaveMessageCampaignDraftMutationVariables,
} from '~/generated-metadata/graphql';

const CAMPAIGN_DRAFT_AUTOSAVE_DEBOUNCE_MS = 2000;

type UseCampaignDraftAutosaveArgs = {
  listId: string | null;
  unsubscribeTopicId: string | null;
  fromAddress: string;
  subject: string;
  body: string;
};

export const useCampaignDraftAutosave = ({
  listId,
  unsubscribeTopicId,
  fromAddress,
  subject,
  body,
}: UseCampaignDraftAutosaveArgs) => {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [isAutosaveStopped, setIsAutosaveStopped] = useState(false);

  const [saveMessageCampaignDraftMutation] = useMutation<
    SaveMessageCampaignDraftMutation,
    SaveMessageCampaignDraftMutationVariables
  >(SAVE_MESSAGE_CAMPAIGN_DRAFT);

  const { enqueueErrorSnackBar } = useSnackBar();

  const saveDraftDebounced = useDebouncedCallback(async () => {
    try {
      const result = await saveMessageCampaignDraftMutation({
        variables: {
          input: {
            campaignId: campaignId ?? undefined,
            listId: listId ?? undefined,
            unsubscribeTopicId: unsubscribeTopicId ?? undefined,
            subject,
            body,
            fromAddress: isNonEmptyString(fromAddress.trim())
              ? fromAddress.trim()
              : undefined,
          },
        },
      });

      const savedCampaignId = result.data?.saveMessageCampaignDraft.id;

      if (isDefined(savedCampaignId)) {
        setCampaignId(savedCampaignId);
      }
    } catch {
      // A failed autosave keeps retrying on every keystroke otherwise, and the
      // usual cause (the campaign left DRAFT) will never resolve itself.
      setIsAutosaveStopped(true);
      enqueueErrorSnackBar({ message: t`Failed to save campaign draft` });
    }
  }, CAMPAIGN_DRAFT_AUTOSAVE_DEBOUNCE_MS);

  const stopAutosave = useCallback(() => {
    setIsAutosaveStopped(true);
    saveDraftDebounced.cancel();
  }, [saveDraftDebounced]);

  const hasContent =
    isDefined(listId) ||
    isDefined(unsubscribeTopicId) ||
    isNonEmptyString(fromAddress.trim()) ||
    isNonEmptyString(subject.trim()) ||
    isNonEmptyString(body.trim());

  useEffect(() => {
    if (!hasContent || isAutosaveStopped) {
      return;
    }

    saveDraftDebounced();
  }, [
    hasContent,
    isAutosaveStopped,
    listId,
    unsubscribeTopicId,
    fromAddress,
    subject,
    body,
    saveDraftDebounced,
  ]);

  return { campaignId, stopAutosave };
};
