-- Mirrors the existing cert_name_x/y/font_size/color columns so the
-- completion date can also be auto-printed on a certificate, the same way
-- the learner's name already is. Left null by default — only brands where
-- an admin explicitly turns this on (and places the date marker) show it;
-- every existing certificate keeps behaving exactly as it does today.

alter table brand_steps add column if not exists cert_date_x numeric;
alter table brand_steps add column if not exists cert_date_y numeric;
alter table brand_steps add column if not exists cert_date_font_size numeric;
alter table brand_steps add column if not exists cert_date_color text;
