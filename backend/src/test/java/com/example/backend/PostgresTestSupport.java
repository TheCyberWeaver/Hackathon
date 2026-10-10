package com.example.backend;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

// A real isolated PostgreSQL instance; no VM credentials or Docker required.
abstract class PostgresTestSupport {
    static final EmbeddedPostgres POSTGRES;
    static {
        try { POSTGRES = EmbeddedPostgres.builder().start(); }
        catch (Exception error) { throw new ExceptionInInitializerError(error); }
    }
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> POSTGRES.getJdbcUrl("postgres", "postgres"));
        properties.add("spring.datasource.username", () -> "postgres");
        properties.add("spring.datasource.password", () -> "");
    }
}
