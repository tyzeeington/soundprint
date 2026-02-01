# SoundPrint Deployment Guide

This guide covers deploying the SoundPrint landing page and future backend services.

## 🚀 Landing Page Deployment

The landing page is a static HTML/CSS/JS site that can be deployed to various platforms.

### Option 1: GitHub Pages (Recommended - Free)

**Setup:**
1. Push your code to GitHub
2. Go to repository Settings → Pages
3. Source: Deploy from a branch
4. Branch: `main` → `/landing-page` folder
5. Save

Your site will be live at: `https://yourusername.github.io/soundprint/`

**Custom Domain:**
1. Add a `CNAME` file to `landing-page/` with your domain:
   ```
   soundprint.ai
   ```
2. Configure DNS with your domain provider:
   - Add CNAME record: `www` → `yourusername.github.io`
   - Add A records for root domain:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```

### Option 2: Vercel (Recommended - Free)

**Setup:**
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   cd landing-page
   vercel
   ```

3. Follow prompts:
   - Link to Git? Yes
   - Which scope? Your account
   - Link to existing project? No
   - Project name: soundprint
   - Directory: `./`
   - Override settings? No

**Auto-deployment:**
- Connect your GitHub repo to Vercel
- Every push to `main` auto-deploys

**Custom Domain:**
- Vercel Dashboard → Project → Settings → Domains
- Add your domain and follow DNS instructions

### Option 3: Netlify (Free)

**Drag & Drop:**
1. Go to [netlify.com](https://netlify.com)
2. Drag the `landing-page` folder to the upload area
3. Done!

**Git-based (recommended):**
1. Connect GitHub repo
2. Build settings:
   - Base directory: `landing-page`
   - Build command: (leave empty)
   - Publish directory: `./`
3. Deploy

**Custom Domain:**
- Netlify Dashboard → Domain settings → Add custom domain

### Option 4: AWS S3 + CloudFront

**S3 Setup:**
```bash
# Create S3 bucket
aws s3 mb s3://soundprint-landing

# Upload files
aws s3 sync landing-page/ s3://soundprint-landing --acl public-read

# Enable static website hosting
aws s3 website s3://soundprint-landing \
  --index-document index.html \
  --error-document index.html
```

**CloudFront Setup:**
1. Create CloudFront distribution
2. Origin: S3 bucket website endpoint
3. Price class: Use all edge locations
4. Alternate domain names: soundprint.ai, www.soundprint.ai
5. SSL certificate: Request ACM certificate

**Cost:** ~$0.50-2/month (very cheap)

### Option 5: Firebase Hosting (Free Tier)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
cd landing-page
firebase init hosting

# Deploy
firebase deploy --only hosting
```

## 📧 Email Capture Backend

For the waitlist form to work, you need a backend endpoint.

### Quick Solution: Form Services

**EmailOctopus / Mailchimp (Recommended):**
1. Create account at emailoctopus.com or mailchimp.com
2. Get API key
3. Update form submission in `index.html`:

```javascript
// Replace the form submission code
document.getElementById('waitlistForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('emailInput').value;

    // EmailOctopus example
    const response = await fetch('https://emailoctopus.com/api/1.6/lists/YOUR_LIST_ID/contacts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            api_key: 'YOUR_API_KEY',
            email_address: email
        })
    });

    if (response.ok) {
        document.getElementById('successMessage').classList.add('show');
        document.getElementById('emailInput').value = '';
    }
});
```

**Formspree (Easiest - Free):**
1. Sign up at formspree.io
2. Get form endpoint
3. Update form:
```html
<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
    <input type="email" name="email" required>
    <button type="submit">Join Waitlist</button>
</form>
```

### Custom Backend (AWS Lambda)

**Simple Lambda Function:**
```python
# lambda_function.py
import json
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('soundprint-waitlist')

def lambda_handler(event, context):
    body = json.loads(event['body'])
    email = body['email']

    # Save to DynamoDB
    table.put_item(Item={'email': email})

    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'message': 'Success'})
    }
```

**Deploy:**
```bash
# Create Lambda function
aws lambda create-function \
  --function-name soundprint-waitlist \
  --runtime python3.11 \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-role

# Create API Gateway endpoint
# ... (or use AWS Console)
```

## 🔮 Future: Full Application Deployment

When the full stack is ready:

### Backend (FastAPI)

**AWS ECS/Fargate:**
```bash
# Build Docker image
docker build -t soundprint-api:latest .

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
docker tag soundprint-api:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/soundprint-api:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/soundprint-api:latest

# Deploy to ECS (use AWS Console or Terraform)
```

**Or use AWS Lambda with Mangum:**
```python
from fastapi import FastAPI
from mangum import Mangum

app = FastAPI()

# Your routes here

handler = Mangum(app)
```

### Frontend (React)

**Vercel/Netlify:**
- Same as landing page
- Build command: `npm run build`
- Publish directory: `dist` or `build`

### Database

**RDS PostgreSQL:**
```bash
# Create RDS instance (or use AWS Console)
aws rds create-db-instance \
  --db-instance-identifier soundprint-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password YOUR_PASSWORD \
  --allocated-storage 20
```

### Environment Variables

**Production .env:**
```bash
# Backend
DATABASE_URL=postgresql://user:pass@host:5432/soundprint
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
S3_BUCKET=soundprint-audio
STRIPE_API_KEY=xxx
JWT_SECRET=xxx

# Frontend
VITE_API_URL=https://api.soundprint.ai
VITE_STRIPE_PUBLIC_KEY=xxx
```

## 📊 Monitoring

**AWS CloudWatch:**
- Lambda logs
- API Gateway metrics
- RDS performance

**Sentry (Error Tracking):**
```bash
# Install
pip install sentry-sdk

# Initialize
import sentry_sdk
sentry_sdk.init(dsn="YOUR_DSN")
```

**Google Analytics:**
```html
<!-- Add to landing page <head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

## 🔐 Security Checklist

Before going live:
- [ ] HTTPS enabled (SSL certificate)
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] API keys in environment variables (not code)
- [ ] Database credentials secured
- [ ] File upload size limits
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS protection

## 💰 Cost Estimates

**MVP (Month 1):**
- GitHub Pages: Free
- Domain: $12/year
- Email service: Free tier
- **Total: ~$1/month**

**With Backend (100 users/day):**
- S3: ~$1
- Lambda: ~$5
- RDS (t3.micro): ~$15
- CloudFront: ~$1
- **Total: ~$22/month**

**Scale (1000 users/day):**
- S3: ~$5
- Lambda/ECS: ~$50
- RDS (t3.small): ~$30
- CloudFront: ~$10
- **Total: ~$95/month**

## 🚀 Quick Start Deployment

**Right now (landing page only):**
```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/soundprint.git
git push -u origin main

# 2. Deploy to Vercel (easiest)
cd landing-page
vercel

# Done! Your site is live.
```

---

**Next Steps:**
1. Deploy landing page to collect emails
2. Set up email capture backend (Formspree or EmailOctopus)
3. Monitor signups
4. Build MVP while collecting interest
