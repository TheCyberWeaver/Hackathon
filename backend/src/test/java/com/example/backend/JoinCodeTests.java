package com.example.backend;

import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.testing-permissions=false")
class JoinCodeTests extends AccountApiTestSupport {
    @Test void invitationsUseStableHexCodesAndResolveToNumericLectureIds() throws Exception {
        String owner = account("professor");
        String student = account("student");
        String lecture = create(owner);
        String code = joinCode(lecture);
        assertTrue(code.matches("[0-9A-F]{6}"));
        assertEquals(code, send("GET", "/lectures/" + lecture, owner, null, 200).get("joinCode").asText());
        assertEquals(code, session(lecture, owner, "start", 200).get("joinCode").asText());

        var joined = send("POST", "/sessions/join", student,
            json.writeValueAsString(Map.of("code", " " + code.toLowerCase(Locale.ROOT) + " ")), 200);
        assertEquals(lecture, joined.get("id").asText());
        assertEquals(code, joined.get("code").asText());
        assertEquals(code, send("GET", "/sessions/mine", student, null, 200).get("session").get("code").asText());

        session(lecture, owner, "end", 200);
        send("POST", "/sessions/join", student, json.writeValueAsString(Map.of("code", code)), 404);
        var visited = send("POST", "/lectures/by-code/" + code.toLowerCase(Locale.ROOT) + "/visits", student, null, 200);
        assertEquals(lecture, visited.get("id").asText());
        assertEquals(code, visited.get("joinCode").asText());
        assertTrue(send("GET", "/sessions/mine", student, null, 200).get("session").isNull());
        assertTrue(ids(send("GET", "/student/lectures/history", student, null, 200)).contains(lecture));
    }

    @Test void leadingZeroesAndAllNumericHexCodesAreLookedUpAsStrings() throws Exception {
        String owner = account("professor");
        String student = account("student");
        for (String code : new String[]{"00AB12", "123456"}) {
            String lecture = create(owner);
            jdbc.update("UPDATE lectures SET join_code = ? WHERE id = ?", code, Long.parseLong(lecture));
            session(lecture, owner, "start", 200);
            var joined = send("POST", "/sessions/join", student, json.writeValueAsString(Map.of("code", code.toLowerCase(Locale.ROOT))), 200);
            assertEquals(lecture, joined.get("id").asText());
            assertEquals(code, joined.get("code").asText());
            session(lecture, owner, "end", 200);
        }
    }

    @Test void malformedAndUnknownCodesDoNotChangeMembership() throws Exception {
        String owner = account("professor");
        String student = account("student");
        String lecture = create(owner);
        session(lecture, owner, "start", 200);
        join(lecture, student);
        for (String code : new String[]{"", "1", "ABCDE", "ABCDEF0", "ABCDEF01", "AB12G4", "0xAB12", "１２３４５６"}) {
            send("POST", "/sessions/join", student, json.writeValueAsString(Map.of("code", code)), 400);
        }
        String missing = "FFFFFF";
        while (jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM lectures WHERE join_code = ?)", Boolean.class, missing))
            missing = String.format("%06X", Integer.parseInt(missing, 16) - 1);
        send("POST", "/sessions/join", student, json.writeValueAsString(Map.of("code", missing)), 404);
        send("POST", "/lectures/by-code/" + missing + "/visits", student, null, 404);
        assertEquals(lecture, send("GET", "/sessions/mine", student, null, 200).get("session").get("id").asText());
    }
}
