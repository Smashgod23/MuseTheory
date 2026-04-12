package com.musetheory.api.dto.response;

import com.musetheory.api.entity.Performance;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class PerformanceResponse {
    private UUID id;
    private UUID userId;
    private UUID pieceId;
    private UUID instrumentId;
    private String audioUrl;
    private Double durationSeconds;
    private Instant recordedAt;
    private Instant createdAt;

    public static PerformanceResponse from(Performance p) {
        return PerformanceResponse.builder()
                .id(p.getId())
                .userId(p.getUser().getId())
                .pieceId(p.getPiece().getId())
                .instrumentId(p.getInstrument().getId())
                .audioUrl(p.getAudioUrl())
                .durationSeconds(p.getDurationSeconds())
                .recordedAt(p.getRecordedAt())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
