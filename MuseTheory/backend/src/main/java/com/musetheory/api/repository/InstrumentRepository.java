package com.musetheory.api.repository;

import com.musetheory.api.entity.Instrument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InstrumentRepository extends JpaRepository<Instrument, UUID> {
    boolean existsByName(String name);
    List<Instrument> findByTypeIgnoreCase(String type);
}
