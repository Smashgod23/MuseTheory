package com.musetheory.api.dto.ai;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

/**
 * Response received from the FastAPI AI microservice.
 * Contains extracted features and generated coaching suggestions.
 * Deserialized from snake_case to match the AI service contract; the naming
 * strategy is scoped to these DTOs so the public REST API keeps its camelCase JSON.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AIAnalysisResponse {

    private AIFeatureVector featureVector;
    private List<AISuggestion> suggestions;

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
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
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class AISuggestion {
        private String suggestionText;
        private Double musicalityScore;
        private Integer measureStart;
        private Integer measureEnd;
        private String featureTargeted;
    }
}
