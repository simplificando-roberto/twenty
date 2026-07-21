import { gql } from '@apollo/client';

export const SEND_TEST_MESSAGE_CAMPAIGN = gql`
  mutation SendTestMessageCampaign($input: SendTestMessageCampaignInput!) {
    sendTestMessageCampaign(input: $input)
  }
`;
