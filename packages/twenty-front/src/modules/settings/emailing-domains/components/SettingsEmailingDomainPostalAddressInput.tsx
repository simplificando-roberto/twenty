import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { useMutation } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { UpdateEmailingDomainSenderPostalAddressDocument } from '~/generated-metadata/graphql';
import { IconCheck } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRow = styled.div`
  display: flex;
  flex-direction: row;
`;

const StyledInputContainer = styled.div`
  flex: 1;
  margin-right: ${themeCssVariables.spacing[2]};
`;

const MINIMUM_POSTAL_ADDRESS_LENGTH = 10;

type SettingsEmailingDomainPostalAddressInputProps = {
  emailingDomainId: string;
  senderPostalAddress: string | null | undefined;
};

export const SettingsEmailingDomainPostalAddressInput = ({
  emailingDomainId,
  senderPostalAddress,
}: SettingsEmailingDomainPostalAddressInputProps) => {
  const { t } = useLingui();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [value, setValue] = useState(senderPostalAddress ?? '');
  const [updateSenderPostalAddress, { loading }] = useMutation(
    UpdateEmailingDomainSenderPostalAddressDocument,
  );

  const isSavable =
    value.trim().length >= MINIMUM_POSTAL_ADDRESS_LENGTH &&
    value.trim() !== (senderPostalAddress ?? '');

  const handleSave = async () => {
    try {
      await updateSenderPostalAddress({
        variables: {
          input: { emailingDomainId, senderPostalAddress: value.trim() },
        },
      });
      enqueueSuccessSnackBar({ message: t`Postal address saved` });
    } catch (error) {
      enqueueErrorSnackBar({
        ...(CombinedGraphQLErrors.is(error) ? { apolloError: error } : {}),
      });
    }
  };

  return (
    <StyledRow>
      <StyledInputContainer>
        <SettingsTextInput
          instanceId="emailing-domain-postal-address"
          value={value}
          onChange={setValue}
          placeholder={t`123 Market Street, San Francisco, CA 94103, USA`}
          fullWidth
        />
      </StyledInputContainer>
      <Button
        Icon={IconCheck}
        title={t`Save`}
        onClick={handleSave}
        isLoading={loading}
        disabled={!isSavable || loading}
      />
    </StyledRow>
  );
};
