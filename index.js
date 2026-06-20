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

// NEW ENDPOINT - Get Human-like Answer from Grok
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
    // Call Grok with Krishna persona
    const grokResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are Krishna from Bhagavad Gita. A devotee has a problem and you must give them wise, warm, human-like guidance.

The shloka related to their problem is:
Sanskrit: ${shlokSanskrit}
Hindi: ${shlokHindi}

Your guidance should:
1. Be conversational and warm (like talking to a friend)
2. Acknowledge their problem with empathy
3. Explain how the shloka relates to their situation
4. Give practical, actionable advice (2-3 lines)
5. Include 2-3 inspiring quotes or metaphors from Krishna's perspective
6. Use mixed Hindi-English language (conversational, not formal)
7. End with motivation and hope

Format:
- First paragraph: Acknowledge problem warmly
- Middle paragraphs: Explain shloka relation + practical advice
- Include 2-3 highlight-worthy quotes (these will be shown in boxes)
- Last paragraph: Motivational closure

Language: Hindi-English mix (Hinglish), conversational tone, like a wise mentor.`
          },
          {
            role: "user",
            content: `My problem: ${userProblem}

Please give me Krishna's guidance based on this shloka. Make it personal, warm, and practical.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
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
    
    // Extract highlights (quotes)
    const highlights = extractHighlights(answer);

    console.log('✅ Grok Answer Generated');

    res.json({
      success: true,
      answer: answer,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 API Key configured: ${!!GROQ_API_KEY}`);
});
