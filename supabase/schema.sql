create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create table if not exists public.songs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid null,
    title text null,
    prompt text null,
    lyrics text null,
    composition_plan jsonb null,
    model_id text not null default 'music_v1',
    music_length_ms integer null check (music_length_ms between 3000 and 600000),
    force_instrumental boolean not null default false,
    respect_sections_durations boolean not null default false,
    status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
    storage_bucket text not null default 'generated-music',
    image_storage_bucket text not null default 'generated-images',
    storage_path text null unique,
    image_storage_path text null unique,
    mime_type text null,
    image_mime_type text null,
    video_job_id text null,
    video_status text null check (video_status is null or video_status in ('queued', 'processing', 'completed', 'failed')),
    video_url text null,
    video_error text null,
    size_bytes bigint null check (size_bytes is null or size_bytes >= 0),
    error_message text null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists songs_created_at_idx on public.songs (created_at desc);
create index if not exists songs_status_idx on public.songs (status);

alter table public.songs
add column if not exists lyrics text null;

alter table public.songs
add column if not exists image_storage_bucket text not null default 'generated-images';

alter table public.songs
add column if not exists image_storage_path text null unique;

alter table public.songs
add column if not exists image_mime_type text null;

alter table public.songs
add column if not exists video_job_id text null;

alter table public.songs
add column if not exists video_status text null;

alter table public.songs
add column if not exists video_url text null;

alter table public.songs
add column if not exists video_error text null;

drop trigger if exists songs_set_updated_at on public.songs;
create trigger songs_set_updated_at
before update on public.songs
for each row
execute procedure public.set_updated_at();

create table if not exists public.song_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid null,
    title text null,
    prompt text null,
    lyrics text null,
    composition_plan jsonb null,
    model_id text not null default 'music_v1',
    music_length_ms integer null check (music_length_ms between 3000 and 600000),
    force_instrumental boolean not null default false,
    respect_sections_durations boolean not null default false,
    candidate_count integer not null default 1 check (candidate_count between 1 and 4),
    status text not null default 'processing' check (status in ('processing', 'completed', 'partial', 'failed')),
    selected_variant_id uuid null,
    selected_song_id uuid null references public.songs(id) on delete set null,
    image_storage_bucket text not null default 'generated-images',
    image_storage_path text null unique,
    image_mime_type text null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists song_sessions_created_at_idx on public.song_sessions (created_at desc);

alter table public.song_sessions
add column if not exists image_storage_bucket text not null default 'generated-images';

alter table public.song_sessions
add column if not exists image_storage_path text null unique;

alter table public.song_sessions
add column if not exists image_mime_type text null;

alter table public.song_sessions
add column if not exists selected_song_id uuid null references public.songs(id) on delete set null;

drop trigger if exists song_sessions_set_updated_at on public.song_sessions;
create trigger song_sessions_set_updated_at
before update on public.song_sessions
for each row
execute procedure public.set_updated_at();

create table if not exists public.song_variants (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.song_sessions(id) on delete cascade,
    variant_index integer not null check (variant_index >= 1),
    title text null,
    prompt text null,
    lyrics text null,
    composition_plan jsonb null,
    model_id text not null default 'music_v1',
    music_length_ms integer null check (music_length_ms between 3000 and 600000),
    force_instrumental boolean not null default false,
    respect_sections_durations boolean not null default false,
    status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
    storage_bucket text not null default 'generated-music',
    storage_path text null unique,
    mime_type text null,
    video_job_id text null,
    video_status text null check (video_status is null or video_status in ('queued', 'processing', 'completed', 'failed')),
    video_url text null,
    video_error text null,
    size_bytes bigint null check (size_bytes is null or size_bytes >= 0),
    error_message text null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists song_variants_session_variant_idx
on public.song_variants (session_id, variant_index);

create index if not exists song_variants_created_at_idx
on public.song_variants (created_at desc);

create index if not exists song_variants_session_id_idx
on public.song_variants (session_id);

alter table public.song_variants
add column if not exists video_job_id text null;

alter table public.song_variants
add column if not exists video_status text null;

alter table public.song_variants
add column if not exists video_url text null;

alter table public.song_variants
add column if not exists video_error text null;

drop trigger if exists song_variants_set_updated_at on public.song_variants;
create trigger song_variants_set_updated_at
before update on public.song_variants
for each row
execute procedure public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('generated-music', 'generated-music', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('generated-images', 'generated-images', false)
on conflict (id) do nothing;

alter table public.songs enable row level security;
alter table public.song_sessions enable row level security;
alter table public.song_variants enable row level security;

drop policy if exists "service_role_manage_songs" on public.songs;
create policy "service_role_manage_songs"
on public.songs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service_role_manage_song_sessions" on public.song_sessions;
create policy "service_role_manage_song_sessions"
on public.song_sessions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service_role_manage_song_variants" on public.song_variants;
create policy "service_role_manage_song_variants"
on public.song_variants
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
