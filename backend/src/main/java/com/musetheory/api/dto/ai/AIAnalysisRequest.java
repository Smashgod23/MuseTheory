package com.musetheory.api.dto.ai;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

/**
 * Request sent from Spring Boot to the FastAPI AI microservice.
 * Contains the audio URL and piece context needed for feature extraction + inference.
 */
@Data
@Builder
public class AIAnalysisRequest {
    private UUID performanceId;
    private String audioUrl;
    private UUID pieceId;
    private UUID instrumentId;
    private String repetitionMap;
    private String harmonicTensionMap;
    private String textStressMap;
    private String directorNotes;
}
