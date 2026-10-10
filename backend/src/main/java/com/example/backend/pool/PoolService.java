package com.example.backend.pool;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.example.backend.pool.ApiModels.*;
import static com.example.backend.pool.PoolRepository.*;
import static org.springframework.http.HttpStatus.*;

@Service
public class PoolService {
    private final PoolRepository repository;
    private final QuestionModeration moderation;
    private final QuestionModerator moderator;
    private final boolean testingPermissions;
    public PoolService(PoolRepository repository, QuestionModeration moderation, QuestionModerator moderator,
                       @Value("${app.testing-permissions:false}") boolean testingPermissions) {
        this.repository = repository;
        this.moderation = moderation;
        this.moderator = moderator;
        this.testingPermissions = testingPermissions;
    }
    public User identify(String identity) {
        if (identity == null || identity.isBlank()) throw new ApiException(UNAUTHORIZED, "Missing signed-in identity.");
        if (identity.length() > 512) throw new ApiException(BAD_REQUEST, "Invalid identity.");
        return repository.user(identity.trim());
    }
    public List<Lecture> lectures(User user) {
        return repository.lectures(user).stream().map(lecture -> testingPermissions
            ? new Lecture(lecture.id(), lecture.title(), lecture.lectureTime(), true, lecture.course(), lecture.startedAt(), lecture.endedAt(), lecture.questionsPaused()) : lecture).toList();
    }
    public Lecture lecture(User user, long id) {
        return lectures(user).stream().filter(lecture -> lecture.id().equals(Long.toString(id)))
            .findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Lecture not found."));
    }
    @Transactional
    public Lecture createLecture(User user, NewLecture request) {
        requireProfessor(user);
        if (request == null || request.lectureTime() == null) throw new ApiException(BAD_REQUEST, "Lecture time is required.");
        var title = text(request.title(), 200, "Lecture title");
        var course = request.course() == null || request.course().isBlank() ? "" : text(request.course(), 200, "Course");
        var id = repository.createLecture(title, request.lectureTime(), user.id(), course);
        return lecture(user, id);
    }
    public List<Question> questions(User user, long lecture) {
        repository.lecture(lecture);
        return repository.questions(lecture, user.id());
    }
    public Question question(User user, long lecture, long id) {
        repository.lecture(lecture);
        return repository.question(lecture, id, user.id());
    }
    @Transactional(noRollbackFor = ModerationRejectedException.class)
    public Question submit(User user, long lecture, NewQuestion request) {
        if (!testingPermissions && !user.role().equals("student")) throw new ApiException(FORBIDDEN, "Only students may submit questions.");
        LectureSession.requireOpen(repository.lockLecture(lecture).session());
        var text = text(request == null ? null : request.text(), 200, "Question");
        boolean blacklisted = moderation.blocks(text);
        boolean rejectedByService = !blacklisted && !moderator.accepts(text);
        if (blacklisted || rejectedByService) {
            var reason = blacklisted ? "blacklisted_word" : "moderation_service";
            throw new ModerationRejectedException(
                repository.recordModerationWarning(lecture, user.id(), reason));
        }
        var id = repository.createQuestion(lecture, user.id(), text);
        return repository.question(lecture, id, user.id());
    }
    @Transactional
    public Question vote(User user, long id, Vote request) {
        if (!testingPermissions && !user.role().equals("student")) throw new ApiException(FORBIDDEN, "Only students may vote.");
        if (request == null || request.voted() == null) throw new ApiException(BAD_REQUEST, "Expected a voted boolean.");
        var question = repository.lockQuestion(id);
        if (question.authorId() == user.id()) throw new ApiException(FORBIDDEN, "You cannot vote on your own question.");
        repository.vote(id, user.id(), request.voted());
        return repository.question(question.lectureId(), id, user.id());
    }
    @Transactional
    public void report(User user, long id) {
        repository.lockQuestion(id);
        repository.report(id, user.id());
    }
    public List<ProfessorQuestion> professorQuestions(User user, long lecture) {
        return professorQuestions(user, lecture, false);
    }
    public List<ProfessorQuestion> professorQuestions(User user, long lecture, boolean includeDeleted) {
        requireManage(user, lecture);
        return repository.professorQuestions(lecture, user.id(), includeDeleted);
    }
    @Transactional
    public ProfessorQuestion status(User user, long id, Status request) {
        requireProfessor(user);
        if (request == null || request.status() == null || !List.of("open", "selected", "answered").contains(request.status()))
            throw new ApiException(BAD_REQUEST, "Status must be open, selected, or answered.");
        var question = repository.lockQuestion(id);
        requireManage(user, question.lectureId());
        String answer = request.answer() == null || request.answer().isBlank() ? null : text(request.answer(), 4000, "Answer");
        if (answer != null && !request.status().equals("answered")) throw new ApiException(BAD_REQUEST, "Written answers require answered status.");
        repository.status(id, request.status(), answer, request.answer() != null);
        return repository.professorQuestions(question.lectureId(), user.id()).stream().filter(q -> q.id().equals(Long.toString(id))).findFirst().orElseThrow();
    }
    @Transactional
    public void delete(User user, long id) {
        var question = repository.lockQuestion(id);
        if (question.authorId() != user.id()) requireManage(user, question.lectureId());
        repository.delete(id);
    }
    @Transactional
    public Lecture session(User user, long id, SessionAction request) {
        requireProfessor(user);
        var access = repository.lockLecture(id);
        requireManage(user, id);
        var next = LectureSession.transition(access.session(), request == null ? null : request.action(), java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC));
        repository.session(id, next);
        return lecture(user, id);
    }
    public Summary summary(User user) {
        requireProfessor(user);
        return repository.summary(user, testingPermissions || user.role().equals("admin"));
    }
    @Transactional(readOnly = true)
    public List<ArchivedLecture> archive(User user) {
        requireProfessor(user);
        return lectures(user).stream().filter(l -> l.canManage() && l.endedAt() != null)
            .map(l -> new ArchivedLecture(l, repository.professorQuestions(Long.parseLong(l.id()), user.id()))).toList();
    }
    @Transactional
    public ProfessorQuestion restore(User user, long id) {
        requireProfessor(user);
        var question = repository.lockQuestion(id, true);
        requireManage(user, question.lectureId());
        repository.restore(id);
        return repository.professorQuestions(question.lectureId(), user.id()).stream().filter(q -> q.id().equals(Long.toString(id))).findFirst().orElseThrow();
    }
    @Transactional
    public void purge(User user, long id) {
        requireProfessor(user);
        var question = repository.lockQuestion(id, true);
        requireManage(user, question.lectureId());
        if (question.deletedAt() == null) throw new ApiException(CONFLICT, "Move this question to Deleted before permanently deleting it.");
        repository.purge(id);
    }
    @Transactional
    public void emptyTrash(User user, long lecture) {
        requireProfessor(user);
        repository.lockLecture(lecture);
        requireManage(user, lecture);
        repository.lockTrash(lecture).forEach(repository::purge);
    }
    private void requireManage(User user, long lecture) {
        requireProfessor(user);
        var access = repository.lecture(lecture);
        if (!testingPermissions && !user.role().equals("admin") && !Long.valueOf(user.id()).equals(access.ownerId()))
            throw new ApiException(FORBIDDEN, "You do not manage this lecture.");
    }
    private void requireProfessor(User user) {
        if (!testingPermissions && !List.of("professor", "admin").contains(user.role())) throw new ApiException(FORBIDDEN, "Professor permission is required.");
    }
    private static String text(String value, int max, String label) {
        if (value == null || value.isBlank() || value.trim().length() > max)
            throw new ApiException(BAD_REQUEST, label + " must be 1 to " + max + " characters.");
        return value.trim();
    }
}
