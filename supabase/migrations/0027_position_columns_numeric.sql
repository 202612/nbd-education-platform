-- Dragging the background/logo directly on the stage produces decimal
-- percentages (e.g. 50.46), but these columns were still integer from
-- when they were only ever set by whole-number sliders.

alter table site_settings alter column logo_position_x type numeric using logo_position_x::numeric;
alter table site_settings alter column logo_position_y type numeric using logo_position_y::numeric;
alter table site_settings alter column background_position_x type numeric using background_position_x::numeric;
alter table site_settings alter column background_position_y type numeric using background_position_y::numeric;
