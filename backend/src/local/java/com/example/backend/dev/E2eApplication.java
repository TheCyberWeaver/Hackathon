package com.example.backend.dev;

import com.example.backend.BackendApplication;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.boot.SpringApplication;

/** Browser-test lifecycle only; excluded from the production JAR. EOF shuts down both servers. */
public final class E2eApplication {
    public static void main(String[] args) throws Exception {
        var postgres = EmbeddedPostgres.builder()
            .setDataDirectory(java.nio.file.Path.of(args[0]).toAbsolutePath())
            .setCleanDataDirectory(false)
            .setServerConfig("listen_addresses", "127.0.0.1")
            .start(); // Automatically choose a free port; never reuse a running database.
        try {
            System.setProperty("spring.datasource.url", postgres.getJdbcUrl("postgres", "postgres"));
            System.setProperty("spring.datasource.username", "postgres");
            System.setProperty("spring.datasource.password", "");
            System.setProperty("spring.flyway.baseline-on-migrate", "false");
            System.setProperty("app.testing-permissions", "true");
            System.setProperty("app.moderation-url", "");
            System.setProperty("app.frontend-origin", "http://127.0.0.1:5186");
            System.setProperty("server.port", "8086");
            var context = SpringApplication.run(BackendApplication.class);
            try { System.in.read(); }
            finally { context.close(); }
        } finally { postgres.close(); }
    }
}
