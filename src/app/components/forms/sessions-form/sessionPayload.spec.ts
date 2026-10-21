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
// control out of the aggregate value while the control itself keeps its value - but only
// while the control's group stays enabled. _reduceValue keeps a child
// `if (control.enabled || this.disabled)`, so a group whose every child is disabled
// computes to DISABLED itself and the hatch re-includes all of them (an all-disabled
// group then does the same to the FormArray above it). A real session group always
// holds enabled controls (files, the source toggles), which is why lockedSession()
// carries an enabled `files`: the shape is part of the premise being pinned. If the
// drop ever stops happening, disabling stops being dangerous and this helper becomes
// dead code - either way this is where you would find out.
import { FormArray, FormControl, FormGroup } from '@angular/forms';

describe("a locked session control in an enabled session group", () => {
  const lockedSession = () => new FormGroup({
    name: new FormControl({ value: "Session 1", disabled: true }),
    sessionScript: new FormControl({ value: "script-a", disabled: true }),
    files: new FormControl([]), // the enabled sibling that keeps the group (and array) enabled
  });

  it("is dropped from the array value but keeps its own", () => {
    const arr = new FormArray([lockedSession()]);
    const value = arr.value as any[];
    expect(value.length).toBe(1);
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

  it("drops the whole entry once every control is disabled, misaligning value against raw value", () => {
    // Not producible by the shipped form: a session group always has enabled controls.
    // Pinned so the shape requirement above stays visible: an all-disabled group is
    // filtered out of the array value entirely while getRawValue keeps it, so the two
    // arrays the helper walks by index no longer line up.
    const arr = new FormArray([
      new FormGroup({ name: new FormControl({ value: "Session 1", disabled: true }) }),
      lockedSession(),
    ]);
    expect((arr.value as any[]).length).toBe(1);
    expect((arr.getRawValue() as any[]).length).toBe(2);
    expect((arr.value as any[])[0].sessionScript).toBeUndefined();
  });
});
