/**
 * React 19 reinicia de forma nativa un formulario cuando una Form Action
 * termina correctamente. En formularios de edición ese reset puede devolver
 * selects y checkboxes al valor anterior aunque el servidor ya haya guardado
 * el nuevo valor (react#30580).
 *
 * El callback debe capturar el FormData y despachar la acción dentro de
 * startTransition. Mantener esta función sin dependencias del DOM permite
 * verificar que preventDefault ocurre antes del despacho.
 */
export function submitFormWithoutNativeReset(
  event: { preventDefault(): void },
  submit: () => void,
): void {
  event.preventDefault();
  submit();
}
