package com.example.backend.pool;

import java.util.List;
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
    public PoolService(PoolRepository repository, QuestionModeration moderation, QuestionModerator moderator) {
        this.repository = repository;
        this.moderation = moderation;
        this.moderator = moderator;
    }
    public User identify(String identity) {
        if (identity == null || identity.isBlank()) throw new ApiException(UNAUTHORIZED, "Missing signed-in identity.");
        if (identity.length() > 512) throw new ApiException(BAD_REQUEST, "Invalid identity.");
        return repository.user(identity.trim());
    }
    public List<Lecture> lectures(User user) {
        return repository.lectures(user);
    }
    public Lecture lecture(User user, long id) {
        return repository.lecture(user, id);
    }
    @Transactional
    public Lecture createLecture(User user, NewLecture request) {
        if (request == null || request.lectureTime() == null) throw new ApiException(BAD_REQUEST, "Lecture time is required.");
        var title = text(request.title(), 200, "Lecture title");
        var course = request.course() == null || request.course().isBlank() ? "" : text(request.course(), 200, "Course");
        var id = repository.createLecture(title, request.lectureTime(), user.id(), course);
        return lecture(user, id);
    }
    @Transactional
    public SharedSession join(User user, JoinRequest request) {
        var code = request == null ? null : request.code();
        if (code == null || !code.matches("[1-9][0-9]{0,18}"))
            throw new ApiException(BAD_REQUEST, "Enter a valid numeric lecture ID.");
        final long id;
        try { id = Long.parseLong(code); }
        catch (NumberFormatException error) { throw new ApiException(BAD_REQUEST, "Enter a valid numeric lecture ID."); }
        var access = repository.lockLecture(id);
        if (access.session().startedAt() == null || access.session().endedAt() != null)
            throw new ApiException(NOT_FOUND, "This lecture ID is invalid or the lecture has ended.");
        repository.joinSession(user.id(), id);
        repository.recordVisit(user.id(), id);
        return repository.joinedSession(user.id());
    }
    public JoinedSession joined(User user) {
        return new JoinedSession(repository.joinedSession(user.id()));
    }
    @Transactional
    public void leave(User user) {
        repository.leaveSession(user.id());
    }
    public List<Lecture> history(User user) {
        return repository.history(user);
    }
    @Transactional
    public Lecture visit(User user, long id) {
        var lecture = repository.lecture(user, id);
        repository.recordVisit(user.id(), id);
        return lecture;
    }
    @Transactional
    public void forget(User user, long id) {
        repository.forgetVisit(user.id(), id);
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
        repository.recordVisit(user.id(), lecture);
        return repository.question(lecture, id, user.id());
    }
    @Transactional
    public Question vote(User user, long id, Vote request) {
        if (request == null || request.voted() == null) throw new ApiException(BAD_REQUEST, "Expected a voted boolean.");
        var question = repository.lockQuestion(id);
        if (question.authorId() == user.id()) throw new ApiException(FORBIDDEN, "You are not allowed to upvote your own question");
        repository.vote(id, user.id(), request.voted());
        repository.recordVisit(user.id(), question.lectureId());
        return repository.question(question.lectureId(), id, user.id());
    }
    @Transactional
    public void report(User user, long id) {
        var question = repository.lockQuestion(id);
        repository.report(id, user.id());
        repository.recordVisit(user.id(), question.lectureId());
    }
    public List<ProfessorQuestion> professorQuestions(User user, long lecture) {
        requireManage(user, lecture);
        return repository.professorQuestions(lecture, user.id());
    }
    @Transactional
    public ProfessorQuestion status(User user, long id, Status request) {
        if (request == null || request.status() == null || !List.of("open", "selected", "answered").contains(request.status()))
            throw new ApiException(BAD_REQUEST, "Status must be open, selected, or answered.");
        var question = repository.lockQuestion(id);
        requireManage(user, question.lectureId());
        repository.status(id, request.status());
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
        var access = repository.lockLecture(id);
        requireManage(user, id);
        var next = LectureSession.transition(access.session(), request == null ? null : request.action(), java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC));
        repository.session(id, next);
        if (next.endedAt() != null) repository.clearLectureMembers(id);
        return lecture(user, id);
    }
    public Summary summary(User user) {
        return repository.summary(user);
    }
    public StudentSummary studentSummary(User user) {
        return repository.studentSummary(user);
    }
    @Transactional(readOnly = true)
    public List<ArchivedLecture> archive(User user) {
        return lectures(user).stream().filter(l -> l.canManage() && l.endedAt() != null)
            .map(l -> new ArchivedLecture(l, repository.professorQuestions(Long.parseLong(l.id()), user.id()))).toList();
    }
    @Transactional
    public ClearedQuestions clearOpen(User user, long lecture, ClearQuestions request) {
        requireManage(user, lecture);
        repository.lockLecture(lecture);
        if (request == null || request.questionIds() == null || request.questionIds().size() > 30000
                || request.questionIds().stream().anyMatch(id -> id == null || id <= 0))
            throw new ApiException(BAD_REQUEST, "A valid snapshot of Open questions is required.");
        return new ClearedQuestions(repository.clearOpen(lecture, request.questionIds().stream().distinct().sorted().toList()));
    }
    private void requireManage(User user, long lecture) {
        var access = repository.lecture(lecture);
        if (!Long.valueOf(user.id()).equals(access.ownerId()))
            throw new ApiException(FORBIDDEN, "You do not manage this lecture.");
    }
    private static String text(String value, int max, String label) {
        if (value == null || value.isBlank() || value.trim().length() > max)
            throw new ApiException(BAD_REQUEST, label + " must be 1 to " + max + " characters.");
        return value.trim();
    }
}
