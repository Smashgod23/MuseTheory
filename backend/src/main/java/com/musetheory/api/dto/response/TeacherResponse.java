package com.musetheory.api.dto.response;

import com.musetheory.api.entity.Teacher;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class TeacherResponse {
    private UUID id;
    private UUID userId;
    private String institution;
    private String specialization;
    private String bio;
    private Instant createdAt;

    public static TeacherResponse from(Teacher t) {
        return TeacherResponse.builder()
                .id(t.getId())
                .userId(t.getUser().getId())
                .institution(t.getInstitution())
                .specialization(t.getSpecialization())
                .bio(t.getBio())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
