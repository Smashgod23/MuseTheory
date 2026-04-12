package com.musetheory.api.dto.response;

import com.musetheory.api.entity.PracticeSession;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class PracticeSessionResponse {
    private UUID id;
    private UUID repertoireEntryId;
    private Integer durationMinutes;
    private String notes;
    private Instant practicedAt;
    private Instant createdAt;

    public static PracticeSessionResponse from(PracticeSession s) {
        return PracticeSessionResponse.builder()
                .id(s.getId())
                .repertoireEntryId(s.getRepertoireEntry().getId())
                .durationMinutes(s.getDurationMinutes())
                .notes(s.getNotes())
                .practicedAt(s.getPracticedAt())
                .createdAt(s.getCreatedAt())
                .build();
    }
}
