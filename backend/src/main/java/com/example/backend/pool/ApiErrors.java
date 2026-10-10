package com.example.backend.pool;

import java.util.Map;
import java.sql.SQLException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);
    @ExceptionHandler(ApiException.class)
    ResponseEntity<?> apiError(ApiException error) {
        return ResponseEntity.status(error.status).body(Map.of("error", error.getMessage()));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<?> invalidBody(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid request body or parameter."));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> conflict(DataIntegrityViolationException error) {
        String state = error.getMostSpecificCause() instanceof SQLException sql ? sql.getSQLState() : null;
        if ("23505".equals(state) || "23503".equals(state)) {
            return ResponseEntity.status(409).body(Map.of("error", "This operation conflicts with existing data."));
        }
        // Log metadata only: database exception details can contain identities or question text.
        log.error("Unexpected database integrity failure (SQLSTATE {}). Check schema compatibility.", state);
        return ResponseEntity.status(500).body(Map.of("error", "A database error prevented this operation. Please contact the administrator."));
    }
}
