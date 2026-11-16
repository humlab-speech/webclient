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
      return { name: level.name, type, usable: false, reason: `${type || "Unknown"} level; Tratt needs a SEGMENT level` };
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

/**
 * Why `name` cannot be a new level in a project with `levels`, or null when it
 * can. Mirrors session-manager's trattLevel.js (which decides): the project
 * dialog's level-name rule, and no name the project has in any letter case.
 */
export function trattLevelNameProblem(name: string, levels: ProjectAnnotLevel[] | undefined): string | null {
  if (!/^[A-Za-z0-9 _-]{1,30}$/.test(name ?? "") || name.trim() !== name) {
    return "A level name is 1-30 letters, digits, spaces, hyphens or underscores";
  }
  const clash = (levels ?? []).find(level => (level.name ?? "").toLowerCase() === name.toLowerCase());
  return clash ? `The project already has a level named "${clash.name}"` : null;
}

/** The name to offer for a new TRATT level: Transcription, or the first free Transcription_<n>. */
export function suggestedTrattLevelName(levels: ProjectAnnotLevel[] | undefined): string {
  for (let n = 1; ; n++) {
    const name = n === 1 ? DEFAULT_TRATT_LEVEL : `${DEFAULT_TRATT_LEVEL}_${n}`;
    if (trattLevelNameProblem(name, levels) === null) {
      return name;
    }
  }
}
