-- Lets an admin control the size of the eyebrow/headline/subtitle text on
-- the landing page hero from Admin -> Design, instead of it being a fixed
-- size in the code.

alter table site_settings add column if not exists eyebrow_size int not null default 15;
alter table site_settings add column if not exists headline_size int not null default 42;
alter table site_settings add column if not exists subtitle_size int not null default 15;
