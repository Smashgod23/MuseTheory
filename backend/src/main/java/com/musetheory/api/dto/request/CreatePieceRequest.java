package com.musetheory.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePieceRequest {

    @NotBlank(message = "Title is required")
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
}
