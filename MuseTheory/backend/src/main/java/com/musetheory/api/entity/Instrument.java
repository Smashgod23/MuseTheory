package com.musetheory.api.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "instruments")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Instrument {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    // e.g. "voice", "string", "woodwind", "brass", "percussion"
    @Column(nullable = false)
    private String type;

    @Column(name = "range_low")
    private String rangeLow;

    @Column(name = "range_high")
    private String rangeHigh;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
