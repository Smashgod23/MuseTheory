package com.musetheory.api.controller;

import com.musetheory.api.dto.request.CreatePieceParameterRequest;
import com.musetheory.api.dto.response.PieceParameterResponse;
import com.musetheory.api.service.PieceParameterService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class PieceParameterController {

    private final PieceParameterService pieceParameterService;

    public PieceParameterController(PieceParameterService pieceParameterService) {
        this.pieceParameterService = pieceParameterService;
    }

    @GetMapping("/api/pieces/{pieceId}/parameters")
    public ResponseEntity<List<PieceParameterResponse>> getByPieceId(@PathVariable UUID pieceId) {
        return ResponseEntity.ok(pieceParameterService.getByPieceId(pieceId));
    }

    @PostMapping("/api/pieces/{pieceId}/parameters")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<PieceParameterResponse> create(@PathVariable UUID pieceId,
                                                          @Valid @RequestBody CreatePieceParameterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pieceParameterService.create(pieceId, request));
    }

    @PutMapping("/api/piece-parameters/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<PieceParameterResponse> update(@PathVariable UUID id,
                                                          @Valid @RequestBody CreatePieceParameterRequest request) {
        return ResponseEntity.ok(pieceParameterService.update(id, request));
    }

    @DeleteMapping("/api/piece-parameters/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        pieceParameterService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
