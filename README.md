# Muse Theory

An AI music coaching system that analyzes musical expressiveness in vocal and instrumental performances, built by Pratham Aithal, a high school student at Rock Hill High School in Frisco, TX (PISD).

GitHub: https://github.com/Smashgod23/MuseTheory
Contact: theprathamaithal@gmail.com

## What This Is

Muse Theory is a backend system that listens to a musician's recorded performance and returns specific, time-stamped coaching suggestions about dynamics, phrasing, contrast, and expressive decisions. It is not a pitch tuner or a rhythm corrector. It focuses on the musical layer above technique -- the choices that turn correct notes into something worth listening to.

The system is built as two services: a Java Spring Boot API that handles authentication, data, and business logic, and a Python FastAPI microservice that runs ML inference. The client only ever talks to Spring Boot. The Python service sits behind it, processes audio, and returns structured analysis results.

This is not a wrapper around a general-purpose LLM. The plan is to train a domain-specific model on real annotated performance data from music educators, producing a system whose knowledge comes from teachers rather than the general internet.

## Background and Motivation

I built this because I watched what happens when a good choir director's voice disappears from daily practice. In rehearsal, a skilled director provides the expressive pushback that turns correct notes into meaningful music: "put a crescendo here," "stress this phrase the second time," "you sang that twice, make it different." When rehearsal ends, that voice goes silent. Current practice tools only check pitch and rhythm. Nothing coaches the musical decisions.

I wanted to build a system that keeps that voice going -- one trained on real music educator feedback, not scraped internet data.

## Architecture

```
Client  --->  Spring Boot API  --->  FastAPI AI Service
                   |                        |
              PostgreSQL              (internal only,
              (8 tables)              no DB access)
                   |
                AWS S3
              (audio files)
```

Spring Boot is the single public entry point. It owns authentication (JWT), all REST endpoints, database access via JPA, S3 audio uploads, and rate limiting. The FastAPI service is internal-only and handles feature extraction and model inference. It receives an audio URL and piece context from Spring Boot, runs analysis, and returns feature vectors and coaching suggestions.

### Database Schema (8 Tables)

| Table | Purpose |
|-------|---------|
| users | Student/teacher/admin profiles with role, skill level, goals, and chosen instrument or voice part (used to personalize the catalog) |
| instruments | Supported instruments and voice types |
| pieces | Musical pieces with metadata and score references |
| piece_parameters | Expressive map per piece+instrument (repetition, tension, stress maps) |
| performances | Recording metadata linked to user, piece, and instrument |
| feature_vectors | 16 extracted audio features per performance (ML model input) |
| performances_feedback | AI and human feedback on recordings (training data store) |
| teachers | Teacher/director profiles linked to user accounts |

### Performance Upload Flow

1. Client POSTs audio file + metadata to `/api/performances`
2. Spring Boot validates the request and checks rate limits
3. Performance record saved to PostgreSQL
4. Audio uploaded to S3
5. Spring Boot calls FastAPI `/analyze` with the audio URL and piece context
6. FastAPI extracts features and generates suggestions
7. Feature vector stored in `feature_vectors`
8. AI suggestions stored in `performances_feedback` with source=AI
9. Full response returned to client

## Obstacles and How I Solved Them

I ran into a circular foreign key problem right away with the database design. The `users` table references `teachers` (a student's assigned teacher), and `teachers` references `users` (because every teacher is also a user). You can't create both tables with their foreign keys at the same time in PostgreSQL. I solved it by creating the `teachers` table first without the `user_id` NOT NULL constraint, creating `users` with its `teacher_id` FK, then altering `teachers` to add the user FK and uniqueness constraint after both tables exist.

The AI service contract was another decision point. I needed the Spring Boot backend and the Python service to agree on a data format before either one existed. I defined the request/response DTOs on both sides first -- `AIAnalysisRequest`/`AIAnalysisResponse` in Java and matching Pydantic models in Python -- and made the FastAPI service return realistic stub data. This means the full pipeline works end-to-end for testing even before real ML models are trained.

Rate limiting had a subtlety: unauthenticated endpoints (login, register, public instrument lists) still need IP-based rate limiting to prevent abuse, but authenticated endpoints should limit per-user. I used Bucket4j with a filter that checks whether a JWT-authenticated user exists in the security context and falls back to IP-based keying when there's no auth.

For local development without AWS, I designed the S3 client to accept an endpoint override so it works with MinIO (an S3-compatible local object store). The same code runs against real AWS in production by just changing environment variables.

## Next Steps

- Train the expressiveness regression model (XGBoost baseline) once 50+ labeled recordings are collected
- Build the real feature extraction pipeline using Librosa, CREPE, Essentia, and Parselmouth
- Fine-tune T5-small on educator-written coaching suggestions
- Add the creativity space model (UMAP-based visualization of performance embeddings)
- Build a teacher portal frontend for annotating piece parameters and reviewing student performances
- Write the ISMIR research paper documenting feature importance findings
- Add WebSocket support for real-time analysis feedback during practice sessions
- Implement the retraining trigger (auto-retrain after every 50 new human-rated rows)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| API Server | Java 17, Spring Boot 3.2, Spring Security, Spring Data JPA |
| Auth | JWT (jjwt library), bcrypt password hashing |
| Database | PostgreSQL with Flyway migrations |
| AI Service | Python 3.10+, FastAPI, Pydantic |
| Object Storage | AWS S3 (MinIO for local dev) |
| Rate Limiting | Bucket4j (in-memory token bucket) |
| API Docs | SpringDoc OpenAPI / Swagger UI |
| Build | Maven |

## Project Structure

```
MuseTheory/
├── backend/                          # Spring Boot API
│   ├── pom.xml                       # Maven build config
│   └── src/main/
│       ├── java/com/musetheory/api/
│       │   ├── MuseTheoryApplication.java
│       │   ├── config/               # Security, S3, rate limit, OpenAPI configs
│       │   ├── controller/           # REST controllers (8 controllers)
│       │   ├── dto/
│       │   │   ├── ai/              # Internal DTOs for AI service communication
│       │   │   ├── request/         # Inbound validation DTOs
│       │   │   └── response/        # Outbound response DTOs
│       │   ├── entity/              # JPA entities (8 tables)
│       │   ├── enums/               # Role, FeedbackSource, SkillLevel
│       │   ├── exception/           # Global handler + custom exceptions
│       │   ├── repository/          # Spring Data JPA repositories
│       │   ├── security/            # JWT provider, filter, UserDetailsService
│       │   └── service/             # Business logic, S3 client, AI client
│       └── resources/
│           ├── application.yml       # Spring config (env-var driven)
│           └── db/migration/         # Flyway SQL migrations + seed data
├── ai-service/                       # Python FastAPI microservice
│   ├── requirements.txt
│   └── app/
│       ├── main.py                  # /analyze endpoint (stub for now)
│       └── models.py                # Pydantic request/response models
├── .env.example                      # Environment variable template
├── LICENSE
└── README.md
```

## Running Locally

### Prerequisites

- Java 17+
- Maven 3.8+
- PostgreSQL 15+
- Python 3.10+
- (Optional) MinIO for local S3

### 1. Set up PostgreSQL

```bash
createdb musetheory
createuser musetheory -P    # set password to "musetheory" for local dev
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env if your Postgres or other settings differ from defaults
source .env
```

### 3. Run the AI service

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd app
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Run the Spring Boot backend

```bash
# Install Maven if you don't have it: brew install maven
cd backend
mvn spring-boot:run
```

The API starts on http://localhost:8080. Swagger UI is at http://localhost:8080/swagger-ui.html.

### 5. Test the flow

Register a user:
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","firstName":"Test","lastName":"User"}'
```

Use the returned JWT token for authenticated requests:
```bash
curl http://localhost:8080/api/users/me \
  -H "Authorization: Bearer <your-token>"
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DB_HOST | PostgreSQL host | localhost |
| DB_PORT | PostgreSQL port | 5432 |
| DB_NAME | Database name | musetheory |
| DB_USERNAME | Database user | musetheory |
| DB_PASSWORD | Database password | musetheory |
| JWT_SECRET | Base64-encoded HMAC key | dev key (change in prod) |
| JWT_EXPIRATION | Token lifetime in ms | 86400000 (24h) |
| AI_SERVICE_URL | FastAPI service URL | http://localhost:8000 |
| AWS_ACCESS_KEY | S3 access key | minioadmin |
| AWS_SECRET_KEY | S3 secret key | minioadmin |
| AWS_REGION | AWS region | us-east-1 |
| S3_BUCKET | Audio storage bucket | musetheory-audio |
| S3_ENDPOINT | S3 endpoint override (for MinIO) | http://localhost:9000 |

Built by Pratham Aithal
Rock Hill High School, Frisco, TX (PISD)
theprathamaithal@gmail.com
https://github.com/Smashgod23/MuseTheory
