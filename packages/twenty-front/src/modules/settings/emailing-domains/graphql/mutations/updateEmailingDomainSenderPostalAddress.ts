import { gql } from '@apollo/client';

export const UPDATE_EMAILING_DOMAIN_SENDER_POSTAL_ADDRESS = gql`
  mutation UpdateEmailingDomainSenderPostalAddress(
    $input: UpdateEmailingDomainSenderPostalAddressInput!
  ) {
    updateEmailingDomainSenderPostalAddress(input: $input) {
      id
      senderPostalAddress
    }
  }
`;
