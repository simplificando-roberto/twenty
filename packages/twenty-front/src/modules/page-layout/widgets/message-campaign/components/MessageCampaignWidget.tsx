import { MessageCampaignComposerPage } from '@/activities/emails/components/MessageCampaignComposerPage';
import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';

type MessageCampaignWidgetProps = {
  widget: PageLayoutWidget;
};

export const MessageCampaignWidget = ({
  widget: _widget,
}: MessageCampaignWidgetProps) => {
  return <MessageCampaignComposerPage />;
};
