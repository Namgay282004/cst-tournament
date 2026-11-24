// CST Silver Jubilee Indo-Bhutan Friendship Open Veteran Football Tournament 2026.
// The fixtures file is the organisers' CST_Silver_Jubilee_Football_Fixtures_2026_Revised.xlsx,
// saved under this name in data/.
export const SCHEDULE_FILE = "data/Veteran_Tournament_Fixtures_2026.xlsx";
export const SCHEDULE_SHEET = "Schedule";

// Asia/Thimphu is UTC+6 all year (no DST).
export const THIMPHU_OFFSET = "+06:00";

// Internal team codes (URLs, logo file names). Fans never see them.
export const SHORT_CODES: Record<string, string> = {
  A1: "GCB", A2: "SBV", A3: "CSV", A4: "PSB", A5: "PLV",
  B1: "DRV", B2: "JGV", B3: "GMV", B4: "SMV", B5: "RPU",
};

// Official names that differ from the fixtures file (the organisers renamed the team after the file
// was made). Applied when the file is read, so `npm run seed` writes these names and never brings the
// old one back.
export const TEAM_NAME_OVERRIDES: Record<string, string> = {
  A1: "BSB Veteran FC", // "GCBS FC" in the fixtures file; renamed 24 Nov 2026
};

// The shape of the tournament, checked by the parser before anything is written.
export const GROUPS = ["A", "B"] as const;
export const TEAMS_PER_GROUP = 5;
export const EXPECTED_TEAMS = 10;
export const EXPECTED_GROUP_MATCHES = 20; // single round-robin: 10 per group
export const EXPECTED_MATCHES = 23; // + SF1, SF2, Final (no 3rd place match)
