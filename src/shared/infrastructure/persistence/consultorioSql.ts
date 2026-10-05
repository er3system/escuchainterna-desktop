/**
 * Fragmento SQL del AISLAMIENTO DE CONSULTORIO (docs/consultorios-spec.md §3, Fase 4)
 * entre dos miembros de una organización. Es la versión SQL del predicado puro
 * `sameConsultorio` (value-objects/accessPolicy.ts): dos miembros de la misma org pero
 * de DISTINTO consultorio se tratan como de orgs distintas.
 *
 * Pasa (devuelve verdadero) si AMBOS comparten consultorio, o si CUALQUIERA no tiene
 * consultorio (NULL = org_master / org sin consultorios / retrocompatible). Se evalúa
 * sobre las membresías de ambos usuarios EN la organización indicada.
 *
 * Usa subconsultas correlacionadas (no JOIN) a propósito: `organization_memberships`
 * tiene UNIQUE(organization_id, user_id), así que cada subconsulta devuelve a lo sumo una
 * fila, y así NO se multiplican filas en queries con COUNT/agregados. Solo recibe nombres
 * de columna fijos (no entrada de usuario) → sin riesgo de inyección.
 *
 * @param orgCol       expresión SQL con el id de organización (p. ej. `'l.organization_id'`)
 * @param userColA     expresión con el id de un miembro (p. ej. `'l.supervisor_user_id'`)
 * @param userColB     expresión con el id del otro miembro (p. ej. `'l.supervised_user_id'`)
 */
export function sameConsultorioSql(orgCol: string, userColA: string, userColB: string): string {
  const consultorioOf = (userCol: string) =>
    `(SELECT m.consultorio_id FROM organization_memberships m` +
    ` WHERE m.organization_id = ${orgCol} AND m.user_id = ${userCol})`;
  const a = consultorioOf(userColA);
  const b = consultorioOf(userColB);
  // MODO SEDES (MS1): en modo 'compartido' los consultorios no aíslan → la condición
  // pasa siempre (el aislamiento por consultorio queda apagado para esa organización).
  const shared = `(SELECT o.consultorio_mode FROM organizations o WHERE o.id = ${orgCol}) = 'compartido'`;
  return `(${shared} OR ${a} IS NULL OR ${b} IS NULL OR ${a} = ${b})`;
}
