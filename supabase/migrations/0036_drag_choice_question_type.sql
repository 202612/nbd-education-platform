-- A simpler drag-and-drop format: one question in a speech bubble, a
-- handful of answer options, drag a line from the bubble to the right one.
-- Reuses the exact same options/correct_index columns multiple_choice
-- already uses — grading and get_quiz_questions() both fall through their
-- existing "any other type" branch unchanged, so only the allowed-type
-- list needs updating.

alter table quiz_questions drop constraint if exists quiz_questions_type_check;
alter table quiz_questions add constraint quiz_questions_type_check
  check (type in ('multiple_choice', 'true_false', 'sequence', 'match_pairs', 'categorize', 'numeric', 'drag_choice'));
