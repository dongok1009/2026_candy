export const sendTelegramMessage = async (rawToken, rawChatId, message) => {
  // Normalize inputs: remove whitespace and 'bot' prefix from token if present
  const token = rawToken ? rawToken.trim().replace(/^bot/, '') : '';
  const chatId = rawChatId ? rawChatId.toString().trim() : '';

  if (!token || !chatId) {
    console.warn('Telegram send failed: Token or Chat ID missing');
    return { 
      success: false, 
      error: 'Token or Chat ID missing',
      debugInfo: { tokenGiven: !!token, chatIdGiven: !!chatId }
    };
  }
  
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  // Create a timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    console.log('Sending Telegram message to:', chatId);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    if (data.ok) {
      console.log('Telegram message sent successfully');
      return { success: true };
    } else {
      console.error('Telegram API error response:', data);
      return { 
        success: false, 
        error: data.description,
        code: data.error_code,
        debugInfo: { 
          tokenStart: token.substring(0, 4) + '...',
          chatIdSent: chatId,
          fullResponse: data
        }
      };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('Telegram API request timed out');
      return { success: false, error: 'Request timed out (10s)' };
    }
    console.error('Telegram API fetch error:', error);
    return { success: false, error: error.message };
  }
};

export const getBotInfo = async (rawToken) => {
  const token = rawToken ? rawToken.trim().replace(/^bot/, '') : '';
  if (!token) return { success: false, error: 'Token missing' };

  const url = `https://api.telegram.org/bot${token}/getMe`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.ok) {
      return { success: true, botName: data.result.first_name, botUsername: data.result.username };
    } else {
      return { success: false, error: data.description };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};
