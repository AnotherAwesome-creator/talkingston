-- Deliver one-shot reminders through the Vercel cron worker.
-- scheduled_at is timestamptz, so the browser's local selection is stored as
-- an absolute instant and is not shifted when the scheduler runs.

create extension if not exists pg_cron with schema extensions;

alter table public.reminders
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_claimed_at timestamptz;

alter table public.notifications
  add column if not exists reminder_id uuid references public.reminders(id) on delete set null;

create unique index if not exists idx_notifications_reminder_once
  on public.notifications(reminder_id)
  where reminder_id is not null;

create index if not exists idx_reminders_due_delivery
  on public.reminders(scheduled_at, active, delivered_at, delivery_claimed_at);

create or replace function public.deliver_due_reminders(batch_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reminder_row record;
  delivered_count integer := 0;
  reminders_enabled boolean;
begin
  for reminder_row in
    select r.id, r.owner_id, r.task_id, t.title
    from public.reminders r
    join public.tasks t on t.id = r.task_id
    where r.active
      and r.delivered_at is null
      and r.scheduled_at <= now()
      and (r.delivery_claimed_at is null or r.delivery_claimed_at < now() - interval '5 minutes')
    order by r.scheduled_at
    for update of r, t skip locked
    limit greatest(1, least(batch_limit, 500))
  loop
    update public.reminders
    set delivery_claimed_at = now(), updated_at = now()
    where id = reminder_row.id
      and delivered_at is null
      and active;

    if not found then
      continue;
    end if;

    select coalesce(np.reminders, true)
      into reminders_enabled
    from public.notification_preferences np
    where np.user_id = reminder_row.owner_id;
    reminders_enabled := coalesce(reminders_enabled, true);

    if reminders_enabled then
      insert into public.notifications (
        user_id,
        type,
        title,
        body,
        target_route,
        target_id,
        reminder_id
      )
      values (
        reminder_row.owner_id,
        'reminder',
        'Reminder',
        reminder_row.title || ' is due now.',
        '/tasks',
        reminder_row.task_id,
        reminder_row.id
      )
      on conflict (reminder_id) do nothing;
    end if;

    update public.reminders
    set delivered_at = coalesce(delivered_at, now()),
        delivery_claimed_at = null,
        updated_at = now()
    where id = reminder_row.id;

    delivered_count := delivered_count + 1;
  end loop;

  return delivered_count;
end;
$$;

revoke all on function public.deliver_due_reminders(integer) from public, anon, authenticated;
grant execute on function public.deliver_due_reminders(integer) to service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'talkingston-reminder-delivery';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'talkingston-reminder-delivery',
    '* * * * *',
    'select public.deliver_due_reminders(100);'
  );
end;
$$;
