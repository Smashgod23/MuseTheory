package com.musetheory.api.controller;

import com.musetheory.api.dto.request.CreateInstrumentRequest;
import com.musetheory.api.dto.request.CreateVoicePartRequest;
import com.musetheory.api.dto.response.InstrumentResponse;
import com.musetheory.api.service.InstrumentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/instruments")
public class InstrumentController {

    private final InstrumentService instrumentService;

    public InstrumentController(InstrumentService instrumentService) {
        this.instrumentService = instrumentService;
    }

    @GetMapping
    public ResponseEntity<List<InstrumentResponse>> getAll() {
        return ResponseEntity.ok(instrumentService.getAll());
    }

    // Literal path must be declared before the {id} route so Spring does not
    // try to parse "voice-parts" as a UUID.
    @GetMapping("/voice-parts")
    public ResponseEntity<List<InstrumentResponse>> getVoiceParts() {
        return ResponseEntity.ok(instrumentService.getByType("voice"));
    }

    @PostMapping("/voice-parts")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<InstrumentResponse> createVoicePart(@Valid @RequestBody CreateVoicePartRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(instrumentService.createVoicePart(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<InstrumentResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(instrumentService.getById(id));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<InstrumentResponse> create(@Valid @RequestBody CreateInstrumentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(instrumentService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<InstrumentResponse> update(@PathVariable UUID id,
                                                      @Valid @RequestBody CreateInstrumentRequest request) {
        return ResponseEntity.ok(instrumentService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        instrumentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
