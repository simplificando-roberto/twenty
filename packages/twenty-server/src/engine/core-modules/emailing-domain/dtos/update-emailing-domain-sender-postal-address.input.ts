import { Field, InputType } from '@nestjs/graphql';

import { IsUUID, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateEmailingDomainSenderPostalAddressInput {
  @Field(() => String)
  @IsUUID()
  emailingDomainId: string;

  @Field(() => String)
  @MinLength(10)
  @MaxLength(255)
  senderPostalAddress: string;
}
