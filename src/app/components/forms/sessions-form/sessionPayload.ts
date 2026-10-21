/**
 * The sessions array as the backend should receive it.
 *
 * A disabled reactive control is skipped when Angular computes the group value, so a
 * session whose recording-script select is locked (see sessionScriptIsLocked in
 * sessions-form.component.ts) would be sent without sessionScript. The backend writes
 * that field unconditionally, so the omission clears the stored script in the project
 * document and in the SPR session - the takes would then name prompts the session no
 * longer claims. The backend now refuses it too; this keeps the field in the payload in
 * the first place.
 *
 * Only sessionScript is restored, from the raw control value. name (disabled for every
 * existing session) and recordingLink (always disabled) have been absent from every
 * payload to date and the backend branches on that absence, so taking getRawValue() for
 * the whole array would change behaviour well beyond this one field.
 *
 * @param values  sessions.value - what would have been sent
 * @param raw     sessions.getRawValue() - same order, disabled controls included
 */
export function withLockedSessionScripts(values: any[], raw: any[]): any[] {
  return (values || []).map((session, i) => {
    const script = raw?.[i]?.sessionScript;
    if (!session || session.sessionScript !== undefined || script === undefined) {
      return session;
    }
    return { ...session, sessionScript: script };
  });
}
