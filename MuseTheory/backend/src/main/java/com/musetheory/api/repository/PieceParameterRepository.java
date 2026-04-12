package com.musetheory.api.repository;

import com.musetheory.api.entity.PieceParameter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PieceParameterRepository extends JpaRepository<PieceParameter, UUID> {
    List<PieceParameter> findByPieceId(UUID pieceId);
    Optional<PieceParameter> findByPieceIdAndInstrumentId(UUID pieceId, UUID instrumentId);
}
