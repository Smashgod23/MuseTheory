package com.musetheory.api.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreatePieceParameterRequest {

    @NotNull(message = "Instrument ID is required")
    private UUID instrumentId;

    private String repetitionMap;
    private String harmonicTensionMap;
    private String textStressMap;
    private String directorNotes;
}
