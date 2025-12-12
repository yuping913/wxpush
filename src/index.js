async function getParams(request) {
  const { searchParams } = new URL(request.url);
  const urlParams = Object.fromEntries(searchParams.entries());
  let bodyParams = {};
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    try {
      if (contentType.includes('application/json')) {
        const jsonBody = await request.json();
        if (typeof jsonBody === 'string') {
          bodyParams = { content: jsonBody };
        } else if (jsonBody && typeof jsonBody === 'object') {
          if (jsonBody.params && typeof jsonBody.params === 'object') {
            bodyParams = jsonBody.params;
          } else if (jsonBody.data && typeof jsonBody.data === 'object') {
            bodyParams = jsonBody.data;
          } else {
            bodyParams = jsonBody;
          }
        }
      } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        bodyParams = Object.fromEntries(formData.entries());
      } else {
        const text = await request.text();
        if (text) {
          try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object') {
              if (parsed.params && typeof parsed.params === 'object') {
                bodyParams = parsed.params;
              } else if (parsed.data && typeof parsed.data === 'object') {
                bodyParams = parsed.data;
              } else {
                bodyParams = parsed;
              }
            } else {
              bodyParams = { content: text };
            }
          } catch (e) {
            bodyParams = { content: text };
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse request body:', error);
    }
  }
  return { ...urlParams, ...bodyParams };
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
}

export default {
  async fetch(request, env, ctx) {
    try {
    const url = new URL(request.url);
    
    if (url.pathname === '/2bd66b5c2b1194f7fbed82e59f8cac8d.txt') {
      return new Response('d7fd03efa806f32fd49df236a7ffa3057e24fed9', { 
        headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
      });
    }

    if (url.pathname === '/wxsend') {
      const params = await getParams(request);
      let requestToken = params.token;
      if (!requestToken) {
        const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
        if (authHeader) {
          const parts = authHeader.split(' ');
          requestToken = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : authHeader;
        }
      }

      if (!requestToken) {
        return new Response('Missing required parameter: token', { status: 400 });
      }

      const beijingTime = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
      const defaultDatetime = beijingTime.toISOString().slice(0, 19).replace('T', ' ');
      
      const source = params.source || params.title || '系统通知';
      const content = params.content || '您有新消息';
      const datetime = params.datetime || defaultDatetime;

      if (!env || !env.API_TOKEN || requestToken !== env.API_TOKEN) {
        return new Response('Invalid token', { status: 403 });
      }

      const appid = params.appid || env.WX_APPID;
      const secret = params.secret || env.WX_SECRET;
      const useridStr = params.userid || env.WX_USERID;
      const template_id = params.template_id || env.WX_TEMPLATE_ID;
      const base_url = params.base_url || env.WX_BASE_URL;

      if (!appid || !secret || !useridStr || !template_id) {
        return new Response('Missing required environment variables', { status: 500 });
      }

      const user_list = useridStr.split('|').map(uid => uid.trim()).filter(Boolean);

      try {
        const accessToken = await getStableToken(appid, secret);
        if (!accessToken) {
          return new Response('Failed to get access token', { status: 500 });
        }

        const results = await Promise.all(user_list.map(userid =>
          sendMessage(accessToken, userid, template_id, base_url, source, content, datetime, env.API_TOKEN)
        ));

        const successfulMessages = results.filter(r => r.errmsg === 'ok');

        if (successfulMessages.length > 0) {
          return new Response(`Successfully sent messages to ${successfulMessages.length} user(s)`, { status: 200 });
        } else {
          const firstError = results.length > 0 ? results[0].errmsg : "Unknown error";
          return new Response(`Failed to send messages: ${firstError}`, { status: 500 });
        }

      } catch (error) {
        console.error('Error:', error);
        return new Response(`An error occurred: ${error.message}`, { status: 500 });
      }
    }

    if (url.pathname === '/message') {
      if (!env || !env.API_TOKEN) {
        return new Response('Service not configured', { status: 500 });
      }
      const message = url.searchParams.get('message') || '';
      const date = url.searchParams.get('date') || '';
      const source = url.searchParams.get('source') || '';
      const sign = url.searchParams.get('sign') || '';
      
      const expectedSign = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source + message + date + env.API_TOKEN));
      const expectedSignHex = Array.from(new Uint8Array(expectedSign)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (sign !== expectedSignHex.substring(0, 16)) {
        return new Response('Invalid signature', { status: 403 });
      }
      
      const safeDecode = (str) => {
        try {
          return decodeURIComponent(str);
        } catch (e) {
          return str;
        }
      };
      
      const sanitizeHtml = (str) => {
        return str.replace(/<script[^>]*>.*?<\/script>/gi, '')
                  .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                  .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi, '$1 $2')
                  .replace(/<a[^>]*>/gi, '')
                  .replace(/<\/a>/gi, '')
                  .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
                  .replace(/javascript:/gi, '');
      };
      
      const safeSource = escapeHtml(safeDecode(source));
      const safeMessage = sanitizeHtml(safeDecode(message));
      const safeDate = escapeHtml(safeDecode(date));
      
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>消息</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f5f5f5;padding:20px}h1{font-size:20px;margin-bottom:20px;color:#333}.box{background:#fff;padding:15px;margin:10px 0;border-radius:8px;line-height:1.6;color:#666}.box strong{color:#333;display:block;margin-bottom:8px}.content{color:#333;word-wrap:break-word}</style></head><body><h1>消息详情</h1><div class="box"><strong>来源</strong><div>${safeSource}</div></div><div class="box"><strong>内容</strong><div class="content">${safeMessage}</div></div><div class="box"><strong>时间</strong><div>${safeDate}</div></div></body></html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WXPush</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f5f5f5;padding:20px;text-align:center}h1{font-size:28px;margin:40px 0 20px;color:#333}p{color:#666;line-height:1.8;margin:10px 0}</style></head><body><h1>WXPush</h1><p>微信消息推送服务</p><p>作者: 饭奇骏</p></body></html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not Found', { status: 404 });
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
};

async function getStableToken(appid, secret) {
  const tokenUrl = 'https://api.weixin.qq.com/cgi-bin/stable_token';
  const payload = {
    grant_type: 'client_credential',
    appid: appid,
    secret: secret,
    force_refresh: false
  };
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return data.access_token;
}

async function sendMessage(accessToken, userid, template_id, base_url, source, content, datetime, apiToken) {
  const sendUrl = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`;

  const encoded_message = encodeURIComponent(content);
  const encoded_date = encodeURIComponent(datetime);
  const encoded_source = encodeURIComponent(source);
  
  const signData = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source + content + datetime + apiToken));
  const sign = Array.from(new Uint8Array(signData)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

  const shortSource = source.length > 38 ? source.substring(0, 38) + '...' : source;
  const shortContent = content.length > 38 ? content.substring(0, 38) + '...' : content;
  const shortDatetime = datetime.length > 38 ? datetime.substring(0, 38) : datetime;

  const payload = {
    touser: userid,
    template_id: template_id,
    url: `${base_url}?message=${encoded_message}&date=${encoded_date}&source=${encoded_source}&sign=${sign}`,
    data: {
      SOURCE: { value: shortSource },
      CONTENT: { value: shortContent },
      DATETIME: { value: shortDatetime }
    }
  };

  const response = await fetch(sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  return await response.json();
}
