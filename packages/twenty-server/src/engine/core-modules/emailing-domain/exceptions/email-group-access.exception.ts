/* @license Enterprise */

import { type MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

import {
  appendCommonExceptionCode,
  CustomException,
} from 'src/utils/custom-exception';

export const EmailGroupAccessExceptionCode = appendCommonExceptionCode({
  EMAIL_GROUP_ENTERPRISE_PLAN_REQUIRED: 'EMAIL_GROUP_ENTERPRISE_PLAN_REQUIRED',
  CAMPAIGN_TEST_SEND_NOT_POSSIBLE: 'CAMPAIGN_TEST_SEND_NOT_POSSIBLE',
  MESSAGE_CAMPAIGN_NOT_EDITABLE: 'MESSAGE_CAMPAIGN_NOT_EDITABLE',
} as const);

const emailGroupAccessExceptionUserFriendlyMessages: Record<
  keyof typeof EmailGroupAccessExceptionCode,
  MessageDescriptor
> = {
  EMAIL_GROUP_ENTERPRISE_PLAN_REQUIRED: msg`Email group requires an Enterprise plan.`,
  CAMPAIGN_TEST_SEND_NOT_POSSIBLE: msg`Select a verified sending address before you send a test.`,
  MESSAGE_CAMPAIGN_NOT_EDITABLE: msg`This campaign has already been sent and can no longer be edited.`,
  INTERNAL_SERVER_ERROR: msg`An unexpected error occurred.`,
};

export class EmailGroupAccessException extends CustomException<
  keyof typeof EmailGroupAccessExceptionCode
> {
  constructor(
    message: string,
    code: keyof typeof EmailGroupAccessExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: MessageDescriptor } = {},
  ) {
    super(message, code, {
      userFriendlyMessage:
        userFriendlyMessage ??
        emailGroupAccessExceptionUserFriendlyMessages[code],
    });
  }
}
