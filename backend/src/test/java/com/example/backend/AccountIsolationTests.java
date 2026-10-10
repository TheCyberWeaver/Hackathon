package com.example.backend;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.testing-permissions=false")
class AccountIsolationTests extends AccountApiTestSupport {
    @Test void everyStoredRoleManagesOnlyItsOwnLecturesAndCanParticipateInSharedLectures() throws Exception {
        String owner = account("student");
        String shared = create(owner);
        session(shared, owner, "start", 200);
        String sharedQuestion = submit(shared, owner, "Explain this shared example");
        var accounts = new LinkedHashMap<String, String>();

        for (String role : List.of("student", "professor", "admin")) {
            String identity = account(role);
            String own = create(identity);
            accounts.put(identity, own);
            assertTrue(send("GET", "/lectures/" + own, identity, null, 200).get("canManage").asBoolean());
            assertEquals(Set.of(own), ids(send("GET", "/lectures", identity, null, 200)));
            assertEquals(Set.of(), ids(send("GET", "/student/lectures/history", identity, null, 200)));
            // Shared-link lookup is available without exposing or adding all other lectures.
            assertFalse(send("GET", "/lectures/" + shared, identity, null, 200).get("canManage").asBoolean());
            assertEquals(Set.of(own), ids(send("GET", "/lectures", identity, null, 200)));
            var publicQuestion = send("GET", "/lectures/" + shared + "/questions/" + sharedQuestion, identity, null, 200);
            assertFalse(publicQuestion.has("authorId"));
            assertFalse(publicQuestion.has("reportCount"));
            assertFalse(publicQuestion.has("reports"));

            assertEquals(shared, join(shared, identity).get("id").asText());
            assertEquals(Set.of(own, shared), ids(send("GET", "/lectures", identity, null, 200)));
            String ownSharedQuestion = submit(shared, identity, "A question from " + role);
            send("POST", "/questions/" + sharedQuestion + "/vote", identity, "{\"voted\":true}", 200);
            send("POST", "/questions/" + sharedQuestion + "/report", identity, null, 204);
            send("GET", "/lectures/" + shared + "/professor/questions", identity, null, 403);
            send("PATCH", "/questions/" + sharedQuestion + "/status", identity, "{\"status\":\"answered\"}", 403);
            // Authorship permits deleting one's question, but never controls another lecture.
            send("PATCH", "/questions/" + ownSharedQuestion + "/status", identity, "{\"status\":\"answered\"}", 403);
            send("DELETE", "/questions/" + sharedQuestion, identity, null, 403);
            for (String action : List.of("start", "pause", "resume", "end")) session(shared, identity, action, 403);
            send("POST", "/lectures/" + shared + "/questions/clear-open", identity,
                "{\"questionIds\":[" + sharedQuestion + "," + ownSharedQuestion + "]}", 403);
            send("DELETE", "/questions/" + ownSharedQuestion, identity, null, 204);
            String ownerRemoves = submit(shared, identity, "The lecture owner may delete this");
            send("DELETE", "/questions/" + ownerRemoves, owner, null, 204);

            session(own, identity, "start", 200);
            String answered = submit(own, owner, "A question in your lecture");
            String cleared = submit(own, owner, "Clear this open question");
            send("POST", "/questions/" + answered + "/report", owner, null, 204);
            send("PATCH", "/questions/" + answered + "/status", identity, "{\"status\":\"answered\"}", 200);
            session(own, identity, "pause", 200);
            send("POST", "/lectures/" + own + "/questions/clear-open", identity,
                "{\"questionIds\":[" + cleared + "]}", 200);
            session(own, identity, "resume", 200);
            var privateQuestion = send("GET", "/lectures/" + own + "/professor/questions", identity, null, 200).get(0);
            assertEquals(owner, privateQuestion.get("authorId").asText());
            assertEquals(1, privateQuestion.get("reportCount").asInt());
            var summary = send("GET", "/professor/summary", identity, null, 200);
            assertEquals(1, summary.get("lectureCount").asInt());
            assertEquals(1, summary.get("answeredCount").asInt());
            assertEquals(0, summary.get("unansweredCount").asInt());
            session(own, identity, "end", 200);
            assertEquals(role, jdbc.queryForObject("SELECT role FROM users WHERE eth_identity_ref = ?", String.class, identity));
        }

        assertEquals(3, send("GET", "/lectures/" + shared + "/professor/questions", owner, null, 200).get(0).get("reportCount").asInt());
        session(shared, owner, "end", 200);
        for (var account : accounts.entrySet()) {
            var archive = send("GET", "/professor/lectures/archive", account.getKey(), null, 200);
            assertEquals(1, archive.size());
            assertEquals(account.getValue(), archive.get(0).get("lecture").get("id").asText());
            assertTrue(archive.get(0).get("lecture").get("canManage").asBoolean());
            assertEquals(1, archive.get(0).get("questions").size());
            assertEquals(Set.of(shared), ids(send("GET", "/student/lectures/history", account.getKey(), null, 200)));
        }
        assertEquals("student", jdbc.queryForObject("SELECT role FROM users WHERE eth_identity_ref = ?", String.class, owner));
    }

    @Test void profilesCoursesAndRevisionsArePrivateForEveryStoredRole() throws Exception {
        var profiles = new LinkedHashMap<String, tools.jackson.databind.JsonNode>();
        for (String role : List.of("student", "professor", "admin")) {
            String identity = account(role);
            String body = json.writeValueAsString(Map.of("onboardingCompleted", false, "revision", 0,
                "courses", List.of(Map.of("id", "same-course-id", "title", role + " course"))));
            var initial = send("POST", "/professor/profile/initialize", identity, body, 200);
            assertEquals(0, initial.get("revision").asInt());
            assertEquals(role + " course", initial.get("courses").get(0).get("title").asText());
            profiles.put(identity, initial);
        }
        String changedIdentity = profiles.keySet().iterator().next();
        var changed = send("PUT", "/professor/profile", changedIdentity,
            "{\"onboardingCompleted\":true,\"revision\":0,\"courses\":[]}", 200);
        assertEquals(1, changed.get("revision").asInt());
        profiles.put(changedIdentity, changed);
        for (var profile : profiles.entrySet()) {
            assertEquals(profile.getValue(), send("GET", "/professor/profile", profile.getKey(), null, 200));
            // Reinitializing from stale local data must retain the server's own courses.
            assertEquals(profile.getValue(), send("POST", "/professor/profile/initialize", profile.getKey(),
                "{\"onboardingCompleted\":true,\"revision\":0,\"courses\":[{\"id\":\"stale\",\"title\":\"Stale import\"}]}", 200));
        }
        send("GET", "/professor/profile", null, null, 401);
        send("POST", "/professor/profile/initialize", null, "{\"onboardingCompleted\":false,\"revision\":0,\"courses\":[]}", 401);
        send("PUT", "/professor/profile", null, "{\"onboardingCompleted\":true,\"revision\":0,\"courses\":[]}", 401);
    }
}
