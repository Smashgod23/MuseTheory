package com.musetheory.api.dto.response;

import com.musetheory.api.entity.PieceParameter;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class PieceParameterResponse {
    private UUID id;
    private UUID pieceId;
    private UUID instrumentId;
    private String repetitionMap;
    private String harmonicTensionMap;
    private String textStressMap;
    private String directorNotes;
    private Instant createdAt;
    private Instant updatedAt;

    public static PieceParameterResponse from(PieceParameter pp) {
        return PieceParameterResponse.builder()
                .id(pp.getId())
                .pieceId(pp.getPiece().getId())
                .instrumentId(pp.getInstrument().getId())
                .repetitionMap(pp.getRepetitionMap())
                .harmonicTensionMap(pp.getHarmonicTensionMap())
                .textStressMap(pp.getTextStressMap())
                .directorNotes(pp.getDirectorNotes())
                .createdAt(pp.getCreatedAt())
                .updatedAt(pp.getUpdatedAt())
                .build();
    }
}
