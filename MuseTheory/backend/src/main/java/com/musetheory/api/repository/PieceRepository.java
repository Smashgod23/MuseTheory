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
     * prefix matches, then anywhere-in-string matches. String filters passed as
     * an empty string are ignored; integer filters use IS NULL.
     */
    @Query("""
            SELECT p FROM Piece p
            WHERE
                (
                    :q = ''
                    OR LOWER(p.title)          LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(p.alternateTitle, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(p.composer, ''))       LIKE LOWER(CONCAT('%', :q, '%'))
                    OR LOWER(COALESCE(p.arranger, ''))       LIKE LOWER(CONCAT('%', :q, '%'))
                )
                AND (:ensembleType = ''
                     OR LOWER(p.ensembleType) = LOWER(:ensembleType)
                     OR (:ensembleType = 'vocal' AND LOWER(p.ensembleType) IN ('choir', 'voice', 'opera'))
                    )
                AND (:style        = '' OR LOWER(p.genre)        = LOWER(:style))
                AND (:language     = '' OR LOWER(p.language)     = LOWER(:language))
                AND (:difficultyMin IS NULL OR p.difficultyLevel >= :difficultyMin)
                AND (:difficultyMax IS NULL OR p.difficultyLevel <= :difficultyMax)
            ORDER BY
                CASE
                    WHEN :q = '' THEN 4
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
