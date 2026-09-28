// How a recording session gets its audio. Mirrors session-manager's
// src/sessionFiles.js, which is the authority; keep the two in step.

export type FileOrigin = "upload" | "recording";

// Which sources a session uses. Each can be switched on and off on its own;
// sessions from before that have only `dataSource`, "upload" or "record".
export function sessionSources(session:any):{ upload:boolean, record:boolean } {
  const legacyRecord = session?.dataSource === "record";
  return {
    upload: typeof session?.uploadEnabled === "boolean" ? session.uploadEnabled : !legacyRecord,
    record: typeof session?.recordEnabled === "boolean" ? session.recordEnabled : legacyRecord,
  };
}

// Files stored before origins existed belong to the session's only source.
export function fileOrigin(file:any, session:any):FileOrigin {
  if(file?.origin === "upload" || file?.origin === "recording") {
    return file.origin;
  }
  return session?.dataSource === "record" ? "recording" : "upload";
}
