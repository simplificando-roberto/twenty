import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { useMutation } from '@apollo/client/react';
import { t } from '@lingui/core/macro';

import { SEND_TEST_MESSAGE_CAMPAIGN } from '@/activities/emails/graphql/mutations/sendTestMessageCampaign';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import {
  type SendTestMessageCampaignMutation,
  type SendTestMessageCampaignMutationVariables,
} from '~/generated-metadata/graphql';

type SendTestMessageCampaignArgs = {
  fromAddress: string;
  toAddresses: string[];
  subject: string;
  body: string;
};

export const useSendTestMessageCampaign = () => {
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [sendTestMessageCampaignMutation, { loading }] = useMutation<
    SendTestMessageCampaignMutation,
    SendTestMessageCampaignMutationVariables
  >(SEND_TEST_MESSAGE_CAMPAIGN);

  const sendTestMessageCampaign = async (
    input: SendTestMessageCampaignArgs,
  ) => {
    try {
      await sendTestMessageCampaignMutation({ variables: { input } });
      enqueueSuccessSnackBar({ message: t`Test email sent` });
    } catch (error) {
      enqueueErrorSnackBar({
        ...(CombinedGraphQLErrors.is(error) ? { apolloError: error } : {}),
      });
    }
  };

  return { sendTestMessageCampaign, loading };
};
