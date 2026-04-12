package com.musetheory.api.dto.response;

import com.musetheory.api.entity.Piece;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class PieceResponse {
    private UUID id;
    private String title;
    private String alternateTitle;
    private String composer;
    private String arranger;
    private String genre;
    private String ensembleType;
    private String instrumentation;
    private String language;
    private String musicalKey;
    private String era;
    private Integer difficultyLevel;
    private Integer durationSeconds;
    private String purpose;
    private String performanceNotes;
    private String sourceReference;
    private String sheetMusicUrl;
    private String scoreUrl;
    private String midiRefUrl;
    private Instant createdAt;

    public static PieceResponse from(Piece p) {
        return PieceResponse.builder()
                .id(p.getId())
                .title(p.getTitle())
                .alternateTitle(p.getAlternateTitle())
                .composer(p.getComposer())
                .arranger(p.getArranger())
                .genre(p.getGenre())
                .ensembleType(p.getEnsembleType())
                .instrumentation(p.getInstrumentation())
                .language(p.getLanguage())
                .musicalKey(p.getMusicalKey())
                .era(p.getEra())
                .difficultyLevel(p.getDifficultyLevel())
                .durationSeconds(p.getDurationSeconds())
                .purpose(p.getPurpose())
                .performanceNotes(p.getPerformanceNotes())
                .sourceReference(p.getSourceReference())
                .sheetMusicUrl(p.getSheetMusicUrl())
                .scoreUrl(p.getScoreUrl())
                .midiRefUrl(p.getMidiRefUrl())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
