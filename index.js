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
    console.error(' ERROR:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Could not find matching shlok"
    });
  }
});

// Endpoint 2 - Get Human-like Answer + Personalized Tips
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
            content: `तुम श्री कृष्ण हो। एक भक्त ने अपनी समस्या/प्रश्न पूछा है।

IMPORTANT RULES:

1. USER का SPECIFIC प्रश्न समझो:
   - अगर user पूछ रहा है "क्या करूँ?" → Clear answer दो
   - अगर user confused है "A करूँ या B?" → Shlok के आधार पर बताओ कौन सा विकल्प सही है
   - अगर user problem बता रहा है → उसका solution दो
   
2. श्लोक के आधार पर ही answer दो:
   - इस श्लोक में क्या कहा गया है?
   - यह श्लोक user की situation पर कैसे apply होता है?
   - इस श्लोक के अनुसार user को क्या करना चाहिए?

3. Decision Questions का Clear Answer:
   Example: "क्या मैं अभी job start करूँ या बाद में?"
   Answer: "पुत्र, इस श्लोक के अनुसार, तुम्हें अभी action लेना चाहिए क्योंकि..."
   - Clear recommendation दो
   - Shlok से reason बताओ
   - Confusion दूर करो

4. Structure:
   वाक्य 1: User के प्रश्न को acknowledge करो
   वाक्य 2: श्लोक क्या कहता है (relevant part)
   वाक्य 3: तुम्हारे प्रश्न का उत्तर (clear & specific)
   वाक्य 4: Action step (क्या करना है)

5. भाषा: शुद्ध हिंदी, conversational
6. Length: 3-4 वाक्य max
7. Tone: मार्गदर्शक, आश्वस्त करने वाला

EXAMPLES:

User: "क्या मैं अभी शादी करूँ या career पर focus करूँ?"
Shlok: 2.47 (कर्मण्येवाधिकारस्ते...)
Answer: "पुत्र, इस श्लोक में कहा गया है कि तुम्हें केवल अपने कर्म पर ध्यान देना है, निर्णय की चिंता नहीं। इसलिए जो भी तुम्हारा वर्तमान कर्तव्य है, उसे पूरी निष्ठा से करो। शादी या career - दोनों में से किसी एक को चुनो और उसे पूर्ण समर्पण से करो। निर्णय लेने में समय मत गंवाओ।"

User: "मुझे बहुत confusion है, क्या करूँ?"
Shlok: 2.50 (योगस्थ कुरु कर्माणि...)
Answer: "भक्त, confusion का कारण है - फल की चिंता। इस श्लोक के अनुसार, योग में स्थित होकर कर्म करो - यानी समत्व भाव से। अपनी पूरी ऊर्जा action में लगाओ, परिणाम की चिंता छोड़ो। confusion अपने आप दूर हो जाएगा।"

User: "क्या मैं इस job को छोड़ दूँ?"
Shlok: 3.35 (श्रेयान्स्वधर्मो विगुणः...)
Answer: "पुत्र, इस श्लोक में कहा गया है कि अपना धर्म दूसरे के धर्म से श्रेष्ठ है। इसलिए बिना सोचे-समझे job मत छोड़ो। पहले देखो - क्या यह तुम्हारा स्वधर्म है? यदि हाँ, तो इसमें ही स्थिर रहो। यदि नहीं, तो ही परिवर्तन का विचार करो।"

TIPS के लिए:
User की problem के आधार पर 3-4 practical tips दो:
1. Jap motivation (108/1008 times)
2. Share dharma with others
3. Punya benefits
4. Specific action for THEIR question`
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

    // Generate personalized tips
    const tips = generatePersonalizedTips(userProblem);

    console.log('✅ Grok Answer Generated');

    res.json({
      success: true,
      answer: cleanAnswer,
      tips: tips
    });

  } catch (error) {
    console.error('❌ Grok Error:', error.message);
    res.status(500).json({
      success: false,
      error: "Could not generate answer"
    });
  }
});

// Helper function to generate personalized tips with Jap motivation
function generatePersonalizedTips(problem) {
  const tips = [];
  const problemLower = problem.toLowerCase();
  const randomNum = Math.floor(Math.random() * 100);

  // Tip 1: Jap motivation (always include)
  const japTips = [
    "🕉️ अभी NaamSetu app खोलो और 108 बार नाम जाप करो - तुम्हारी समस्या का समाधान होगा",
    "🙏 आज 1008 बार जाप का संकल्प लो - यह तुम्हारे लिए चमत्कार लाएगा",
    "✨ रोज 108 बार जाप करो - धीरे-धीरे सब ठीक होता जाएगा",
    "🌟 अभी 21 बार जाप करो और देखो कैसे मन शांत होता है",
    "💫 108 बार जाप सबसे पवित्र होता है - अभी शुरू करो"
  ];

  // Tip 2: Share dharma with others
  const shareTips = [
    "👥 अपने किसी प्रियजन को भी जाप करने के लिए प्रेरित करो - इससे तुम्हारा पुण्य बढ़ेगा",
    "💫 किसी मित्र को NaamSetu app के बारे में बताओ - दूसरों को धर्म की राह पर लाना सबसे बड़ा पुण्य है",
    "🌺 अपने परिवार को जाप के लिए प्रोत्साहित करो - साथ मिलकर जाप करने से शक्ति बढ़ती है",
    "⭐ आज किसी एक व्यक्ति को जाप करने के लिए कहो - यह तुम्हारा सबसे बड़ा उपकार होगा",
    "📱 अपने दोस्तों को यह app share करो - दूसरों की मदद करने से तुम्हारी मदद होगी"
  ];

  // Tip 3: Punya benefits
  const punyaTips = [
    "🎯 किसी को नाम जप करवाना सबसे बड़ा पुण्य है - आज कोई एक व्यक्ति ज़रूर प्रेरित करो",
    " जब तुम दूसरों को धर्म की राह पर लाते हो, तो तुम्हारे सभी पाप नष्ट हो जाते हैं",
    "🌟 एक व्यक्ति को जाप सिखाना = 100 यज्ञ करने के बराबर पुण्य",
    "✨ दूसरों की आध्यात्मिक मदद करना सबसे बड़ा दान है",
    " जब तुम किसी को जाप करवाते हो, तो भगवान तुम्हारी सभी मनोकामनाएँ पूरी करते हैं"
  ];

  // Tip 4: Problem-specific tips
  let specificTip = "";
  
  if (problemLower.includes('शादी') || problemLower.includes('marriage') || problemLower.includes('relationship')) {
    specificTip = "💑 जाप करते समय अपने जीवनसाथी के लिए प्रार्थना करो - सही समय पर सब होगा";
  } 
  else if (problemLower.includes('करियर') || problemLower.includes('job') || problemLower.includes('career') || problemLower.includes('नौकरी') || problemLower.includes('काम')) {
    specificTip = "💼 जाप के बाद अपने कर्म पर पूरा ध्यान दो - सफलता अवश्य मिलेगी";
  }
  else if (problemLower.includes('confusion') || problemLower.includes('confused') || problemLower.includes('क्या करूँ') || problemLower.includes('decision')) {
    specificTip = "🧘 confusion दूर करने के लिए 108 बार जाप करो - मन स्पष्ट हो जाएगा और सही मार्ग दिखेगा";
  }
  else if (problemLower.includes('पैसा') || problemLower.includes('money') || problemLower.includes('financial')) {
    specificTip = "💰 जाप से पहले दान का संकल्प लो - धन का प्रवाह बढ़ेगा";
  }
  else if (problemLower.includes('तनाव') || problemLower.includes('stress') || problemLower.includes('anxiety') || problemLower.includes('depression')) {
    specificTip = "🧘 गहरी सांस लो और 108 बार जाप करो - मन तुरंत शांत होगा";
  }
  else if (problemLower.includes('परिवार') || problemLower.includes('family') || problemLower.includes('parents')) {
    specificTip = "👨‍👩‍👧‍👦 पूरे परिवार के साथ मिलकर जाप करो - घर में सुख-शांति आएगी";
  }
  else if (problemLower.includes('स्वास्थ्य') || problemLower.includes('health') || problemLower.includes('बीमार')) {
    specificTip = "🏥 जाप के साथ प्रार्थना करो - स्वास्थ्य में सुधार होगा";
  }
  else if (problemLower.includes('पढ़ाई') || problemLower.includes('study') || problemLower.includes('exam')) {
    specificTip = "📚 परीक्षा से पहले 108 बार जाप करो - एकाग्रता बढ़ेगी";
  }
  else {
    specificTip = "🌟 रोज सुबह उठकर सबसे पहले 108 बार जाप करो - पूरा दिन मंगलमय होगा";
  }

  // Select tips based on random number for variety
  tips.push(japTips[randomNum % japTips.length]);
  tips.push(shareTips[randomNum % shareTips.length]);
  tips.push(punyaTips[randomNum % punyaTips.length]);
  tips.push(specificTip);

  return tips;
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
  console.log(` API Key configured: ${!!GROQ_API_KEY}`);
});
