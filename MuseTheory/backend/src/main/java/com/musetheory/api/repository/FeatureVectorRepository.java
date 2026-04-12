package com.musetheory.api.repository;

import com.musetheory.api.entity.FeatureVector;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface FeatureVectorRepository extends JpaRepository<FeatureVector, UUID> {
    Optional<FeatureVector> findByPerformanceId(UUID performanceId);
}
