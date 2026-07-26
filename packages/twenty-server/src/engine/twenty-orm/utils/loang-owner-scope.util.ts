import { type ObjectLiteral } from 'typeorm';
import { isDefined } from 'twenty-shared/utils';

import { type FeatureFlagMap } from 'src/engine/core-modules/feature-flag/interfaces/feature-flag-map.interface';
import { type WorkspaceInternalContext } from 'src/engine/twenty-orm/interfaces/workspace-internal-context.interface';

import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type WorkspaceSelectQueryBuilder } from 'src/engine/twenty-orm/repository/workspace-select-query-builder';
import { applyRowLevelPermissionPredicates as applyEnterpriseRowLevelPermissionPredicates } from 'src/engine/twenty-orm/utils/apply-row-level-permission-predicates.util';
import { resolveRoleIdFromAuthContext } from 'src/engine/twenty-orm/utils/resolve-role-id-from-auth-context.util';

type ApplyRowLevelPermissionPredicatesArgs<T extends ObjectLiteral> = {
  queryBuilder: WorkspaceSelectQueryBuilder<T>;
  objectMetadata: FlatObjectMetadata;
  internalContext: WorkspaceInternalContext;
  authContext: WorkspaceAuthContext;
  featureFlagMap: FeatureFlagMap;
};

const PERSON = 'person';
const COMPANY = 'company';
const TASK = 'task';
const TASK_TARGET = 'taskTarget';
const TIMELINE_ACTIVITY = 'timelineActivity';

// La lista blanca. Un objeto que no este aqui sale de la consulta sin filtrar,
// asi que dar lectura sobre el equivale a dar lectura del workspace entero.
// Ojo con los objetos de sistema (taskTarget, timelineActivity): el cache de
// permisos calcula `isSystem ? true`, o sea que se leen aunque el rol tenga
// todo cerrado y no exista fila en objectPermission. Para esos, este filtro es
// lo unico que hay.
const SCOPED_OBJECTS = new Set([
  PERSON,
  COMPANY,
  TASK,
  TASK_TARGET,
  TIMELINE_ACTIVITY,
]);

// Columna de asignacion manual desde la interfaz, por si un responsable quiere
// mover un registro sin pasar por una tarea. La asignacion automatica de Loang
// no usa esto: llega como Task + TaskTarget (migracion 011).
// taskTarget no aparece a proposito: no tiene duenyo propio, lo hereda de su
// tarea.
const OWNER_COLUMN_BY_OBJECT: Record<string, string> = {
  [PERSON]: 'comercialId',
  [COMPANY]: 'accountOwnerId',
  [TASK]: 'assigneeId',
};

let cachedRawRoleIds: string | undefined;
let cachedRoleIds = new Set<string>();

// Los ids de rol son datos del despliegue, no del codigo: van por entorno para
// poder activar y desactivar el filtro sin reconstruir la imagen. Vacio = inerte.
const getScopedRoleIds = (): Set<string> => {
  const raw = process.env.LOANG_OWNER_SCOPED_ROLE_IDS ?? '';

  if (raw !== cachedRawRoleIds) {
    cachedRawRoleIds = raw;
    cachedRoleIds = new Set(
      raw
        .split(',')
        .map((roleId) => roleId.trim())
        .filter((roleId) => roleId.length > 0),
    );
  }

  return cachedRoleIds;
};

const assignedTargetIds = (schema: string, targetColumn: string): string =>
  `SELECT tt."${targetColumn}" FROM "${schema}"."${TASK_TARGET}" tt ` +
  `JOIN "${schema}"."${TASK}" t ON t."id" = tt."taskId" AND t."deletedAt" IS NULL ` +
  `WHERE tt."deletedAt" IS NULL AND tt."${targetColumn}" IS NOT NULL ` +
  `AND t."assigneeId" = :loangOwnerId`;

const ownedTaskIds = (schema: string): string =>
  `SELECT t."id" FROM "${schema}"."${TASK}" t WHERE t."deletedAt" IS NULL ` +
  `AND (t."assigneeId" = :loangOwnerId ` +
  `OR t."createdByWorkspaceMemberId" = :loangOwnerId)`;

export const buildLoangOwnerCondition = ({
  objectNameSingular,
  schema,
  useDirectTableReference,
  alias,
}: {
  objectNameSingular: string;
  schema: string;
  useDirectTableReference: boolean;
  // Solo lo usa ownedRecordIds, para reconstruir la misma condicion dentro de
  // una subconsulta con su propio alias.
  alias?: string;
}): string => {
  const ref = (column: string): string => {
    if (isDefined(alias)) {
      return `"${alias}"."${column}"`;
    }

    return useDirectTableReference
      ? `"${column}"`
      : `"${objectNameSingular}"."${column}"`;
  };

  const ownerColumn = OWNER_COLUMN_BY_OBJECT[objectNameSingular];
  const branches = isDefined(ownerColumn)
    ? [`${ref(ownerColumn)} = :loangOwnerId`]
    : [];

  branches.push(`${ref('createdByWorkspaceMemberId')} = :loangOwnerId`);

  // Un else aqui daria las ramas de empresa a cualquier objeto nuevo de la
  // lista blanca, que es SQL contra columnas que no existen.
  if (objectNameSingular === PERSON) {
    branches.push(
      `${ref('id')} IN (${assignedTargetIds(schema, 'targetPersonId')})`,
    );
  }

  if (objectNameSingular === COMPANY) {
    branches.push(
      `${ref('id')} IN (${assignedTargetIds(schema, 'targetCompanyId')})`,
    );
    // La empresa de un contacto suyo tambien es suya, si no la ficha del
    // contacto se queda sin empresa y el CRM deja de servir para nada.
    branches.push(
      `${ref('id')} IN (SELECT p."companyId" FROM "${schema}"."${PERSON}" p ` +
        `WHERE p."deletedAt" IS NULL AND p."companyId" IS NOT NULL AND (` +
        `p."${OWNER_COLUMN_BY_OBJECT[PERSON]}" = :loangOwnerId ` +
        `OR p."createdByWorkspaceMemberId" = :loangOwnerId ` +
        `OR p."id" IN (${assignedTargetIds(schema, 'targetPersonId')})))`,
    );
  }

  // El enlace sigue a su tarea. Sin esta rama la tarea se ve pero sale sin
  // contacto, y con la rama de arriba sola veria los enlaces de todo el mundo.
  if (objectNameSingular === TASK_TARGET) {
    branches.push(`${ref('taskId')} IN (${ownedTaskIds(schema)})`);
  }

  // El timeline tampoco tiene duenyo: lo hereda del registro al que apunta, y
  // se reusa la condicion de ese registro para que no pueda enseniar mas que la
  // propia ficha. Lo que apunta a otra cosa (nota, oportunidad, workflow) o a
  // nada se queda fuera, que es el lado seguro.
  if (objectNameSingular === TIMELINE_ACTIVITY) {
    branches.push(
      `${ref('targetPersonId')} IN (${ownedRecordIds(schema, PERSON, 'lp')})`,
      `${ref('targetCompanyId')} IN (${ownedRecordIds(schema, COMPANY, 'lc')})`,
      `${ref('targetTaskId')} IN (${ownedTaskIds(schema)})`,
    );
  }

  return `(${branches.join(' OR ')})`;
};

const ownedRecordIds = (
  schema: string,
  objectNameSingular: string,
  alias: string,
): string =>
  `SELECT "${alias}"."id" FROM "${schema}"."${objectNameSingular}" "${alias}" ` +
  `WHERE "${alias}"."deletedAt" IS NULL AND ` +
  buildLoangOwnerCondition({
    objectNameSingular,
    schema,
    useDirectTableReference: false,
    alias,
  });

export const applyLoangOwnerScope = <T extends ObjectLiteral>({
  queryBuilder,
  objectMetadata,
  internalContext,
  authContext,
}: ApplyRowLevelPermissionPredicatesArgs<T>): void => {
  const objectNameSingular = objectMetadata.nameSingular;

  if (!SCOPED_OBJECTS.has(objectNameSingular)) {
    return;
  }

  const roleId = resolveRoleIdFromAuthContext({
    authContext,
    userWorkspaceRoleMap: internalContext.userWorkspaceRoleMap,
    apiKeyRoleMap: internalContext.apiKeyRoleMap,
  });

  if (!isDefined(roleId) || !getScopedRoleIds().has(roleId)) {
    return;
  }

  const workspaceMemberId = isUserAuthContext(authContext)
    ? authContext.workspaceMemberId
    : undefined;

  // Las subconsultas nombran tablas hermanas, asi que necesitan el esquema del
  // workspace; no se puede deducir del id, hay que leerlo de la entidad.
  const schema = queryBuilder.expressionMap.mainAlias?.metadata?.schema;

  // Un rol acotado que no se resuelve a un duenyo, o del que no sabemos el
  // esquema, se cierra en vez de abrirse: lo contrario enseniaria la tabla
  // entera, que es justo lo que este filtro existe para impedir.
  if (!isDefined(workspaceMemberId) || !isDefined(schema)) {
    queryBuilder.andWhere('1 = 0');

    return;
  }

  // En update / delete no hay alias de tabla, la columna va desnuda. Mismo
  // criterio que computeWhereConditionParts con useDirectTableReference.
  const useDirectTableReference =
    queryBuilder.expressionMap.queryType === 'update' ||
    queryBuilder.expressionMap.queryType === 'soft-delete' ||
    queryBuilder.expressionMap.queryType === 'delete';

  // andWhere sobre una lista vacia de wheres produce el primer WHERE, no hace
  // falta el caso especial que usa la version Enterprise.
  queryBuilder.andWhere(
    buildLoangOwnerCondition({
      objectNameSingular,
      schema,
      useDirectTableReference,
    }),
    { loangOwnerId: workspaceMemberId },
  );
};

export const applyRowLevelPermissionPredicates = <T extends ObjectLiteral>(
  args: ApplyRowLevelPermissionPredicatesArgs<T>,
): void => {
  applyEnterpriseRowLevelPermissionPredicates(args);
  applyLoangOwnerScope(args);
};
