package com.musetheory.api.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateTeacherRequest {

    @NotNull(message = "User ID is required")
    private UUID userId;

    private String institution;
    private String specialization;
    private String bio;
}
