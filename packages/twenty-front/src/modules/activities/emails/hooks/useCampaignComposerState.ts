import { useState } from 'react';

import { useCampaignDraftAutosave } from '@/activities/emails/hooks/useCampaignDraftAutosave';
import { useSendMessageCampaign } from '@/activities/emails/hooks/useSendMessageCampaign';

type UseCampaignComposerStateArgs = {
  onSent?: () => void;
};

export const useCampaignComposerState = ({
  onSent,
}: UseCampaignComposerStateArgs) => {
  const [unsubscribeTopicId, setUnsubscribeTopicId] = useState<string | null>(
    null,
  );
  const [listId, setListId] = useState<string | null>(null);
  const [fromAddress, setFromAddress] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const { sendMessageCampaign, loading } = useSendMessageCampaign();

  const { campaignId, stopAutosave } = useCampaignDraftAutosave({
    listId,
    unsubscribeTopicId,
    fromAddress,
    subject,
    body,
  });

  const canSend =
    listId !== null &&
    fromAddress.trim().length > 0 &&
    subject.trim().length > 0 &&
    !loading;

  const handleSend = async () => {
    if (listId === null || !canSend) {
      return;
    }

    stopAutosave();

    const success = await sendMessageCampaign({
      campaignId: campaignId ?? undefined,
      listId,
      unsubscribeTopicId: unsubscribeTopicId ?? undefined,
      subject,
      body,
      fromAddress: fromAddress.trim(),
    });

    if (success) {
      onSent?.();
    }
  };

  return {
    unsubscribeTopicId,
    setUnsubscribeTopicId,
    listId,
    setListId,
    fromAddress,
    setFromAddress,
    subject,
    setSubject,
    body,
    setBody,
    handleSend,
    canSend,
    loading,
  };
};
