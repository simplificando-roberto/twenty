import { Field, InputType } from '@nestjs/graphql';

import { IsEmail, IsString, MaxLength } from 'class-validator';

@InputType()
export class SendTestMessageCampaignInput {
  @Field(() => String)
  @IsEmail()
  fromAddress: string;

  @Field(() => String)
  @IsString()
  @MaxLength(998)
  subject: string;

  @Field(() => String)
  @IsString()
  body: string;
}
