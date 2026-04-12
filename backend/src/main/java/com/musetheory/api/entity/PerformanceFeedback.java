package com.musetheory.api.entity;

import com.musetheory.api.enums.FeedbackSource;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "performances_feedback")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PerformanceFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performance_id", nullable = false)
    private Performance performance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FeedbackSource source;

    @Column(name = "suggestion_text", columnDefinition = "TEXT")
    private String suggestionText;

    // Human-rated musicality score (1-10), used as training target
    @Column(name = "musicality_score")
    private Double musicalityScore;

    // User rating of a suggestion's usefulness (1-5)
    private Integer rating;

    @Column(name = "measure_start")
    private Integer measureStart;

    @Column(name = "measure_end")
    private Integer measureEnd;

    @Column(name = "feature_targeted")
    private String featureTargeted;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
