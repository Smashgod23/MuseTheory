package com.musetheory.api.dto.response;

import com.musetheory.api.entity.RepertoireEntry;
import com.musetheory.api.enums.RepertoireStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class RepertoireEntryResponse {
    private UUID id;
    private UUID userId;
    private PieceResponse piece;
    private RepertoireStatus status;
    private String goals;
    private String notes;
    private Instant addedAt;
    private Instant updatedAt;

    public static RepertoireEntryResponse from(RepertoireEntry e) {
        return RepertoireEntryResponse.builder()
                .id(e.getId())
                .userId(e.getUser().getId())
                .piece(PieceResponse.from(e.getPiece()))
                .status(e.getStatus())
                .goals(e.getGoals())
                .notes(e.getNotes())
                .addedAt(e.getAddedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
