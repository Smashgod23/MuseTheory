package com.musetheory.api.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "piece_parameters",
       uniqueConstraints = @UniqueConstraint(columnNames = {"piece_id", "instrument_id"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PieceParameter {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "piece_id", nullable = false)
    private Piece piece;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instrument_id", nullable = false)
    private Instrument instrument;

    // JSON arrays stored as text -- parsed by the AI service
    @Column(name = "repetition_map", columnDefinition = "TEXT")
    private String repetitionMap;

    @Column(name = "harmonic_tension_map", columnDefinition = "TEXT")
    private String harmonicTensionMap;

    @Column(name = "text_stress_map", columnDefinition = "TEXT")
    private String textStressMap;

    @Column(name = "director_notes", columnDefinition = "TEXT")
    private String directorNotes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
