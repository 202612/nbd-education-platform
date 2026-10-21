-- Lets the hero's text block (logo/eyebrow/headline/subtitle together) be
-- dragged to any position on the landing page, not just centered.

alter table site_settings add column if not exists content_x numeric not null default 50;
alter table site_settings add column if not exists content_y numeric not null default 50;
