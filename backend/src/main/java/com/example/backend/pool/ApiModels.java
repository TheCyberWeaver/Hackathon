package com.example.backend.pool;

import java.time.OffsetDateTime;

// Wire models are deliberately independent of the database schema.
public final class ApiModels {
    private ApiModels() {}
    public record Lecture(String id, String title, OffsetDateTime lectureTime, boolean canManage,
                          String course, OffsetDateTime startedAt, OffsetDateTime endedAt, boolean questionsPaused) {}
    public record NewLecture(String title, OffsetDateTime lectureTime, String course) {}
    public record SessionAction(String action) {}
    public record JoinRequest(String code) {}
    public record SharedSession(String id, String code, String course, OffsetDateTime startedAt) {}
    public record JoinedSession(SharedSession session) {}
    public record Summary(long lectureCount, long unansweredCount, long answeredCount) {}
    public record ArchivedLecture(Lecture lecture, java.util.List<ProfessorQuestion> questions) {}
    public record NewQuestion(String text) {}
    public record Vote(Boolean voted) {}
    public record Status(String status, String answer) {}
    public record Question(String id, String text, long votes, OffsetDateTime createdAt,
                           String status, boolean mine, boolean votedByMe, String answer) {}
    public record ProfessorQuestion(String id, String text, String authorId, long upvoteCount,
                                    OffsetDateTime createdAt, boolean answered, String status,
                                    OffsetDateTime answeredAt, long reportCount, OffsetDateTime deletedAt, String answer) {}
}
