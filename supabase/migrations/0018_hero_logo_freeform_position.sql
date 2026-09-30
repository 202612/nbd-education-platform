-- Switches brand hero-logo placement from a coarse left/right + offset model
-- to freeform x/y percentage coordinates, so the admin Design tab can offer
-- an actual drag-and-drop preview instead of sliders with numbers.

alter table brands add column if not exists hero_x numeric not null default 50;
alter table brands add column if not exists hero_y numeric not null default 50;

update brands set hero_x = 20 where hero_side = 'left' and hero_x = 50;
update brands set hero_x = 80 where hero_side = 'right' and hero_x = 50;
