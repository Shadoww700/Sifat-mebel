import secrets
from django.contrib.auth.hashers import make_password
from datetime import timedelta
from django.utils import timezone
from .models import EmailVerificationCode, VerificationPurpose
from django.core.mail import send_mail
from django.conf import settings


def generate_verification_code():
    return f'{secrets.randbelow(1000000):06d}'


def create_verification_code(
            user, 
            purpose=VerificationPurpose.EMAIL_VERIFY
        ):
    EmailVerificationCode.objects.filter(
        user=user,
        purpose=purpose,
        is_used=False
    ).update(is_used=True)
    
    code = generate_verification_code()
    code_hash = make_password(code)
    expires_at = timezone.now() + timedelta(minutes=10)

    EmailVerificationCode.objects.create(
        user=user,
        code_hash=code_hash,
        purpose=purpose,
        expires_at=expires_at
    )
    return code


def send_verification_code(email, code):
    send_mail(
        subject='Sifat-Mebel ~ Email verification',
        message=f'Your verification code : {code}',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False
    )

def send_reset_password_code(email, code):
    send_mail(
        subject='Sifat-Mebel ~ Reset password',
        message=f'You password reset code \n{code}\n',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False
    )