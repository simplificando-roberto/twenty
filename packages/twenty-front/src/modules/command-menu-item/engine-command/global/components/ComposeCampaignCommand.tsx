import { useCreateAndOpenCampaign } from '@/activities/emails/hooks/useCreateAndOpenCampaign';
import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';

export const ComposeCampaignCommand = () => {
  const { createAndOpenCampaign } = useCreateAndOpenCampaign();

  return (
    <HeadlessEngineCommandWrapperEffect execute={createAndOpenCampaign} ready />
  );
};
