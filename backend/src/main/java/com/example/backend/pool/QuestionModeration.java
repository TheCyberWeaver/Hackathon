package com.example.backend.pool;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class QuestionModeration {
    private static final String BETWEEN_LETTERS = "[\\p{P}\\p{S}\\p{Cf}]*";
    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{M}+");
    private final List<Pattern> blockedWords;

    public QuestionModeration() {
        try (var reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource("moderation/blocked-words.txt").getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
            blockedWords = reader.lines()
                .map(String::trim)
                .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                .map(QuestionModeration::wordPattern)
                .toList();
        } catch (IOException error) {
            throw new IllegalStateException("Could not load question moderation rules.", error);
        }
        if (blockedWords.isEmpty()) throw new IllegalStateException("Question moderation rules are empty.");
    }

    public boolean blocks(String text) {
        String normalized = normalize(text);
        return blockedWords.stream().anyMatch(pattern -> pattern.matcher(normalized).find());
    }

    private static Pattern wordPattern(String word) {
        String normalized = normalize(word);
        var expression = new StringBuilder("(?<![\\p{L}\\p{N}])");
        for (int index = 0; index < normalized.length(); index++) {
            if (index > 0) expression.append(BETWEEN_LETTERS);
            expression.append(switch (normalized.charAt(index)) {
                case 'a' -> "[a4@]";
                case 'e' -> "[e3]";
                case 'i' -> "[i1!|]";
                case 'o' -> "[o0]";
                case 's' -> "[s5$]";
                case 't' -> "[t7+]";
                default -> Pattern.quote(String.valueOf(normalized.charAt(index)));
            });
        }
        return Pattern.compile(expression.append("(?![\\p{L}\\p{N}])").toString());
    }

    private static String normalize(String text) {
        return COMBINING_MARKS.matcher(Normalizer.normalize(text, Normalizer.Form.NFKD)
            .toLowerCase(Locale.ROOT)).replaceAll("");
    }
}
