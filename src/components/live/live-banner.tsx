import { getImageProps } from "next/image";
import phone from "@/assets/banner-phone.webp";
import wide from "@/assets/banner-wide.webp";
import { Sponsors } from "../sponsors";
import { TOURNAMENT_DATES, TOURNAMENT_FULL_NAME, VENUE } from "@/lib/brand";

const ALT = "Indo-Bhutan Friendship Open Veteran Tournament, CST Silver Jubilee Celebration: the Silver Jubilee emblem between the flags of India and Bhutan";
// Breakpoint where the wider crop takes over (Tailwind's sm). The page column is max-w-xl (576px).
const WIDE_FROM = 640;

/**
 * Live page banner, shown the same way whether or not a match is live: the tournament artwork (it carries the
 * tournament's name), one line with the venue and dates, then the sponsors. The full name is the section's
 * heading for screen readers; shown again under artwork that already names the tournament it would only push
 * the scores down. Phones get a crop without the artwork's small venue/date row and outer flag edges (that row
 * is about 4 px tall at phone width), wider screens the whole artwork (python3 scripts/brand-assets.py).
 * Low priority and not preloaded: it never holds up the scores.
 */
export function BannerHero() {
  const common = { alt: ALT, fetchPriority: "low" as const, loading: "lazy" as const };
  const { props: { srcSet: wideSrcSet } } = getImageProps({ ...common, src: wide, sizes: "544px" });
  const { props: img } = getImageProps({ ...common, src: phone, sizes: "calc(100vw - 32px)" });

  return (
    <section aria-labelledby="tournament-title" className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
      {/* Fixed proportions per breakpoint, so nothing below moves when the image arrives. */}
      <picture
        className="block aspect-[980/350] bg-cover bg-center sm:aspect-[1280/384]"
        style={{ backgroundImage: `url(${phone.blurDataURL})` }}
      >
        <source media={`(min-width: ${WIDE_FROM}px)`} srcSet={wideSrcSet} sizes="544px" />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
        <img {...img} className="h-full w-full object-cover" />
      </picture>
      <h2 id="tournament-title" className="sr-only">
        {TOURNAMENT_FULL_NAME}
      </h2>
      <p className="px-4 py-2 text-center text-sm font-medium text-muted">
        {VENUE} · {TOURNAMENT_DATES}
      </p>
      {/* Sponsors: one slim row under the venue and dates, behind a thin divider. */}
      <Sponsors place="banner" className="mx-4 border-t border-border py-2" />
    </section>
  );
}
