package com.musetheory.api.service;

import com.musetheory.api.dto.request.CreatePieceParameterRequest;
import com.musetheory.api.dto.response.PieceParameterResponse;
import com.musetheory.api.entity.Instrument;
import com.musetheory.api.entity.Piece;
import com.musetheory.api.entity.PieceParameter;
import com.musetheory.api.exception.DuplicateResourceException;
import com.musetheory.api.exception.ResourceNotFoundException;
import com.musetheory.api.repository.InstrumentRepository;
import com.musetheory.api.repository.PieceParameterRepository;
import com.musetheory.api.repository.PieceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PieceParameterService {

    private final PieceParameterRepository pieceParameterRepository;
    private final PieceRepository pieceRepository;
    private final InstrumentRepository instrumentRepository;

    public PieceParameterService(PieceParameterRepository pieceParameterRepository,
                                 PieceRepository pieceRepository,
                                 InstrumentRepository instrumentRepository) {
        this.pieceParameterRepository = pieceParameterRepository;
        this.pieceRepository = pieceRepository;
        this.instrumentRepository = instrumentRepository;
    }

    public List<PieceParameterResponse> getByPieceId(UUID pieceId) {
        return pieceParameterRepository.findByPieceId(pieceId).stream()
                .map(PieceParameterResponse::from)
                .toList();
    }

    @Transactional
    public PieceParameterResponse create(UUID pieceId, CreatePieceParameterRequest request) {
        Piece piece = pieceRepository.findById(pieceId)
                .orElseThrow(() -> new ResourceNotFoundException("Piece", "id", pieceId));
        Instrument instrument = instrumentRepository.findById(request.getInstrumentId())
                .orElseThrow(() -> new ResourceNotFoundException("Instrument", "id", request.getInstrumentId()));

        if (pieceParameterRepository.findByPieceIdAndInstrumentId(pieceId, request.getInstrumentId()).isPresent()) {
            throw new DuplicateResourceException(
                    "Parameters already exist for this piece and instrument combination");
        }

        PieceParameter param = PieceParameter.builder()
                .piece(piece)
                .instrument(instrument)
                .repetitionMap(request.getRepetitionMap())
                .harmonicTensionMap(request.getHarmonicTensionMap())
                .textStressMap(request.getTextStressMap())
                .directorNotes(request.getDirectorNotes())
                .build();

        return PieceParameterResponse.from(pieceParameterRepository.save(param));
    }

    @Transactional
    public PieceParameterResponse update(UUID id, CreatePieceParameterRequest request) {
        PieceParameter param = pieceParameterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PieceParameter", "id", id));

        if (request.getRepetitionMap() != null) param.setRepetitionMap(request.getRepetitionMap());
        if (request.getHarmonicTensionMap() != null) param.setHarmonicTensionMap(request.getHarmonicTensionMap());
        if (request.getTextStressMap() != null) param.setTextStressMap(request.getTextStressMap());
        if (request.getDirectorNotes() != null) param.setDirectorNotes(request.getDirectorNotes());

        return PieceParameterResponse.from(pieceParameterRepository.save(param));
    }

    @Transactional
    public void delete(UUID id) {
        if (!pieceParameterRepository.existsById(id)) {
            throw new ResourceNotFoundException("PieceParameter", "id", id);
        }
        pieceParameterRepository.deleteById(id);
    }
}
