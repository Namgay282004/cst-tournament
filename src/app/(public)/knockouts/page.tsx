import type { Metadata } from "next";
import { KnockoutsView } from "@/components/knockouts/knockouts-view";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("Knockouts") };

export default function KnockoutsPage() {
  return <KnockoutsView />;
}
