ALTER TABLE question_moderation_warnings
    DROP CONSTRAINT question_moderation_warnings_reason_check;

ALTER TABLE question_moderation_warnings
    ADD CONSTRAINT question_moderation_warnings_reason_check
    CHECK (reason IN ('blacklisted_word', 'moderation_service'));
