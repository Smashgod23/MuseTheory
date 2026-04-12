package com.musetheory.api.service;

import com.musetheory.api.dto.request.CreateInstrumentRequest;
import com.musetheory.api.dto.request.CreateVoicePartRequest;
import com.musetheory.api.dto.response.InstrumentResponse;
import com.musetheory.api.entity.Instrument;
import com.musetheory.api.exception.DuplicateResourceException;
import com.musetheory.api.exception.ResourceNotFoundException;
import com.musetheory.api.repository.InstrumentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class InstrumentService {

    private final InstrumentRepository instrumentRepository;

    public InstrumentService(InstrumentRepository instrumentRepository) {
        this.instrumentRepository = instrumentRepository;
    }

    public List<InstrumentResponse> getAll() {
        return instrumentRepository.findAll().stream()
                .map(InstrumentResponse::from)
                .toList();
    }

    public List<InstrumentResponse> getByType(String type) {
        return instrumentRepository.findByTypeIgnoreCase(type).stream()
                .map(InstrumentResponse::from)
                .toList();
    }

    public InstrumentResponse getById(UUID id) {
        Instrument instrument = instrumentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Instrument", "id", id));
        return InstrumentResponse.from(instrument);
    }

    @Transactional
    public InstrumentResponse create(CreateInstrumentRequest request) {
        if (instrumentRepository.existsByName(request.getName())) {
            throw new DuplicateResourceException("Instrument with this name already exists");
        }

        Instrument instrument = Instrument.builder()
                .name(request.getName())
                .type(request.getType())
                .rangeLow(request.getRangeLow())
                .rangeHigh(request.getRangeHigh())
                .build();

        // saveAndFlush so @CreationTimestamp fires before we build the response.
        // The UUID id generator is in-memory, so a plain save() defers the INSERT
        // until commit and createdAt comes back null.
        return InstrumentResponse.from(instrumentRepository.saveAndFlush(instrument));
    }

    @Transactional
    public InstrumentResponse createVoicePart(CreateVoicePartRequest request) {
        if (instrumentRepository.existsByName(request.getName())) {
            throw new DuplicateResourceException("An instrument or voice part with this name already exists");
        }

        Instrument voicePart = Instrument.builder()
                .name(request.getName())
                .type("voice")
                .rangeLow(request.getRangeLow())
                .rangeHigh(request.getRangeHigh())
                .build();

        return InstrumentResponse.from(instrumentRepository.saveAndFlush(voicePart));
    }

    @Transactional
    public InstrumentResponse update(UUID id, CreateInstrumentRequest request) {
        Instrument instrument = instrumentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Instrument", "id", id));

        if (request.getName() != null) instrument.setName(request.getName());
        if (request.getType() != null) instrument.setType(request.getType());
        if (request.getRangeLow() != null) instrument.setRangeLow(request.getRangeLow());
        if (request.getRangeHigh() != null) instrument.setRangeHigh(request.getRangeHigh());

        return InstrumentResponse.from(instrumentRepository.save(instrument));
    }

    @Transactional
    public void delete(UUID id) {
        if (!instrumentRepository.existsById(id)) {
            throw new ResourceNotFoundException("Instrument", "id", id);
        }
        instrumentRepository.deleteById(id);
    }
}
