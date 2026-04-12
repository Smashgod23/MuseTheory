package com.musetheory.api.service;

import com.musetheory.api.dto.request.LoginRequest;
import com.musetheory.api.dto.request.RegisterRequest;
import com.musetheory.api.dto.response.AuthResponse;
import com.musetheory.api.dto.response.UserResponse;
import com.musetheory.api.entity.Instrument;
import com.musetheory.api.entity.Teacher;
import com.musetheory.api.entity.User;
import com.musetheory.api.enums.Role;
import com.musetheory.api.exception.DuplicateResourceException;
import com.musetheory.api.exception.ResourceNotFoundException;
import com.musetheory.api.repository.InstrumentRepository;
import com.musetheory.api.repository.TeacherRepository;
import com.musetheory.api.repository.UserRepository;
import com.musetheory.api.security.JwtTokenProvider;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final InstrumentRepository instrumentRepository;
    private final TeacherRepository teacherRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;

    public AuthService(UserRepository userRepository, InstrumentRepository instrumentRepository,
                       TeacherRepository teacherRepository, PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager, JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.instrumentRepository = instrumentRepository;
        this.teacherRepository = teacherRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Email is already registered");
        }

        Instrument instrument = null;
        if (request.getInstrumentId() != null) {
            instrument = instrumentRepository.findById(request.getInstrumentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Instrument", "id", request.getInstrumentId()));
        }

        Teacher teacher = null;
        if (request.getTeacherId() != null) {
            teacher = teacherRepository.findById(request.getTeacherId())
                    .orElseThrow(() -> new ResourceNotFoundException("Teacher", "id", request.getTeacherId()));
        }

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .role(request.getRole() != null ? request.getRole() : Role.STUDENT)
                .skillLevel(request.getSkillLevel())
                .musicalGoals(request.getMusicalGoals())
                .instrument(instrument)
                .teacher(teacher)
                .build();

        userRepository.save(user);

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        String token = tokenProvider.generateToken(authentication);
        return AuthResponse.of(token, UserResponse.from(user));
    }

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        String token = tokenProvider.generateToken(authentication);

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", request.getEmail()));

        return AuthResponse.of(token, UserResponse.from(user));
    }
}
