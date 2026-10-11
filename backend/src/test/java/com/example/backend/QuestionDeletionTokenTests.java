package com.example.backend;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class QuestionDeletionTokenTests extends AccountApiTestSupport {
    @Test void creationStoresOnlyDistinctMatchingHashesAndDeletionRequiresTheAccountToken() throws Exception {
        String owner = account("professor");
        String author = account("student");
        String lecture = create(owner);
        session(lecture, owner, "start", 200);
        String path = "/lectures/" + lecture + "/questions";
        send("POST", path, null, "{\"text\":\"Unauthenticated\"}", 401);
        String first = submit(lecture, author, "First private question");
        String second = submit(lecture, author, "Second private question");
        var created = send("GET", path + "/" + first, author, null, 200);
        assertFalse(created.has("deletionToken"));
        assertFalse(created.has("deletionTokenHash"));
        assertFalse(created.has("tokenHash"));
        assertEquals(2, jdbc.queryForObject("""
            SELECT count(*) FROM questions q JOIN question_deletion_tokens t
              ON t.question_id = q.id AND t.token_hash = q.deletion_token_hash
            WHERE q.id IN (?, ?) AND t.user_id =
              (SELECT id FROM users WHERE eth_identity_ref = ?)
              AND octet_length(q.deletion_token_hash) = 32
            """, Integer.class, Long.parseLong(first), Long.parseLong(second), author));
        assertTrue(jdbc.queryForObject("""
            SELECT a.deletion_token_hash <> b.deletion_token_hash
            FROM questions a CROSS JOIN questions b WHERE a.id = ? AND b.id = ?
            """, Boolean.class, Long.parseLong(first), Long.parseLong(second)));
        send("DELETE", "/questions/" + first, null, null, 401);
        var ownerDenied = send("DELETE", "/questions/" + first, owner, null, 404);
        var strangerDenied = send("DELETE", "/questions/9223372036854775807", owner, null, 404);
        assertEquals(ownerDenied.get("error").asText(), strangerDenied.get("error").asText());
        send("DELETE", "/questions/" + first, author, null, 204);
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM question_deletion_tokens WHERE question_id = ?", Integer.class, Long.parseLong(first)));
        send("DELETE", "/questions/" + first, author, null, 404);
        send("GET", path + "/" + second, author, null, 200);
    }

    @Test void tokenMismatchAndBulkClearRollBackWithoutDeletingAnyQuestion() throws Exception {
        String owner = account("professor");
        String student = account("student");
        String lecture = create(owner);
        session(lecture, owner, "start", 200);
        String own = submit(lecture, owner, "Owner question");
        String other = submit(lecture, student, "Student question");
        String clear = "/lectures/" + lecture + "/questions/clear-open";
        String both = json.writeValueAsString(Map.of("questionIds", new long[]{Long.parseLong(own), Long.parseLong(other)}));
        send("POST", clear, null, both, 401);
        send("POST", clear, owner, both, 404);
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM questions WHERE id IN (?, ?)", Integer.class, Long.parseLong(own), Long.parseLong(other)));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM question_deletion_tokens WHERE question_id IN (?, ?)", Integer.class, Long.parseLong(own), Long.parseLong(other)));
        var cleared = send("POST", clear, owner, json.writeValueAsString(Map.of("questionIds", new long[]{Long.parseLong(own)})), 200);
        assertEquals(own, cleared.get("deletedIds").get(0).asText());
        send("GET", "/lectures/" + lecture + "/questions/" + other, student, null, 200);
        jdbc.update("DELETE FROM question_deletion_tokens WHERE question_id = ?", Long.parseLong(other));
        send("DELETE", "/questions/" + other, student, null, 404);
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM questions WHERE id = ?", Integer.class, Long.parseLong(other)));
        jdbc.update("DELETE FROM questions WHERE id = ?", Long.parseLong(other));
    }

    @Test void failedTokenInsertRollsBackQuestionCreation() throws Exception {
        String owner = account("professor");
        String author = account("student");
        String lecture = create(owner);
        session(lecture, owner, "start", 200);
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String function = "fail_token_insert_" + suffix;
        String trigger = "fail_token_insert_" + suffix;
        jdbc.execute("CREATE FUNCTION " + function + "() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT text FROM questions WHERE id = NEW.question_id) = 'Fail token insert' THEN RAISE EXCEPTION 'forced token insert failure'; END IF; RETURN NEW; END $$");
        jdbc.execute("CREATE TRIGGER " + trigger + " BEFORE INSERT ON question_deletion_tokens FOR EACH ROW EXECUTE FUNCTION " + function + "()");
        try {
            send("POST", "/lectures/" + lecture + "/questions", author, "{\"text\":\"Fail token insert\"}", 500);
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM questions WHERE text = 'Fail token insert'", Integer.class));
        } finally {
            jdbc.execute("DROP TRIGGER " + trigger + " ON question_deletion_tokens");
            jdbc.execute("DROP FUNCTION " + function + "()");
        }
    }

    @Test void failedQuestionDeleteRestoresItsTokenAndConcurrentRetryCannotReuseIt() throws Exception {
        String owner = account("professor");
        String author = account("student");
        String lecture = create(owner);
        session(lecture, owner, "start", 200);
        String id = submit(lecture, author, "Rollback deletion");
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String function = "fail_question_delete_" + suffix;
        String trigger = "fail_question_delete_" + suffix;
        jdbc.execute("CREATE FUNCTION " + function + "() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id = " + id + " THEN RAISE EXCEPTION 'forced question delete failure'; END IF; RETURN OLD; END $$");
        jdbc.execute("CREATE TRIGGER " + trigger + " BEFORE DELETE ON questions FOR EACH ROW EXECUTE FUNCTION " + function + "()");
        try {
            send("DELETE", "/questions/" + id, author, null, 500);
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM questions WHERE id = ?", Integer.class, Long.parseLong(id)));
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM question_deletion_tokens WHERE question_id = ?", Integer.class, Long.parseLong(id)));
        } finally {
            jdbc.execute("DROP TRIGGER " + trigger + " ON questions");
            jdbc.execute("DROP FUNCTION " + function + "()");
        }
        var first = CompletableFuture.supplyAsync(() -> deleteStatus(id, author));
        var second = CompletableFuture.supplyAsync(() -> deleteStatus(id, author));
        assertEquals(java.util.Set.of(204, 404), java.util.Set.of(first.get(), second.get()));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM question_deletion_tokens WHERE question_id = ?", Integer.class, Long.parseLong(id)));
    }

    private int deleteStatus(String id, String identity) {
        try {
            var request = java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://localhost:" + port + "/api/questions/" + id))
                .header("X-User-Id", identity).DELETE().build();
            return client.send(request, java.net.http.HttpResponse.BodyHandlers.discarding()).statusCode();
        } catch (Exception error) {
            throw new RuntimeException(error);
        }
    }
}
