import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';

import { CampaignComposerFields } from '@/activities/emails/components/CampaignComposerFields';
import { useCampaignAudiencePreview } from '@/activities/emails/hooks/useCampaignAudiencePreview';
import { useCampaignComposerState } from '@/activities/emails/hooks/useCampaignComposerState';
import { useMyMessageChannels } from '@/settings/accounts/hooks/useMyMessageChannels';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useSendTestMessageCampaign } from '@/activities/emails/hooks/useSendTestMessageCampaign';
import { MessageChannelType, SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { Callout } from 'twenty-ui/feedback';
import { IconMailCog, IconSend, IconTestPipe } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useNavigate } from 'react-router-dom';

const SEND_CAMPAIGN_MODAL_ID = 'send-campaign-confirmation-modal';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  height: 100%;
  margin: 0 auto;
  max-width: 640px;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[4]};
  width: 100%;
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
`;

export const MessageCampaignComposerPage = () => {
  const targetRecord = useTargetRecord();
  const navigate = useNavigate();
  const { openModal } = useModal();
  const { channels } = useMyMessageChannels();

  const { record: campaign, loading: campaignLoading } = useFindOneRecord({
    objectNameSingular: 'messageCampaign',
    objectRecordId: targetRecord.id,
  });

  const campaignState = useCampaignComposerState({
    initialValues: {
      campaignId: targetRecord.id,
      listId: campaign?.listId ?? null,
      unsubscribeTopicId: campaign?.unsubscribeTopicId ?? null,
      fromAddress: campaign?.fromAddress?.primaryEmail ?? null,
      subject: campaign?.subject ?? null,
      body: campaign?.bodyTemplate ?? null,
    },
  });

  const audiencePreview = useCampaignAudiencePreview({
    listId: campaignState.listId,
    unsubscribeTopicId: campaignState.unsubscribeTopicId,
  });

  const { sendTestMessageCampaign, loading: sendingTest } =
    useSendTestMessageCampaign();

  const hasMailbox = channels.some(
    (channel) => channel.type === MessageChannelType.EMAIL_GROUP,
  );

  const canSendTest =
    campaignState.fromAddress.trim().length > 0 &&
    campaignState.subject.trim().length > 0 &&
    !sendingTest;

  const openSendConfirmation = () => {
    if (campaignState.canSend) {
      openModal(SEND_CAMPAIGN_MODAL_ID);
    }
  };

  const handleSendTest = () =>
    sendTestMessageCampaign({
      fromAddress: campaignState.fromAddress.trim(),
      subject: campaignState.subject,
      body: campaignState.body,
    });

  if (campaignLoading) {
    return null;
  }

  return (
    <StyledContainer>
      {!hasMailbox && (
        <Callout
          variant="warning"
          Icon={IconMailCog}
          title={t`No shared mailbox yet`}
          description={t`A campaign is sent from a shared mailbox on a verified domain. Set one up before you send.`}
          action={{
            label: t`Open Communication settings`,
            onClick: () =>
              navigate(getSettingsPath(SettingsPath.WorkspaceCommunications)),
          }}
        />
      )}
      <CampaignComposerFields campaignState={campaignState} />
      <StyledActions>
        <Button
          title={t`Send test to myself`}
          Icon={IconTestPipe}
          variant="secondary"
          onClick={handleSendTest}
          isLoading={sendingTest}
          disabled={!canSendTest}
        />
        <Button
          title={t`Send campaign`}
          Icon={IconSend}
          variant="primary"
          accent="blue"
          onClick={openSendConfirmation}
          disabled={!campaignState.canSend}
        />
      </StyledActions>
      <ConfirmationModal
        modalInstanceId={SEND_CAMPAIGN_MODAL_ID}
        title={t`Send this campaign?`}
        subtitle={
          isDefined(audiencePreview)
            ? t`${audiencePreview.sendable} people will receive "${campaignState.subject}" from ${campaignState.fromAddress}. This cannot be undone.`
            : t`"${campaignState.subject}" will be sent from ${campaignState.fromAddress}. This cannot be undone.`
        }
        onConfirmClick={campaignState.handleSend}
        confirmButtonText={t`Send campaign`}
        confirmButtonAccent="blue"
        loading={campaignState.loading}
      />
    </StyledContainer>
  );
};
