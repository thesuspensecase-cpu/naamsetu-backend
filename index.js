const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// Groq API Key from environment (SECRET!)
const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.post('/find-shlok', async (req, res) => {
  const { userProblem } = req.body;

  if (!userProblem || userProblem.trim().length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: "Please describe your problem" 
    });
  }

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: "llama-3.1-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a Bhagavad Gita expert. User problem: "${userProblem}"

Find BEST matching shlok from 700 total. Respond ONLY as JSON:
{
  "chapter": <1-18>,
  "verse": <number>,
  "confidence": <0-100>
}

ONLY JSON, nothing else.`
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
    console.error('Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: "Could not find matching shlok. Please try again." 
    });
  }
});

app.get('/', (req, res) => {
  res.json({ status: "Naamsetu Backend is running!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});