package com.musetheory.api.repository;

import com.musetheory.api.entity.Performance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PerformanceRepository extends JpaRepository<Performance, UUID> {
    List<Performance> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<Performance> findByUserIdAndPieceIdOrderByCreatedAtDesc(UUID userId, UUID pieceId);
}
