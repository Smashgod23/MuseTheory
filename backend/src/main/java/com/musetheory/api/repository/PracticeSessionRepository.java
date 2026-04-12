package com.musetheory.api.repository;

import com.musetheory.api.entity.PracticeSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PracticeSessionRepository extends JpaRepository<PracticeSession, UUID> {

    List<PracticeSession> findByRepertoireEntryIdOrderByPracticedAtDesc(UUID repertoireEntryId);
}
