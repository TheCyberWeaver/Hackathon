package com.example.backend;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CurrentUserController {
    public record CurrentUser(String id, String name) {}

    // Trust these headers only behind the managed proxy with access control enabled.
    // They identify the user; they do not grant student/professor permissions.
    @GetMapping("/api/me")
    public ResponseEntity<CurrentUser> currentUser(
        @RequestHeader(value = "X-User-Id", required = false) String id,
        @RequestHeader(value = "X-User-Name", required = false) String name
    ) {
        if (id == null || id.isBlank()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String displayName = id.trim();
        if (name != null && !name.isBlank()) {
            try {
                // Percent encoding is not form encoding: preserve literal plus signs.
                displayName = URLDecoder.decode(name.replace("+", "%2B"), StandardCharsets.UTF_8).trim();
                if (displayName.isBlank()) displayName = id.trim();
            } catch (IllegalArgumentException ignored) {
                displayName = id.trim();
            }
        }
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(new CurrentUser(id.trim(), displayName));
    }
}
