package com.musetheory.api.dto.response;

import com.musetheory.api.entity.Instrument;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class InstrumentResponse {
    private UUID id;
    private String name;
    private String type;
    private String rangeLow;
    private String rangeHigh;
    private Instant createdAt;

    public static InstrumentResponse from(Instrument i) {
        return InstrumentResponse.builder()
                .id(i.getId())
                .name(i.getName())
                .type(i.getType())
                .rangeLow(i.getRangeLow())
                .rangeHigh(i.getRangeHigh())
                .createdAt(i.getCreatedAt())
                .build();
    }
}
