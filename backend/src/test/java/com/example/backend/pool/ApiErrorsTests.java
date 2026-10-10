package com.example.backend.pool;

import java.sql.SQLException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import static org.junit.jupiter.api.Assertions.*;

class ApiErrorsTests {
    @Test
    void missingRequiredDatabaseColumnIsAServerError() {
        var result = new ApiErrors().conflict(new DataIntegrityViolationException("insert failed", new SQLException("private row data", "23502")));
        assertEquals(500, result.getStatusCode().value());
        assertFalse(result.getBody().toString().contains("private row data"));
    }

    @Test
    void duplicateOrReferencedDataStillReturnsConflict() {
        for (String state : new String[] {"23505", "23503"}) {
            var result = new ApiErrors().conflict(new DataIntegrityViolationException("insert failed", new SQLException("private row data", state)));
            assertEquals(409, result.getStatusCode().value());
        }
    }
}
