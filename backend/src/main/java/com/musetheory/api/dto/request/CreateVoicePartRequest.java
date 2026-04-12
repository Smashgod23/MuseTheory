package com.musetheory.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateVoicePartRequest {

    @NotBlank(message = "Voice part name is required")
    private String name;

    private String rangeLow;
    private String rangeHigh;
}
