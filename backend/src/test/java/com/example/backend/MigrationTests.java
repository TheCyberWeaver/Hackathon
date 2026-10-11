package com.example.backend;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.junit.jupiter.api.Assertions.*;

class MigrationTests extends PostgresTestSupport {
    @Test void backfillsOnlyRecordedLectureParticipationAndPreservesProfilesAndRoles() {
        String schema = "history_" + UUID.randomUUID().toString().replace("-", "");
        String url = POSTGRES.getJdbcUrl("postgres", "postgres");
        var admin = new JdbcTemplate(new DriverManagerDataSource(url, "postgres", ""));
        admin.execute("CREATE SCHEMA " + schema);
        try {
            var source = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema, "postgres", "");
            var db = new JdbcTemplate(source);
            Flyway.configure().dataSource(source).schemas(schema).target("9").load().migrate();
            long owner = db.queryForObject("INSERT INTO users (eth_identity_ref, role) VALUES ('owner', 'student') RETURNING id", Long.class);
            long author = db.queryForObject("INSERT INTO users (eth_identity_ref, role) VALUES ('author', 'professor') RETURNING id", Long.class);
            long voter = db.queryForObject("INSERT INTO users (eth_identity_ref, role) VALUES ('voter', 'admin') RETURNING id", Long.class);
            long reporter = db.queryForObject("INSERT INTO users (eth_identity_ref) VALUES ('reporter') RETURNING id", Long.class);
            long member = db.queryForObject("INSERT INTO users (eth_identity_ref) VALUES ('member') RETURNING id", Long.class);
            long idle = db.queryForObject("INSERT INTO users (eth_identity_ref) VALUES ('idle') RETURNING id", Long.class);
            long lecture = db.queryForObject("INSERT INTO lectures (title, lecture_time, owner_id) VALUES ('Participated', CURRENT_TIMESTAMP, ?) RETURNING id", Long.class, owner);
            long membershipOnly = db.queryForObject("INSERT INTO lectures (title, lecture_time, owner_id) VALUES ('Membership only', CURRENT_TIMESTAMP, ?) RETURNING id", Long.class, owner);
            long unrelated = db.queryForObject("INSERT INTO lectures (title, lecture_time, owner_id) VALUES ('Unvisited', CURRENT_TIMESTAMP, ?) RETURNING id", Long.class, owner);
            long firstQuestion = db.queryForObject("INSERT INTO questions (lecture_id, author_id, text, submitted_at) VALUES (?, ?, 'Earlier question', '2026-10-01T10:00:00Z') RETURNING id", Long.class, lecture, author);
            long laterQuestion = db.queryForObject("INSERT INTO questions (lecture_id, author_id, text, submitted_at) VALUES (?, ?, 'Later question', '2026-10-03T10:00:00Z') RETURNING id", Long.class, lecture, author);
            db.update("INSERT INTO question_votes (question_id, user_id) VALUES (?, ?), (?, ?)", firstQuestion, voter, laterQuestion, voter);
            db.update("INSERT INTO question_reports (question_id, user_id, reported_at) VALUES (?, ?, '2026-10-05T10:00:00Z')", firstQuestion, reporter);
            db.update("INSERT INTO lecture_memberships (user_id, lecture_id, joined_at) VALUES (?, ?, '2026-10-07T10:00:00Z'), (?, ?, '2026-10-06T10:00:00Z')", member, lecture, author, membershipOnly);
            db.update("INSERT INTO professor_profiles (user_id, onboarding_completed, revision) VALUES (?, TRUE, 7)", owner);
            db.update("INSERT INTO professor_courses (user_id, id, title, position) VALUES (?, 'saved-course', 'Stored course', 0)", owner);

            var flyway = Flyway.configure().dataSource(source).schemas(schema).load();
            assertEquals(flyway.info().pending().length, flyway.migrate().migrationsExecuted);
            assertEquals(5L, db.queryForObject("SELECT count(*) FROM lecture_history", Long.class));
            assertEquals(java.util.Set.of(author, voter, reporter, member), new java.util.HashSet<>(db.queryForList("SELECT user_id FROM lecture_history WHERE lecture_id = ?", Long.class, lecture)));
            assertEquals(java.util.List.of(author), db.queryForList("SELECT user_id FROM lecture_history WHERE lecture_id = ?", Long.class, membershipOnly));
            assertEquals(0L, db.queryForObject("SELECT count(*) FROM lecture_history WHERE user_id IN (?, ?) OR lecture_id = ?", Long.class, owner, idle, unrelated));
            assertEquals(java.time.Instant.parse("2026-10-01T10:00:00Z"), db.queryForObject("SELECT first_visited_at FROM lecture_history WHERE user_id = ? AND lecture_id = ?", java.time.OffsetDateTime.class, author, lecture).toInstant());
            assertEquals(java.time.Instant.parse("2026-10-03T10:00:00Z"), db.queryForObject("SELECT last_visited_at FROM lecture_history WHERE user_id = ? AND lecture_id = ?", java.time.OffsetDateTime.class, author, lecture).toInstant());
            assertEquals(java.time.Instant.parse("2026-10-05T10:00:00Z"), db.queryForObject("SELECT first_visited_at FROM lecture_history WHERE user_id = ? AND lecture_id = ?", java.time.OffsetDateTime.class, reporter, lecture).toInstant());
            assertTrue(db.queryForObject("SELECT bool_and(first_visited_at IS NOT NULL AND last_visited_at >= first_visited_at) FROM lecture_history", Boolean.class));
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> db.update("INSERT INTO lecture_history (user_id, lecture_id) VALUES (?, ?)", author, lecture));
            assertEquals(2L, db.queryForObject("SELECT count(*) FROM lecture_memberships", Long.class));
            assertEquals(2L, db.queryForObject("SELECT count(*) FROM questions", Long.class));
            assertEquals(2L, db.queryForObject("""
                SELECT count(*) FROM question_deletion_tokens t JOIN questions q
                  ON q.id = t.question_id AND q.deletion_token_hash = t.token_hash
                WHERE t.user_id = q.author_id AND octet_length(t.token_hash) = 32
                """, Long.class));
            assertEquals(2L, db.queryForObject("SELECT count(*) FROM question_votes", Long.class));
            assertEquals(1L, db.queryForObject("SELECT count(*) FROM question_reports", Long.class));
            assertEquals(7L, db.queryForObject("SELECT revision FROM professor_profiles WHERE user_id = ?", Long.class, owner));
            assertTrue(db.queryForObject("SELECT onboarding_completed FROM professor_profiles WHERE user_id = ?", Boolean.class, owner));
            assertEquals("Stored course", db.queryForObject("SELECT title FROM professor_courses WHERE user_id = ?", String.class, owner));
            assertEquals("student", db.queryForObject("SELECT role FROM users WHERE id = ?", String.class, owner));
            assertEquals("professor", db.queryForObject("SELECT role FROM users WHERE id = ?", String.class, author));
            assertEquals("admin", db.queryForObject("SELECT role FROM users WHERE id = ?", String.class, voter));
            assertEquals(0, flyway.migrate().migrationsExecuted);
        } finally { admin.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }

    @Test void removesLegacyWrittenTextAndTrashWhileKeepingQuestionStateAndVotes() {
        String schema = "product_" + UUID.randomUUID().toString().replace("-", "");
        String url = POSTGRES.getJdbcUrl("postgres", "postgres");
        var admin = new JdbcTemplate(new DriverManagerDataSource(url, "postgres", ""));
        admin.execute("CREATE SCHEMA " + schema);
        try {
            var source = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema, "postgres", "");
            var db = new JdbcTemplate(source);
            Flyway.configure().dataSource(source).schemas(schema).target("8").load().migrate();
            long author = db.queryForObject("INSERT INTO users (eth_identity_ref) VALUES ('author') RETURNING id", Long.class);
            long peer = db.queryForObject("INSERT INTO users (eth_identity_ref) VALUES ('peer') RETURNING id", Long.class);
            long lecture = db.queryForObject("INSERT INTO lectures (title, lecture_time) VALUES ('Preserved', CURRENT_TIMESTAMP) RETURNING id", Long.class);
            long kept = db.queryForObject("INSERT INTO questions (lecture_id, author_id, text, status, answered_at, answer) VALUES (?, ?, 'Keep question', 'answered', CURRENT_TIMESTAMP, 'Erase written text') RETURNING id", Long.class, lecture, author);
            long trash = db.queryForObject("INSERT INTO questions (lecture_id, author_id, text, deleted_at) VALUES (?, ?, 'Old trash', CURRENT_TIMESTAMP) RETURNING id", Long.class, lecture, author);
            db.update("INSERT INTO question_votes (question_id, user_id) VALUES (?, ?), (?, ?)", kept, peer, trash, peer);
            db.update("INSERT INTO question_reports (question_id, user_id) VALUES (?, ?)", trash, peer);
            Flyway.configure().dataSource(source).schemas(schema).load().migrate();
            assertEquals(1L, db.queryForObject("SELECT count(*) FROM questions", Long.class));
            assertEquals("answered", db.queryForObject("SELECT status FROM questions WHERE id = ?", String.class, kept));
            assertEquals(1L, db.queryForObject("SELECT count(*) FROM question_votes WHERE question_id = ?", Long.class, kept));
            assertEquals(0L, db.queryForObject("SELECT count(*) FROM question_reports", Long.class));
            assertEquals(0L, db.queryForObject("SELECT count(*) FROM information_schema.columns WHERE table_schema = ? AND table_name = 'questions' AND column_name IN ('answer', 'deleted_at')", Long.class, schema));
        } finally { admin.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }

    @Test
    void upgradesModerationDatabaseToLectureMembershipWithoutLosingData() {
        String schema = "upgrade_" + UUID.randomUUID().toString().replace("-", "");
        String url = POSTGRES.getJdbcUrl("postgres", "postgres");
        var admin = new JdbcTemplate(new DriverManagerDataSource(url, "postgres", ""));
        admin.execute("CREATE SCHEMA " + schema);
        try {
            var source = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema, "postgres", "");
            var db = new JdbcTemplate(source);
            Flyway.configure().dataSource(source).schemas(schema).target("7").load().migrate();
            long user = db.queryForObject("INSERT INTO users (eth_identity_ref) VALUES ('upgrade-student') RETURNING id", Long.class);
            long lecture = db.queryForObject("INSERT INTO lectures (title, lecture_time, owner_id) VALUES ('Upgrade lecture', CURRENT_TIMESTAMP, ?) RETURNING id", Long.class, user);
            db.update("INSERT INTO question_moderation_warnings (lecture_id, user_id, reason) VALUES (?, ?, 'moderation_service')", lecture, user);

            var flyway = Flyway.configure().dataSource(source).schemas(schema).load();
            assertEquals(flyway.info().pending().length, flyway.migrate().migrationsExecuted);
            assertEquals("moderation_service", db.queryForObject("SELECT reason FROM question_moderation_warnings", String.class));
            assertNotNull(db.queryForObject("SELECT join_code FROM lectures WHERE id = ?", String.class, lecture));
            db.update("INSERT INTO lecture_memberships (user_id, lecture_id) VALUES (?, ?)", user, lecture);
            assertEquals(lecture, db.queryForObject("SELECT lecture_id FROM lecture_memberships WHERE user_id = ?", Long.class, user));
            assertEquals(0, flyway.migrate().migrationsExecuted);
        } finally { admin.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }

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
            var flyway = Flyway.configure().dataSource(source).schemas(schema).baselineOnMigrate(true).baselineVersion("1").load();
            // V1 is already installed. Count discovered later migrations so new versions do not stale this assertion.
            long expectedMigrations = java.util.Arrays.stream(flyway.info().all())
                .filter(migration -> migration.getVersion() != null && migration.getVersion().compareTo(MigrationVersion.fromVersion("1")) > 0)
                .count();
            assertTrue(expectedMigrations > 0);
            var result = flyway.migrate();
            assertEquals(expectedMigrations, result.migrationsExecuted);
            assertEquals(0, flyway.info().pending().length);
            assertEquals("Existing question", db.queryForObject("SELECT text FROM questions", String.class));
            assertEquals(false, db.queryForObject("SELECT selected FROM questions", Boolean.class));
            assertTrue(db.queryForObject("SELECT started_at = lecture_time FROM lectures", Boolean.class));
            assertEquals(false, db.queryForObject("SELECT questions_paused FROM lectures", Boolean.class));
            assertEquals(0L, db.queryForObject("SELECT count(*) FROM lecture_memberships", Long.class));
            assertEquals(0L, db.queryForObject("SELECT count(*) FROM information_schema.columns WHERE table_schema = ? AND table_name = 'questions' AND column_name IN ('answer', 'deleted_at')", Long.class, schema));
            assertEquals(0L, db.queryForObject("SELECT count(*) FROM question_votes", Long.class));
            assertEquals(0L, db.queryForObject("SELECT count(*) FROM question_moderation_warnings", Long.class));
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
