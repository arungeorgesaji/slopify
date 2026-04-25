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
    storage_path text null unique,
    image_storage_bucket text not null default 'generated-images',
    image_storage_path text null unique,
    mime_type text null,
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

insert into storage.buckets (id, name, public)
values ('generated-music', 'generated-music', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('generated-images', 'generated-images', false)
on conflict (id) do nothing;

alter table public.songs enable row level security;

drop policy if exists "service_role_manage_songs" on public.songs;
create policy "service_role_manage_songs"
on public.songs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
