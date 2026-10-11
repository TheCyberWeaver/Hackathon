package com.example.backend.pool;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.http.HttpStatus.*;

class PoolServiceTests {
    final PoolRepository repository = mock(PoolRepository.class);
    final QuestionModerator moderator = mock(QuestionModerator.class);
    final QuestionModeration moderation = new QuestionModeration();
    final PoolService service = new PoolService(repository, moderation, moderator);

    @ParameterizedTest
    @ValueSource(strings = {"student", "professor", "admin"})
    void accountWithMatchingTokenCanDeleteRegardlessOfStoredRole(String role) {
        when(repository.lockQuestion(10)).thenReturn(new PoolRepository.QuestionAccess(10, 20, 30));
        when(repository.deleteToken(10, 30)).thenReturn(1);
        when(repository.delete(10)).thenReturn(1);
        service.delete(new PoolRepository.User(30, role), 10);
        verify(repository).deleteToken(10, 30);
        verify(repository).delete(10);
        verify(repository, never()).lecture(anyLong());
    }

    @ParameterizedTest
    @ValueSource(strings = {"student", "professor", "admin"})
    void noStoredRoleCanDeleteWithoutMatchingToken(String role) {
        when(repository.lockQuestion(10)).thenReturn(new PoolRepository.QuestionAccess(10, 20, 30));
        assertEquals(NOT_FOUND, assertThrows(ApiException.class,
            () -> service.delete(new PoolRepository.User(31, role), 10)).status);
        verify(repository, never()).delete(anyLong());
    }

    @Test void pausedSessionsRejectSubmissions() {
        when(repository.lockLecture(20)).thenReturn(new PoolRepository.LectureAccess(20, 40L,
            new LectureSession.State(OffsetDateTime.now(), null, true)));
        assertEquals(CONFLICT, assertThrows(ApiException.class,
            () -> service.submit(new PoolRepository.User(30, "professor"), 20, new ApiModels.NewQuestion("Question"))).status);
        verify(repository, never()).createQuestion(anyLong(), anyLong(), anyString(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"student", "professor", "admin"})
    void onlyTheLectureOwnerCanChangeItsSession(String role) {
        var access = new PoolRepository.LectureAccess(20, 40L, new LectureSession.State(null, null, false));
        when(repository.lockLecture(20)).thenReturn(access);
        when(repository.lecture(20)).thenReturn(access);
        assertEquals(FORBIDDEN, assertThrows(ApiException.class,
            () -> service.session(new PoolRepository.User(41, role), 20, new ApiModels.SessionAction("start"))).status);
        verify(repository, never()).session(anyLong(), any());
        assertDoesNotThrow(() -> service.session(new PoolRepository.User(40, role), 20, new ApiModels.SessionAction("start")));
        verify(repository).session(eq(20L), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"student", "professor", "admin"})
    void legacyOwnerlessLecturesDoNotGiveAnyAccountManagementRights(String role) {
        when(repository.lecture(20)).thenReturn(new PoolRepository.LectureAccess(20, null,
            new LectureSession.State(null, null, false)));
        assertEquals(FORBIDDEN, assertThrows(ApiException.class,
            () -> service.professorQuestions(new PoolRepository.User(30, role), 20)).status);
        verify(repository, never()).professorQuestions(anyLong(), anyLong());
    }
}
