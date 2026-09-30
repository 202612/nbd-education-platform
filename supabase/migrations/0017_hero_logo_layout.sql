-- Lets an admin control how each brand's logo is laid out on the landing page
-- hero (which side it sits on, how big it is, its vertical offset, and its
-- order within that side) instead of it being hardcoded in the frontend.

alter table brands add column if not exists hero_visible boolean not null default true;
alter table brands add column if not exists hero_side text not null default 'left' check (hero_side in ('left', 'right'));
alter table brands add column if not exists hero_size int not null default 44;
alter table brands add column if not exists hero_offset_y int not null default 0;
alter table brands add column if not exists hero_order int not null default 0;
