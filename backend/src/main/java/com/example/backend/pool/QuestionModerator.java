package com.example.backend.pool;

import java.net.http.HttpClient;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class QuestionModerator {
    private static final Logger log = LoggerFactory.getLogger(QuestionModerator.class);
    private final RestClient client;
    record Request(String question) {}
    record Response(String decision) {}

    public QuestionModerator(@Value("${app.moderation-url:}") String url,
                             @Value("${app.moderation-timeout-ms:800}") int timeoutMs) {
        if (timeoutMs < 1) throw new IllegalArgumentException("Moderation timeout must be positive");
        if (url.isBlank()) {
            client = null;
        } else {
            var timeout = Duration.ofMillis(timeoutMs);
            var http = HttpClient.newBuilder().connectTimeout(timeout).build();
            var factory = new JdkClientHttpRequestFactory(http);
            factory.setReadTimeout(timeout);
            client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
        }
    }

    public boolean accepts(String question) {
        if (client == null) return true;
        try {
            var response = client.post().uri("/moderate").contentType(MediaType.APPLICATION_JSON)
                .body(new Request(question)).retrieve().body(Response.class);
            if (response != null && "reject".equals(response.decision())) return false;
            if (response == null || !"accept".equals(response.decision())) {
                log.warn("Invalid moderation response; allowing question");
            }
        } catch (RestClientException exception) {
            log.warn("Moderation unavailable; allowing question ({})", exception.getClass().getSimpleName());
        }
        return true;
    }
}
