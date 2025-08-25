
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'nabeelhussain8873@gmail.com',
    pass: 'cakrmmmjdodmhpka',
  },
});

async function testEmail() {
  try {

    const info = await transporter.sendMail({
      from: 'nabeelhussain8873@gmail.com',
      to: 'nabeelhussain8873@gmail.com',
      subject: 'Test Email from HRMS',
      text: 'This is a test email to verify SMTP configuration.',
      html: '<h1>Test Email</h1><p>This is a test email to verify SMTP configuration.</p>',
    });

    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

testEmail();
