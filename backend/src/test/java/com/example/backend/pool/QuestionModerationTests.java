package com.example.backend.pool;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class QuestionModerationTests {
    final QuestionModeration moderation = new QuestionModeration();

    @Test void blocksWholeWordsAndSimpleDisguises() {
        assertTrue(moderation.blocks("What the FUCK?"));
        assertTrue(moderation.blocks("This is f.u.c.k.e.d up"));
        assertTrue(moderation.blocks("What a sh!t explanation"));
        assertTrue(moderation.blocks("Fullwidth: ｆｕｃｋ"));
        assertTrue(moderation.blocks("Das ist Scheiße"));
        assertTrue(moderation.blocks("f\u200bu\u200bc\u200bk"));
        assertTrue(moderation.blocks("What the f u c k?"));
        assertTrue(moderation.blocks("What the f  u\t c\u00a0k?"));
        assertTrue(moderation.blocks("What the f . u . c . k?"));
        assertTrue(moderation.blocks("Stop this b u l l s h i t"));
        assertTrue(moderation.blocks("What a wanker"));
        assertTrue(moderation.blocks("Das ist eine Schlampe"));
    }

    @Test void leavesOrdinaryLectureQuestionsAlone() {
        assertFalse(moderation.blocks("Can you explain class inheritance?"));
        assertFalse(moderation.blocks("How does the assumption affect this proof?"));
        assertFalse(moderation.blocks("Is this about the Fitch proof system?"));
        assertFalse(moderation.blocks("Why does the base case work?"));
        assertFalse(moderation.blocks("What are the variables f, u, and c?"));
        assertFalse(moderation.blocks("Can you explain the analytic function?"));
        assertFalse(moderation.blocks("Is this an assumption about the shift operator?"));
        assertFalse(moderation.blocks("How does Fick's law describe diffusion?"));
    }
}
