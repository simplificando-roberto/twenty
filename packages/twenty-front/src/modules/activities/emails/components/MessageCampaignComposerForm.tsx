import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useNavigate } from 'react-router-dom';

import { CampaignComposerFields } from '@/activities/emails/components/CampaignComposerFields';
import {
  SEND_TEST_CAMPAIGN_MODAL_ID,
  SendTestCampaignModal,
} from '@/activities/emails/components/SendTestCampaignModal';
import { useCampaignAudiencePreview } from '@/activities/emails/hooks/useCampaignAudiencePreview';
import { useCampaignComposerState } from '@/activities/emails/hooks/useCampaignComposerState';
import { useMyMessageChannels } from '@/settings/accounts/hooks/useMyMessageChannels';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { MessageChannelType, SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { Callout } from 'twenty-ui/feedback';
import { IconMailCog, IconSend, IconTestPipe } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const SEND_CAMPAIGN_MODAL_ID = 'send-campaign-confirmation-modal';

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
`;

type MessageCampaignComposerFormProps = {
  campaignId: string;
  listId: string | null;
  unsubscribeTopicId: string | null;
  fromAddress: string | null;
  subject: string | null;
  body: string | null;
  onSent: () => void;
};

export const MessageCampaignComposerForm = ({
  campaignId,
  listId,
  unsubscribeTopicId,
  fromAddress,
  subject,
  body,
  onSent,
}: MessageCampaignComposerFormProps) => {
  const navigate = useNavigate();
  const { openModal } = useModal();
  const { channels } = useMyMessageChannels();

  const campaignState = useCampaignComposerState({
    onSent,
    initialValues: {
      campaignId,
      listId,
      unsubscribeTopicId,
      fromAddress,
      subject,
      body,
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

  return (
    <>
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
    </>
  );
};
