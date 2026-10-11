package com.example.backend.pool;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.example.backend.pool.ApiModels.*;
import static com.example.backend.pool.PoolRepository.User;
import static org.springframework.http.HttpStatus.*;

@Service
public class ProfessorProfileService {
    private final JdbcTemplate jdbc;
    public ProfessorProfileService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }
    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public ProfessorProfile get(User user) {
        return jdbc.query("SELECT onboarding_completed, revision FROM professor_profiles WHERE user_id = ?",
            (rs, row) -> new ProfessorProfile(rs.getBoolean(1), rs.getLong(2),
                jdbc.query("SELECT id, title FROM professor_courses WHERE user_id = ? AND NOT archived ORDER BY position",
                    (course, index) -> new Course(course.getString(1), course.getString(2), user.id() + ":" + course.getString(1)), user.id())), user.id())
            .stream().findFirst().orElse(null);
    }
    @Transactional
    public ProfessorProfile initialize(User user, ProfileUpdate legacy) {
        // Serialize first use on different devices. Once present, ignore browser-local data.
        jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", Long.class, user.id());
        // Existing-profile loads must pair the same revision with the same ordered courses.
        jdbc.queryForList("SELECT user_id FROM professor_profiles WHERE user_id = ? FOR UPDATE", Long.class, user.id());
        var existing = get(user);
        if (existing != null) return existing;
        var courses = validate(legacy);
        jdbc.update("INSERT INTO professor_profiles (user_id, onboarding_completed) VALUES (?, ?)", user.id(), legacy.onboardingCompleted());
        insertCourses(user, courses);
        return get(user);
    }
    @Transactional
    public ProfessorProfile save(User user, ProfileUpdate update) {
        var courses = validate(update);
        var revision = jdbc.queryForList("SELECT revision FROM professor_profiles WHERE user_id = ? FOR UPDATE", Long.class, user.id());
        if (revision.isEmpty()) throw new ApiException(CONFLICT, "Load your professor profile before saving.");
        if (update.revision() == null || !update.revision().equals(revision.getFirst()))
            throw new ApiException(CONFLICT, "Your courses changed in another browser. The latest list has been loaded; review it and retry.");
        jdbc.update("UPDATE professor_profiles SET onboarding_completed = onboarding_completed OR ?, revision = revision + 1 WHERE user_id = ?", update.onboardingCompleted(), user.id());
        var archivedIds = new HashSet<>(jdbc.queryForList("SELECT id FROM professor_courses WHERE user_id = ? AND archived", String.class, user.id()));
        if (courses.stream().anyMatch(course -> archivedIds.contains(course.id())))
            throw new ApiException(CONFLICT, "A removed course cannot reuse its old identity. Add it as a new course.");
        // Temporarily archive the list so swaps of positions or names cannot hit
        // active-only uniqueness constraints. No course row is ever replaced.
        jdbc.update("UPDATE professor_courses SET archived = TRUE WHERE user_id = ?", user.id());
        for (int i = 0; i < courses.size(); i++) {
            var course = courses.get(i);
            jdbc.update("""
                INSERT INTO professor_courses (user_id, id, title, position) VALUES (?, ?, ?, ?)
                ON CONFLICT (user_id, id) DO UPDATE
                SET title = EXCLUDED.title, position = EXCLUDED.position, archived = FALSE
                """, user.id(), course.id(), course.title(), i);
        }
        return get(user);
    }
    private List<Course> validate(ProfileUpdate update) {
        if (update == null || update.onboardingCompleted() == null || update.courses() == null)
            throw new ApiException(BAD_REQUEST, "Completion and courses are required.");
        var ids = new HashSet<String>();
        var names = new HashSet<String>();
        var courses = new ArrayList<Course>();
        for (var course : update.courses()) {
            if (course == null || course.id() == null || course.id().isBlank() || course.id().length() > 200
                    || course.title() == null || course.title().trim().isEmpty() || course.title().trim().length() > 120)
                throw new ApiException(BAD_REQUEST, "Course titles must be 1 to 120 characters with a valid ID.");
            var title = course.title().trim();
            if (!ids.add(course.id()) || !names.add(title.toLowerCase(Locale.ROOT)))
                throw new ApiException(BAD_REQUEST, "This course is already on your list.");
            courses.add(new Course(course.id(), title));
        }
        return courses;
    }
    private void insertCourses(User user, List<Course> courses) {
        for (int i = 0; i < courses.size(); i++) {
            var course = courses.get(i);
            jdbc.update("INSERT INTO professor_courses (user_id, id, title, position) VALUES (?, ?, ?, ?)", user.id(), course.id(), course.title(), i);
        }
    }
}
