package com.musetheory.api.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateFeedbackRequest {

    @NotBlank(message = "Suggestion text is required")
    private String suggestionText;

    @Min(1) @Max(10)
    private Double musicalityScore;

    @Min(1) @Max(5)
    private Integer rating;

    private Integer measureStart;
    private Integer measureEnd;
    private String featureTargeted;
}
