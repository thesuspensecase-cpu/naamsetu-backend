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

// Endpoint 1 - Find Shlok
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

// Endpoint 2 - Get Human-like Answer from Groq (SHORT, PERSONALIZED, HINDI)
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
            content: `तुम श्री कृष्ण हो। एक भक्त ने अपनी समस्या बताई है।

IMPORTANT RULES:
1. पहली लाइन में USER की SPECIFIC समस्या का जिक्र करो
   ✅ "पुत्र, तुम्हारी शादी की चिंता..."
   ✅ "भक्त, तुम्हारा करियर का तनाव..."
   ✅ "हे अर्जुन, तुम्हारी पारिवारिक समस्या..."
   
2. फिर श्लोक से जोड़ो
3. Practical advice दो
4. आशीर्वाद दो

5. भाषा: शुद्ध हिंदी (Hinglish नहीं)
6. Length: 3-4 वाक्य max
7. Tone: व्यक्तिगत, गर्म, आश्वस्त करने वाला

STRUCTURE:
वाक्य 1: "पुत्र/भक्त, तुम्हारी [USER की SPECIFIC problem] की चिंता मैं समझता हूँ..."
वाक्य 2: इस श्लोक में कहा गया है... [श्लोक का सार]
वाक्य 3: इसलिए तुम... [specific advice for THEIR problem]
वाक्य 4: [आशीर्वाद]

HIGHLIGHTS के लिए अलग-अलग important quotes निकालो:
- Main answer में full explanation दो
- Highlights में सिर्फ powerful one-liners (2-3 quotes)
- Highlights answer से अलग होने चाहिए
- Quotes short और impactful हों

EXAMPLE:
User Problem: "मुझे शादी में बहुत देरी हो रही है, मैं perfect नहीं हूँ"

Answer:
"पुत्र, तुम्हारी शादी की चिंता व्यर्थ है। इस श्लोक में कहा गया है कि तुम्हें केवल अपने कर्म पर ध्यान देना है, फल की नहीं। इसलिए स्वयं को शुद्ध करो, अपना धर्म निभाओ। जब तुम तैयार होगे, मैं स्वयं व्यवस्था करूँगा।"

Highlights:
- "तुम्हें केवल अपने कर्म पर ध्यान देना है, फल की नहीं"
- "जब तुम तैयार होगे, मैं स्वयं व्यवस्था करूँगा"
- "स्वयं को शुद्ध करो, अपना धर्म निभाओ"`
          },
          {
            role: "user",
            content: `मेरी समस्या: ${userProblem}

श्लोक: ${shlokSanskrit}
हिंदी: ${shlokHindi}

कृपया 3-4 वाक्यों में उत्तर दें। अपनी समस्या का जिक्र जरूर करें।`
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

    // Extract highlights (important quotes) - different from main answer
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
