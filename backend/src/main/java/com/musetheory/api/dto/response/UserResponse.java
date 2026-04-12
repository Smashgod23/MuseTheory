package com.musetheory.api.dto.response;

import com.musetheory.api.entity.User;
import com.musetheory.api.enums.Role;
import com.musetheory.api.enums.SkillLevel;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class UserResponse {
    private UUID id;
    private String email;
    private String firstName;
    private String lastName;
    private Role role;
    private SkillLevel skillLevel;
    private String musicalGoals;
    private UUID teacherId;
    private UUID instrumentId;
    private Instant createdAt;

    public static UserResponse from(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(user.getRole())
                .skillLevel(user.getSkillLevel())
                .musicalGoals(user.getMusicalGoals())
                .teacherId(user.getTeacher() != null ? user.getTeacher().getId() : null)
                .instrumentId(user.getInstrument() != null ? user.getInstrument().getId() : null)
                .createdAt(user.getCreatedAt())
                .build();
    }
}
