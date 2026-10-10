package com.example.backend.pool;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.http.HttpStatus.*;

class LectureSessionTests {
    final OffsetDateTime first = OffsetDateTime.parse("2026-10-10T10:00:00Z");
    final OffsetDateTime later = first.plusHours(1);
    final LectureSession.State scheduled = new LectureSession.State(null, null, false);

    @Test void startIsIdempotentAndDoesNotResumeAPausedSession() {
        var running = LectureSession.transition(scheduled, "start", first);
        assertEquals(first, running.startedAt());
        assertSame(running, LectureSession.transition(running, "start", later));
        var paused = LectureSession.transition(running, "pause", later);
        assertSame(paused, LectureSession.transition(paused, "start", later));
        assertTrue(paused.paused());
    }
    @Test void pauseAndResumeKeepTheOriginalStartTime() {
        var running = new LectureSession.State(first, null, false);
        var paused = LectureSession.transition(running, "pause", later);
        assertEquals(new LectureSession.State(first, null, true), paused);
        assertEquals(paused, LectureSession.transition(paused, "pause", later));
        assertEquals(running, LectureSession.transition(paused, "resume", later));
        assertEquals(running, LectureSession.transition(running, "resume", later));
    }
    @Test void endingIsIdempotentAndCannotBeReopened() {
        var ended = LectureSession.transition(new LectureSession.State(first, null, true), "end", later);
        assertEquals(new LectureSession.State(first, later, false), ended);
        assertSame(ended, LectureSession.transition(ended, "end", later.plusHours(1)));
        for (String action : new String[]{"start", "pause", "resume"})
            assertEquals(CONFLICT, assertThrows(ApiException.class, () -> LectureSession.transition(ended, action, later)).status);
    }
    @Test void scheduledLecturesRequireStartAndUnknownCommandsAreRejected() {
        for (String action : new String[]{"pause", "resume", "end"})
            assertEquals(CONFLICT, assertThrows(ApiException.class, () -> LectureSession.transition(scheduled, action, first)).status);
        for (String action : new String[]{null, "", "restart", "START"})
            assertEquals(BAD_REQUEST, assertThrows(ApiException.class, () -> LectureSession.transition(scheduled, action, first)).status);
    }
    @Test void onlyRunningUnpausedLecturesAcceptQuestions() {
        assertDoesNotThrow(() -> LectureSession.requireOpen(new LectureSession.State(first, null, false)));
        for (var state : new LectureSession.State[]{scheduled, new LectureSession.State(first, null, true), new LectureSession.State(first, later, false)})
            assertEquals(CONFLICT, assertThrows(ApiException.class, () -> LectureSession.requireOpen(state)).status);
    }
}
