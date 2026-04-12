package com.musetheory.api.dto.request;

import com.musetheory.api.enums.RepertoireStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class SaveRepertoireRequest {

    @NotNull(message = "pieceId is required")
    private UUID pieceId;

    private RepertoireStatus status;
    private String goals;
    private String notes;
}
