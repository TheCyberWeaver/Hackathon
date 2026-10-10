package com.example.backend;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.testing-permissions=false")
class LectureHistoryTests extends AccountApiTestSupport {
    static final String HISTORY = "/student/lectures/history";

    @Test void visitsArePrivateIdempotentAndRetainTheFirstVisitTimestamp() throws Exception {
        String owner = account("professor");
        String visitor = account("student");
        String untouched = account("admin");
        String lecture = create(owner);
        assertEquals(Set.of(lecture), ids(send("GET", "/lectures", owner, null, 200)));
        assertEquals(Set.of(), ids(send("GET", HISTORY, owner, null, 200)));
        assertEquals(Set.of(), ids(send("GET", "/lectures", visitor, null, 200)));
        send("GET", "/lectures/" + lecture, visitor, null, 200);
        assertEquals(Set.of(), ids(send("GET", HISTORY, visitor, null, 200)));
        assertEquals(Set.of(), ids(send("GET", "/lectures", visitor, null, 200)));

        var visit = send("POST", "/lectures/" + lecture + "/visits", visitor, null, 200);
        assertEquals(lecture, visit.get("id").asText());
        assertFalse(visit.get("canManage").asBoolean());
        assertTrue(visit.get("startedAt").isNull());
        long userId = userId(visitor);
        OffsetDateTime first = OffsetDateTime.parse("2026-10-01T10:00:00Z");
        OffsetDateTime previousLast = first.plusDays(1);
        jdbc.update("UPDATE lecture_history SET first_visited_at = ?, last_visited_at = ? WHERE user_id = ? AND lecture_id = ?",
            first, previousLast, userId, Long.parseLong(lecture));
        var a = CompletableFuture.runAsync(() -> visitUnchecked(lecture, visitor));
        var b = CompletableFuture.runAsync(() -> visitUnchecked(lecture, visitor));
        CompletableFuture.allOf(a, b).get();
        assertEquals(first.toInstant(), jdbc.queryForObject("SELECT first_visited_at FROM lecture_history WHERE user_id = ? AND lecture_id = ?",
            OffsetDateTime.class, userId, Long.parseLong(lecture)).toInstant());
        assertTrue(jdbc.queryForObject("SELECT last_visited_at FROM lecture_history WHERE user_id = ? AND lecture_id = ?",
            OffsetDateTime.class, userId, Long.parseLong(lecture)).isAfter(previousLast));
        assertEquals(1L, jdbc.queryForObject("SELECT count(*) FROM lecture_history WHERE user_id = ?", Long.class, userId));
        assertEquals(Set.of(lecture), ids(send("GET", HISTORY, visitor, null, 200)));
        assertEquals(Set.of(lecture), ids(send("GET", "/lectures", visitor, null, 200)));
        assertEquals(Set.of(), ids(send("GET", HISTORY, untouched, null, 200)));
        assertEquals(Set.of(), ids(send("GET", "/lectures", untouched, null, 200)));
        assertTrue(send("POST", "/lectures/" + lecture + "/visits", owner, null, 200).get("canManage").asBoolean());
        assertEquals(Set.of(lecture), ids(send("GET", "/lectures", owner, null, 200)));

        send("GET", HISTORY, null, null, 401);
        send("POST", "/lectures/" + lecture + "/visits", null, null, 401);
        send("DELETE", HISTORY + "/" + lecture, null, null, 401);
        send("POST", "/lectures/9223372036854775807/visits", visitor, null, 404);
        send("DELETE", HISTORY + "/9223372036854775807", visitor, null, 204);
    }

    @Test void joiningAndSwitchingRoomsRecordsHistoryThatSurvivesLeavingAndEnding() throws Exception {
        String owner = account("student");
        String visitor = account("professor");
        String peer = account("admin");
        String first = create(owner);
        String second = create(owner);
        session(first, owner, "start", 200);
        session(second, owner, "start", 200);
        join(first, visitor);
        join(first, peer);
        join(second, visitor);
        assertEquals(Set.of(first, second), ids(send("GET", HISTORY, visitor, null, 200)));
        assertEquals(Set.of(first), ids(send("GET", HISTORY, peer, null, 200)));
        assertEquals(second, send("GET", "/sessions/mine", visitor, null, 200).get("session").get("id").asText());
        send("DELETE", "/sessions/mine", visitor, null, 204);
        assertTrue(send("GET", "/sessions/mine", visitor, null, 200).get("session").isNull());
        assertEquals(Set.of(first, second), ids(send("GET", HISTORY, visitor, null, 200)));
        session(first, owner, "end", 200);
        session(second, owner, "end", 200);
        assertTrue(send("GET", "/sessions/mine", peer, null, 200).get("session").isNull());
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM lecture_memberships WHERE lecture_id IN (?, ?)",
            Long.class, Long.parseLong(first), Long.parseLong(second)));
        var history = send("GET", HISTORY, visitor, null, 200);
        assertEquals(Set.of(first, second), ids(history));
        for (var lecture : history) {
            assertFalse(lecture.get("endedAt").isNull());
            assertFalse(lecture.get("canManage").asBoolean());
        }
        assertEquals(Set.of(first), ids(send("GET", HISTORY, peer, null, 200)));
        assertEquals(Set.of(), ids(send("GET", HISTORY, owner, null, 200)));
        send("POST", "/sessions/join", visitor, "{\"code\":\"" + first + "\"}", 404);
    }

    @Test void removingHistoryOnlyForgetsTheCallerAndAnEndedLectureCanBeRevisited() throws Exception {
        String owner = account("student");
        String visitor = account("admin");
        String peer = account("professor");
        String lecture = create(owner);
        session(lecture, owner, "start", 200);
        String question = submit(lecture, owner, "Keep the shared question and its state");
        join(lecture, visitor);
        join(lecture, peer);
        send("POST", "/questions/" + question + "/vote", visitor, "{\"voted\":true}", 200);
        send("POST", "/questions/" + question + "/report", visitor, null, 204);
        send("PATCH", "/questions/" + question + "/status", owner, "{\"status\":\"answered\"}", 200);

        send("DELETE", HISTORY + "/" + lecture, visitor, null, 204);
        send("DELETE", HISTORY + "/" + lecture, visitor, null, 204);
        assertEquals(Set.of(), ids(send("GET", HISTORY, visitor, null, 200)));
        assertEquals(Set.of(lecture), ids(send("GET", HISTORY, peer, null, 200)));
        // Active membership remains independently visible until the user leaves.
        assertEquals(lecture, send("GET", "/sessions/mine", visitor, null, 200).get("session").get("id").asText());
        assertEquals(Set.of(lecture), ids(send("GET", "/lectures", visitor, null, 200)));
        send("DELETE", "/sessions/mine", visitor, null, 204);
        assertEquals(Set.of(), ids(send("GET", "/lectures", visitor, null, 200)));
        var publicQuestion = send("GET", "/lectures/" + lecture + "/questions/" + question, visitor, null, 200);
        assertEquals("answered", publicQuestion.get("status").asText());
        assertEquals(1, publicQuestion.get("votes").asInt());
        assertTrue(publicQuestion.get("votedByMe").asBoolean());
        assertEquals(1, send("GET", "/lectures/" + lecture + "/professor/questions", owner, null, 200).get(0).get("reportCount").asInt());

        session(lecture, owner, "end", 200);
        var revisited = send("POST", "/lectures/" + lecture + "/visits", visitor, null, 200);
        assertEquals(lecture, revisited.get("id").asText());
        assertFalse(revisited.get("endedAt").isNull());
        assertFalse(revisited.get("canManage").asBoolean());
        assertEquals(Set.of(lecture), ids(send("GET", HISTORY, visitor, null, 200)));
        assertEquals(Set.of(lecture), ids(send("GET", HISTORY, peer, null, 200)));
        assertTrue(send("GET", "/sessions/mine", visitor, null, 200).get("session").isNull());
        assertEquals(1, send("GET", "/professor/lectures/archive", owner, null, 200).get(0).get("questions").size());
        assertEquals(0, send("GET", "/professor/lectures/archive", visitor, null, 200).size());
        assertEquals(0, send("GET", "/professor/summary", visitor, null, 200).get("lectureCount").asInt());
    }

    long userId(String identity) {
        return jdbc.queryForObject("SELECT id FROM users WHERE eth_identity_ref = ?", Long.class, identity);
    }
    void visitUnchecked(String lecture, String identity) {
        try { send("POST", "/lectures/" + lecture + "/visits", identity, null, 200); }
        catch (Exception error) { throw new RuntimeException(error); }
    }
}
