// Pins the wire contract between session-manager's denyAccess() and the
// signed-out detection in system.service.ts. The server answer is copied
// literally from session-manager src/ApiServer.class.js (denyAccess); if the
// two drift, the signed-out UI silently stops firing - which is exactly the
// bug this spec exists to prevent (webclient read only data.data.reason,
// server sent only top level).
import { isSessionDenialFrame } from './system.service';

// Faithful copy of the server frame (see session-manager denyAccess):
function serverDenial(reason: string, reasonInsideData = true, reasonAtTop = true): any {
  return {
    requestId: "r1",
    type: "cmd-result",
    cmd: "saveProject",
    result: false,
    ...(reasonAtTop ? { reason } : {}),
    ...(reasonInsideData ? { data: { reason } } : {}),
    statusCode: reason === "authentication" ? 401 : 403,
    message: "Your session is no longer valid, please sign in again",
  };
}

describe("session denial wire shape", () => {
  it("fires on the exact frame the server currently sends", () => {
    expect(isSessionDenialFrame(serverDenial("authentication"))).toBeTrue();
  });

  it("still fires if only the legacy position (data.reason) is present", () => {
    expect(isSessionDenialFrame(serverDenial("authentication", true, false))).toBeTrue();
  });

  it("still fires if only the top level reason is present", () => {
    expect(isSessionDenialFrame(serverDenial("authentication", false, true))).toBeTrue();
  });

  it("does not fire on authorization denials", () => {
    expect(isSessionDenialFrame(serverDenial("authorization"))).toBeFalse();
  });

  it("does not fire on unrelated frames", () => {
    expect(isSessionDenialFrame({ type: "cmd-result", result: true })).toBeFalse();
    expect(isSessionDenialFrame(null)).toBeFalse();
    expect(isSessionDenialFrame(undefined)).toBeFalse();
  });
});
