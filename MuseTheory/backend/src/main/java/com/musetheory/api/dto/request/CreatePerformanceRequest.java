package com.musetheory.api.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
public class CreatePerformanceRequest {

    @NotNull(message = "Piece ID is required")
    private UUID pieceId;

    @NotNull(message = "Instrument ID is required")
    private UUID instrumentId;

    private Double durationSeconds;
    private Instant recordedAt;
}
