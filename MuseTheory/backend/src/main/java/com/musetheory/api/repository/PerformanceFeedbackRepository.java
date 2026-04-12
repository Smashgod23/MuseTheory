package com.musetheory.api.repository;

import com.musetheory.api.entity.PerformanceFeedback;
import com.musetheory.api.enums.FeedbackSource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PerformanceFeedbackRepository extends JpaRepository<PerformanceFeedback, UUID> {
    List<PerformanceFeedback> findByPerformanceId(UUID performanceId);
    List<PerformanceFeedback> findByPerformanceIdAndSource(UUID performanceId, FeedbackSource source);

    List<PerformanceFeedback> findByPerformanceUserIdAndPerformancePieceIdOrderByCreatedAtDesc(
            UUID userId, UUID pieceId);
}
