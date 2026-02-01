# Contributing to SoundPrint

Thanks for your interest in contributing! SoundPrint is built with the goal of making sound design accessible to everyone. Here's how you can help.

## 🌟 Ways to Contribute

### 1. Code Contributions
- Frontend development (React, UI/UX)
- Backend API (Python, FastAPI)
- Audio analysis algorithms (DSP, ML)
- DAW preset generation
- Testing and quality assurance

### 2. Non-Code Contributions
- Documentation improvements
- UI/UX design
- Sound testing and validation
- Bug reports and feature requests
- Community support

## 🚀 Getting Started

### Prerequisites
- Git
- Node.js 18+ (for frontend)
- Python 3.10+ (for backend)
- Docker (optional, for local development)

### Setting Up Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/soundprint.git
   cd soundprint
   ```

2. **Landing Page Development**
   ```bash
   # Serve the landing page locally
   cd landing-page
   python -m http.server 8000
   # Visit http://localhost:8000
   ```

3. **Backend Development** (coming soon)
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

4. **Frontend Development** (coming soon)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 📝 Development Workflow

### 1. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding tests

### 2. Make Your Changes
- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Write tests for new features

### 3. Commit Your Changes
```bash
git add .
git commit -m "feat: add audio upload functionality"
```

Commit message format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### 4. Push and Create Pull Request
```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title describing the change
- Description of what changed and why
- Screenshots (if UI changes)
- Testing steps

## 🎨 Code Style

### Python
- Follow PEP 8
- Use type hints
- Write docstrings for functions
- Maximum line length: 100 characters

```python
def analyze_audio(audio_file: str, sample_rate: int = 44100) -> dict:
    """
    Analyze audio file and extract features.

    Args:
        audio_file: Path to audio file
        sample_rate: Sample rate for analysis (default: 44100)

    Returns:
        Dictionary containing extracted features
    """
    # Implementation
```

### JavaScript/React
- Use ES6+ features
- Functional components with hooks
- Prettier for formatting
- ESLint for linting

```javascript
// Good
const AudioUploader = ({ onUpload }) => {
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    // Implementation
  };

  return <div>{/* Component JSX */}</div>;
};
```

### HTML/CSS
- Semantic HTML5
- Mobile-first responsive design
- Use CSS custom properties for theming
- Meaningful class names

## 🧪 Testing

### Writing Tests
- Write unit tests for new functions
- Write integration tests for API endpoints
- Test edge cases and error handling

### Running Tests
```bash
# Python tests
pytest

# JavaScript tests
npm test
```

## 🐛 Reporting Bugs

When reporting bugs, please include:
1. **Description**: Clear description of the issue
2. **Steps to Reproduce**: Detailed steps to reproduce the bug
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Screenshots**: If applicable
6. **Environment**: OS, browser, DAW version, etc.

Use the issue template on GitHub.

## 💡 Feature Requests

We love new ideas! When requesting features:
1. **Use Case**: Describe why this feature would be useful
2. **Proposed Solution**: How you envision it working
3. **Alternatives**: Other approaches you've considered
4. **Additional Context**: Any other relevant information

## 🎯 Priority Areas

We're especially looking for help with:
- [ ] Audio feature extraction algorithms
- [ ] ML model training for sound classification
- [ ] Ableton preset XML generation
- [ ] UI/UX design improvements
- [ ] Test coverage
- [ ] Documentation

## 📚 Resources

### Audio Processing
- [Librosa documentation](https://librosa.org/doc/latest/index.html)
- [DSP Guide](https://www.dspguide.com/)
- [Audio Signal Processing for ML](https://www.coursera.org/learn/audio-signal-processing)

### DAW Preset Formats
- [Ableton Live Object Model](https://docs.cycling74.com/max8/vignettes/live_object_model)
- [VST SDK](https://www.steinberg.net/vst-developer/)

### ML for Audio
- [Audio Classification with PyTorch](https://pytorch.org/tutorials/)
- [Magenta (Google)](https://magenta.tensorflow.org/)

## 🤝 Code of Conduct

### Our Standards
- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior
- Harassment or discrimination
- Trolling or insulting comments
- Personal or political attacks
- Publishing others' private information
- Other unprofessional conduct

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

All contributors will be recognized in our README and documentation. Significant contributors may be listed as core team members.

## ❓ Questions?

- Open an issue with the `question` label
- Email: themistayoung@gmail.com
- Join our Discord (coming soon)

---

Thank you for contributing to SoundPrint! Let's make sound design accessible to everyone. 🎵
