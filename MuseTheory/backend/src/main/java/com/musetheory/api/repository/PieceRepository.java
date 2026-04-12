package com.musetheory.api.repository;

import com.musetheory.api.entity.Piece;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PieceRepository extends JpaRepository<Piece, UUID> {

    /**
     * Partial-match search across title, alternate title, composer, and arranger.
     * Results are ranked so exact title/arranger matches surface first, then
     * prefix matches, then anywhere-in-string matches. Any filter passed as
     * null is ignored.
     */
    @Query("""
            SELECT p FROM Piece p
            WHERE
                (
                    :q IS NULL
                    OR LOWER(p.title)          LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(p.alternateTitle, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(p.composer, ''))       LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(p.arranger, ''))       LIKE LOWER(CONCAT('%', :q, '%'))
                )
                AND (:ensembleType IS NULL OR LOWER(p.ensembleType) = LOWER(:ensembleType))
                AND (:style        IS NULL OR LOWER(p.genre)        = LOWER(:style))
                AND (:language     IS NULL OR LOWER(p.language)     = LOWER(:language))
                AND (:difficultyMin IS NULL OR p.difficultyLevel >= :difficultyMin)
                AND (:difficultyMax IS NULL OR p.difficultyLevel <= :difficultyMax)
            ORDER BY
                CASE
                    WHEN :q IS NULL THEN 4
                    WHEN LOWER(p.title)    = LOWER(:q) THEN 0
                    WHEN LOWER(COALESCE(p.arranger, '')) = LOWER(:q) THEN 1
                    WHEN LOWER(p.title)    LIKE LOWER(CONCAT(:q, '%')) THEN 2
                    ELSE 3
                END,
                p.title ASC
            """)
    List<Piece> search(@Param("q") String q,
                       @Param("ensembleType") String ensembleType,
                       @Param("style") String style,
                       @Param("language") String language,
                       @Param("difficultyMin") Integer difficultyMin,
                       @Param("difficultyMax") Integer difficultyMax);
}
