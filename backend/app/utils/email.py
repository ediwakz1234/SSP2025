import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

def send_reset_email(to_email: str, reset_link: str):
    """Send password reset email with reset link."""
    sender_email = settings.MAIL_USERNAME
    sender_password = settings.MAIL_PASSWORD
    subject = "Password Reset Request"
    body = f"""
    Hi there,
    
    We received a request to reset your password.
    Click the link below to set a new password:
    {reset_link}

    This link will expire in 1 hour.

    If you didn't request this, just ignore this email.
    """

    msg = MIMEMultipart()
    msg["From"] = sender_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        # Works for Gmail/Outlook/Yahoo if "less secure apps" is enabled
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
        print(f"✅ Reset email sent to {to_email}")
    except Exception as e:
        print(f"❌ Email failed: {e}")
