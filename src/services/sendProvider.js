const Mailjet = require('node-mailjet');
const { mailjet, defaultFrom } = require('../config');
const logger = require('../utils/logger');

const mjClient = Mailjet.apiConnect(mailjet.apiKey, mailjet.apiSecret);

function buildMessage(payload) {
  const to = (payload.to || []).map(email => ({ Email: email }));
  const Attachments = (payload.attachments || []).map(a => ({
    ContentType: a.mimeType || 'application/octet-stream',
    Filename: a.filename,
    Base64Content: a.content
  }));

  const message = {
    From: { Email: defaultFrom },
    To: to,
    Subject: payload.subject,
    TextPart: payload.text,
    HTMLPart: payload.html,
  };
  if (Attachments.length) message.Attachments = Attachments;
  return message;
}

async function sendViaMailjet(msg) {
  try {
    const response = await mjClient.post('send', { version: 'v3.1' }).request({ Messages: [msg] });
    const status = response?.response?.status;
    if (status >= 200 && status < 300) {
      logger.info({ to: msg.To?.map(r => r.Email), subject: msg.Subject }, 'Email sent');
      return { success: true };
    }
    logger.error({ status, data: response?.body }, 'Mailjet non-2xx response');
    return { success: false, error: `Mailjet status ${status}` };
  } catch (err) {
    logger.error({ err }, 'Mailjet send failed');
    return { success: false, error: err.message };
  }
}

module.exports = { sendViaMailjet, buildMessage };
