import { ArgsType, Field, Int } from '@nestjs/graphql';

import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ArgsType()
export class UpdateWorkspaceMessageCampaignDailySendLimitInput {
  @Field(() => UUIDScalarType)
  @IsNotEmpty()
  @IsUUID()
  workspaceId: string;

  // Null clears the override and puts the workspace back on its tier default.
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  dailySendLimit?: number | null;
}
