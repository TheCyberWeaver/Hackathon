package com.example.backend.dev;

import com.example.backend.BackendApplication;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.boot.SpringApplication;

/** Persistent development database. This class and its runtime are excluded from the production JAR. */
public final class LocalApplication {
    public static void main(String[] args) throws Exception {
        Path data = Path.of(args[0]).toAbsolutePath();
        int databasePort = Integer.parseInt(args[1]);
        int backendPort = Integer.parseInt(args[2]);
        Files.createDirectories(data);
        EmbeddedPostgres postgres = EmbeddedPostgres.builder()
            .setDataDirectory(data)
            .setCleanDataDirectory(false)
            .setPort(databasePort)
            .setServerConfig("listen_addresses", "127.0.0.1")
            .start();
        try {
            try (var connection = postgres.getPostgresDatabase().getConnection();
                 var statement = connection.createStatement()) {
                try (var roles = statement.executeQuery("SELECT 1 FROM pg_roles WHERE rolname = 'askpool_app'")) {
                    if (!roles.next()) {
                        try (var createRole = connection.createStatement()) { createRole.execute("CREATE ROLE askpool_app LOGIN"); }
                    }
                }
                try (var databases = statement.executeQuery("SELECT 1 FROM pg_database WHERE datname = 'askpool'")) {
                    if (!databases.next()) {
                        try (var createDatabase = connection.createStatement()) { createDatabase.execute("CREATE DATABASE askpool OWNER askpool_app"); }
                    }
                }
            }
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try { postgres.close(); }
                catch (Exception error) { System.err.println("Local PostgreSQL shutdown failed: " + error.getMessage()); }
            }, "local-postgres-shutdown"));
            // Override inherited VM/environment settings: this runner always uses its own local database.
            System.setProperty("spring.datasource.url", "jdbc:postgresql://127.0.0.1:" + databasePort + "/askpool");
            System.setProperty("spring.datasource.username", "askpool_app");
            System.setProperty("spring.datasource.password", "");
            System.setProperty("spring.flyway.baseline-on-migrate", "false");
            System.setProperty("server.port", Integer.toString(backendPort));
            System.setProperty("app.frontend-origin", args.length > 3 ? args[3] : "http://localhost:5173,http://127.0.0.1:5173");
            System.out.println("Local PostgreSQL: 127.0.0.1:" + databasePort + "/askpool (askpool_app, empty password)");
            System.out.println("Persistent database directory: " + data);
            SpringApplication.run(BackendApplication.class);
        } catch (Throwable error) {
            postgres.close();
            throw error;
        }
    }
}
