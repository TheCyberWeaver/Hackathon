package com.example.backend.pool;

import java.time.OffsetDateTime;
import static org.springframework.http.HttpStatus.*;

/** Session rules shared by lifecycle commands and submission validation. */
public final class LectureSession {
    private LectureSession() {}
    public record State(OffsetDateTime startedAt, OffsetDateTime endedAt, boolean paused) {}

    public static State transition(State current, String action, OffsetDateTime now) {
        if (action == null || !java.util.List.of("start", "pause", "resume", "end").contains(action))
            throw new ApiException(BAD_REQUEST, "Action must be start, pause, resume, or end.");
        if (action.equals("end") && current.endedAt() != null) return current;
        if (current.endedAt() != null) throw new ApiException(CONFLICT, "This lecture has ended.");
        if (action.equals("start"))
            return current.startedAt() == null ? new State(now, null, false) : current;
        if (current.startedAt() == null) throw new ApiException(CONFLICT, "Start the lecture first.");
        return switch (action) {
            case "pause" -> new State(current.startedAt(), null, true);
            case "resume" -> new State(current.startedAt(), null, false);
            default -> new State(current.startedAt(), now, false);
        };
    }

    public static void requireOpen(State state) {
        if (state.endedAt() != null) throw new ApiException(CONFLICT, "This lecture has ended.");
        if (state.startedAt() == null) throw new ApiException(CONFLICT, "This lecture has not started yet.");
        if (state.paused()) throw new ApiException(CONFLICT, "Question submissions are paused for this lecture.");
    }
}
