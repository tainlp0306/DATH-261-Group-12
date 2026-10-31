from email.utils import parseaddr

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend


class EmailDeliveryError(Exception):
    def __init__(self, message, *, provider_status=None, cause_type=None):
        super().__init__(message)
        self.provider_status = provider_status
        self.cause_type = cause_type


class MailjetEmailBackend(BaseEmailBackend):
    api_url = 'https://api.mailjet.com/v3.1/send'

    def _address(self, value):
        name, email = parseaddr(value or '')
        if not email:
            raise EmailDeliveryError('A valid sender or recipient email is required.')
        address = {'Email': email}
        if name:
            address['Name'] = name
        return address

    def _payload(self, message):
        if message.attachments:
            raise EmailDeliveryError('The Mailjet email backend does not support attachments.')

        payload = {
            'From': self._address(message.from_email or settings.DEFAULT_FROM_EMAIL),
            'To': [self._address(address) for address in message.to],
            'Subject': message.subject or '',
        }
        if message.cc:
            payload['Cc'] = [self._address(address) for address in message.cc]
        if message.bcc:
            payload['Bcc'] = [self._address(address) for address in message.bcc]
        if message.reply_to:
            payload['ReplyTo'] = self._address(message.reply_to[0])

        html_body = next(
            (
                content
                for content, mimetype in getattr(message, 'alternatives', ())
                if mimetype == 'text/html'
            ),
            None,
        )
        if html_body is not None:
            payload['HTMLPart'] = html_body
        else:
            payload['TextPart'] = message.body or ''
        return payload

    def _send_message(self, message):
        api_key = getattr(settings, 'MAILJET_API_KEY', '')
        secret_key = getattr(settings, 'MAILJET_SECRET_KEY', '')
        if not api_key or not secret_key:
            raise EmailDeliveryError('Mailjet API credentials are not configured.')

        try:
            response = requests.post(
                self.api_url,
                auth=(api_key, secret_key),
                headers={'accept': 'application/json'},
                json={'Messages': [self._payload(message)]},
                timeout=(5, 20),
            )
        except requests.RequestException as error:
            raise EmailDeliveryError(
                'Mailjet API request failed.',
                cause_type=type(error).__name__,
            ) from error

        if not 200 <= response.status_code < 300:
            raise EmailDeliveryError(
                f'Mailjet returned HTTP {response.status_code}.',
                provider_status=response.status_code,
            )

        try:
            result = response.json()
        except ValueError as error:
            raise EmailDeliveryError(
                'Mailjet returned an invalid response.',
                provider_status=response.status_code,
            ) from error

        messages = result.get('Messages', []) if isinstance(result, dict) else []
        if not isinstance(messages, list) or not messages or any(
            not isinstance(item, dict) or item.get('Status') != 'success'
            for item in messages
        ):
            raise EmailDeliveryError(
                'Mailjet did not accept the email.',
                provider_status=response.status_code,
            )

    def send_messages(self, email_messages):
        sent = 0
        for message in email_messages:
            if not message.recipients():
                continue
            try:
                self._send_message(message)
            except EmailDeliveryError:
                if not self.fail_silently:
                    raise
                continue
            sent += 1
        return sent
