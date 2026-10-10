package com.example.backend.pool;

import static org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY;

public class ModerationRejectedException extends ApiException {
    private final long warningCount;

    public ModerationRejectedException(long warningCount) {
        super(UNPROCESSABLE_ENTITY, "Question not sent. It contains wording that is not allowed. Edit it and try again.");
        this.warningCount = warningCount;
    }

    public long warningCount() { return warningCount; }
}
