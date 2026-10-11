package com.example.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.testing-permissions=false")
class SessionStatsTests extends AccountApiTestSupport {
    @Test void countsUniqueJoinedStudentsNotOwnerOrHistoryAndTracksLeavingAndSwitching() throws Exception {
        String owner = account("professor");
        String student = account("student");
        // Modes are interchangeable; a professor account can attend someone else's lecture.
        String peer = account("professor");
        String visitor = account("student");
        String first = create(owner);
        String second = create(owner);
        assertCount(first, owner, 0);
        session(first, owner, "start", 200);
        session(second, owner, "start", 200);
        send("POST", "/lectures/" + first + "/visits", visitor, null, 200);
        submit(first, visitor, "A question alone is not a joined session");
        join(first, owner);
        assertCount(first, owner, 0);
        join(first, student);
        join(first, student);
        assertCount(first, owner, 1);
        join(first, peer);
        assertCount(first, owner, 2);
        assertCount(second, owner, 0);
        join(second, student);
        assertCount(first, owner, 1);
        assertCount(second, owner, 1);
        send("DELETE", "/sessions/mine", peer, null, 204);
        assertCount(first, owner, 0);
        // A past visit survives leaving, but must not inflate the live count.
        assertTrue(ids(send("GET", "/student/lectures/history", peer, null, 200)).contains(first));
        send("DELETE", "/sessions/mine", student, null, 204);
        assertCount(second, owner, 0);
    }

    @Test void pausingRetainsStudentsAndStartTimeWhileEndingClearsMemberships() throws Exception {
        String owner = account("student");
        String student = account("student");
        String lecture = create(owner);
        var started = session(lecture, owner, "start", 200).get("startedAt");
        join(lecture, student);
        assertEquals(started, session(lecture, owner, "pause", 200).get("startedAt"));
        assertCount(lecture, owner, 1);
        assertEquals(started, session(lecture, owner, "resume", 200).get("startedAt"));
        assertCount(lecture, owner, 1);
        session(lecture, owner, "end", 200);
        assertCount(lecture, owner, 0);
    }

    @Test void statisticsRequireAuthenticationAndLectureOwnership() throws Exception {
        String owner = account("student");
        String outsider = account("professor");
        String lecture = create(owner);
        session(lecture, owner, "start", 200);
        join(lecture, outsider);
        send("GET", statsPath(lecture), null, null, 401);
        send("GET", statsPath(lecture), outsider, null, 403);
        send("GET", statsPath("9223372036854775807"), owner, null, 404);
        assertCount(lecture, owner, 1);
    }

    private String statsPath(String lecture) {
        return "/lectures/" + lecture + "/professor/session-stats";
    }
    private void assertCount(String lecture, String owner, long expected) throws Exception {
        assertEquals(expected, send("GET", statsPath(lecture), owner, null, 200).get("studentCount").asLong());
    }
}
