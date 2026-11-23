// seed-demo, test-admin and rehearsal were written for the departmental tournament's 68 fixtures
// (Round of 16, quarter-finals, match 52, Group G...). Against the veteran tournament's 23 fixtures
// they would touch the wrong matches, so they refuse to run until they are adapted.
import { admin } from "./admin-client";

export async function requireDepartmentalFixtures(script: string): Promise<void> {
  const { count, error } = await admin.from("matches").select("id", { count: "exact", head: true });
  if (error) throw new Error(`Couldn't count matches: ${error.message}`);
  if (count !== 68) {
    throw new Error(
      `${script} was written for the departmental tournament (68 matches, Round of 16). ` +
        `This database has ${count} matches, so nothing was run. Adapt the script to the veteran ` +
        `tournament's fixtures before using it.`,
    );
  }
}
