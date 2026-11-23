import type { Metadata } from "next";
import { GroupsView } from "@/components/groups/groups-view";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("Groups") };

export default function GroupsPage() {
  return <GroupsView />;
}
