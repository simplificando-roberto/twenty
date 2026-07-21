import { Field, InputType } from '@nestjs/graphql';

import { IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateEmailingDomainSenderIdentityInput {
  @Field(() => String)
  @IsUUID()
  emailingDomainId: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MinLength(10)
  @MaxLength(255)
  senderPostalAddress?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(255)
  senderDisplayName?: string;
}
