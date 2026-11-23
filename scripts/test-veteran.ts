// The veteran tournament's structure, checked without a database:
//   * the fixtures parser on a SYNTHETIC workbook in the Schedule sheet's layout (made-up dates and
//     pairings, never written anywhere), and on the real fixtures file when it is in data/;
//   * group tables for two groups of five, the semi-final fill and the bracket (SF1, SF2, Final);
//   * no re-entry after a substitution.
//
//   npm run test:veteran
import { existsSync } from "node:fs";
import ExcelJS from "exceljs";
import { SCHEDULE_FILE } from "./lib/config";
import { parseSource, parseStage, parseWorksheet, readSchedule, startTime, validateSchedule, type ParsedMatch } from "./lib/schedule";
import {
  ALLOW_RE_ENTRY,
  GROUP_CODES,
  KNOCKOUT_ROUNDS,
  computeStandings,
  eventAfterSubWarning,
  previewFillRound16,
  resolveSide,
  substitutionWarnings,
  takesGroupTeams,
  type Match,
  type Substitution,
  type Team,
} from "../src/lib/tournament";
import { SHORT_CODES } from "./lib/config";

let failures = 0;
const check = (ok: boolean, line: string, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${line}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

// ---------------------------------------------------------------------------
// A synthetic Schedule sheet in the documented layout (A no., B date, D time, E stage, G/H slots or
// sources, I/J names, K-N formulas). The group pairings are a generated round-robin, NOT the real draw.
// ---------------------------------------------------------------------------
const NAMES: Record<string, string> = Object.fromEntries(Object.keys(SHORT_CODES).map((slot) => [slot, `Test team ${slot}`]));
const ROUND_ROBIN_5 = [[1, 2], [3, 4], [5, 1], [2, 3], [4, 5], [1, 3], [2, 4], [3, 5], [4, 1], [5, 2]];

function syntheticSheet(edit?: (rows: unknown[][]) => void): ExcelJS.Worksheet {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Schedule");
  const rows: unknown[][] = [
    ["SYNTHETIC TEST FIXTURES (not the real draw)"],
    ["No.", "Date", "Day", "Time", "Stage", "Venue", "Team 1", "Team 2", "Team 1 name", "Team 2 name", "Score 1", "Score 2", "Result", "Notes"],
  ];
  let id = 1;
  for (let i = 0; i < ROUND_ROBIN_5.length; i++) {
    for (const g of ["A", "B"]) {
      const [h, a] = ROUND_ROBIN_5[i].map((n) => `${g}${n}`);
      const date = new Date(Date.UTC(2026, 10, 24 + Math.floor((id - 1) / 2)));
      rows.push([id++, date, "", "5:00 PM – 7:00 PM", `Group ${g}`, "CST", h, a, NAMES[h], NAMES[a], { formula: "0", result: 0 }, null, null, null]);
    }
  }
  rows.push(["Note: one team in each group rests each round."]);
  rows.push([21, new Date(Date.UTC(2026, 11, 14)), "Mon", "5:00 PM – 7:00 PM", "Semi-final 1", "CST", "Group A Winner", "Group B Runner-up"]);
  rows.push([22, new Date(Date.UTC(2026, 11, 15)), "Tue", "5:00 PM – 7:00 PM", "Semi-final 2", "CST", "Group B Winner", "Group A Runner-up"]);
  rows.push([23, new Date(Date.UTC(2026, 11, 17)), "Thu", "5:00 PM – 7:00 PM", "Final", "CST", "Winner Semi-final 1", "Winner Semi-final 2"]);
  edit?.(rows);
  for (const r of rows) ws.addRow(r);
  return ws;
}

// 1. Small parsers.
check(startTime("5:00 PM – 7:00 PM") === "17:00" && startTime("3:00 PM - 5:00 PM") === "15:00", "time: start of an en-dash or hyphen range");
check(parseStage("Group B").group_code === "B" && parseStage("Semi-final 2").slot_label === "SF2" && parseStage("Final").stage === "final", "stage column: Group X / Semi-final N / Final");
check(
  parseSource("Group A Winner").kind === "group_winner" && parseSource("Group B Runner-up").group === "B" && parseSource("Winner Semi-final 1").label === "SF1",
  "knockout sources: group winner, runner-up, semi-final winner",
);
{
  let threw = false;
  try { parseSource("Loser Quarter-final 1"); } catch { threw = true; }
  check(threw, "an unknown knockout source is an error, not a guess");
}

// 2. The whole synthetic sheet.
const parsed = parseWorksheet(syntheticSheet());
{
  const problems = validateSchedule(parsed);
  check(problems.length === 0, "synthetic schedule: 10 teams, 23 matches, single round-robin, SF1/SF2/Final", problems.join("; "));
  const byId = new Map(parsed.matches.map((m) => [m.id, m]));
  const sf1 = byId.get(21)!, sf2 = byId.get(22)!, fin = byId.get(23)!;
  check(
    sf1.slot_label === "SF1" && sf1.home?.kind === "group_winner" && sf1.home.group === "A" && sf1.away?.kind === "group_runner_up" && sf1.away.group === "B",
    "SF1 = Winner Group A v Runner-up Group B",
  );
  check(sf2.slot_label === "SF2" && sf2.home?.group === "B" && sf2.away?.kind === "group_runner_up" && sf2.away.group === "A", "SF2 = Winner Group B v Runner-up Group A");
  check(fin.slot_label === "FINAL" && fin.home?.label === "SF1" && fin.away?.label === "SF2", "Final = Winner SF1 v Winner SF2");
  check(!parsed.matches.some((m) => m.stage === "third_place"), "no 3rd place match");
  check(byId.get(1)!.kickoff_at === "2026-11-24T17:00:00+06:00", "kick-off stored in Bhutan time (+06:00)", byId.get(1)!.kickoff_at);
  check(parsed.teams.every((t) => t.short_code === SHORT_CODES[t.slot]), "team codes from SHORT_CODES (GCB … RPU)");
}
// 3. The validator catches a broken sheet before anything is written.
{
  // rows[2] is match 1 (Group A: A1 v A2); rows[4] is match 3 (Group A) — make it A1 v A2 again.
  const dup = parseWorksheet(syntheticSheet((rows) => { rows[4][6] = "A1"; rows[4][7] = "A2"; rows[4][8] = NAMES.A1; rows[4][9] = NAMES.A2; }));
  check(validateSchedule(dup).some((p) => p.includes("appears twice")), "validator: a pairing played twice is reported");
  const noFinal = parseWorksheet(syntheticSheet((rows) => { rows.pop(); }));
  check(validateSchedule(noFinal).some((p) => p.includes("FINAL")), "validator: a missing Final is reported");
  let threw = false;
  try { parseWorksheet(syntheticSheet((rows) => { rows[2][6] = "B1"; })); } catch { threw = true; }
  check(threw, "parser: a Group B slot in a Group A row is an error");
}

// ---------------------------------------------------------------------------
// Tables, semi-final fill and the bracket, from the synthetic schedule.
// ---------------------------------------------------------------------------
const teams: Team[] = parsed.teams.map((t, i) => ({ id: i + 1, slot: t.slot, group_code: t.group_code, short_code: t.short_code, name: t.name, tiebreak_rank: null }));
const teamBySlot = new Map(teams.map((t) => [t.slot, t]));
const labelToId = new Map(parsed.matches.filter((m) => m.slot_label).map((m) => [m.slot_label!, m.id]));

function toMatch(p: ParsedMatch, score?: [number, number]): Match {
  return {
    id: p.id, stage: p.stage, group_code: p.group_code, slot_label: p.slot_label, kickoff_at: p.kickoff_at,
    status: score ? "finished" : "scheduled",
    home_team_id: p.home_slot ? teamBySlot.get(p.home_slot)!.id : null,
    away_team_id: p.away_slot ? teamBySlot.get(p.away_slot)!.id : null,
    home_score: score?.[0] ?? 0, away_score: score?.[1] ?? 0, home_pens: null, away_pens: null, period_started_at: null,
    home_source: p.home?.kind ?? null, home_source_group: p.home?.group ?? null, home_source_match: p.home?.label ? labelToId.get(p.home.label)! : null,
    away_source: p.away?.kind ?? null, away_source_group: p.away?.group ?? null, away_source_match: p.away?.label ? labelToId.get(p.away.label)! : null,
    is_demo: false, notes: null, updated_at: "2026-11-24T00:00:00Z",
  } as Match;
}
// Lower slot number wins every group match, so the tables read 1st = X1, 2nd = X2.
const finishedGroups = parsed.matches.map((p) => {
  if (p.stage !== "group") return toMatch(p);
  const h = Number(p.home_slot!.slice(1)), a = Number(p.away_slot!.slice(1));
  return toMatch(p, h < a ? [2, 0] : [0, 2]);
});

{
  check(GROUP_CODES.length === 2 && GROUP_CODES.join() === "A,B", "two groups: A and B");
  const halfway = computeStandings(teams, parsed.matches.map((p) => toMatch(p)));
  check(halfway.A.rows.length === 5 && halfway.B.rows.length === 5 && !halfway.A.complete && halfway.A.matchesTotal === 10, "each group: 5 teams, 10 matches");
  const st = computeStandings(teams, finishedGroups);
  check(st.A.complete && st.B.complete, "groups complete after 20 finished matches");
  check(st.A.rows.every((r) => r.played === 4), "every team plays 4 group matches (one rests each round)");
  check(st.A.rows[0].team.slot === "A1" && st.A.rows[0].points === 12 && st.A.rows[1].team.slot === "A2", "points 3/1/0 and order: A1 12 pts, then A2");
  check(st.A.rows.filter((r) => r.qualifying).map((r) => r.team.slot).join() === "A1,A2", "top two qualify");

  const plans = previewFillRound16(finishedGroups, [], st, new Map(teams.map((t) => [t.id, t])));
  const plan = (slot: string, side: "home" | "away") => plans.find((p) => p.match.slot_label === slot && p.side === side);
  check(plans.length === 4 && plans.every((p) => p.outcome === "filled"), "Fill semi-finals: 4 slots to fill, nothing else touched", JSON.stringify(plans.map((p) => [p.match.slot_label, p.side, p.outcome])));
  check(
    plan("SF1", "home")?.team?.slot === "A1" && plan("SF1", "away")?.team?.slot === "B2" && plan("SF2", "home")?.team?.slot === "B1" && plan("SF2", "away")?.team?.slot === "A2",
    "fill: SF1 = A1 v B2, SF2 = B1 v A2",
  );
  check(!plans.some((p) => p.match.slot_label === "FINAL"), "fill never touches the Final (its teams come from the semi-finals)");
  check(finishedGroups.filter(takesGroupTeams).map((m) => m.slot_label).sort().join() === "SF1,SF2", "takesGroupTeams: just the semi-finals");

  const half = computeStandings(teams, finishedGroups.map((m) => (m.group_code === "B" ? { ...m, status: "scheduled" as const } : m)));
  const halfPlans = previewFillRound16(finishedGroups, [], half, new Map(teams.map((t) => [t.id, t])));
  check(halfPlans.filter((p) => p.outcome === "skipped").every((p) => p.reason === "Group B not complete") && halfPlans.filter((p) => p.outcome === "filled").length === 2, "fill with Group B unfinished: only the Group A slots");

  const final = finishedGroups.find((m) => m.slot_label === "FINAL")!;
  const ctx = { teamsById: new Map(teams.map((t) => [t.id, t])), matchesById: new Map(finishedGroups.map((m) => [m.id, m])), standings: st };
  check(resolveSide(final, "home", ctx).placeholder === "Winner SF1" && resolveSide(final, "away", ctx).placeholder === "Winner SF2", "Final shows 'Winner SF1' v 'Winner SF2' until decided");
  check(
    KNOCKOUT_ROUNDS.map((r) => `${r.key}:${r.slots.join("+")}`).join(" ") === "sf:SF1+SF2 finals:FINAL",
    "bracket rounds: semi-finals (SF1, SF2), then the Final",
  );
}

// ---------------------------------------------------------------------------
// Substitutions: no re-entry.
// ---------------------------------------------------------------------------
{
  check(ALLOW_RE_ENTRY === false, "ALLOW_RE_ENTRY is false (re-entry is a hard block)");
  const subs: Substitution[] = [{ id: 1, match_id: 1, team_id: 1, player_off: "p9", player_on: "p14", minute: 60, added_time: null, client_id: null }];
  const label = (id: string) => id;
  const back = substitutionWarnings({ matchId: 1, subs, at: { minute: 75, added_time: null }, offId: "p14", onId: "p9", label });
  check(back.some((w) => w.reEntry), "bringing back a player who came off is flagged as re-entry (blocked)");
  const goal = eventAfterSubWarning({ matchId: 1, subs, at: { minute: 70, added_time: null }, playerId: "p9", noun: "goal", label });
  check(goal?.reEntry === true, "a goal for a player who has gone off is blocked");
  const before = eventAfterSubWarning({ matchId: 1, subs, at: { minute: 55, added_time: null }, playerId: "p9", noun: "goal", label });
  check(before === null, "a goal before the substitution is fine");
}

// ---------------------------------------------------------------------------
// The real fixtures file, when it's there.
// ---------------------------------------------------------------------------
async function realFile() {
  if (!existsSync(SCHEDULE_FILE)) {
    console.log(`\nskip  ${SCHEDULE_FILE} not found: the real fixtures can't be checked yet.`);
    return;
  }
  const real = await readSchedule();
  const problems = validateSchedule(real);
  check(problems.length === 0, `real fixtures file (${SCHEDULE_FILE}) passes every check`, problems.join("; "));
  const ko = real.matches.filter((m) => m.stage !== "group").map((m) => `${m.id}:${m.slot_label}`).join(" ");
  check(ko === "21:SF1 22:SF2 23:FINAL", "real file: matches 21-23 are SF1, SF2, Final", ko);
}

realFile()
  .catch((err) => check(false, "real fixtures file can be read", err instanceof Error ? err.message : String(err)))
  .finally(() => {
    if (failures) {
      console.log(`\n${failures} problem(s).`);
      process.exit(1);
    }
    console.log("\nThe veteran tournament's structure holds.");
  });
