package com.musetheory.api.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;

@Data
public class LogPracticeRequest {

    @NotNull(message = "durationMinutes is required")
    @Min(value = 1, message = "durationMinutes must be at least 1")
    @Max(value = 1440, message = "durationMinutes cannot exceed 1440 (24 hours)")
    private Integer durationMinutes;

    private String notes;

    // Optional. Defaults to now if omitted.
    private Instant practicedAt;
}
