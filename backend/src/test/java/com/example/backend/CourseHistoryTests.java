package com.example.backend;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.testing-permissions=false")
class CourseHistoryTests extends AccountApiTestSupport {
    String profile(String owner, long revision, String... idsAndTitles) throws Exception {
        var courses = new ArrayList<Map<String, String>>();
        for (int i = 0; i < idsAndTitles.length; i += 2) courses.add(Map.of("id", idsAndTitles[i], "title", idsAndTitles[i + 1]));
        return json.writeValueAsString(Map.of("revision", revision, "onboardingCompleted", true, "courses", courses));
    }
    JsonNode initialize(String owner, String... courses) throws Exception {
        return send("POST", "/professor/profile/initialize", owner, profile(owner, 0, courses), 200);
    }
    JsonNode createCourseSession(String owner, String course) throws Exception {
        return send("POST", "/lectures", owner, json.writeValueAsString(Map.of("title", "Saved session title", "course", "Client snapshot", "courseId", course, "lectureTime", "2026-10-10T10:00:00Z")), 201);
    }
    @Test void renameReorderArchiveAndSameNameRecreationKeepIdentityAndPersonalHistory() throws Exception {
        var owner = account("student");
        var peerOwner = account("professor");
        var learner = account("student");
        var peer = account("student");
        var firstProfile = initialize(owner, "a", "Algebra", "b", "Biology", "empty", "Empty course");
        initialize(peerOwner, "a", "Algebra");
        var first = createCourseSession(owner, "a");
        var key = first.get("courseKey").asText();
        var id = first.get("id").asText();
        assertEquals(firstProfile.get("courses").get(0).get("historyKey").asText(), key);
        assertNotEquals(key, createCourseSession(peerOwner, "a").get("courseKey").asText());
        session(id, owner, "start", 200);
        join(id, learner); join(id, peer);
        // Rename and reorder while the session runs. Saved session details stay intact.
        var saved = send("PUT", "/professor/profile", owner, profile(owner, 0, "b", "Biology", "a", "Renamed Algebra", "empty", "Empty course"), 200);
        assertEquals("b", saved.get("courses").get(0).get("id").asText());
        var renamed = send("GET", "/lectures/" + id, learner, null, 200);
        assertEquals("Renamed Algebra", renamed.get("courseName").asText());
        assertEquals("Algebra", renamed.get("course").asText());
        assertEquals("Saved session title", renamed.get("title").asText());
        assertEquals(key, renamed.get("courseKey").asText());
        // Remove the running course and the empty course, and introduce a new identity.
        send("PUT", "/professor/profile", owner, profile(owner, 1, "b", "Biology", "new-a", "Renamed Algebra"), 200);
        var replacement = createCourseSession(owner, "new-a");
        assertNotEquals(key, replacement.get("courseKey").asText());
        session(id, owner, "end", 200);
        var history = send("GET", "/student/lectures/history", learner, null, 200);
        assertEquals(Set.of(id), ids(history));
        assertTrue(history.get(0).get("courseArchived").asBoolean());
        assertEquals(key, history.get(0).get("courseKey").asText());
        assertEquals(1, send("GET", "/professor/lectures/archive", owner, null, 200).size());
        assertEquals(0, send("GET", "/professor/lectures/archive", peerOwner, null, 200).size());
        send("DELETE", "/student/lectures/history/" + id, learner, null, 204);
        // Resolving a parent and reading questions cannot restore removed attendance.
        send("GET", "/lectures/" + id, learner, null, 200);
        send("GET", "/lectures/" + id + "/questions", learner, null, 200);
        assertEquals(0, send("GET", "/student/lectures/history", learner, null, 200).size());
        assertEquals(Set.of(id), ids(send("GET", "/student/lectures/history", peer, null, 200)));
        // Conflict handling remains transactional, and an archived ID cannot be resurrected.
        send("PUT", "/professor/profile", owner, profile(owner, 1, "b", "Old revision"), 409);
        send("PUT", "/professor/profile", owner, profile(owner, 2, "a", "Reused identity"), 409);
        assertEquals(2, send("GET", "/professor/profile", owner, null, 200).get("revision").asInt());
        send("POST", "/lectures", owner, "{\"title\":\"bad\",\"lectureTime\":\"2026-10-10T10:00:00Z\",\"courseId\":\"a\"}", 400);
        send("POST", "/lectures", learner, "{\"title\":\"bad\",\"lectureTime\":\"2026-10-10T10:00:00Z\",\"courseId\":\"b\"}", 400);
    }
    @Test void aVisitDoesNotExposeUnvisitedSessionsAndLegacyLabelsDoNotInferIdentity() throws Exception {
        var owner = account("student"); var learner = account("student");
        initialize(owner, "a", "Algorithms");
        var visible = new HashSet<String>();
        for (int i = 0; i < 5; i++) {
            var id = createCourseSession(owner, "a").get("id").asText();
            session(id, owner, "start", 200);
            if (i < 2) { join(id, learner); visible.add(id); }
            session(id, owner, "end", 200);
        }
        assertEquals(visible, ids(send("GET", "/student/lectures/history", learner, null, 200)));
        var legacy = create(owner);
        assertTrue(send("GET", "/lectures/" + legacy, owner, null, 200).get("courseKey").isNull());
    }
}
