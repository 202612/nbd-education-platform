-- Switches scheduled training from a single date to a start date + a
-- deadline, so "Overdue" means past the deadline specifically, not just
-- past whenever it was originally logged.

alter table training_schedule rename column scheduled_date to deadline_date;
alter table training_schedule add column if not exists start_date date;
update training_schedule set start_date = deadline_date where start_date is null;
alter table training_schedule alter column start_date set not null;
