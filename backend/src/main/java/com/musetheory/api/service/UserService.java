package com.musetheory.api.service;

import com.musetheory.api.dto.request.UpdateUserRequest;
import com.musetheory.api.dto.response.UserResponse;
import com.musetheory.api.entity.Instrument;
import com.musetheory.api.entity.Teacher;
import com.musetheory.api.entity.User;
import com.musetheory.api.exception.ResourceNotFoundException;
import com.musetheory.api.repository.InstrumentRepository;
import com.musetheory.api.repository.TeacherRepository;
import com.musetheory.api.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final InstrumentRepository instrumentRepository;
    private final TeacherRepository teacherRepository;

    public UserService(UserRepository userRepository, InstrumentRepository instrumentRepository,
                       TeacherRepository teacherRepository) {
        this.userRepository = userRepository;
        this.instrumentRepository = instrumentRepository;
        this.teacherRepository = teacherRepository;
    }

    public UserResponse getById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
        return UserResponse.from(user);
    }

    public List<UserResponse> getAll() {
        return userRepository.findAll().stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse update(UUID id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));

        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        if (request.getSkillLevel() != null) user.setSkillLevel(request.getSkillLevel());
        if (request.getMusicalGoals() != null) user.setMusicalGoals(request.getMusicalGoals());

        if (request.getInstrumentId() != null) {
            Instrument instrument = instrumentRepository.findById(request.getInstrumentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Instrument", "id", request.getInstrumentId()));
            user.setInstrument(instrument);
        }

        if (request.getTeacherId() != null) {
            Teacher teacher = teacherRepository.findById(request.getTeacherId())
                    .orElseThrow(() -> new ResourceNotFoundException("Teacher", "id", request.getTeacherId()));
            user.setTeacher(teacher);
        }

        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public void delete(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("User", "id", id);
        }
        userRepository.deleteById(id);
    }
}
