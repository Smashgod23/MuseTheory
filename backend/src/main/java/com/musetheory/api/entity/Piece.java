package com.musetheory.api.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pieces")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Piece {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(name = "alternate_title")
    private String alternateTitle;

    private String composer;

    private String arranger;

    // Broad style bucket ("classical", "jazz", "sacred motet", ...). Reused as
    // style/genre on the performer-facing UI.
    private String genre;

    @Column(name = "ensemble_type")
    private String ensembleType;

    // Free-text instrumentation line ("SATB choir, organ", "solo voice, piano").
    @Column(columnDefinition = "TEXT")
    private String instrumentation;

    private String language;

    // Key or mode ("G major", "D dorian").
    @Column(name = "musical_key")
    private String musicalKey;

    private String era;

    @Column(name = "difficulty_level")
    private Integer difficultyLevel;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    private String purpose;

    @Column(name = "performance_notes", columnDefinition = "TEXT")
    private String performanceNotes;

    @Column(name = "source_reference")
    private String sourceReference;

    @Column(name = "sheet_music_url")
    private String sheetMusicUrl;

    @Column(name = "score_url")
    private String scoreUrl;

    @Column(name = "midi_ref_url")
    private String midiRefUrl;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
