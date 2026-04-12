package com.musetheory.api.service;

import com.musetheory.api.dto.ai.AIAnalysisRequest;
import com.musetheory.api.dto.ai.AIAnalysisResponse;
import com.musetheory.api.exception.AIServiceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * HTTP client for calling the internal FastAPI AI microservice.
 * Spring Boot is the only caller. The AI service never faces the public internet.
 */
@Service
public class AIServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AIServiceClient.class);

    private final RestTemplate restTemplate;
    private final String aiServiceUrl;

    public AIServiceClient(RestTemplate restTemplate,
                           @Value("${app.ai-service.url}") String aiServiceUrl) {
        this.restTemplate = restTemplate;
        this.aiServiceUrl = aiServiceUrl;
    }

    public AIAnalysisResponse analyze(AIAnalysisRequest request) {
        String url = aiServiceUrl + "/analyze";
        log.info("Calling AI service at {} for performance {}", url, request.getPerformanceId());

        try {
            ResponseEntity<AIAnalysisResponse> response = restTemplate.postForEntity(
                    url, request, AIAnalysisResponse.class);

            if (response.getBody() == null) {
                throw new AIServiceException("AI service returned empty response");
            }

            log.info("AI analysis complete for performance {}. {} suggestions generated.",
                    request.getPerformanceId(),
                    response.getBody().getSuggestions() != null ? response.getBody().getSuggestions().size() : 0);

            return response.getBody();
        } catch (RestClientException e) {
            throw new AIServiceException("Failed to reach AI analysis service", e);
        }
    }
}
