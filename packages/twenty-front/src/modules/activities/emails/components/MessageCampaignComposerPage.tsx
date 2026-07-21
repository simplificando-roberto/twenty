import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useNavigate } from 'react-router-dom';

import { CampaignComposerFields } from '@/activities/emails/components/CampaignComposerFields';
import { MessageCampaignStats } from '@/activities/emails/components/MessageCampaignStats';
import {
  SEND_TEST_CAMPAIGN_MODAL_ID,
  SendTestCampaignModal,
} from '@/activities/emails/components/SendTestCampaignModal';
import { useCampaignAudiencePreview } from '@/activities/emails/hooks/useCampaignAudiencePreview';
import { useCampaignComposerState } from '@/activities/emails/hooks/useCampaignComposerState';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useMyMessageChannels } from '@/settings/accounts/hooks/useMyMessageChannels';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { MessageChannelType, SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { Callout } from 'twenty-ui/feedback';
import { IconMailCog, IconSend, IconTestPipe } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

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

  const {
    record: campaign,
    loading: campaignLoading,
    refetch: refetchCampaign,
  } = useFindOneRecord({
    objectNameSingular: 'messageCampaign',
    objectRecordId: targetRecord.id,
  });

  const campaignState = useCampaignComposerState({
    onSent: refetchCampaign,
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

  const hasMailbox = channels.some(
    (channel) => channel.type === MessageChannelType.EMAIL_GROUP,
  );

  const canSendTest =
    campaignState.fromAddress.trim().length > 0 &&
    campaignState.subject.trim().length > 0;

  const openSendConfirmation = () => {
    if (campaignState.canSend) {
      openModal(SEND_CAMPAIGN_MODAL_ID);
    }
  };

  if (campaignLoading) {
    return null;
  }

  // A campaign that has left DRAFT is already with the provider, so the page
  // reports on it instead of offering an editor that could not be applied.
  if (isDefined(campaign) && campaign.status !== 'DRAFT') {
    return (
      <StyledContainer>
        <MessageCampaignStats
          status={campaign.status}
          subject={campaign.subject ?? null}
          sentAt={campaign.sentAt ?? null}
          sentCount={campaign.sentCount ?? 0}
          failedCount={campaign.failedCount ?? 0}
          bouncedCount={campaign.bouncedCount ?? 0}
          complainedCount={campaign.complainedCount ?? 0}
        />
      </StyledContainer>
    );
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
          title={t`Send test`}
          Icon={IconTestPipe}
          variant="secondary"
          onClick={() => openModal(SEND_TEST_CAMPAIGN_MODAL_ID)}
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
      <SendTestCampaignModal
        fromAddress={campaignState.fromAddress.trim()}
        subject={campaignState.subject}
        body={campaignState.body}
      />
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
