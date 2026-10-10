package com.example.backend;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.junit.jupiter.api.Assertions.*;

class MigrationTests extends PostgresTestSupport {
    @Test
    void adoptsTheExistingSchemaOnlyWhenExplicitlyEnabledAndKeepsItsData() throws Exception {
        String schema = "adoption_" + UUID.randomUUID().toString().replace("-", "");
        String url = POSTGRES.getJdbcUrl("postgres", "postgres");
        var admin = new JdbcTemplate(new DriverManagerDataSource(url, "postgres", ""));
        admin.execute("CREATE SCHEMA " + schema);
        try {
            var source = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema, "postgres", "");
            var db = new JdbcTemplate(source);
            db.execute(new ClassPathResource("db/migration/V1__initial_schema.sql").getContentAsString(StandardCharsets.UTF_8));
            db.update("INSERT INTO users (eth_identity_ref) VALUES ('existing-student')");
            db.update("INSERT INTO lectures (title, lecture_time) VALUES ('Existing lecture', CURRENT_TIMESTAMP)");
            db.update("INSERT INTO questions (lecture_id, author_id, text) SELECT l.id, u.id, 'Existing question' FROM lectures l CROSS JOIN users u");
            assertThrows(Exception.class, () -> Flyway.configure().dataSource(source).schemas(schema).load().migrate());
            var result = Flyway.configure().dataSource(source).schemas(schema).baselineOnMigrate(true).baselineVersion("1").load().migrate();
            assertEquals(4, result.migrationsExecuted);
            assertEquals("Existing question", db.queryForObject("SELECT text FROM questions", String.class));
            assertEquals(false, db.queryForObject("SELECT selected FROM questions", Boolean.class));
            assertTrue(db.queryForObject("SELECT started_at = lecture_time FROM lectures", Boolean.class));
            assertEquals(false, db.queryForObject("SELECT questions_paused FROM lectures", Boolean.class));
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> db.update("UPDATE questions SET answer = 'An unanswered question cannot have a written answer'"));
            assertEquals(0L, db.queryForObject("SELECT count(*) FROM question_votes", Long.class));
            assertEquals(0, Flyway.configure().dataSource(source).schemas(schema).load().migrate().migrationsExecuted);
        } finally { admin.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }

    @Test
    void adoptsLegacyProfessorColumnAndSupportsBothInsertFormats() throws Exception {
        String schema = "legacy_" + UUID.randomUUID().toString().replace("-", "");
        String url = POSTGRES.getJdbcUrl("postgres", "postgres");
        var admin = new JdbcTemplate(new DriverManagerDataSource(url, "postgres", ""));
        admin.execute("CREATE SCHEMA " + schema);
        try {
            var source = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema, "postgres", "");
            var db = new JdbcTemplate(source);
            db.execute(new ClassPathResource("db/migration/V1__initial_schema.sql").getContentAsString(StandardCharsets.UTF_8));
            db.execute("ALTER TABLE lectures ADD COLUMN professor_id BIGINT NOT NULL REFERENCES users(id)");
            db.execute("ALTER TABLE lectures ADD COLUMN ended_at TIMESTAMPTZ");
            db.execute("CREATE TABLE votes (question_id BIGINT REFERENCES questions(id) ON DELETE RESTRICT, user_id BIGINT REFERENCES users(id), PRIMARY KEY (question_id, user_id))");
            long professor = db.queryForObject("INSERT INTO users (eth_identity_ref, role) VALUES ('legacy-professor', 'professor') RETURNING id", Long.class);
            db.update("INSERT INTO lectures (title, lecture_time, professor_id) VALUES ('Existing legacy lecture', CURRENT_TIMESTAMP, ?)", professor);
            db.update("UPDATE lectures SET ended_at = CURRENT_TIMESTAMP");
            long question = db.queryForObject("INSERT INTO questions (lecture_id, author_id, text) SELECT id, ?, 'Legacy vote' FROM lectures RETURNING id", Long.class, professor);
            db.update("INSERT INTO votes (question_id, user_id) VALUES (?, ?)", question, professor);
            Flyway.configure().dataSource(source).schemas(schema).baselineOnMigrate(true).baselineVersion("1").load().migrate();
            assertEquals(professor, db.queryForObject("SELECT owner_id FROM lectures WHERE title = 'Existing legacy lecture'", Long.class));
            assertTrue(db.queryForObject("SELECT started_at IS NOT NULL FROM lectures", Boolean.class));
            assertTrue(db.queryForObject("SELECT ended_at IS NOT NULL FROM lectures", Boolean.class));
            db.update("DELETE FROM questions WHERE id = ?", question);
            assertEquals(0L, db.queryForObject("SELECT count(*) FROM votes", Long.class));
            db.update("INSERT INTO lectures (title, lecture_time, owner_id) VALUES ('Java lecture', CURRENT_TIMESTAMP, ?)", professor);
            db.update("INSERT INTO lectures (title, lecture_time, professor_id) VALUES ('Legacy lecture', CURRENT_TIMESTAMP, ?)", professor);
            assertEquals(3L, db.queryForObject("SELECT count(*) FROM lectures WHERE owner_id = professor_id AND owner_id = ?", Long.class, professor));
            // The live repair can run before a backend release; Flyway must safely apply it again.
            db.execute(new ClassPathResource("db/migration/V3__legacy_lecture_owner_compatibility.sql").getContentAsString(StandardCharsets.UTF_8));
            db.update("INSERT INTO lectures (title, lecture_time, owner_id) VALUES ('After repair replay', CURRENT_TIMESTAMP, ?)", professor);
            assertEquals(4L, db.queryForObject("SELECT count(*) FROM lectures", Long.class));
            assertEquals(0, Flyway.configure().dataSource(source).schemas(schema).load().migrate().migrationsExecuted);
        } finally { admin.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }
}
