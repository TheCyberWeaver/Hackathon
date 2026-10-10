package com.example.backend;

import org.springframework.boot.test.context.SpringBootTest;

// The retired flag must not restore cross-account access, even on an old deployment.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "app.testing-permissions=true")
class TestingPermissionsTests extends AccountIsolationTests {}
