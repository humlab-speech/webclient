// A locked (disabled) control is dropped by FormGroup.value. If that reaches the
// backend it reads as "no script" and the stored one is cleared, so the payload builder
// has to put it back. Plain objects, no form: the bug is in this function alone.
import { withLockedSessionScripts } from './sessionPayload';

const rawSession = (over: any = {}) => ({
  id: "s1",
  name: "Session 1",
  sessionScript: "script-a",
  files: [],
  ...over,
});

describe("sessions payload value", () => {
  it("restores the script a locked control dropped", () => {
    const value = rawSession();
    delete (value as any).sessionScript; // what a disabled control produces
    const out = withLockedSessionScripts([value], [rawSession()]);
    expect(out[0].sessionScript).toBe("script-a");
  });

  it("leaves a present value alone, including an explicit null (no script)", () => {
    const out = withLockedSessionScripts([rawSession()], [rawSession()]);
    expect(out[0]).toEqual(rawSession());
    const cleared = withLockedSessionScripts(
      [rawSession({ sessionScript: null })],
      [rawSession({ sessionScript: "script-a" })],
    );
    expect(cleared[0].sessionScript).toBeNull();
  });

  it("does not resurrect the keys the backend expects absent", () => {
    const value = { id: "s1", sessionScript: undefined, recordingLink: undefined };
    delete (value as any).sessionScript;
    delete (value as any).recordingLink;
    const raw = { id: "s1", name: "Session 1", recordingLink: "link-1", sessionScript: "a" };
    const out = withLockedSessionScripts([value], [raw])[0];
    expect(out.name).toBeUndefined();
    expect(out.recordingLink).toBeUndefined();
    expect(out.sessionScript).toBe("a");
  });

  it("survives a missing raw entry rather than guessing", () => {
    const value = { id: "s1" };
    expect(withLockedSessionScripts([value], [])[0]).toEqual({ id: "s1" });
  });
});

// Pins the premise the lock depends on, not just the helper: Angular leaves a disabled
// control out of the aggregate value while the control itself keeps its value. If that
// ever changes, disabling stops being dangerous and this helper becomes dead code -
// either way this is where you would find out.
import { FormArray, FormControl, FormGroup } from '@angular/forms';

describe("a locked session control in the save payload", () => {
  const lockedSession = () => new FormGroup({
    name: new FormControl({ value: "Session 1", disabled: true }),
    sessionScript: new FormControl({ value: "script-a", disabled: true }),
  });

  it("is dropped from the array value but keeps its own", () => {
    const arr = new FormArray([lockedSession()]);
    const value = arr.value as any[];
    expect(value[0].sessionScript).toBeUndefined();
    expect(value[0].name).toBeUndefined(); // the absence the backend branches on
    expect(arr.at(0).get('sessionScript')!.value).toBe("script-a");
  });

  it("goes back into the payload, and only it", () => {
    const arr = new FormArray([lockedSession()]);
    const out = withLockedSessionScripts(arr.value as any[], arr.getRawValue() as any[])[0];
    expect(out.sessionScript).toBe("script-a");
    expect("name" in out).toBeFalse();
  });
});
