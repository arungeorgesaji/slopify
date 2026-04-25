create extension if not exists pgcrypto;

create table if not exists public.songs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid null,
    title text null,
    prompt text null,
    composition_plan jsonb null,
    model_id text not null default 'music_v1',
    music_length_ms integer null check (music_length_ms between 3000 and 600000),
    force_instrumental boolean not null default false,
    respect_sections_durations boolean not null default false,
    status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
    storage_bucket text not null default 'generated-music',
    storage_path text null unique,
    mime_type text null,
    size_bytes bigint null check (size_bytes is null or size_bytes >= 0),
    error_message text null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.videos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid null,
    title text null,
    prompt text null,
    status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
    storage_bucket text not null default 'videos',
    storage_path text null unique,
    mime_type text null check (mime_type is null or mime_type like 'video/%'),
    size_bytes bigint null check (size_bytes is null or size_bytes >= 0),
    duration_ms integer null check (duration_ms is null or duration_ms between 1 and 7200000),
    width integer null check (width is null or width > 0),
    height integer null check (height is null or height > 0),
    error_message text null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists songs_created_at_idx on public.songs (created_at desc);
create index if not exists songs_status_idx on public.songs (status);
create index if not exists videos_created_at_idx on public.videos (created_at desc);
create index if not exists videos_status_idx on public.videos (status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists songs_set_updated_at on public.songs;
create trigger songs_set_updated_at
before update on public.songs
for each row
execute procedure public.set_updated_at();

drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at
before update on public.videos
for each row
execute procedure public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('generated-music', 'generated-music', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

alter table public.songs enable row level security;
alter table public.videos enable row level security;

drop policy if exists "service_role_manage_songs" on public.songs;
create policy "service_role_manage_songs"
on public.songs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service_role_manage_videos" on public.videos;
create policy "service_role_manage_videos"
on public.videos
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
