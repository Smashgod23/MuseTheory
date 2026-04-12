package com.musetheory.api.service;

import com.musetheory.api.dto.request.CreateFeedbackRequest;
import com.musetheory.api.dto.request.UpdateFeedbackRequest;
import com.musetheory.api.dto.response.FeedbackResponse;
import com.musetheory.api.entity.Performance;
import com.musetheory.api.entity.PerformanceFeedback;
import com.musetheory.api.enums.FeedbackSource;
import com.musetheory.api.exception.ResourceNotFoundException;
import com.musetheory.api.repository.PerformanceFeedbackRepository;
import com.musetheory.api.repository.PerformanceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class FeedbackService {

    private final PerformanceFeedbackRepository feedbackRepository;
    private final PerformanceRepository performanceRepository;

    public FeedbackService(PerformanceFeedbackRepository feedbackRepository,
                           PerformanceRepository performanceRepository) {
        this.feedbackRepository = feedbackRepository;
        this.performanceRepository = performanceRepository;
    }

    public List<FeedbackResponse> getByPerformanceId(UUID performanceId) {
        return feedbackRepository.findByPerformanceId(performanceId).stream()
                .map(FeedbackResponse::from)
                .toList();
    }

    @Transactional
    public FeedbackResponse createHumanFeedback(UUID performanceId, CreateFeedbackRequest request) {
        Performance performance = performanceRepository.findById(performanceId)
                .orElseThrow(() -> new ResourceNotFoundException("Performance", "id", performanceId));

        PerformanceFeedback feedback = PerformanceFeedback.builder()
                .performance(performance)
                .source(FeedbackSource.HUMAN)
                .suggestionText(request.getSuggestionText())
                .musicalityScore(request.getMusicalityScore())
                .rating(request.getRating())
                .measureStart(request.getMeasureStart())
                .measureEnd(request.getMeasureEnd())
                .featureTargeted(request.getFeatureTargeted())
                .build();

        return FeedbackResponse.from(feedbackRepository.save(feedback));
    }

    @Transactional
    public FeedbackResponse update(UUID id, UpdateFeedbackRequest request) {
        PerformanceFeedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback", "id", id));

        if (request.getSuggestionText() != null) feedback.setSuggestionText(request.getSuggestionText());
        if (request.getMusicalityScore() != null) feedback.setMusicalityScore(request.getMusicalityScore());
        if (request.getRating() != null) feedback.setRating(request.getRating());
        if (request.getMeasureStart() != null) feedback.setMeasureStart(request.getMeasureStart());
        if (request.getMeasureEnd() != null) feedback.setMeasureEnd(request.getMeasureEnd());
        if (request.getFeatureTargeted() != null) feedback.setFeatureTargeted(request.getFeatureTargeted());

        return FeedbackResponse.from(feedbackRepository.save(feedback));
    }

    @Transactional
    public void delete(UUID id) {
        if (!feedbackRepository.existsById(id)) {
            throw new ResourceNotFoundException("Feedback", "id", id);
        }
        feedbackRepository.deleteById(id);
    }
}
