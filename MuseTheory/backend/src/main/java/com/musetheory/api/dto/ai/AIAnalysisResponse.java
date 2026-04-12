package com.musetheory.api.dto.ai;

import lombok.Data;

import java.util.List;

/**
 * Response received from the FastAPI AI microservice.
 * Contains extracted features and generated coaching suggestions.
 */
@Data
public class AIAnalysisResponse {

    private AIFeatureVector featureVector;
    private List<AISuggestion> suggestions;

    @Data
    public static class AIFeatureVector {
        private Double tempoMean;
        private Double tempoVariance;
        private Double dynamicRange;
        private String rmsEnergyContour;
        private Double pitchMean;
        private Double pitchStability;
        private Double vibratoRate;
        private Double vibratoExtent;
        private Double spectralCentroidMean;
        private String mfccSummary;
        private Double onsetDensity;
        private Double articulationStyle;
        private Double contrastScore;
        private Double phraseLengthVariance;
        private String breathPlacement;
        private Double harmonicDeviation;
    }

    @Data
    public static class AISuggestion {
        private String suggestionText;
        private Double musicalityScore;
        private Integer measureStart;
        private Integer measureEnd;
        private String featureTargeted;
    }
}
