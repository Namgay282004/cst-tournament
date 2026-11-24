// Parses the Schedule sheet of the veteran tournament's fixtures file, the only source of fixtures.
//
// Columns (one row per match; rows without a match number in A are titles and notes):
//   A  match number (1-23)
//   B  date (a real date, or an Excel serial number)
//   D  time range, e.g. "5:00 PM – 7:00 PM" (the start is the kick-off)
//   E  stage, on every row: "Group A", "Group B", "Semi-final 1", "Semi-final 2", "Final"
//   G, H  group rows: the slots ("B2", "B4"); knockout rows: "Group A Winner",
//         "Group B Runner-up", "Winner Semi-final 1"
//   I, J  group rows: the team names
//   K-N   scores and results (spreadsheet formulas): ignored
import ExcelJS from "exceljs";
import {
  EXPECTED_GROUP_MATCHES, EXPECTED_MATCHES, EXPECTED_TEAMS, GROUPS, SCHEDULE_FILE, SCHEDULE_SHEET,
  SHORT_CODES, TEAM_NAME_OVERRIDES, TEAMS_PER_GROUP, THIMPHU_OFFSET,
} from "./config";
import type { Database } from "../../src/lib/supabase/database.types";

type Stage = Database["public"]["Enums"]["match_stage"];
type SlotSource = Database["public"]["Enums"]["slot_source"];

export type ParsedTeam = { slot: string; group_code: string; short_code: string; name: string };

export type Source = { kind: SlotSource; group?: string; label?: string };

export type ParsedMatch = {
  id: number;
  stage: Stage;
  group_code: string | null;
  slot_label: string | null;
  kickoff_at: string;
  home_slot: string | null;
  away_slot: string | null;
  home: Source | null;
  away: Source | null;
  notes: string | null;
};

const COL = { id: 1, date: 2, time: 4, stage: 5, home: 7, away: 8, homeName: 9, awayName: 10 } as const;

export function text(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "richText" in value) return value.richText.map((r) => r.text).join("").trim();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim(); // hyperlink
  return String(value).trim().replace(/\s+/g, " ");
}

// Date cells come back as UTC-midnight Dates, as Excel serial numbers, or as formula results.
function isoDate(value: ExcelJS.CellValue, id: number): string {
  if (value && typeof value === "object" && !(value instanceof Date) && "result" in value) {
    value = value.result as ExcelJS.CellValue;
  }
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "number") date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
  else throw new Error(`Match ${id}: unexpected date cell ${JSON.stringify(value)} (expected a date).`);
  return date.toISOString().slice(0, 10);
}

// "5:00 PM – 7:00 PM" -> "17:00"
export function startTime(range: string, id = 0): string {
  const m = range.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)/i);
  if (!m) throw new Error(`Match ${id}: unexpected time "${range}" (expected e.g. "5:00 PM – 7:00 PM").`);
  let hour = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${m[2]}`;
}

type StageInfo = { stage: Stage; group_code: string | null; slot_label: string | null };

// "Group A" | "Semi-final 1" | "Semi Final 2" | "Final" (any case, hyphen or space).
export function parseStage(label: string, id = 0): StageInfo {
  const s = label.trim().toLowerCase().replace(/[–—-]/g, " ").replace(/\s+/g, " ");
  let m = s.match(/^group ([a-z])$/);
  if (m) return { stage: "group", group_code: m[1].toUpperCase(), slot_label: null };
  m = s.match(/^semi ?final (\d)$/);
  if (m) return { stage: "semi_final", group_code: null, slot_label: `SF${m[1]}` };
  if (s === "final") return { stage: "final", group_code: null, slot_label: "FINAL" };
  throw new Error(`Match ${id}: unknown stage "${label}".`);
}

// "Group A Winner" | "Group B Runner-up" | "Winner Semi-final 1" (any case, hyphen or space).
export function parseSource(label: string, id = 0): Source {
  const s = label.trim().toLowerCase().replace(/[–—-]/g, " ").replace(/\s+/g, " ");
  let m = s.match(/^group ([a-z]) winner$/) ?? s.match(/^winner group ([a-z])$/);
  if (m) return { kind: "group_winner", group: m[1].toUpperCase() };
  m = s.match(/^group ([a-z]) runner ?up$/) ?? s.match(/^runner ?up group ([a-z])$/);
  if (m) return { kind: "group_runner_up", group: m[1].toUpperCase() };
  m = s.match(/^(winner|loser) (?:semi ?final |sf ?)(\d)$/);
  if (m) return { kind: m[1] === "winner" ? "match_winner" : "match_loser", label: `SF${m[2]}` };
  throw new Error(`Match ${id}: unrecognised knockout team "${label}".`);
}

export function parseWorksheet(sheet: ExcelJS.Worksheet): { teams: ParsedTeam[]; matches: ParsedMatch[] } {
  const teams = new Map<string, ParsedTeam>();
  const matches: ParsedMatch[] = [];

  sheet.eachRow((row) => {
    const rawId = row.getCell(COL.id).value;
    const id = typeof rawId === "number" ? rawId : /^\d+$/.test(text(rawId)) ? Number(text(rawId)) : null;
    if (id == null) return; // titles, headers, notes

    const { stage, group_code, slot_label } = parseStage(text(row.getCell(COL.stage).value), id);
    const kickoff_at = `${isoDate(row.getCell(COL.date).value, id)}T${startTime(text(row.getCell(COL.time).value), id)}:00${THIMPHU_OFFSET}`;
    const home = text(row.getCell(COL.home).value);
    const away = text(row.getCell(COL.away).value);

    if (stage === "group") {
      for (const [slot, name] of [[home, text(row.getCell(COL.homeName).value)], [away, text(row.getCell(COL.awayName).value)]]) {
        const code = slot.toUpperCase();
        if (!SHORT_CODES[code]) throw new Error(`Match ${id}: unknown team slot "${slot}".`);
        if (code[0] !== group_code) throw new Error(`Match ${id}: slot ${code} is not in Group ${group_code}.`);
        if (!name) throw new Error(`Match ${id}: no team name for slot ${code}.`);
        const known = teams.get(code);
        if (!known) teams.set(code, { slot: code, group_code: code[0], short_code: SHORT_CODES[code], name: TEAM_NAME_OVERRIDES[code] ?? name });
        else if (known.name !== (TEAM_NAME_OVERRIDES[code] ?? name)) {
          console.warn(`Note: slot ${code} is "${known.name}" in one row and "${name}" in match ${id}; using "${known.name}".`);
        }
      }
      matches.push({
        id, stage, group_code, slot_label: null, kickoff_at,
        home_slot: home.toUpperCase(), away_slot: away.toUpperCase(), home: null, away: null, notes: null,
      });
      return;
    }

    matches.push({
      id, stage, group_code: null, slot_label, kickoff_at,
      home_slot: null, away_slot: null, home: parseSource(home, id), away: parseSource(away, id), notes: null,
    });
  });

  return { teams: [...teams.values()].sort((a, b) => a.slot.localeCompare(b.slot)), matches };
}

// Structural checks: counts, every pairing exactly once, knockout sources that exist.
// Returns a list of problems (empty when the schedule is sound).
export function validateSchedule({ teams, matches }: { teams: ParsedTeam[]; matches: ParsedMatch[] }): string[] {
  const problems: string[] = [];
  if (teams.length !== EXPECTED_TEAMS) problems.push(`Expected ${EXPECTED_TEAMS} teams, found ${teams.length}.`);
  if (matches.length !== EXPECTED_MATCHES) problems.push(`Expected ${EXPECTED_MATCHES} matches, found ${matches.length}.`);

  const ids = matches.map((m) => m.id).sort((a, b) => a - b);
  ids.forEach((id, i) => { if (id !== i + 1) problems.push(`Match numbers should run 1-${matches.length}; found ${id} at position ${i + 1}.`); });
  if (new Set(ids).size !== ids.length) problems.push("A match number appears more than once.");

  const group = matches.filter((m) => m.stage === "group");
  if (group.length !== EXPECTED_GROUP_MATCHES) problems.push(`Expected ${EXPECTED_GROUP_MATCHES} group matches, found ${group.length}.`);
  for (const g of GROUPS) {
    const slots = teams.filter((t) => t.group_code === g).map((t) => t.slot);
    if (slots.length !== TEAMS_PER_GROUP) problems.push(`Group ${g}: expected ${TEAMS_PER_GROUP} teams, found ${slots.length}.`);
    const seen = new Map<string, number>();
    for (const m of group.filter((x) => x.group_code === g)) {
      if (m.home_slot === m.away_slot) problems.push(`Match ${m.id}: a team can't play itself.`);
      const key = [m.home_slot, m.away_slot].sort().join(" v ");
      if (seen.has(key)) problems.push(`Group ${g}: ${key} appears twice (matches ${seen.get(key)} and ${m.id}).`);
      seen.set(key, m.id);
    }
    const pairs = (slots.length * (slots.length - 1)) / 2;
    if (seen.size !== pairs) problems.push(`Group ${g}: expected ${pairs} different pairings (single round-robin), found ${seen.size}.`);
  }

  const knockouts = matches.filter((m) => m.stage !== "group");
  const labels = new Set(knockouts.map((m) => m.slot_label));
  for (const want of ["SF1", "SF2", "FINAL"]) if (!labels.has(want)) problems.push(`No ${want} match found.`);
  if (labels.size !== knockouts.length) problems.push("Two knockout matches have the same stage label.");
  for (const m of knockouts) {
    for (const s of [m.home, m.away]) {
      if (!s) continue;
      if (s.group && !GROUPS.includes(s.group as (typeof GROUPS)[number])) problems.push(`Match ${m.id}: there is no Group ${s.group}.`);
      if (s.label && !labels.has(s.label)) problems.push(`Match ${m.id}: refers to ${s.label}, which isn't in the schedule.`);
    }
  }
  return problems;
}

export async function readSchedule(file = SCHEDULE_FILE): Promise<{ teams: ParsedTeam[]; matches: ParsedMatch[] }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(file);
  } catch (err) {
    throw new Error(`Can't read the fixtures file ${file}: ${err instanceof Error ? err.message : err}`);
  }
  const sheet = workbook.getWorksheet(SCHEDULE_SHEET);
  if (!sheet) throw new Error(`Sheet "${SCHEDULE_SHEET}" not found in ${file}`);
  return parseWorksheet(sheet);
}
