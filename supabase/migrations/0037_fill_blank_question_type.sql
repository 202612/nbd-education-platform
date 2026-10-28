-- Fill in the blank (drag the correct word into the sentence). Same
-- options/correct_index shape as multiple_choice and drag_choice, so
-- grading and get_quiz_questions() both already handle it via their
-- existing "any other type" branch — only the allowed-type list changes.

alter table quiz_questions drop constraint if exists quiz_questions_type_check;
alter table quiz_questions add constraint quiz_questions_type_check
  check (type in ('multiple_choice', 'true_false', 'sequence', 'match_pairs', 'categorize', 'numeric', 'drag_choice', 'fill_blank'));
