package com.musetheory.api.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Full repertoire view for a single piece in a student's library:
 * the entry itself, their practice log, any performances they've
 * uploaded for this piece, and the feedback history tied to those
 * performances.
 */
@Data
@Builder
public class RepertoireDetailResponse {
    private RepertoireEntryResponse entry;
    private List<PracticeSessionResponse> practiceSessions;
    private List<PerformanceResponse> performances;
    private List<FeedbackResponse> feedback;
}
