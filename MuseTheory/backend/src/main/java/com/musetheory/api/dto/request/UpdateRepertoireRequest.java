package com.musetheory.api.dto.request;

import com.musetheory.api.enums.RepertoireStatus;
import lombok.Data;

@Data
public class UpdateRepertoireRequest {
    private RepertoireStatus status;
    private String goals;
    private String notes;
}
