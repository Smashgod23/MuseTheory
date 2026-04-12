package com.musetheory.api.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Full response returned after a performance upload and AI analysis.
 * Wraps the performance metadata, extracted features, and AI-generated feedback.
 */
@Data
@Builder
public class PerformanceAnalysisResponse {
    private PerformanceResponse performance;
    private FeatureVectorResponse features;
    private List<FeedbackResponse> feedback;
}
