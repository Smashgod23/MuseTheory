package com.musetheory.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.UUID;

@Service
public class S3Service {

    private static final Logger log = LoggerFactory.getLogger(S3Service.class);
    private static final long MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

    private final S3Client s3Client;

    @Value("${app.aws.s3.bucket}")
    private String bucket;

    @Value("${app.aws.s3.base-url}")
    private String baseUrl;

    public S3Service(S3Client s3Client) {
        this.s3Client = s3Client;
    }

    public String uploadAudio(MultipartFile file, UUID performanceId) throws IOException {
        validateAudioFile(file);

        String key = "performances/" + performanceId + "/" + file.getOriginalFilename();

        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                // Store a safe, server-decided content type rather than the client's.
                // The bucket is publicly readable, so trusting a client-sent
                // "text/html" would let an attacker serve a script from our origin.
                .contentType(safeStoredContentType(file.getContentType()))
                // Force download rather than inline rendering as defense in depth.
                .contentDisposition("attachment")
                .contentLength(file.getSize())
                .build();

        s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        log.info("Uploaded audio to S3: {}", key);

        return baseUrl + "/" + key;
    }

    public void deleteAudio(String audioUrl) {
        if (audioUrl == null || audioUrl.isBlank()) return;

        String key = audioUrl.replace(baseUrl + "/", "");
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build());
        log.info("Deleted audio from S3: {}", key);
    }

    /**
     * Only ever store a benign content type. Client-sent values are untrusted:
     * a "text/html" upload named like audio would otherwise be rendered (and its
     * scripts executed) straight from our public bucket.
     */
    private String safeStoredContentType(String clientType) {
        if (clientType != null && clientType.startsWith("audio/")) {
            return clientType;
        }
        return "application/octet-stream";
    }

    private void validateAudioFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Audio file is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Audio file exceeds 50MB limit");
        }

        // Browsers and phones are inconsistent about audio MIME types: .m4a often
        // arrives as video/mp4 or application/octet-stream, .flac sometimes with no
        // type at all. Accept by content type OR by a known audio file extension.
        String contentType = file.getContentType();
        boolean typeOk = contentType != null
                && (contentType.startsWith("audio/")
                    || contentType.equals("video/mp4")
                    || contentType.equals("application/octet-stream"));

        String name = file.getOriginalFilename();
        String lower = name == null ? "" : name.toLowerCase();
        boolean extensionOk = lower.endsWith(".wav") || lower.endsWith(".mp3")
                || lower.endsWith(".m4a") || lower.endsWith(".flac")
                || lower.endsWith(".ogg") || lower.endsWith(".aac");

        if (!typeOk && !extensionOk) {
            throw new IllegalArgumentException("File must be an audio file (wav, mp3, m4a, flac, ogg)");
        }
    }
}
