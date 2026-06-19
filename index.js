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

app.post('/find-shlok', async (req, res) => {
  const { userProblem } = req.body;

  console.log('📥 Received request');
  console.log('📝 User problem:', userProblem);
  console.log('🔑 API Key exists:', !!GROQ_API_KEY);

  // Validate input
  if (!userProblem || userProblem.trim().length === 0) {
    console.log('❌ Empty problem');
    return res.status(400).json({ 
      success: false, 
      error: "Please describe your problem" 
    });
  }

  if (userProblem.length > 500) {
    console.log('❌ Problem too long');
    return res.status(400).json({ 
      success: false, 
      error: "Problem too long (max 500 characters)" 
    });
  }

  try {
    console.log('🚀 Calling Groq API...');
    
    // Call Groq API with correct model
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: "llama-3.3-70b-versatile",  // ✅ Updated model
        messages: [
          {
            role: "system",
            content: `You are a Bhagavad Gita expert with knowledge of all 700 shlokas.

User will describe their problem. You must find the SINGLE best matching shlok from the 700 shlokas.

Respond ONLY with valid JSON (no markdown, no explanation, no text before or after):
{
  "chapter": <integer 1-18>,
  "verse": <integer>,
  "confidence": <integer 0-100>
}

Example response:
{"chapter": 2, "verse": 47, "confidence": 95}

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
        timeout: 10000 // 10 seconds timeout
      }
    );

    console.log('✅ Groq API response received');
    console.log('Status:', response.status);

    const groqText = response.data.choices[0].message.content.trim();
    console.log('📄 Raw response:', groqText);
    
    // Remove markdown code blocks if present
    const cleanText = groqText.replace(/```json/g, '').replace(/```/g, '').trim();
    console.log('🧹 Cleaned response:', cleanText);
    
    const shlokMatch = JSON.parse(cleanText);
    console.log('📊 Parsed:', shlokMatch);

    // Validate response
    if (!shlokMatch.chapter || !shlokMatch.verse) {
      console.log('❌ Invalid response structure');
      throw new Error('Invalid response from AI');
    }

    console.log(`✅ Success! Chapter ${shlokMatch.chapter}, Verse ${shlokMatch.verse}`);

    res.json({
      success: true,
      chapter: shlokMatch.chapter,
      verse: shlokMatch.verse,
      confidence: shlokMatch.confidence || 80
    });

  } catch (error) {
    console.error('❌ ERROR in /find-shlok:');
    console.error('Message:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || "Could not find matching shlok. Please try again.",
      timestamp: new Date().toISOString()
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 API Key configured: ${!!GROQ_API_KEY}`);
});
