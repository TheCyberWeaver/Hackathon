package com.example.backend;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.testing-permissions=false")
class SessionDeletionTests extends AccountApiTestSupport {
    @Test void completedSessionDeletionRemovesAllDependentsButPreservesCourseAndOtherSessions() throws Exception {
        var owner = account("professor");
        var student = account("student");
        var peer = account("student");
        send("POST", "/professor/profile/initialize", owner,
            "{\"onboardingCompleted\":true,\"courses\":[{\"id\":\"a\",\"title\":\"Algebra\"}]}", 200);
        var body = "{\"title\":\"Algebra session\",\"courseId\":\"a\",\"lectureTime\":\"2026-10-11T10:00:00Z\"}";
        var past = send("POST", "/lectures", owner, body, 201).get("id").asText();
        session(past, owner, "start", 200);
        join(past, student); join(past, peer);
        var question = submit(past, student, "What is the base case?");
        send("POST", "/questions/" + question + "/vote", peer, "{\"voted\":true}", 200);
        send("POST", "/questions/" + question + "/report", peer, null, 204);
        send("PATCH", "/questions/" + question + "/status", owner, "{\"status\":\"answered\"}", 200);
        var studentId = jdbc.queryForObject("SELECT id FROM users WHERE eth_identity_ref = ?", Long.class, student);
        jdbc.update("INSERT INTO question_moderation_warnings (lecture_id, user_id, reason) VALUES (?, ?, 'blacklisted_word')", Long.valueOf(past), studentId);
        session(past, owner, "end", 200);
        var kept = send("POST", "/lectures", owner, body, 201).get("id").asText();
        session(kept, owner, "start", 200);
        join(kept, student); join(kept, peer);
        var keptQuestion = submit(kept, peer, "What is the induction step?");
        session(kept, owner, "end", 200);
        var live = send("POST", "/lectures", owner, body, 201).get("id").asText();
        session(live, owner, "start", 200);
        join(live, student); join(live, peer);

        send("DELETE", "/lectures/" + past, owner, null, 204);
        for (var identity : List.of(owner, student, peer)) {
            send("GET", "/lectures/" + past, identity, null, 404);
            send("GET", "/lectures/" + past + "/questions", identity, null, 404);
            send("GET", "/lectures/" + past + "/questions/" + question, identity, null, 404);
            assertFalse(ids(send("GET", "/lectures", identity, null, 200)).contains(past));
        }
        for (var identity : List.of(student, peer)) {
            assertEquals(Set.of(kept, live), ids(send("GET", "/student/lectures/history", identity, null, 200)));
            assertEquals(live, send("GET", "/sessions/mine", identity, null, 200).get("session").get("id").asText());
        }
        for (var table : List.of("questions", "question_moderation_warnings", "lecture_history", "lecture_memberships"))
            assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE lecture_id = ?", Long.class, Long.valueOf(past)), table);
        for (var table : List.of("question_votes", "question_reports"))
            assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE question_id = ?", Long.class, Long.valueOf(question)), table);
        assertEquals(kept, send("GET", "/professor/lectures/archive", owner, null, 200).get(0).get("lecture").get("id").asText());
        assertEquals(1, send("GET", "/professor/lectures/archive", owner, null, 200).size());
        assertEquals("a", send("GET", "/professor/profile", owner, null, 200).get("courses").get(0).get("id").asText());
        send("GET", "/lectures/" + kept + "/questions/" + keptQuestion, student, null, 200);
        send("DELETE", "/lectures/" + past, owner, null, 404);
    }

    @Test void deletionRequiresOwnershipAndNeverAllowsScheduledOrLiveSessions() throws Exception {
        var owner = account("student"); // Management follows ownership, not the chosen UI role.
        var stranger = account("professor");
        var student = account("student");
        var lecture = create(owner);
        send("DELETE", "/lectures/" + lecture, null, null, 401);
        send("DELETE", "/lectures/" + lecture, stranger, null, 403);
        send("DELETE", "/lectures/" + lecture, owner, null, 409);
        session(lecture, owner, "start", 200);
        join(lecture, student);
        var question = submit(lecture, student, "Can you explain the proof?");
        send("DELETE", "/lectures/" + lecture, owner, null, 409);
        session(lecture, owner, "end", 200);
        send("DELETE", "/lectures/" + lecture, stranger, null, 403);
        send("DELETE", "/lectures/" + lecture, student, null, 403);
        send("GET", "/lectures/" + lecture + "/questions/" + question, owner, null, 200);
        assertEquals(Set.of(lecture), ids(send("GET", "/student/lectures/history", student, null, 200)));
        send("DELETE", "/lectures/" + lecture, owner, null, 204);
    }
}
