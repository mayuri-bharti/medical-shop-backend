/**
 * Notification Service
 * Handles sending notifications via email and SMS
 */

import { sendOtpSms } from './otpProvider.js'
import nodemailer from 'nodemailer'

/**
 * Send email notification
 */
const sendEmail = async (to, subject, htmlContent, textContent) => {
  try {
    // Check if email is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('📧 Email not configured, skipping email notification')
      console.log('📧 Email would be sent to:', to)
      console.log('📧 Subject:', subject)
      return { success: false, reason: 'Email not configured' }
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'HealthPlus'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      text: textContent,
      html: htmlContent
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('✅ Email sent successfully:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('❌ Failed to send email:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Send SMS notification
 */
const sendSms = async (phone, message) => {
  try {
    const result = await sendOtpSms(phone, message)
    return { success: true, ...result }
  } catch (error) {
    console.error('❌ Failed to send SMS:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Notify user about admin reply to contact message
 */
export const notifyContactReply = async (contactMessage, adminName) => {
  const notifications = []

  // Prepare email content
  const emailSubject = 'Response to your enquiry - HealthPlus'
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Response to Your Enquiry</h2>
      <p>Dear ${contactMessage.name},</p>
      <p>Thank you for contacting HealthPlus. We have received your enquiry and our team has responded:</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; white-space: pre-wrap;">${contactMessage.adminReply}</p>
      </div>
      <p><strong>Your Original Message:</strong></p>
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <p style="margin: 0; white-space: pre-wrap;">${contactMessage.message}</p>
      </div>
      <p>If you have any further questions, please don't hesitate to contact us again.</p>
      <p>Best regards,<br>${adminName || 'HealthPlus Team'}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
    </div>
  `
  const emailText = `
Response to Your Enquiry

Dear ${contactMessage.name},

Thank you for contacting HealthPlus. We have received your enquiry and our team has responded:

${contactMessage.adminReply}

Your Original Message:
${contactMessage.message}

If you have any further questions, please don't hesitate to contact us again.

Best regards,
${adminName || 'HealthPlus Team'}
  `

  // Send email if email exists
  if (contactMessage.email) {
    const emailResult = await sendEmail(
      contactMessage.email,
      emailSubject,
      emailHtml,
      emailText
    )
    notifications.push({ type: 'email', ...emailResult })
  }

  // Send SMS if phone exists
  if (contactMessage.phone) {
    const smsMessage = `HealthPlus: Hi ${contactMessage.name}, we've responded to your enquiry. Check your email (${contactMessage.email || 'registered email'}) for details. Thank you!`
    const smsResult = await sendSms(contactMessage.phone, smsMessage)
    notifications.push({ type: 'sms', ...smsResult })
  }

  return notifications
}

/**
 * Notify user about account creation
 */
export const notifyAccountCreated = async (user, password) => {
  const notifications = []

  // Prepare email content
  const emailSubject = 'Welcome to HealthPlus - Your Account is Ready!'
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Welcome to HealthPlus!</h2>
      <p>Dear ${user.name || 'User'},</p>
      <p>Your account has been successfully created. You can now access all our services!</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Your Account Details:</strong></p>
        <p>Email: ${user.email || 'N/A'}</p>
        <p>Phone: ${user.phone || 'N/A'}</p>
        ${password ? `<p><strong>Password:</strong> ${password}</p><p style="color: #dc2626; font-size: 12px;">Please change your password after first login.</p>` : ''}
      </div>
      <p>You can now:</p>
      <ul>
        <li>Browse and order medicines</li>
        <li>Upload prescriptions</li>
        <li>Track your orders</li>
        <li>Manage your profile</li>
      </ul>
      <p>Thank you for choosing HealthPlus!</p>
      <p>Best regards,<br>HealthPlus Team</p>
    </div>
  `

  // Send email if email exists
  if (user.email) {
    const emailResult = await sendEmail(
      user.email,
      emailSubject,
      emailHtml,
      emailHtml.replace(/<[^>]*>/g, '')
    )
    notifications.push({ type: 'email', ...emailResult })
  }

  // Send SMS if phone exists
  if (user.phone) {
    const smsMessage = `Welcome to HealthPlus! Your account has been created. ${password ? `Password: ${password}` : 'You can login with your phone number.'} Visit us to get started!`
    const smsResult = await sendSms(user.phone, smsMessage)
    notifications.push({ type: 'sms', ...smsResult })
  }

  return notifications
}

export default {
  sendEmail,
  sendSms,
  notifyContactReply,
  notifyAccountCreated
}

