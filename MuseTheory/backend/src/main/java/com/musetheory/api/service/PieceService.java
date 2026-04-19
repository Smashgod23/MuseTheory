package com.musetheory.api.service;

import com.musetheory.api.dto.request.CreatePieceRequest;
import com.musetheory.api.dto.response.PieceResponse;
import com.musetheory.api.entity.Piece;
import com.musetheory.api.exception.ResourceNotFoundException;
import com.musetheory.api.repository.PieceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PieceService {

    private final PieceRepository pieceRepository;

    public PieceService(PieceRepository pieceRepository) {
        this.pieceRepository = pieceRepository;
    }

    public List<PieceResponse> getAll() {
        return pieceRepository.findAll().stream()
                .map(PieceResponse::from)
                .toList();
    }

    public List<PieceResponse> search(String q,
                                      String ensembleType,
                                      String style,
                                      String language,
                                      Integer difficultyMin,
                                      Integer difficultyMax) {
        // Empty string (not null) is the "no filter" sentinel. Untyped JDBC nulls
        // get bound as bytea by the Postgres driver, which breaks LOWER(:param).
        String normalizedQ = (q == null || q.isBlank()) ? "" : q.trim();
        String normalizedEnsemble = (ensembleType == null || ensembleType.isBlank()) ? "" : ensembleType.trim();
        String normalizedStyle = (style == null || style.isBlank()) ? "" : style.trim();
        String normalizedLanguage = (language == null || language.isBlank()) ? "" : language.trim();

        return pieceRepository.search(
                normalizedQ,
                normalizedEnsemble,
                normalizedStyle,
                normalizedLanguage,
                difficultyMin,
                difficultyMax
        ).stream().map(PieceResponse::from).toList();
    }

    public PieceResponse getById(UUID id) {
        Piece piece = pieceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Piece", "id", id));
        return PieceResponse.from(piece);
    }

    public Piece getEntityById(UUID id) {
        return pieceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Piece", "id", id));
    }

    @Transactional
    public PieceResponse create(CreatePieceRequest request) {
        Piece piece = applyRequest(Piece.builder().build(), request);
        return PieceResponse.from(pieceRepository.saveAndFlush(piece));
    }

    @Transactional
    public PieceResponse update(UUID id, CreatePieceRequest request) {
        Piece piece = pieceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Piece", "id", id));
        applyRequest(piece, request);
        return PieceResponse.from(pieceRepository.save(piece));
    }

    @Transactional
    public void delete(UUID id) {
        if (!pieceRepository.existsById(id)) {
            throw new ResourceNotFoundException("Piece", "id", id);
        }
        pieceRepository.deleteById(id);
    }

    private Piece applyRequest(Piece piece, CreatePieceRequest r) {
        if (r.getTitle() != null)            piece.setTitle(r.getTitle());
        if (r.getAlternateTitle() != null)   piece.setAlternateTitle(r.getAlternateTitle());
        if (r.getComposer() != null)         piece.setComposer(r.getComposer());
        if (r.getArranger() != null)         piece.setArranger(r.getArranger());
        if (r.getGenre() != null)            piece.setGenre(r.getGenre());
        if (r.getEnsembleType() != null)     piece.setEnsembleType(r.getEnsembleType());
        if (r.getInstrumentation() != null)  piece.setInstrumentation(r.getInstrumentation());
        if (r.getLanguage() != null)         piece.setLanguage(r.getLanguage());
        if (r.getMusicalKey() != null)       piece.setMusicalKey(r.getMusicalKey());
        if (r.getEra() != null)              piece.setEra(r.getEra());
        if (r.getDifficultyLevel() != null)  piece.setDifficultyLevel(r.getDifficultyLevel());
        if (r.getDurationSeconds() != null)  piece.setDurationSeconds(r.getDurationSeconds());
        if (r.getPurpose() != null)          piece.setPurpose(r.getPurpose());
        if (r.getPerformanceNotes() != null) piece.setPerformanceNotes(r.getPerformanceNotes());
        if (r.getSourceReference() != null)  piece.setSourceReference(r.getSourceReference());
        if (r.getSheetMusicUrl() != null)    piece.setSheetMusicUrl(r.getSheetMusicUrl());
        if (r.getScoreUrl() != null)         piece.setScoreUrl(r.getScoreUrl());
        if (r.getMidiRefUrl() != null)       piece.setMidiRefUrl(r.getMidiRefUrl());
        return piece;
    }
}
