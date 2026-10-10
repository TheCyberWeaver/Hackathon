package com.example.backend.pool;

import org.springframework.web.bind.annotation.*;
import static com.example.backend.pool.ApiModels.*;

@RestController
@RequestMapping("/api/professor/profile")
public class ProfessorProfileController {
    private final PoolService pool;
    private final ProfessorProfileService profiles;
    public ProfessorProfileController(PoolService pool, ProfessorProfileService profiles) {
        this.pool = pool;
        this.profiles = profiles;
    }
    @ModelAttribute public void noStore(jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
    }
    @GetMapping public ProfessorProfile get(@RequestHeader(value = "X-User-Id", required = false) String identity) {
        return profiles.get(pool.identify(identity));
    }
    @PostMapping("/initialize") public ProfessorProfile initialize(@RequestHeader(value = "X-User-Id", required = false) String identity, @RequestBody ProfileUpdate body) {
        return profiles.initialize(pool.identify(identity), body);
    }
    @PutMapping public ProfessorProfile save(@RequestHeader(value = "X-User-Id", required = false) String identity, @RequestBody ProfileUpdate body) {
        return profiles.save(pool.identify(identity), body);
    }
}
