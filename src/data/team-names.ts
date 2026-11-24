/**
 * How each team is named on screen, keyed by team code. Change a team's display name here, nowhere
 * else. The official name stays in the database (teams.name) and is what screen readers and image
 * alt text use; the code stays the internal ID (URLs like /matches?team=GCB, logo file names).
 *
 * `short`: the bold name shown where the code used to be (and alone in tight spots: bracket ties,
 * the LED pill, small chips). `sub`: an optional second line, smaller and muted, where there's room.
 * Veteran tournament names from the fixtures file; "Jaigaon Veterans" and "Samtse Veteran FC" confirmed
 * (23 Nov 2026) over the "Jaigaon Veteran" / "Samtse Veteran" spellings in the file's notes.
 */
export const TEAM_NAMES: Record<string, { short: string; sub?: string }> = {
  // Group A
  GCB: { short: "BSB Veteran FC" }, // listed as "GCBS FC" in the fixtures file; renamed 24 Nov 2026
  SBV: { short: "Star Bro", sub: "Star Bro Veteran FC" },
  CSV: { short: "CST Veteran" },
  PSB: { short: "PSB Traders" },
  PLV: { short: "Phuenthrom Legends", sub: "Phuenthrom Legends Veteran" },
  // Group B
  DRV: { short: "Doors Rhino", sub: "Doors Rhino Veterans FC" },
  JGV: { short: "Jaigaon Veterans" },
  GMV: { short: "Gomtu Veterans", sub: "Gomtu Veterans FC" },
  SMV: { short: "Samtse Veteran FC" },
  RPU: { short: "Rinpung United" },
};

/** Display names set in the admin (database) win over this file; the file is the fallback. */
type Named = { short_code: string; name: string; display?: { short: string; full: string | null } };

/** The team's short display name ("BBPL Brewery"); the official name if it isn't in the list; `fallback` with no team. */
export function teamShort(team: Named | null | undefined, fallback = ""): string {
  if (!team) return fallback;
  return team.display?.short ?? TEAM_NAMES[team.short_code]?.short ?? team.name;
}

/** The optional second line ("Bhutan Brewary Private Limited"), or null. */
export function teamSub(team: Named): string | null {
  if (team.display) return team.display.full;
  return TEAM_NAMES[team.short_code]?.sub ?? null;
}

/** Everything a search should match: short name, second line, official name and code. */
export function teamSearchText(team: Named): string {
  return [teamShort(team), teamSub(team), team.name, team.short_code].filter(Boolean).join(" ").toLowerCase();
}

/**
 * A font size that fits each name's longest word into its column: `max` px, or less, measured in
 * container units (the element's parent needs `[container-type:inline-size]`). Names wrap between
 * words and are never split inside one. Pass both teams' names so the two sides share one size.
 */
export function fitNameSize(names: string[], max: number, emPerChar = 0.47): string {
  const longest = Math.max(3, ...names.flatMap((n) => n.split(/\s+/).map((w) => w.length)));
  return `min(${max}px, calc(100cqi / ${(longest * emPerChar).toFixed(2)}))`;
}
