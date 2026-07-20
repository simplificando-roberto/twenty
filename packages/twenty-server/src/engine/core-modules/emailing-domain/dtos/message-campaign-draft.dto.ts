import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('MessageCampaignDraft')
export class MessageCampaignDraftDTO {
  @Field(() => String)
  id: string;
}
