import { useState } from 'react';

import { useCampaignDraftAutosave } from '@/activities/emails/hooks/useCampaignDraftAutosave';
import { useSendMessageCampaign } from '@/activities/emails/hooks/useSendMessageCampaign';

type CampaignComposerInitialValues = {
  campaignId?: string | null;
  listId?: string | null;
  unsubscribeTopicId?: string | null;
  fromAddress?: string | null;
  subject?: string | null;
  body?: string | null;
};

type UseCampaignComposerStateArgs = {
  onSent?: () => void;
  initialValues?: CampaignComposerInitialValues;
};

export const useCampaignComposerState = ({
  onSent,
  initialValues,
}: UseCampaignComposerStateArgs) => {
  const [unsubscribeTopicId, setUnsubscribeTopicId] = useState<string | null>(
    initialValues?.unsubscribeTopicId ?? null,
  );
  const [listId, setListId] = useState<string | null>(
    initialValues?.listId ?? null,
  );
  const [fromAddress, setFromAddress] = useState(
    initialValues?.fromAddress ?? '',
  );
  const [subject, setSubject] = useState(initialValues?.subject ?? '');
  const [body, setBody] = useState(initialValues?.body ?? '');

  const { sendMessageCampaign, loading } = useSendMessageCampaign();

  const { campaignId, stopAutosave } = useCampaignDraftAutosave({
    listId,
    unsubscribeTopicId,
    fromAddress,
    subject,
    body,
    initialCampaignId: initialValues?.campaignId,
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
