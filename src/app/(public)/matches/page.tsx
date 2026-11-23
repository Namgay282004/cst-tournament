import type { Metadata } from "next";
import { MatchesView } from "@/components/matches/matches-view";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("Matches") };

export default function MatchesPage() {
  return <MatchesView />;
}
