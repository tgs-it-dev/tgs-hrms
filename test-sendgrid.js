const sgMail = require('@sendgrid/mail');

// Set your SendGrid API key
sgMail.setApiKey('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');

async function testSendGrid() {
  const msg = {
    to: 'nabeelhussain8873@gmail.com',
    from: 'nabeelhussain8873@gmail.com',
    subject: 'Test Email from HRMS - SendGrid',
    text: 'This is a test email to verify SendGrid configuration.',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Test Email from HRMS</h2>
        <p>This is a test email to verify SendGrid configuration.</p>
        <p>If you receive this email, SendGrid is working correctly!</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">This is an automated test message.</p>
      </div>
    `,
  };

  try {
    const result = await sgMail.send(msg);
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result[0].headers['x-message-id']);
    console.log('Status Code:', result[0].statusCode);
  } catch (error) {
    console.error('❌ Error sending email:', error);
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
  }
}

testSendGrid();
