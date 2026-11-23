-- CST Silver Jubilee Indo-Bhutan Friendship Open Veteran Football Tournament 2026.
-- Applied on a NEW database, after every earlier migration. Replaces three functions that were
-- hard-wired to the departmental tournament (26 Sep - 31 Oct 2026, Round of 16):
--   * admin_change_kickoff: kick-offs within 24 Nov - 31 Dec 2026 (room for postponements past
--     the 17 Dec final).
--   * admin_abandon_match: the "continues on" date within the same window.
--   * admin_fill_round_of_16: fills every knockout match that takes a team from the group tables
--     (here the two semi-finals). The name is kept because the admin screen calls it by name.
-- `create or replace` keeps each function's existing grants.

-- ---------------------------------------------------------------------------
-- admin_change_kickoff (from 20261010090000_schedule_changes_and_notices.sql; only the dates differ)
-- ---------------------------------------------------------------------------
create or replace function public.admin_change_kickoff(p_match smallint, p_new timestamptz, p_reason text default null)
returns public.kickoff_changes
language plpgsql
set search_path = ''
as $$
declare
  m public.matches;
  c public.kickoff_changes;
  last public.kickoff_changes;
  postponed boolean;
  v_reason text := nullif(public.tidy_name(p_reason), '');
begin
  perform public.require_admin();
  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'Match % not found.', p_match using errcode = 'CST01'; end if;
  if length(coalesce(v_reason, '')) > 80 then
    raise exception 'The reason is too long (80 characters at most).' using errcode = 'CST01';
  end if;
  select * into last from public.kickoff_changes where match_id = p_match and undone_at is null order by id desc limit 1;
  postponed := found and last.new_kickoff is null;  -- currently postponed (latest change has no new time)

  if p_new is null then
    if m.status <> 'scheduled' then
      raise exception 'Only a match that hasn''t started can be postponed.' using errcode = 'CST01';
    end if;
    if postponed then
      raise exception 'This match is already postponed. Set its new kick-off to end the postponement.' using errcode = 'CST01';
    end if;
  else
    if p_new < timestamptz '2026-11-24 00:00:00+06' or p_new >= timestamptz '2027-01-01 00:00:00+06' then
      raise exception 'The kick-off must be during the tournament (24 Nov - 31 Dec 2026).' using errcode = 'CST01';
    end if;
    if p_new = m.kickoff_at and not postponed then
      raise exception 'That''s already the kick-off time.' using errcode = 'CST01';
    end if;
    if m.status <> 'scheduled'
       and (p_new at time zone 'Asia/Thimphu')::date <> (m.kickoff_at at time zone 'Asia/Thimphu')::date then
      raise exception 'This match has started, so only its kick-off time on the same day can be corrected.' using errcode = 'CST01';
    end if;
    update public.matches set kickoff_at = p_new where id = p_match;
  end if;

  insert into public.kickoff_changes (match_id, old_kickoff, new_kickoff, reason, is_demo)
  values (p_match, m.kickoff_at, p_new, v_reason, m.is_demo)
  returning * into c;
  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_abandon_match (from 20261010130000_match_stoppages.sql; only the dates differ)
-- ---------------------------------------------------------------------------
create or replace function public.admin_abandon_match(p_match smallint, p_resume_at timestamptz default null)
returns public.match_stoppages
language plpgsql
set search_path = ''
as $$
declare
  s public.match_stoppages;
begin
  perform public.require_admin();
  select * into s from public.match_stoppages where match_id = p_match and outcome is null for update;
  if not found then raise exception 'Suspend play first.' using errcode = 'CST01'; end if;
  if p_resume_at is not null and (p_resume_at < timestamptz '2026-11-24 00:00:00+06' or p_resume_at >= timestamptz '2027-01-01 00:00:00+06') then
    raise exception 'The new date must be during the tournament (24 Nov - 31 Dec 2026).' using errcode = 'CST01';
  end if;
  update public.match_stoppages set abandoned = true, resume_at = p_resume_at where id = s.id returning * into s;
  return s;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_fill_round_of_16 (from 20261004180000_undo_coverage.sql). Fills every knockout match
-- with a side that comes from the group tables (the semi-finals here), instead of stage
-- 'round_of_16'. A side that comes from another match (e.g. the Final) is never touched.
-- ---------------------------------------------------------------------------
create or replace function public.admin_fill_round_of_16()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  d public.matches;
  side text;
  side_source public.slot_source;
  grp char(1);
  pos integer;
  team smallint;
  current_team smallint;
  started boolean;
  report jsonb := '[]'::jsonb;
  outcome text;
  reason text;
  changed boolean;
begin
  perform public.require_admin();

  for d in select * from public.matches
            where home_source in ('group_winner', 'group_runner_up')
               or away_source in ('group_winner', 'group_runner_up')
            order by slot_label for update loop
    started := d.status <> 'scheduled' or exists (select 1 from public.match_events where match_id = d.id);
    changed := false;
    foreach side in array array['home', 'away'] loop
      side_source := case when side = 'home' then d.home_source else d.away_source end;
      continue when side_source is null or side_source not in ('group_winner', 'group_runner_up');
      grp := case when side = 'home' then d.home_source_group else d.away_source_group end;
      pos := case when side_source = 'group_winner' then 1 else 2 end;
      current_team := case when side = 'home' then d.home_team_id else d.away_team_id end;
      team := public.group_position_team(grp, pos);
      reason := null;

      if team is null then
        outcome := 'skipped';
        reason := case when public.group_complete(grp) then format('Group %s needs a decision', grp)
                       else format('Group %s not complete', grp) end;
      elsif team is not distinct from current_team then
        outcome := 'unchanged';
      elsif started then
        outcome := 'skipped';
        reason := format('%s has already started', d.slot_label);
      else
        if not changed then
          -- One undo step per tie, restoring both of its teams.
          insert into public.match_actions (match_id, kind, payload)
          values (d.id, 'teams', jsonb_build_object('home', d.home_team_id, 'away', d.away_team_id));
          changed := true;
        end if;
        if side = 'home' then
          update public.matches set home_team_id = team where id = d.id;
        else
          update public.matches set away_team_id = team where id = d.id;
        end if;
        outcome := 'filled';
      end if;

      report := report || jsonb_build_object(
        'match_id', d.id, 'slot', d.slot_label, 'side', side, 'outcome', outcome,
        'team_id', team, 'previous_team_id', current_team, 'reason', reason);
    end loop;
  end loop;
  return report;
end;
$$;
