package com.musetheory.api.service;

import com.musetheory.api.dto.ai.AIAnalysisRequest;
import com.musetheory.api.dto.ai.AIAnalysisResponse;
import com.musetheory.api.dto.request.CreatePerformanceRequest;
import com.musetheory.api.dto.response.*;
import com.musetheory.api.entity.*;
import com.musetheory.api.enums.FeedbackSource;
import com.musetheory.api.exception.ResourceNotFoundException;
import com.musetheory.api.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class PerformanceService {

    private static final Logger log = LoggerFactory.getLogger(PerformanceService.class);

    private final PerformanceRepository performanceRepository;
    private final UserRepository userRepository;
    private final PieceRepository pieceRepository;
    private final InstrumentRepository instrumentRepository;
    private final PieceParameterRepository pieceParameterRepository;
    private final FeatureVectorRepository featureVectorRepository;
    private final PerformanceFeedbackRepository feedbackRepository;
    private final S3Service s3Service;
    private final AIServiceClient aiServiceClient;

    public PerformanceService(PerformanceRepository performanceRepository, UserRepository userRepository,
                              PieceRepository pieceRepository, InstrumentRepository instrumentRepository,
                              PieceParameterRepository pieceParameterRepository,
                              FeatureVectorRepository featureVectorRepository,
                              PerformanceFeedbackRepository feedbackRepository,
                              S3Service s3Service, AIServiceClient aiServiceClient) {
        this.performanceRepository = performanceRepository;
        this.userRepository = userRepository;
        this.pieceRepository = pieceRepository;
        this.instrumentRepository = instrumentRepository;
        this.pieceParameterRepository = pieceParameterRepository;
        this.featureVectorRepository = featureVectorRepository;
        this.feedbackRepository = feedbackRepository;
        this.s3Service = s3Service;
        this.aiServiceClient = aiServiceClient;
    }

    /**
     * Full performance upload flow:
     * 1. Validate and save performance metadata
     * 2. Upload audio to S3
     * 3. Call AI microservice for analysis
     * 4. Store feature vector and feedback
     * 5. Return combined response
     */
    @Transactional
    public PerformanceAnalysisResponse createAndAnalyze(UUID userId, CreatePerformanceRequest request,
                                                         MultipartFile audioFile) throws IOException {
        // Resolve foreign keys
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        Piece piece = pieceRepository.findById(request.getPieceId())
                .orElseThrow(() -> new ResourceNotFoundException("Piece", "id", request.getPieceId()));
        Instrument instrument = instrumentRepository.findById(request.getInstrumentId())
                .orElseThrow(() -> new ResourceNotFoundException("Instrument", "id", request.getInstrumentId()));

        // 1. Save performance record
        Performance performance = Performance.builder()
                .user(user)
                .piece(piece)
                .instrument(instrument)
                .durationSeconds(request.getDurationSeconds())
                .recordedAt(request.getRecordedAt())
                .build();
        performance = performanceRepository.save(performance);

        // 2. Upload audio to S3
        String audioUrl = s3Service.uploadAudio(audioFile, performance.getId());
        performance.setAudioUrl(audioUrl);
        performance = performanceRepository.save(performance);

        // 3. Build AI request with piece parameter context
        PieceParameter pieceParams = pieceParameterRepository
                .findByPieceIdAndInstrumentId(piece.getId(), instrument.getId())
                .orElse(null);

        AIAnalysisRequest aiRequest = AIAnalysisRequest.builder()
                .performanceId(performance.getId())
                .audioUrl(audioUrl)
                .pieceId(piece.getId())
                .instrumentId(instrument.getId())
                .repetitionMap(pieceParams != null ? pieceParams.getRepetitionMap() : null)
                .harmonicTensionMap(pieceParams != null ? pieceParams.getHarmonicTensionMap() : null)
                .textStressMap(pieceParams != null ? pieceParams.getTextStressMap() : null)
                .directorNotes(pieceParams != null ? pieceParams.getDirectorNotes() : null)
                .build();

        AIAnalysisResponse aiResponse = aiServiceClient.analyze(aiRequest);

        // 4. Store feature vector
        FeatureVector featureVector = mapFeatureVector(performance, aiResponse.getFeatureVector());
        featureVector = featureVectorRepository.save(featureVector);

        // 5. Store AI-generated feedback
        List<PerformanceFeedback> feedbackList = new ArrayList<>();
        if (aiResponse.getSuggestions() != null) {
            for (AIAnalysisResponse.AISuggestion suggestion : aiResponse.getSuggestions()) {
                PerformanceFeedback feedback = PerformanceFeedback.builder()
                        .performance(performance)
                        .source(FeedbackSource.AI)
                        .suggestionText(suggestion.getSuggestionText())
                        .musicalityScore(suggestion.getMusicalityScore())
                        .measureStart(suggestion.getMeasureStart())
                        .measureEnd(suggestion.getMeasureEnd())
                        .featureTargeted(suggestion.getFeatureTargeted())
                        .build();
                feedbackList.add(feedbackRepository.save(feedback));
            }
        }

        log.info("Performance {} analyzed. {} features extracted, {} suggestions generated.",
                performance.getId(), featureVector.getId(), feedbackList.size());

        // 6. Build combined response
        return PerformanceAnalysisResponse.builder()
                .performance(PerformanceResponse.from(performance))
                .features(FeatureVectorResponse.from(featureVector))
                .feedback(feedbackList.stream().map(FeedbackResponse::from).toList())
                .build();
    }

    public List<PerformanceResponse> getByUserId(UUID userId) {
        return performanceRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(PerformanceResponse::from)
                .toList();
    }

    public PerformanceResponse getById(UUID id) {
        Performance p = performanceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Performance", "id", id));
        return PerformanceResponse.from(p);
    }

    public FeatureVectorResponse getFeatures(UUID performanceId) {
        FeatureVector fv = featureVectorRepository.findByPerformanceId(performanceId)
                .orElseThrow(() -> new ResourceNotFoundException("FeatureVector", "performanceId", performanceId));
        return FeatureVectorResponse.from(fv);
    }

    @Transactional
    public void delete(UUID id) {
        Performance p = performanceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Performance", "id", id));
        s3Service.deleteAudio(p.getAudioUrl());
        performanceRepository.delete(p);
    }

    private FeatureVector mapFeatureVector(Performance performance, AIAnalysisResponse.AIFeatureVector aiFv) {
        return FeatureVector.builder()
                .performance(performance)
                .tempoMean(aiFv.getTempoMean())
                .tempoVariance(aiFv.getTempoVariance())
                .dynamicRange(aiFv.getDynamicRange())
                .rmsEnergyContour(aiFv.getRmsEnergyContour())
                .pitchMean(aiFv.getPitchMean())
                .pitchStability(aiFv.getPitchStability())
                .vibratoRate(aiFv.getVibratoRate())
                .vibratoExtent(aiFv.getVibratoExtent())
                .spectralCentroidMean(aiFv.getSpectralCentroidMean())
                .mfccSummary(aiFv.getMfccSummary())
                .onsetDensity(aiFv.getOnsetDensity())
                .articulationStyle(aiFv.getArticulationStyle())
                .contrastScore(aiFv.getContrastScore())
                .phraseLengthVariance(aiFv.getPhraseLengthVariance())
                .breathPlacement(aiFv.getBreathPlacement())
                .harmonicDeviation(aiFv.getHarmonicDeviation())
                .build();
    }
}
