# SoundPrint Architecture

## System Overview

SoundPrint is a cloud-based platform that reverse engineers audio into DAW presets using AI and signal processing. The system consists of multiple components working together to analyze audio, generate synthesis parameters, and create downloadable preset files.

## High-Level Architecture

```
┌─────────────────┐
│   User Input    │  (Audio file, URL, text, or DJ software)
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         Frontend (React)            │
│  - File upload                      │
│  - URL input (YouTube/Spotify)      │
│  - Text description                 │
│  - Audio preview player             │
└────────┬────────────────────────────┘
         │ HTTPS/REST API
         ▼
┌─────────────────────────────────────┐
│      API Gateway (AWS)              │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    Backend API (FastAPI/Python)     │
│  - Request validation               │
│  - User management                  │
│  - Job queue management             │
│  - Preset file generation           │
└────────┬────────────────────────────┘
         │
         ├──────────────────┬─────────────────┐
         ▼                  ▼                 ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
│  Audio Engine   │  │  ML Engine   │  │ Preset Gen   │
│  - Librosa      │  │  - TF/Torch  │  │ - DAW format │
│  - Feature      │  │  - Sound     │  │ - XML/JSON   │
│    extraction   │  │    classifier│  │   generation │
└─────────────────┘  └──────────────┘  └──────────────┘
         │                  │                 │
         └──────────────────┴─────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   AWS S3        │
                  │ - Audio files   │
                  │ - Preset files  │
                  │ - User data     │
                  └─────────────────┘
```

## Core Components

### 1. Frontend (React + Web Audio API)

**Responsibilities:**
- User interface for all input methods
- Real-time audio preview using Web Audio API
- Preset download and instructions display
- User authentication and dashboard

**Tech Stack:**
- React 18
- Tailwind CSS
- Web Audio API
- Tone.js (for in-browser synthesis preview)
- Axios (API calls)

**Key Features:**
- Drag-and-drop audio upload
- YouTube/Spotify URL parser
- Text-to-sound description (natural language input)
- A/B comparison player (original vs recreated)
- Preset library browser

### 2. Backend API (Python FastAPI)

**Responsibilities:**
- RESTful API endpoints
- User authentication (JWT)
- Job queue management
- File storage orchestration
- Billing and subscription management

**Tech Stack:**
- FastAPI (async Python framework)
- PostgreSQL (user data, job history)
- Redis (job queue, caching)
- AWS S3 (file storage)
- Stripe (payments)

**Key Endpoints:**
```
POST   /api/v1/analyze          - Submit audio for analysis
GET    /api/v1/jobs/{job_id}    - Check job status
GET    /api/v1/presets/{id}     - Download preset file
POST   /api/v1/describe          - Text-to-preset
POST   /api/v1/extract-url       - Extract audio from URL
```

### 3. Audio Analysis Engine

**Responsibilities:**
- Extract audio features (spectral, temporal, harmonic)
- Identify synthesis components (oscillators, filters, envelopes)
- Estimate synthesis parameters
- Match to DAW stock instruments

**Tech Stack:**
- Librosa (audio feature extraction)
- NumPy/SciPy (DSP algorithms)
- PyDub (audio format conversion)

**Analysis Pipeline:**

```python
# Pseudocode for audio analysis
def analyze_audio(audio_file):
    # 1. Load and preprocess
    audio, sr = librosa.load(audio_file, sr=44100)

    # 2. Extract features
    features = {
        'pitch': extract_pitch(audio, sr),
        'spectral_centroid': librosa.feature.spectral_centroid(y=audio, sr=sr),
        'mfcc': librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13),
        'envelope': extract_envelope(audio),
        'harmonics': extract_harmonic_content(audio, sr),
        'effects': detect_effects(audio, sr)
    }

    # 3. Classify sound type
    sound_type = ml_classifier.predict(features)

    # 4. Map to synthesis parameters
    synth_params = features_to_synth_params(features, sound_type)

    return synth_params
```

**Key Features Extracted:**
- Pitch/fundamental frequency
- Spectral centroid (brightness)
- MFCCs (timbre fingerprint)
- ADSR envelope
- Harmonic/inharmonic content
- Effects detection (reverb, delay, distortion, etc.)

### 4. ML Classification Engine

**Responsibilities:**
- Classify sound type (bass, lead, pad, pluck, etc.)
- Identify instrument family
- Suggest appropriate stock DAW instrument
- Text-to-sound understanding (NLP)

**Tech Stack:**
- TensorFlow/PyTorch (ML models)
- scikit-learn (traditional ML)
- Hugging Face Transformers (NLP for text descriptions)

**Models:**
1. **Sound Classifier**: CNN trained on labeled sound dataset
2. **Instrument Matcher**: Maps analyzed features to DAW stock instruments
3. **Text-to-Sound**: NLP model that understands "warm analog bass" → synthesis parameters

### 5. Preset Generation Engine

**Responsibilities:**
- Generate DAW-specific preset files
- Create human-readable instructions
- Format output for different DAW formats

**Preset Formats:**

**Ableton (.adg - Ableton Device Group):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Ableton>
  <GroupDevicePreset>
    <Operator>
      <Oscillator.A.Type>Saw</Oscillator.A.Type>
      <Filter.Frequency>800</Filter.Frequency>
      <Envelope.Attack>0.01</Envelope.Attack>
      <!-- etc -->
    </Operator>
  </GroupDevicePreset>
</Ableton>
```

**FL Studio (.fst):**
- Binary format or XML depending on plugin
- Uses FL Studio's state format

**Logic Pro (.pst, .logic):**
- XML-based preset format
- Component AU (Audio Unit) settings

### 6. DJ Software Integration

**Responsibilities:**
- Capture audio from rekordbox/serato
- Real-time or post-mix analysis
- Sync with user's SoundPrint account

**Integration Methods:**

**Rekordbox:**
- VST/AU plugin running in rekordbox's FX chain
- Records short clips on button press
- Uploads to cloud queue for processing

**Serato:**
- Serato DJ plugin (SoundPrint Capture)
- Similar workflow to rekordbox

**Technical Approach:**
```cpp
// VST plugin pseudocode
class SoundPrintCapture : public AudioProcessor {
    void processBlock(AudioBuffer& buffer) {
        if (captureButtonPressed) {
            ringBuffer.write(buffer);  // Capture 5 seconds

            if (captureComplete) {
                uploadToAPI(ringBuffer.getData());
            }
        }
    }
};
```

## Data Flow

### Example: User Uploads Audio File

1. User uploads `cool_bass.wav` via frontend
2. Frontend uploads to S3, creates job via API
3. Backend creates job in Redis queue
4. Worker picks up job:
   - Downloads audio from S3
   - Runs audio analysis (librosa)
   - Runs ML classification
   - Maps features to Ableton's "Analog" synth parameters
   - Generates `.adg` preset file
   - Generates PDF instructions
   - Uploads to S3
5. Job marked complete, user notified
6. User downloads preset and instructions

### Example: Text Description

1. User types "warm analog bass with slight distortion"
2. NLP model extracts:
   - Sound type: bass
   - Timbre: warm (low-pass filter, low cutoff)
   - Character: analog (slight detuning, vintage)
   - Effects: distortion (light)
3. Maps to synthesis parameters:
   ```json
   {
     "oscillator": "sawtooth",
     "filter_type": "lowpass",
     "filter_cutoff": 400,
     "distortion": 0.2,
     "detune": 0.05
   }
   ```
4. Generates preset for selected DAW
5. Returns preset file + instructions

## Cloud Infrastructure (AWS)

```
┌─────────────────────────────────────────────┐
│            CloudFront (CDN)                 │
│  - Static frontend hosting                  │
│  - Global distribution                      │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│         API Gateway                         │
│  - Rate limiting                            │
│  - Request throttling                       │
│  - API versioning                           │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│      Lambda Functions (or ECS/Fargate)      │
│  - API endpoints (FastAPI)                  │
│  - Audio processing workers                 │
│  - Preset generation                        │
└─────┬─────────────────────┬─────────────────┘
      │                     │
      ▼                     ▼
┌──────────────┐      ┌──────────────┐
│  RDS (PG)    │      │   ElastiCache│
│  User data   │      │   (Redis)    │
│  Job history │      │   Job queue  │
└──────────────┘      └──────────────┘
      │
      ▼
┌──────────────────────────┐
│         S3               │
│  - Audio uploads         │
│  - Generated presets     │
│  - Instruction PDFs      │
└──────────────────────────┘
```

**Cost Optimization:**
- Lambda for API endpoints (pay per request)
- S3 for storage (cheap, scalable)
- RDS on-demand (small instance initially)
- CloudFront caching (reduce origin requests)

## Security

- **Authentication**: JWT tokens, OAuth2
- **API Keys**: For DJ software integrations
- **File Upload**: Virus scanning, file type validation, size limits
- **Rate Limiting**: Prevent abuse, DDoS protection
- **Encryption**: S3 encryption at rest, HTTPS in transit

## Scalability

- **Horizontal**: Lambda auto-scales based on load
- **Vertical**: Can switch to ECS/Fargate for long-running workers
- **Caching**: Redis caching for common sounds
- **CDN**: CloudFront for global low-latency access
- **Database**: RDS read replicas if needed

## Development Phases

### Phase 1: MVP (Weeks 1-4)
- Landing page + email capture ✓
- Simple audio upload
- Basic Ableton preset generation (1-2 stock instruments)
- Text description support (limited vocabulary)

### Phase 2: Core Features (Weeks 5-12)
- ML classification model training
- All Ableton stock instruments support
- FL Studio and Logic Pro support
- YouTube/Spotify URL extraction
- User accounts and authentication

### Phase 3: DJ Integration (Weeks 13-20)
- rekordbox VST plugin development
- serato plugin development
- Real-time capture and cloud sync
- Mobile companion app

### Phase 4: Community (Weeks 21+)
- Preset library and sharing
- User ratings and feedback
- Community sound database
- Advanced features (layering, multi-timbre)

## Future Enhancements

- **Mobile app**: Capture sounds on the go with your phone
- **Browser extension**: Capture audio from any website
- **Collaborative features**: Share and remix presets
- **Advanced synthesis**: Support for more complex sounds (layered, evolving)
- **MIDI generation**: Generate MIDI patterns alongside presets
- **More DAWs**: Cubase, Studio One, Bitwig, Reaper

---

**Next Steps**: Begin with Phase 1 MVP - get audio upload and basic Ableton preset generation working.
