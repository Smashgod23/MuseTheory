package com.musetheory.api.service;

import com.musetheory.api.dto.request.LogPracticeRequest;
import com.musetheory.api.dto.request.SaveRepertoireRequest;
import com.musetheory.api.dto.request.UpdateRepertoireRequest;
import com.musetheory.api.dto.response.FeedbackResponse;
import com.musetheory.api.dto.response.PerformanceResponse;
import com.musetheory.api.dto.response.PracticeSessionResponse;
import com.musetheory.api.dto.response.RepertoireDetailResponse;
import com.musetheory.api.dto.response.RepertoireEntryResponse;
import com.musetheory.api.entity.Piece;
import com.musetheory.api.entity.PracticeSession;
import com.musetheory.api.entity.RepertoireEntry;
import com.musetheory.api.entity.User;
import com.musetheory.api.enums.RepertoireStatus;
import com.musetheory.api.exception.DuplicateResourceException;
import com.musetheory.api.exception.ResourceNotFoundException;
import com.musetheory.api.repository.PerformanceFeedbackRepository;
import com.musetheory.api.repository.PerformanceRepository;
import com.musetheory.api.repository.PieceRepository;
import com.musetheory.api.repository.PracticeSessionRepository;
import com.musetheory.api.repository.RepertoireEntryRepository;
import com.musetheory.api.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class RepertoireService {

    private final RepertoireEntryRepository repertoireRepository;
    private final PracticeSessionRepository practiceRepository;
    private final PerformanceRepository performanceRepository;
    private final PerformanceFeedbackRepository feedbackRepository;
    private final PieceRepository pieceRepository;
    private final UserRepository userRepository;

    public RepertoireService(RepertoireEntryRepository repertoireRepository,
                              PracticeSessionRepository practiceRepository,
                              PerformanceRepository performanceRepository,
                              PerformanceFeedbackRepository feedbackRepository,
                              PieceRepository pieceRepository,
                              UserRepository userRepository) {
        this.repertoireRepository = repertoireRepository;
        this.practiceRepository = practiceRepository;
        this.performanceRepository = performanceRepository;
        this.feedbackRepository = feedbackRepository;
        this.pieceRepository = pieceRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public RepertoireEntryResponse save(UUID userId, SaveRepertoireRequest request) {
        if (repertoireRepository.existsByUserIdAndPieceId(userId, request.getPieceId())) {
            throw new DuplicateResourceException("Piece is already in your repertoire");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        Piece piece = pieceRepository.findById(request.getPieceId())
                .orElseThrow(() -> new ResourceNotFoundException("Piece", "id", request.getPieceId()));

        RepertoireEntry entry = RepertoireEntry.builder()
                .user(user)
                .piece(piece)
                .status(request.getStatus() != null ? request.getStatus() : RepertoireStatus.NEW)
                .goals(request.getGoals())
                .notes(request.getNotes())
                .build();

        return RepertoireEntryResponse.from(repertoireRepository.saveAndFlush(entry));
    }

    @Transactional(readOnly = true)
    public List<RepertoireEntryResponse> listForUser(UUID userId) {
        return repertoireRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(RepertoireEntryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public RepertoireDetailResponse getDetail(UUID userId, UUID entryId) {
        RepertoireEntry entry = loadOwnedEntry(userId, entryId);
        UUID pieceId = entry.getPiece().getId();

        List<PracticeSessionResponse> sessions = practiceRepository
                .findByRepertoireEntryIdOrderByPracticedAtDesc(entryId).stream()
                .map(PracticeSessionResponse::from)
                .toList();

        List<PerformanceResponse> performances = performanceRepository
                .findByUserIdAndPieceIdOrderByCreatedAtDesc(entry.getUser().getId(), pieceId).stream()
                .map(PerformanceResponse::from)
                .toList();

        List<FeedbackResponse> feedback = feedbackRepository
                .findByPerformanceUserIdAndPerformancePieceIdOrderByCreatedAtDesc(
                        entry.getUser().getId(), pieceId).stream()
                .map(FeedbackResponse::from)
                .toList();

        return RepertoireDetailResponse.builder()
                .entry(RepertoireEntryResponse.from(entry))
                .practiceSessions(sessions)
                .performances(performances)
                .feedback(feedback)
                .build();
    }

    @Transactional
    public RepertoireEntryResponse update(UUID userId, UUID entryId, UpdateRepertoireRequest request) {
        RepertoireEntry entry = loadOwnedEntry(userId, entryId);
        if (request.getStatus() != null) entry.setStatus(request.getStatus());
        if (request.getGoals() != null)  entry.setGoals(request.getGoals());
        if (request.getNotes() != null)  entry.setNotes(request.getNotes());
        return RepertoireEntryResponse.from(repertoireRepository.saveAndFlush(entry));
    }

    @Transactional
    public void delete(UUID userId, UUID entryId) {
        RepertoireEntry entry = loadOwnedEntry(userId, entryId);
        repertoireRepository.delete(entry);
    }

    @Transactional
    public PracticeSessionResponse logPractice(UUID userId, UUID entryId, LogPracticeRequest request) {
        RepertoireEntry entry = loadOwnedEntry(userId, entryId);

        PracticeSession session = PracticeSession.builder()
                .repertoireEntry(entry)
                .durationMinutes(request.getDurationMinutes())
                .notes(request.getNotes())
                .practicedAt(request.getPracticedAt() != null ? request.getPracticedAt() : Instant.now())
                .build();

        return PracticeSessionResponse.from(practiceRepository.saveAndFlush(session));
    }

    @Transactional(readOnly = true)
    public List<PracticeSessionResponse> listPracticeSessions(UUID userId, UUID entryId) {
        loadOwnedEntry(userId, entryId);
        return practiceRepository.findByRepertoireEntryIdOrderByPracticedAtDesc(entryId).stream()
                .map(PracticeSessionResponse::from)
                .toList();
    }

    /**
     * Teacher/admin view of a student's full repertoire. Does not enforce
     * the ownership check (the caller's role is checked at the controller).
     */
    @Transactional(readOnly = true)
    public List<RepertoireEntryResponse> listForStudent(UUID studentId) {
        return repertoireRepository.findByUserIdOrderByUpdatedAtDesc(studentId).stream()
                .map(RepertoireEntryResponse::from)
                .toList();
    }

    private RepertoireEntry loadOwnedEntry(UUID userId, UUID entryId) {
        RepertoireEntry entry = repertoireRepository.findById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("RepertoireEntry", "id", entryId));
        if (!entry.getUser().getId().equals(userId)) {
            throw new AccessDeniedException("This repertoire entry does not belong to you");
        }
        return entry;
    }
}
