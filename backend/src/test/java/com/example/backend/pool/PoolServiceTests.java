package com.example.backend.pool;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.http.HttpStatus.*;

class PoolServiceTests {
    final PoolRepository repository = mock(PoolRepository.class);
    final QuestionModerator moderator = mock(QuestionModerator.class);
    final QuestionModeration moderation = new QuestionModeration();
    final PoolService service = new PoolService(repository, moderation, moderator, false);

    @Test void authorsCanDeleteTheirOwnQuestionsWithoutProfessorRights() {
        when(repository.lockQuestion(10)).thenReturn(new PoolRepository.QuestionAccess(10, 20, 30));
        service.delete(new PoolRepository.User(30, "student"), 10);
        verify(repository).delete(10);
        verify(repository, never()).lecture(anyLong());
    }
    @Test void studentsCannotDeleteAnotherPersonsQuestion() {
        var question = new PoolRepository.QuestionAccess(10, 20, 30);
        when(repository.lockQuestion(10)).thenReturn(question);
        var student = new PoolRepository.User(31, "student");
        assertEquals(FORBIDDEN, assertThrows(ApiException.class, () -> service.delete(student, 10)).status);
        verify(repository, never()).delete(anyLong());
    }
    @Test void PausedSessionsRejectSubmissionsEvenWithTestingPermissions() {
        when(repository.lockLecture(20)).thenReturn(new PoolRepository.LectureAccess(20, 40L,
            new LectureSession.State(OffsetDateTime.now(), null, true)));
        var testingService = new PoolService(repository, moderation, moderator, true);
        assertEquals(CONFLICT, assertThrows(ApiException.class,
            () -> testingService.submit(new PoolRepository.User(30, "professor"), 20, new ApiModels.NewQuestion("Question"))).status);
        verify(repository, never()).createQuestion(anyLong(), anyLong(), anyString());
    }
    @Test void OnlyTheLectureOwnerOrAdminCanChangeItsSession() {
        var access = new PoolRepository.LectureAccess(20, 40L, new LectureSession.State(null, null, false));
        when(repository.lockLecture(20)).thenReturn(access);
        when(repository.lecture(20)).thenReturn(access);
        assertEquals(FORBIDDEN, assertThrows(ApiException.class,
            () -> service.session(new PoolRepository.User(41, "professor"), 20, new ApiModels.SessionAction("start"))).status);
        verify(repository, never()).session(anyLong(), any());
    }
}
