package com.musetheory.api.repository;

import com.musetheory.api.entity.RepertoireEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RepertoireEntryRepository extends JpaRepository<RepertoireEntry, UUID> {

    List<RepertoireEntry> findByUserIdOrderByUpdatedAtDesc(UUID userId);

    Optional<RepertoireEntry> findByUserIdAndPieceId(UUID userId, UUID pieceId);

    boolean existsByUserIdAndPieceId(UUID userId, UUID pieceId);
}
