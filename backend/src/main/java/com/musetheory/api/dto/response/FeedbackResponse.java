package com.musetheory.api.dto.response;

import com.musetheory.api.entity.PerformanceFeedback;
import com.musetheory.api.enums.FeedbackSource;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class FeedbackResponse {
    private UUID id;
    private UUID performanceId;
    private FeedbackSource source;
    private String suggestionText;
    private Double musicalityScore;
    private Integer rating;
    private Integer measureStart;
    private Integer measureEnd;
    private String featureTargeted;
    private Instant createdAt;

    public static FeedbackResponse from(PerformanceFeedback fb) {
        return FeedbackResponse.builder()
                .id(fb.getId())
                .performanceId(fb.getPerformance().getId())
                .source(fb.getSource())
                .suggestionText(fb.getSuggestionText())
                .musicalityScore(fb.getMusicalityScore())
                .rating(fb.getRating())
                .measureStart(fb.getMeasureStart())
                .measureEnd(fb.getMeasureEnd())
                .featureTargeted(fb.getFeatureTargeted())
                .createdAt(fb.getCreatedAt())
                .build();
    }
}
