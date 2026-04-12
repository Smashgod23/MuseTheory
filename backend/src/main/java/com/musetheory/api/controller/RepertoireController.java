package com.musetheory.api.controller;

import com.musetheory.api.dto.request.LogPracticeRequest;
import com.musetheory.api.dto.request.SaveRepertoireRequest;
import com.musetheory.api.dto.request.UpdateRepertoireRequest;
import com.musetheory.api.dto.response.PracticeSessionResponse;
import com.musetheory.api.dto.response.RepertoireDetailResponse;
import com.musetheory.api.dto.response.RepertoireEntryResponse;
import com.musetheory.api.security.CustomUserDetails;
import com.musetheory.api.service.RepertoireService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/repertoire")
public class RepertoireController {

    private final RepertoireService repertoireService;

    public RepertoireController(RepertoireService repertoireService) {
        this.repertoireService = repertoireService;
    }

    @PostMapping
    public ResponseEntity<RepertoireEntryResponse> save(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody SaveRepertoireRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(repertoireService.save(userDetails.getUser().getId(), request));
    }

    @GetMapping
    public ResponseEntity<List<RepertoireEntryResponse>> list(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(repertoireService.listForUser(userDetails.getUser().getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RepertoireDetailResponse> getDetail(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(repertoireService.getDetail(userDetails.getUser().getId(), id));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<RepertoireEntryResponse> update(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRepertoireRequest request) {
        return ResponseEntity.ok(repertoireService.update(userDetails.getUser().getId(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id) {
        repertoireService.delete(userDetails.getUser().getId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/practice-sessions")
    public ResponseEntity<PracticeSessionResponse> logPractice(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody LogPracticeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(repertoireService.logPractice(userDetails.getUser().getId(), id, request));
    }

    @GetMapping("/{id}/practice-sessions")
    public ResponseEntity<List<PracticeSessionResponse>> listPractice(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(repertoireService.listPracticeSessions(userDetails.getUser().getId(), id));
    }

    /**
     * Teacher/admin view of a student's full repertoire.
     */
    @GetMapping("/student/{studentId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<List<RepertoireEntryResponse>> listForStudent(@PathVariable UUID studentId) {
        return ResponseEntity.ok(repertoireService.listForStudent(studentId));
    }
}
