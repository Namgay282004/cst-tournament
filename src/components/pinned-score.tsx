"use client";

import { useEffect } from "react";
import { teamShort } from "@/data/team-names";
import { formatTime, relativeDay } from "@/lib/format";
import { setPinnedMatch, usePinnedMatch } from "@/lib/pinned-match";
import { isFinished, isLive, isPostponed, type Match, type Team } from "@/lib/tournament";
import { CloseIcon, PinIcon } from "./icons";
import { LivePill } from "./live-pill";
import { useMatchSheet } from "./match-sheet/context";
import { TeamLogo } from "./team-logo";
import { useServerNow, useTournament } from "./tournament-provider";
import { useFlashOnChange } from "./use-flash";

/** A finished match stays pinned (showing FT) until this long after kick-off, then unpins itself. */
const UNPIN_AFTER_KICKOFF_MS = 4 * 60 * 60 * 1000;

/**
 * The pinned match as a small floating scoreboard in the bottom-right corner, above the tab bar (and the
 * announcements ticker): both logos and the score, with the status on a badge on top ("Live 62'", "FT",
 * "Today 5:00 PM"). Live through the page's existing realtime connection. Tapping opens the match
 * details; × unpins. One pinned match at a time, kept in this browser only (pinned-match.ts).
 */
export function PinnedScore() {
  const pinnedId = usePinnedMatch();
  const { matchesById, teamsById } = useTournament();
  const now = useServerNow(60_000);
  const match = pinnedId != null ? matchesById.get(pinnedId) : undefined;
  const expired = !!match && isFinished(match) && now - Date.parse(match.kickoff_at) > UNPIN_AFTER_KICKOFF_MS;

  useEffect(() => {
    // A pin for a match that no longer exists, or a result long over, clears itself.
    if (pinnedId != null && matchesById.size > 0 && (!match || expired)) setPinnedMatch(null);
  }, [pinnedId, match, expired, matchesById.size]);

  if (!match || expired) return null;
  const home = match.home_team_id != null ? teamsById.get(match.home_team_id) : undefined;
  const away = match.away_team_id != null ? teamsById.get(match.away_team_id) : undefined;
  return <Chip match={match} home={home} away={away} now={now} />;
}

function Chip({ match, home, away, now }: { match: Match; home?: Team; away?: Team; now: number }) {
  const openSheet = useMatchSheet();
  const live = isLive(match);
  const finished = isFinished(match);
  const started = live || finished;
  const score = `${match.home_score}–${match.away_score}`;
  const flash = useFlashOnChange(score);
  const status = live
    ? "Live"
    : finished
      ? "Full time"
      : isPostponed(match)
        ? "Postponed"
        : `${relativeDay(match.kickoff_at, now)} ${formatTime(match.kickoff_at)}`;
  const teamsSaid = started
    ? `${home?.name ?? "TBD"} ${match.home_score}, ${away?.name ?? "TBD"} ${match.away_score}`
    : `${home?.name ?? "TBD"} v ${away?.name ?? "TBD"}`;
  const spoken = `Pinned score: ${teamsSaid}, ${status}. Open match details.`;

  return (
    <>
      {/* Room at the bottom of the page, so the last row can scroll clear of the chip. */}
      <div aria-hidden="true" className="h-16" />
      <div className="fixed right-4 bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom)+var(--ticker-offset)+0.75rem)] z-30">
        <div className="relative">
          {/* The status badge, centred on the chip's top edge. */}
          <div className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap">
            {live ? (
              <LivePill match={match} size="sm" />
            ) : (
              <span
                className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold tabular ${
                  finished ? "bg-text text-white" : "bg-card text-muted ring-1 ring-border"
                }`}
              >
                {finished ? "FT" : status}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => openSheet?.(match.id)}
            aria-label={spoken}
            className="flex h-14 min-w-36 items-center justify-center gap-2.5 rounded-2xl bg-card px-3 pt-1.5 shadow-lg ring-1 ring-border active:scale-[0.98]"
          >
            <Side team={home} />
            <span key={flash} className={`font-display text-2xl leading-none font-bold tabular ${flash ? "score-flash" : ""}`}>
              {started ? score : <span className="text-base font-semibold text-muted">v</span>}
            </span>
            <Side team={away} />
          </button>
          <button
            type="button"
            onClick={() => setPinnedMatch(null)}
            aria-label="Unpin score"
            className="absolute -top-2.5 -right-2.5 grid size-7 place-items-center rounded-full bg-card text-muted shadow ring-1 ring-border active:bg-bg"
          >
            <CloseIcon className="size-3" />
          </button>
        </div>
      </div>
    </>
  );
}

function Side({ team }: { team?: Team }) {
  if (!team) return <span className="font-display text-xs font-semibold text-muted">TBD</span>;
  return (
    <span className="flex flex-col items-center" title={teamShort(team)}>
      <TeamLogo team={team} size={28} />
    </span>
  );
}

/** The "Pin score" toggle for the match details. Hidden for a finished match (nothing left to follow). */
export function PinButton({ match, className = "" }: { match: Match; className?: string }) {
  const pinnedId = usePinnedMatch();
  if (isFinished(match) && pinnedId !== match.id) return null;
  const pinned = pinnedId === match.id;
  return (
    <button
      type="button"
      aria-pressed={pinned}
      onClick={() => setPinnedMatch(pinned ? null : match.id)}
      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 active:opacity-80 ${
        pinned ? "bg-brand/10 text-brand-text ring-brand/40" : "bg-card text-brand-text ring-border"
      } ${className}`}
    >
      <PinIcon className="size-4" filled={pinned} />
      {pinned ? "Pinned" : "Pin score"}
    </button>
  );
}
