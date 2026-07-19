package com.musetheory.api.entity;

import java.security.SecureRandom;
import java.util.UUID;

import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.id.uuid.UuidValueGenerator;

/**
 * RFC 9562 UUID version 7: a 48-bit big-endian millisecond timestamp followed by
 * random bits, so IDs generated close in time sort close together (better DB index
 * locality than the fully random UUIDv4 that {@code GenerationType.UUID} produces).
 */
public class UuidV7Generator implements UuidValueGenerator {

    private static final SecureRandom RANDOM = new SecureRandom();

    @Override
    public UUID generateUuid(SharedSessionContractImplementor session) {
        long timestampMs = System.currentTimeMillis();

        byte[] randomBytes = new byte[10];
        RANDOM.nextBytes(randomBytes);

        long mostSigBits = (timestampMs & 0xFFFFFFFFFFFFL) << 16;
        mostSigBits |= 0x7000L;
        mostSigBits |= (randomBytes[0] & 0x0FL) << 8;
        mostSigBits |= (randomBytes[1] & 0xFFL);

        long leastSigBits = 0L;
        for (int i = 2; i < randomBytes.length; i++) {
            leastSigBits = (leastSigBits << 8) | (randomBytes[i] & 0xFFL);
        }
        leastSigBits &= 0x3FFFFFFFFFFFFFFFL;
        leastSigBits |= 0x8000000000000000L;

        return new UUID(mostSigBits, leastSigBits);
    }
}
