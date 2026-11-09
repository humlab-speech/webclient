/**
 * Which of a project's annotation levels TRATT can transcribe into.
 *
 * TRATT replaces the items of one level when it saves and leaves every other
 * level alone, so the level must be a SEGMENT level (TRATT's segments have
 * times) and must not take part in a link: replacing a linked level's items
 * would orphan the links that point at them. TRATT checks the same rules
 * against the project's DBconfig when it opens, so these only decide what the
 * launch dialog offers.
 */

export interface ProjectAnnotLevel {
  name: string;
  type: string;
}

export interface ProjectAnnotLink {
  superLevel: string;
  subLevel: string;
  type?: string;
}

export interface TrattLevelOption {
  name: string;
  type: string;
  usable: boolean;
  /** Why TRATT cannot use the level; unset when usable. */
  reason?: string;
}

/** The level new projects get for TRATT; preferred when nothing else is remembered. */
export const DEFAULT_TRATT_LEVEL = "Transcription";

export function trattLevelOptions(
  levels: ProjectAnnotLevel[] | undefined,
  links: ProjectAnnotLink[] | undefined,
): TrattLevelOption[] {
  return (levels ?? []).map(level => {
    const type = (level.type ?? "").toUpperCase();
    if (type !== "SEGMENT") {
      return { name: level.name, type, usable: false, reason: `${type || "Unknown"} level; TRATT needs a SEGMENT level` };
    }
    const linkedTo = (links ?? [])
      .filter(link => link.superLevel === level.name || link.subLevel === level.name)
      .map(link => (link.superLevel === level.name ? link.subLevel : link.superLevel));
    if (linkedTo.length > 0) {
      return { name: level.name, type, usable: false, reason: `Linked to ${linkedTo.join(", ")}` };
    }
    return { name: level.name, type, usable: true };
  });
}

/** The level to preselect: the remembered one, else Transcription, else the first usable one. */
export function preferredTrattLevel(options: TrattLevelOption[], remembered?: string | null): string | null {
  const usable = options.filter(option => option.usable).map(option => option.name);
  for (const candidate of [remembered, DEFAULT_TRATT_LEVEL]) {
    if (candidate && usable.includes(candidate)) {
      return candidate;
    }
  }
  return usable[0] ?? null;
}
