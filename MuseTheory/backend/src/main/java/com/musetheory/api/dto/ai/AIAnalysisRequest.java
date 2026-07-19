package com.musetheory.api.dto.ai;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.util.Map;
import java.util.UUID;

/**
 * Request sent from Spring Boot to the FastAPI AI microservice.
 * Contains the audio URL and piece context needed for feature extraction + inference.
 * Serialized as snake_case to match the AI service contract; the naming strategy is
 * scoped to this DTO so the public REST API keeps its camelCase JSON.
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AIAnalysisRequest {
    private UUID performanceId;
    private String audioUrl;
    private UUID pieceId;
    private UUID instrumentId;
    private String repetitionMap;
    private String harmonicTensionMap;
    private String textStressMap;
    private String directorNotes;

    // Personalization: the singer's own history on this piece. userBaseline maps a
    // feature name (snake_case, matching the AI feature_vector keys) to their median
    // value across prior takes; baselineTakes is how many takes it summarizes. Both
    // null on a first take, so the AI service coaches exactly as before.
    private Map<String, Double> userBaseline;
    private Integer baselineTakes;
}
