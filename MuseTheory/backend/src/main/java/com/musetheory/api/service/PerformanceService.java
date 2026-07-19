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
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

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

        // Personalize against the singer's own history on this piece: summarize
        // their prior takes into a per-feature median the AI service can coach
        // against ("narrower than your usual here"). Empty on a first take.
        List<FeatureVector> history = featureVectorRepository
                .findHistoryForUserAndPiece(user.getId(), piece.getId(), performance.getId());
        Map<String, Double> userBaseline = computeBaseline(history);
        if (!userBaseline.isEmpty()) {
            log.info("Performance {}: personalizing against {} prior takes; baseline features {}",
                    performance.getId(), history.size(), userBaseline.keySet());
        }

        AIAnalysisRequest aiRequest = AIAnalysisRequest.builder()
                .performanceId(performance.getId())
                .audioUrl(audioUrl)
                .pieceId(piece.getId())
                .instrumentId(instrument.getId())
                .repetitionMap(pieceParams != null ? pieceParams.getRepetitionMap() : null)
                .harmonicTensionMap(pieceParams != null ? pieceParams.getHarmonicTensionMap() : null)
                .textStressMap(pieceParams != null ? pieceParams.getTextStressMap() : null)
                .directorNotes(pieceParams != null ? pieceParams.getDirectorNotes() : null)
                .userBaseline(userBaseline.isEmpty() ? null : userBaseline)
                .baselineTakes(userBaseline.isEmpty() ? null : history.size())
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

    /**
     * Summarize a singer's prior takes of a piece into a per-feature median (their
     * "usual"). Only features whose direction has a clear coaching meaning are
     * included, and only when at least two prior takes actually measured them, so a
     * single noisy value never becomes a baseline. Keys are snake_case to match the
     * AI service's feature_vector names. Returns empty when there is not enough
     * history, in which case the caller sends no baseline and coaching is unchanged.
     */
    private Map<String, Double> computeBaseline(List<FeatureVector> history) {
        Map<String, Double> baseline = new LinkedHashMap<>();
        if (history == null || history.size() < 2) {
            return baseline;
        }
        Map<String, Function<FeatureVector, Double>> features = new LinkedHashMap<>();
        features.put("dynamic_range", FeatureVector::getDynamicRange);
        features.put("pitch_stability", FeatureVector::getPitchStability);
        features.put("contrast_score", FeatureVector::getContrastScore);
        features.put("vibrato_extent", FeatureVector::getVibratoExtent);
        features.put("spectral_centroid_mean", FeatureVector::getSpectralCentroidMean);
        features.put("phrase_length_variance", FeatureVector::getPhraseLengthVariance);
        features.put("articulation_style", FeatureVector::getArticulationStyle);

        for (Map.Entry<String, Function<FeatureVector, Double>> entry : features.entrySet()) {
            List<Double> values = new ArrayList<>();
            for (FeatureVector fv : history) {
                Double v = entry.getValue().apply(fv);
                if (v != null && !v.isNaN() && !v.isInfinite()) {
                    values.add(v);
                }
            }
            if (values.size() >= 2) {
                baseline.put(entry.getKey(), median(values));
            }
        }
        return baseline;
    }

    private double median(List<Double> values) {
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int n = sorted.size();
        return (n % 2 == 1) ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
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
