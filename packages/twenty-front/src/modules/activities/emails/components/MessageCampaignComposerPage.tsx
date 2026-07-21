import { styled } from '@linaria/react';

import { MessageCampaignComposerForm } from '@/activities/emails/components/MessageCampaignComposerForm';
import { MessageCampaignStats } from '@/activities/emails/components/MessageCampaignStats';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

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

export const MessageCampaignComposerPage = () => {
  const targetRecord = useTargetRecord();

  const {
    record: campaign,
    loading: campaignLoading,
    refetch: refetchCampaign,
  } = useFindOneRecord({
    objectNameSingular: 'messageCampaign',
    objectRecordId: targetRecord.id,
  });

  if (campaignLoading || !isDefined(campaign)) {
    return null;
  }

  // A campaign that has left DRAFT is already with the provider, so the page
  // reports on it instead of offering an editor that could not be applied.
  if (campaign.status !== 'DRAFT') {
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
      {/* Keyed on the record so the composer state initialises from the loaded
      draft rather than from the empty values present while it was fetching. */}
      <MessageCampaignComposerForm
        key={campaign.id}
        campaignId={campaign.id}
        listId={campaign.listId ?? null}
        unsubscribeTopicId={campaign.unsubscribeTopicId ?? null}
        fromAddress={campaign.fromAddress?.primaryEmail ?? null}
        subject={campaign.subject ?? null}
        body={campaign.bodyTemplate ?? null}
        onSent={refetchCampaign}
      />
    </StyledContainer>
  );
};
