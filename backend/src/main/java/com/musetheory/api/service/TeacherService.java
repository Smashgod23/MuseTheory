package com.musetheory.api.service;

import com.musetheory.api.dto.request.CreateTeacherRequest;
import com.musetheory.api.dto.response.TeacherResponse;
import com.musetheory.api.entity.Teacher;
import com.musetheory.api.entity.User;
import com.musetheory.api.exception.DuplicateResourceException;
import com.musetheory.api.exception.ResourceNotFoundException;
import com.musetheory.api.repository.TeacherRepository;
import com.musetheory.api.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class TeacherService {

    private final TeacherRepository teacherRepository;
    private final UserRepository userRepository;

    public TeacherService(TeacherRepository teacherRepository, UserRepository userRepository) {
        this.teacherRepository = teacherRepository;
        this.userRepository = userRepository;
    }

    public List<TeacherResponse> getAll() {
        return teacherRepository.findAll().stream()
                .map(TeacherResponse::from)
                .toList();
    }

    public TeacherResponse getById(UUID id) {
        Teacher teacher = teacherRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher", "id", id));
        return TeacherResponse.from(teacher);
    }

    @Transactional
    public TeacherResponse create(CreateTeacherRequest request) {
        if (teacherRepository.existsByUserId(request.getUserId())) {
            throw new DuplicateResourceException("Teacher profile already exists for this user");
        }

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getUserId()));

        Teacher teacher = Teacher.builder()
                .user(user)
                .institution(request.getInstitution())
                .specialization(request.getSpecialization())
                .bio(request.getBio())
                .build();

        return TeacherResponse.from(teacherRepository.save(teacher));
    }

    @Transactional
    public TeacherResponse update(UUID id, CreateTeacherRequest request) {
        Teacher teacher = teacherRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher", "id", id));

        if (request.getInstitution() != null) teacher.setInstitution(request.getInstitution());
        if (request.getSpecialization() != null) teacher.setSpecialization(request.getSpecialization());
        if (request.getBio() != null) teacher.setBio(request.getBio());

        return TeacherResponse.from(teacherRepository.save(teacher));
    }

    @Transactional
    public void delete(UUID id) {
        if (!teacherRepository.existsById(id)) {
            throw new ResourceNotFoundException("Teacher", "id", id);
        }
        teacherRepository.deleteById(id);
    }
}
