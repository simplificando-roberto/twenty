import { CampaignComposerFields } from '@/activities/emails/components/CampaignComposerFields';
import { useCampaignAudiencePreview } from '@/activities/emails/hooks/useCampaignAudiencePreview';
import { useCampaignComposerState } from '@/activities/emails/hooks/useCampaignComposerState';
import { SIDE_PANEL_FOCUS_ID } from '@/side-panel/constants/SidePanelFocusId';
import { useSidePanelHistory } from '@/side-panel/hooks/useSidePanelHistory';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { SidePanelFooter } from '@/ui/layout/side-panel/components/SidePanelFooter';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { isDefined } from 'twenty-shared/utils';
import { IconSend } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { getOsControlSymbol } from 'twenty-ui/utilities';

const SEND_CAMPAIGN_MODAL_ID = 'send-campaign-confirmation-modal';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
`;

export const SidePanelCampaignComposerPage = () => {
  const { goBackFromSidePanel } = useSidePanelHistory();
  const { openModal } = useModal();

  const campaignState = useCampaignComposerState({
    onSent: goBackFromSidePanel,
  });

  const audiencePreview = useCampaignAudiencePreview({
    listId: campaignState.listId,
    unsubscribeTopicId: campaignState.unsubscribeTopicId,
  });

  const openSendConfirmation = () => {
    if (campaignState.canSend) {
      openModal(SEND_CAMPAIGN_MODAL_ID);
    }
  };

  useHotkeysOnFocusedElement({
    keys: ['ctrl+Enter,meta+Enter'],
    callback: openSendConfirmation,
    focusId: SIDE_PANEL_FOCUS_ID,
    dependencies: [campaignState.canSend],
  });

  return (
    <StyledContainer>
      <StyledContent>
        <CampaignComposerFields campaignState={campaignState} />
      </StyledContent>
      <SidePanelFooter
        actions={[
          <Button
            key="cancel"
            size="small"
            variant="secondary"
            title={t`Cancel`}
            onClick={goBackFromSidePanel}
          />,
          <Button
            key="send"
            size="small"
            variant="primary"
            accent="blue"
            title={t`Send campaign`}
            Icon={IconSend}
            hotkeys={[getOsControlSymbol(), '⏎']}
            onClick={openSendConfirmation}
            disabled={!campaignState.canSend}
          />,
        ]}
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
