create table "public"."waitlist" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "email" text not null,
    "situation" text,
    "goal" text,
    "tried" text,
    "obstacle" text,
    constraint "waitlist_pkey" primary key ("id")
);

alter table "public"."waitlist" enable row level security;

create policy "Enable insert for all users"
on "public"."waitlist"
as permissive
for insert
to public
with check (true);

create policy "Enable read access for authenticated users only"
on "public"."waitlist"
as permissive
for select
to authenticated
using (true);
