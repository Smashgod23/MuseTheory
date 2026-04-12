package com.musetheory.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateInstrumentRequest {

    @NotBlank(message = "Instrument name is required")
    private String name;

    @NotBlank(message = "Instrument type is required")
    private String type;

    private String rangeLow;
    private String rangeHigh;
}
