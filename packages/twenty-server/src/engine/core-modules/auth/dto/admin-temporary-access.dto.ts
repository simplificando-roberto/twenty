import { Field, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ObjectType('AdminTemporaryAccess')
export class AdminTemporaryAccessDTO {
  @Field(() => UUIDScalarType)
  targetUserId: string;

  @Field(() => String)
  passwordResetToken: string;

  @Field(() => Date)
  passwordResetTokenExpiresAt: Date;

  @Field(() => UUIDScalarType)
  workspaceId: string;
}
