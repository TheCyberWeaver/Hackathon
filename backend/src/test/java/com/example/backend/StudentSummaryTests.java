package com.example.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.testing-permissions=false")
class StudentSummaryTests extends AccountApiTestSupport {
    @Test void countsOnlyTheCurrentAccountsRetainedQuestionsAcrossLectures() throws Exception {
        String student = account("student");
        String other = account("professor");
        String ownLecture = create(student);
        String otherLecture = create(other);
        session(ownLecture, student, "start", 200);
        session(otherLecture, other, "start", 200);

        assertSummary(student, 0, 0);
        assertSummary(other, 0, 0);
        String answered = submit(ownLecture, student, "Explain the first step");
        String selected = submit(otherLecture, student, "Explain the second step");
        String deleted = submit(otherLecture, student, "Explain the third step");
        submit(otherLecture, other, "An unrelated question");
        send("PATCH", "/questions/" + answered + "/status", student, "{\"status\":\"answered\"}", 200);
        send("PATCH", "/questions/" + selected + "/status", other, "{\"status\":\"selected\"}", 200);

        assertSummary(student, 3, 1);
        assertSummary(other, 1, 0);
        send("DELETE", "/student/lectures/history/" + ownLecture, student, null, 204);
        assertSummary(student, 3, 1);

        send("PATCH", "/questions/" + selected + "/status", other, "{\"status\":\"answered\"}", 200);
        assertSummary(student, 3, 2);
        send("PATCH", "/questions/" + answered + "/status", student, "{\"status\":\"open\"}", 200);
        send("DELETE", "/questions/" + deleted, student, null, 204);
        assertSummary(student, 2, 1);
        assertSummary(other, 1, 0);
        send("GET", "/student/summary", null, null, 401);
    }

    private void assertSummary(String identity, int submitted, int answered) throws Exception {
        JsonNode summary = send("GET", "/student/summary", identity, null, 200);
        assertEquals(submitted, summary.get("submittedCount").asInt());
        assertEquals(answered, summary.get("answeredCount").asInt());
    }
}
