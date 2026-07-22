import { ArgsType, Field } from '@nestjs/graphql';

import { IsEmail, IsUUID } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ArgsType()
export class ProvisionTemporaryWorkspaceMemberInput {
  @Field(() => String)
  @IsEmail()
  email: string;

  @Field(() => UUIDScalarType)
  @IsUUID()
  roleId: string;
}
