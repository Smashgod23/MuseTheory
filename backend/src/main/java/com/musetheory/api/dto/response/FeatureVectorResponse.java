package com.musetheory.api.dto.response;

import com.musetheory.api.entity.FeatureVector;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class FeatureVectorResponse {
    private UUID id;
    private UUID performanceId;
    private Double tempoMean;
    private Double tempoVariance;
    private Double dynamicRange;
    private String rmsEnergyContour;
    private Double pitchMean;
    private Double pitchStability;
    private Double vibratoRate;
    private Double vibratoExtent;
    private Double spectralCentroidMean;
    private String mfccSummary;
    private Double onsetDensity;
    private Double articulationStyle;
    private Double contrastScore;
    private Double phraseLengthVariance;
    private String breathPlacement;
    private Double harmonicDeviation;
    private Instant createdAt;

    public static FeatureVectorResponse from(FeatureVector fv) {
        return FeatureVectorResponse.builder()
                .id(fv.getId())
                .performanceId(fv.getPerformance().getId())
                .tempoMean(fv.getTempoMean())
                .tempoVariance(fv.getTempoVariance())
                .dynamicRange(fv.getDynamicRange())
                .rmsEnergyContour(fv.getRmsEnergyContour())
                .pitchMean(fv.getPitchMean())
                .pitchStability(fv.getPitchStability())
                .vibratoRate(fv.getVibratoRate())
                .vibratoExtent(fv.getVibratoExtent())
                .spectralCentroidMean(fv.getSpectralCentroidMean())
                .mfccSummary(fv.getMfccSummary())
                .onsetDensity(fv.getOnsetDensity())
                .articulationStyle(fv.getArticulationStyle())
                .contrastScore(fv.getContrastScore())
                .phraseLengthVariance(fv.getPhraseLengthVariance())
                .breathPlacement(fv.getBreathPlacement())
                .harmonicDeviation(fv.getHarmonicDeviation())
                .createdAt(fv.getCreatedAt())
                .build();
    }
}
