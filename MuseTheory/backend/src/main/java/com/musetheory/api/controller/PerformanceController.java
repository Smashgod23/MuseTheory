package com.musetheory.api.controller;

import com.musetheory.api.dto.request.CreateFeedbackRequest;
import com.musetheory.api.dto.request.CreatePerformanceRequest;
import com.musetheory.api.dto.response.FeedbackResponse;
import com.musetheory.api.dto.response.FeatureVectorResponse;
import com.musetheory.api.dto.response.PerformanceAnalysisResponse;
import com.musetheory.api.dto.response.PerformanceResponse;
import com.musetheory.api.security.CustomUserDetails;
import com.musetheory.api.service.FeedbackService;
import com.musetheory.api.service.PerformanceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/performances")
public class PerformanceController {

    private final PerformanceService performanceService;
    private final FeedbackService feedbackService;

    public PerformanceController(PerformanceService performanceService, FeedbackService feedbackService) {
        this.performanceService = performanceService;
        this.feedbackService = feedbackService;
    }

    /**
     * Upload a performance recording and trigger AI analysis.
     * Accepts multipart form data: audio file + JSON metadata.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PerformanceAnalysisResponse> create(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestPart("metadata") CreatePerformanceRequest request,
            @RequestPart("audio") MultipartFile audioFile) throws IOException {

        PerformanceAnalysisResponse response = performanceService.createAndAnalyze(
                userDetails.getUser().getId(), request, audioFile);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<PerformanceResponse>> getMyPerformances(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(performanceService.getByUserId(userDetails.getUser().getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PerformanceResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(performanceService.getById(id));
    }

    @GetMapping("/{id}/features")
    public ResponseEntity<FeatureVectorResponse> getFeatures(@PathVariable UUID id) {
        return ResponseEntity.ok(performanceService.getFeatures(id));
    }

    @GetMapping("/{id}/feedback")
    public ResponseEntity<List<FeedbackResponse>> getFeedback(@PathVariable UUID id) {
        return ResponseEntity.ok(feedbackService.getByPerformanceId(id));
    }

    @PostMapping("/{id}/feedback")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<FeedbackResponse> addHumanFeedback(@PathVariable UUID id,
                                                              @Valid @RequestBody CreateFeedbackRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(feedbackService.createHumanFeedback(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        performanceService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
