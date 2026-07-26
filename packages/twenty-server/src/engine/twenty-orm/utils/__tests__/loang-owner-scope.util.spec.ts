import { applyLoangOwnerScope } from 'src/engine/twenty-orm/utils/loang-owner-scope.util';

const SCOPED_ROLE_ID = '56d6aad2-10cb-40ce-aff0-f8d9c12f5492';
const ADMIN_ROLE_ID = '11111111-1111-1111-1111-111111111111';
const WORKSPACE_MEMBER_ID = 'de322b8c-9dfd-4b23-8a00-557e22e7e341';
const SCHEMA = 'workspace_3kptftr3l8ymma5ghurg3ez71';

const buildArgs = ({
  nameSingular = 'person',
  roleId = SCOPED_ROLE_ID,
  authContextType = 'user',
  queryType = 'select',
  // Un valor por defecto se aplica tambien cuando pasas undefined a proposito,
  // asi que el caso sin esquema necesita su propia bandera.
  withoutSchema = false,
}: {
  nameSingular?: string;
  roleId?: string;
  authContextType?: 'user' | 'apiKey';
  queryType?: string;
  withoutSchema?: boolean;
} = {}) => {
  const andWhere = jest.fn();

  const authContext =
    authContextType === 'user'
      ? {
          type: 'user',
          userWorkspaceId: 'user-workspace-id',
          workspaceMemberId: WORKSPACE_MEMBER_ID,
        }
      : { type: 'apiKey', apiKey: { id: 'api-key-id' } };

  return {
    andWhere,
    args: {
      queryBuilder: {
        andWhere,
        expressionMap: {
          queryType,
          mainAlias: {
            metadata: { schema: withoutSchema ? undefined : SCHEMA },
          },
        },
      },
      objectMetadata: { nameSingular },
      internalContext: {
        userWorkspaceRoleMap: { 'user-workspace-id': roleId },
        apiKeyRoleMap: { 'api-key-id': roleId },
      },
      authContext,
      featureFlagMap: {},
      // oxlint-disable-next-line typescript/no-explicit-any
    } as any,
  };
};

const sqlOf = (andWhere: jest.Mock): string => andWhere.mock.calls[0][0];

describe('applyLoangOwnerScope', () => {
  beforeEach(() => {
    process.env.LOANG_OWNER_SCOPED_ROLE_IDS = SCOPED_ROLE_ID;
  });

  it('deja ver los contactos asignados por tarea, los subidos y los suyos', () => {
    const { andWhere, args } = buildArgs();

    applyLoangOwnerScope(args);

    const sql = sqlOf(andWhere);

    expect(sql).toContain('"person"."comercialId" = :loangOwnerId');
    expect(sql).toContain(
      '"person"."createdByWorkspaceMemberId" = :loangOwnerId',
    );
    expect(sql).toContain(`FROM "${SCHEMA}"."taskTarget" tt`);
    expect(sql).toContain('t."assigneeId" = :loangOwnerId');
    expect(andWhere.mock.calls[0][1]).toEqual({
      loangOwnerId: WORKSPACE_MEMBER_ID,
    });
  });

  it('arrastra la empresa de los contactos del comercial', () => {
    const { andWhere, args } = buildArgs({ nameSingular: 'company' });

    applyLoangOwnerScope(args);

    const sql = sqlOf(andWhere);

    expect(sql).toContain('"company"."accountOwnerId" = :loangOwnerId');
    expect(sql).toContain(`SELECT p."companyId" FROM "${SCHEMA}"."person" p`);
  });

  it('usa la columna desnuda en update, donde no hay alias', () => {
    const { andWhere, args } = buildArgs({ queryType: 'update' });

    applyLoangOwnerScope(args);

    expect(sqlOf(andWhere)).toContain('"comercialId" = :loangOwnerId');
    expect(sqlOf(andWhere)).not.toContain('"person"."comercialId"');
  });

  it('no toca las consultas de un rol fuera del alcance', () => {
    const { andWhere, args } = buildArgs({ roleId: ADMIN_ROLE_ID });

    applyLoangOwnerScope(args);

    expect(andWhere).not.toHaveBeenCalled();
  });

  it('no toca los objetos sin duenyo declarado', () => {
    const { andWhere, args } = buildArgs({ nameSingular: 'task' });

    applyLoangOwnerScope(args);

    expect(andWhere).not.toHaveBeenCalled();
  });

  it('cierra cuando el rol acotado no tiene workspace member', () => {
    const { andWhere, args } = buildArgs({ authContextType: 'apiKey' });

    applyLoangOwnerScope(args);

    expect(andWhere).toHaveBeenCalledWith('1 = 0');
  });

  it('cierra cuando no se puede saber el esquema del workspace', () => {
    const { andWhere, args } = buildArgs({ withoutSchema: true });

    applyLoangOwnerScope(args);

    expect(andWhere).toHaveBeenCalledWith('1 = 0');
  });

  it('queda inerte sin la variable de entorno', () => {
    process.env.LOANG_OWNER_SCOPED_ROLE_IDS = '';

    const { andWhere, args } = buildArgs();

    applyLoangOwnerScope(args);

    expect(andWhere).not.toHaveBeenCalled();
  });
});
