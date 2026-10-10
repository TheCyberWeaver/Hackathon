package com.example.backend.pool;

import java.time.OffsetDateTime;

// Wire models are deliberately independent of the database schema.
public final class ApiModels {
    private ApiModels() {}
    public record Lecture(String id, String title, OffsetDateTime lectureTime, boolean canManage) {}
    public record NewLecture(String title, OffsetDateTime lectureTime) {}
    public record NewQuestion(String text) {}
    public record Vote(Boolean voted) {}
    public record Status(String status) {}
    public record Question(String id, String text, long votes, OffsetDateTime createdAt,
                           String status, boolean mine, boolean votedByMe) {}
    public record ProfessorQuestion(String id, String text, String authorId, long upvoteCount,
                                    OffsetDateTime createdAt, boolean answered, String status,
                                    OffsetDateTime answeredAt, long reportCount) {}
}
