package com.musetheory.api.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "feature_vectors")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FeatureVector {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performance_id", nullable = false, unique = true)
    private Performance performance;

    // Core tempo features
    @Column(name = "tempo_mean")
    private Double tempoMean;

    @Column(name = "tempo_variance")
    private Double tempoVariance;

    // Dynamics
    @Column(name = "dynamic_range")
    private Double dynamicRange;

    @Column(name = "rms_energy_contour", columnDefinition = "TEXT")
    private String rmsEnergyContour;

    // Pitch features
    @Column(name = "pitch_mean")
    private Double pitchMean;

    @Column(name = "pitch_stability")
    private Double pitchStability;

    @Column(name = "vibrato_rate")
    private Double vibratoRate;

    @Column(name = "vibrato_extent")
    private Double vibratoExtent;

    // Timbral features
    @Column(name = "spectral_centroid_mean")
    private Double spectralCentroidMean;

    @Column(name = "mfcc_summary", columnDefinition = "TEXT")
    private String mfccSummary;

    // Rhythmic features
    @Column(name = "onset_density")
    private Double onsetDensity;

    @Column(name = "articulation_style")
    private Double articulationStyle;

    // Expressive features
    @Column(name = "contrast_score")
    private Double contrastScore;

    @Column(name = "phrase_length_variance")
    private Double phraseLengthVariance;

    @Column(name = "breath_placement", columnDefinition = "TEXT")
    private String breathPlacement;

    @Column(name = "harmonic_deviation")
    private Double harmonicDeviation;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
