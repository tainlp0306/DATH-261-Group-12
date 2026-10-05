# Gmail SMTP Setup

The backend sends registration and password-reset OTPs through Gmail SMTP. Use a Gmail App Password, not the regular account password.

1. Enable 2-Step Verification on the Gmail account that will send LMS email.
2. Create an App Password for Mail in the Google Account security settings.
3. Copy `.env.example` to `.env` in the repository root. Set `EMAIL_HOST_USER` and `DEFAULT_FROM_EMAIL` to the same Gmail address, and set `EMAIL_HOST_PASSWORD` to the generated App Password. Enter the App Password without spaces.
4. Keep `.env` private. It is excluded by `.gitignore`; never commit the App Password.
5. Restart the backend with `docker compose up -d --build backend`.

The App Password is a server-side SMTP credential. Students use their own email addresses for verification; they never enter the sender's Gmail password into LingoSphere.
