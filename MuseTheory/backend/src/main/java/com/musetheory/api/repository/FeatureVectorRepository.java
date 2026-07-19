package com.musetheory.api.repository;

import com.musetheory.api.entity.FeatureVector;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FeatureVectorRepository extends JpaRepository<FeatureVector, UUID> {
    Optional<FeatureVector> findByPerformanceId(UUID performanceId);

    /**
     * Feature vectors from this singer's PRIOR takes of a piece, newest first,
     * excluding the take currently being analyzed. Used to build the personalized
     * baseline ("your usual on this piece") the AI service coaches against.
     */
    @Query("select fv from FeatureVector fv "
            + "where fv.performance.user.id = :userId "
            + "and fv.performance.piece.id = :pieceId "
            + "and fv.performance.id <> :excludePerformanceId "
            + "order by fv.performance.createdAt desc")
    List<FeatureVector> findHistoryForUserAndPiece(@Param("userId") UUID userId,
                                                   @Param("pieceId") UUID pieceId,
                                                   @Param("excludePerformanceId") UUID excludePerformanceId);
}
