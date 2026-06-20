const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// Groq API Key from environment (SECRET!)
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: "Naamsetu Backend is running!",
    timestamp: new Date().toISOString()
  });
});

// Existing endpoint - Find Shlok
app.post('/find-shlok', async (req, res) => {
  const { userProblem } = req.body;

  console.log('📥 Received request');
  console.log('📝 User problem:', userProblem);

  if (!userProblem || userProblem.trim().length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: "Please describe your problem" 
    });
  }

  if (userProblem.length > 500) {
    return res.status(400).json({ 
      success: false, 
      error: "Problem too long (max 500 characters)" 
    });
  }

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a Bhagavad Gita expert with knowledge of all 700 shlokas.

User will describe their problem. You must find the SINGLE best matching shlok from the 700 shlokas.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "chapter": <integer 1-18>,
  "verse": <integer>,
  "confidence": <integer 0-100>
}

ONLY JSON, nothing else!`
          },
          {
            role: "user",
            content: `My problem: ${userProblem}`
          }
        ],
        temperature: 0.3,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const groqText = response.data.choices[0].message.content.trim();
    const cleanText = groqText.replace(/```json/g, '').replace(/```/g, '').trim();
    const shlokMatch = JSON.parse(cleanText);

    res.json({
      success: true,
      chapter: shlokMatch.chapter,
      verse: shlokMatch.verse,
      confidence: shlokMatch.confidence || 80
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Could not find matching shlok"
    });
  }
});

// NEW ENDPOINT - Get Human-like Answer from Groq (SHORT & SWEET)
app.post('/grok/answer', async (req, res) => {
  const { userProblem, shlokSanskrit, shlokHindi } = req.body;

  console.log('🎭 Grok Answer Request');
  console.log('Problem:', userProblem);

  // Validate input
  if (!userProblem || !shlokSanskrit || !shlokHindi) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields"
    });
  }

  try {
    const grokResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `तुम श्री कृष्ण हो। एक भक्त की समस्या है और तुम्हें उन्हें आश्वस्त करना है।

नियम:
1. बहुत छोटा और मीठा उत्तर दो (3-4 वाक्य से ज्यादा नहीं)
2. भाषा: शुद्ध हिंदी (Hinglish नहीं)
3. Tone: जैसे माँ बच्चे को समझाती है या कृष्ण अर्जुन को
4. Structure:
   - पहला वाक्य: आश्वस्त करो (चिंता मत करो, सब ठीक होगा)
   - दूसरा वाक्य: श्लोक क्या कहता है (सरल हिंदी में)
   - तीसरा वाक्य: एक practical advice
   - चौथा वाक्य: आशीर्वाद/उम्मीद

5. ऐसे बोलो जैसे तुम सामने बैठे हो:
   ✅ "पुत्र, चिंता मत करो..."
   ✅ "हे अर्जुन, तुम्हारा कर्म करो..."
   ✅ "भक्त, धैर्य रखो..."

6. ये शब्द use करो:
   - चिंता मत करो
   - धैर्य रखो
   - तुम्हारा कर्म करो
   - मैं तुम्हारे साथ हूँ
   - सब ठीक होगा
   - ईश्वर पर भरोसा रखो

7. ज्यादा उपदेश मत दो - बस 3-4 लाइन में समाप्त करो

उदाहरण:
"पुत्र, चिंता मत करो। तुम्हें केवल अपने कर्म पर ध्यान देना है, फल की चिंता नहीं। अपना सर्वश्रेष्ठ दो, बाकी मुझ पर छोड़ दो। सब कुछ समय पर ठीक हो जाएगा।"

"हे भक्त, धैर्य रखो। गीता कहती है कि जो होता है वह अच्छे के लिए होता है। अपना धर्म निभाओ, परिणाम की चिंता मत करो। मैं तुम्हारी रक्षा करूँगा।"`
          },
          {
            role: "user",
            content: `मेरी समस्या: ${userProblem}

श्लोक: ${shlokSanskrit}
हिंदी: ${shlokHindi}

कृपया 3-4 वाक्यों में उत्तर दें।`
          }
        ],
        temperature: 0.5,
        max_tokens: 300
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const answer = grokResponse.data.choices[0].message.content.trim();
    
    // Remove markdown and clean
    const cleanAnswer = answer
      .replace(/```/g, '')
      .replace(/\*\*/g, '')
      .trim();

    // Extract highlights (important quotes)
    const highlights = extractHighlights(cleanAnswer);

    console.log('✅ Grok Answer Generated');

    res.json({
      success: true,
      answer: cleanAnswer,
      highlights: highlights
    });

  } catch (error) {
    console.error('❌ Grok Error:', error.message);
    res.status(500).json({
      success: false,
      error: "Could not generate answer"
    });
  }
});

// Helper function to extract highlights
function extractHighlights(text) {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const highlights = [];

  lines.forEach(line => {
    if (
      (line.includes('"') && line.length > 50) ||
      line.startsWith('"') ||
      (line.length > 60 && (line.includes('तो') || line.includes('तुम्हें')))
    ) {
      highlights.push(line.trim().replace(/"/g, ''));
    }
  });

  return highlights.slice(0, 3);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 API Key configured: ${!!GROQ_API_KEY}`);
});
