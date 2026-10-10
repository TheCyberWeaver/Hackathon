package com.example.backend.pool;

import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import static com.example.backend.pool.ApiModels.*;

@RestController
@RequestMapping("/api")
public class PoolController {
    private final PoolService service;
    public PoolController(PoolService service) { this.service = service; }
    @ModelAttribute
    public void noStore(jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
    }

    @GetMapping("/lectures")
    public List<Lecture> lectures(@RequestHeader(value = "X-User-Id", required = false) String identity) {
        return service.lectures(service.identify(identity));
    }
    @PostMapping("/lectures")
    public ResponseEntity<Lecture> createLecture(@RequestHeader(value = "X-User-Id", required = false) String identity, @RequestBody NewLecture body) {
        var lecture = service.createLecture(service.identify(identity), body);
        return ResponseEntity.created(URI.create("/api/lectures/" + lecture.id())).body(lecture);
    }
    @GetMapping("/lectures/{lecture}")
    public Lecture lecture(@RequestHeader(value = "X-User-Id", required = false) String identity, @PathVariable long lecture) {
        return service.lecture(service.identify(identity), lecture);
    }
    @PostMapping("/sessions/join")
    public SharedSession join(@RequestHeader(value = "X-User-Id", required = false) String identity, @RequestBody JoinRequest body) {
        return service.join(service.identify(identity), body);
    }
    @GetMapping("/sessions/mine")
    public JoinedSession joined(@RequestHeader(value = "X-User-Id", required = false) String identity) {
        return service.joined(service.identify(identity));
    }
    @DeleteMapping("/sessions/mine")
    public ResponseEntity<Void> leave(@RequestHeader(value = "X-User-Id", required = false) String identity) {
        service.leave(service.identify(identity));
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/lectures/{lecture}/questions")
    public List<Question> questions(@RequestHeader(value = "X-User-Id", required = false) String identity, @PathVariable long lecture) {
        return service.questions(service.identify(identity), lecture);
    }
    @PostMapping("/lectures/{lecture}/questions")
    public ResponseEntity<Question> submit(@RequestHeader(value = "X-User-Id", required = false) String identity,
                                          @PathVariable long lecture, @RequestBody NewQuestion body) {
        var question = service.submit(service.identify(identity), lecture, body);
        return ResponseEntity.created(URI.create("/api/lectures/" + lecture + "/questions/" + question.id())).body(question);
    }
    @GetMapping("/lectures/{lecture}/questions/{id}")
    public Question question(@RequestHeader(value = "X-User-Id", required = false) String identity, @PathVariable long lecture, @PathVariable long id) {
        return service.question(service.identify(identity), lecture, id);
    }
    @PostMapping("/questions/{id}/vote")
    public Question vote(@RequestHeader(value = "X-User-Id", required = false) String identity, @PathVariable long id, @RequestBody Vote body) {
        return service.vote(service.identify(identity), id, body);
    }
    @PostMapping("/questions/{id}/report")
    public ResponseEntity<Void> report(@RequestHeader(value = "X-User-Id", required = false) String identity, @PathVariable long id) {
        service.report(service.identify(identity), id);
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/lectures/{lecture}/professor/questions")
    public List<ProfessorQuestion> professorQuestions(@RequestHeader(value = "X-User-Id", required = false) String identity, @PathVariable long lecture) {
        return service.professorQuestions(service.identify(identity), lecture);
    }
    @PatchMapping("/questions/{id}/status")
    public ProfessorQuestion status(@RequestHeader(value = "X-User-Id", required = false) String identity, @PathVariable long id, @RequestBody Status body) {
        return service.status(service.identify(identity), id, body);
    }
    @DeleteMapping("/questions/{id}")
    public ResponseEntity<Void> delete(@RequestHeader(value = "X-User-Id", required = false) String identity, @PathVariable long id) {
        service.delete(service.identify(identity), id);
        return ResponseEntity.noContent().build();
    }
    @PatchMapping("/lectures/{lecture}/session")
    public Lecture session(@RequestHeader(value = "X-User-Id", required = false) String identity, @PathVariable long lecture, @RequestBody SessionAction body) {
        return service.session(service.identify(identity), lecture, body);
    }
    @GetMapping("/professor/summary")
    public Summary summary(@RequestHeader(value = "X-User-Id", required = false) String identity) { return service.summary(service.identify(identity)); }
    @GetMapping("/professor/lectures/archive")
    public List<ArchivedLecture> archive(@RequestHeader(value = "X-User-Id", required = false) String identity) { return service.archive(service.identify(identity)); }
    @PostMapping("/lectures/{lecture}/questions/clear-open")
    public ClearedQuestions clearOpen(@RequestHeader(value = "X-User-Id", required = false) String identity,
                                     @PathVariable long lecture, @RequestBody ClearQuestions body) {
        return service.clearOpen(service.identify(identity), lecture, body);
    }
}
