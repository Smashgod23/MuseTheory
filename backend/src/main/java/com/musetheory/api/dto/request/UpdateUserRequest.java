package com.musetheory.api.dto.request;

import com.musetheory.api.enums.SkillLevel;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class UpdateUserRequest {

    @Size(max = 100)
    private String firstName;

    @Size(max = 100)
    private String lastName;

    private SkillLevel skillLevel;
    private String musicalGoals;
    private UUID instrumentId;
    private UUID teacherId;
}
