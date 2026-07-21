import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';

import { useSendTestMessageCampaign } from '@/activities/emails/hooks/useSendTestMessageCampaign';
import { ModalStatefulWrapper } from '@/ui/layout/modal/components/ModalStatefulWrapper';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { emailSchema } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { H1Title, H1TitleFontColor } from 'twenty-ui/typography';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const SEND_TEST_CAMPAIGN_MODAL_ID = 'send-test-campaign-modal';

const StyledLabel = styled.label`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledTextArea = styled.textarea`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  min-height: 140px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]};
  resize: vertical;
  width: 100%;

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledFooter = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[4]};
`;

const parseEmailAddresses = (rawValue: string): string[] =>
  rawValue
    .split(/[\s,;]+/)
    .map((address) => address.trim())
    .filter((address) => address.length > 0);

type SendTestCampaignModalProps = {
  fromAddress: string;
  subject: string;
  body: string;
};

export const SendTestCampaignModal = ({
  fromAddress,
  subject,
  body,
}: SendTestCampaignModalProps) => {
  const { closeModal } = useModal();
  const [rawAddresses, setRawAddresses] = useState('');
  const { sendTestMessageCampaign, loading } = useSendTestMessageCampaign();

  const addresses = parseEmailAddresses(rawAddresses);

  const canSendTest =
    addresses.length > 0 &&
    addresses.every((address) => emailSchema.safeParse(address).success) &&
    !loading;

  const handleSendTest = async () => {
    if (!canSendTest) {
      return;
    }

    await sendTestMessageCampaign({
      fromAddress,
      toAddresses: addresses,
      subject,
      body,
    });

    setRawAddresses('');
    closeModal(SEND_TEST_CAMPAIGN_MODAL_ID);
  };

  return (
    <ModalStatefulWrapper
      modalInstanceId={SEND_TEST_CAMPAIGN_MODAL_ID}
      onEnter={handleSendTest}
      isClosable={true}
      padding="large"
    >
      <H1Title
        title={t`Send test email`}
        fontColor={H1TitleFontColor.Primary}
      />
      <StyledContent>
        <StyledLabel htmlFor="send-test-campaign-addresses">
          {t`Email addresses`}
        </StyledLabel>
        <StyledTextArea
          id="send-test-campaign-addresses"
          value={rawAddresses}
          onChange={(event) => setRawAddresses(event.target.value)}
          placeholder="foo@gmail.com, bar@gmail.com"
          autoFocus
        />
        <StyledHint>
          {t`Use commas or line breaks to separate multiple email addresses.`}
        </StyledHint>
      </StyledContent>
      <StyledFooter>
        <Button
          title={t`Send test`}
          variant="primary"
          accent="blue"
          hotkeys={['⌘', '⏎']}
          onClick={handleSendTest}
          isLoading={loading}
          disabled={!canSendTest}
        />
        <Button
          title={t`Cancel`}
          variant="secondary"
          hotkeys={['Esc']}
          onClick={() => closeModal(SEND_TEST_CAMPAIGN_MODAL_ID)}
        />
      </StyledFooter>
    </ModalStatefulWrapper>
  );
};
