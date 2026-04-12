package com.musetheory.api.controller;

import com.musetheory.api.dto.request.CreatePieceRequest;
import com.musetheory.api.dto.response.PieceResponse;
import com.musetheory.api.service.PieceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/pieces")
public class PieceController {

    private final PieceService pieceService;

    public PieceController(PieceService pieceService) {
        this.pieceService = pieceService;
    }

    @GetMapping
    public ResponseEntity<List<PieceResponse>> getAll() {
        return ResponseEntity.ok(pieceService.getAll());
    }

    @GetMapping("/search")
    public ResponseEntity<List<PieceResponse>> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String ensembleType,
            @RequestParam(required = false) String style,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) Integer difficultyMin,
            @RequestParam(required = false) Integer difficultyMax) {
        return ResponseEntity.ok(
                pieceService.search(q, ensembleType, style, language, difficultyMin, difficultyMax)
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<PieceResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(pieceService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<PieceResponse> create(@Valid @RequestBody CreatePieceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pieceService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<PieceResponse> update(@PathVariable UUID id,
                                                 @Valid @RequestBody CreatePieceRequest request) {
        return ResponseEntity.ok(pieceService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        pieceService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
