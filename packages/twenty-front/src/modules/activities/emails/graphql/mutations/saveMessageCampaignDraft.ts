import gql from 'graphql-tag';

export const SAVE_MESSAGE_CAMPAIGN_DRAFT = gql`
  mutation SaveMessageCampaignDraft($input: SaveMessageCampaignDraftInput!) {
    saveMessageCampaignDraft(input: $input) {
      id
    }
  }
`;
