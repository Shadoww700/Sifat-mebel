from django.contrib.auth.models import AbstractUser
from django.db import models 

from .managers import CustomUserManager
from django.conf import settings


class UserRole(models.TextChoices):
    USER = 'USER', 'USER'
    MANAGER = 'MANAGER', 'MANAGER'
    ADMIN = 'ADMIN', 'ADMIN'


class CustomUser(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20, blank=True)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.USER,
    )
    is_email_verified = models.BooleanField(
        default=False
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email




class VerificationPurpose(models.TextChoices):
    EMAIL_VERIFY = "EMAIL_VERIFY", "Email verification"
    PASSWORD_RESET = "PASSWORD_RESET", "Password reset"


class EmailVerificationCode(models.Model):
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='verification_codes'
    )
    code_hash = models.CharField(max_length=255)
    purpose = models.CharField(
        max_length=30,
        choices=VerificationPurpose.choices,
        default=VerificationPurpose.EMAIL_VERIFY,
    )
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user.email} - {self.purpose}'


class Profile(models.Model):
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    avatar = models.ImageField(
        upload_to='profiles/',
        blank=True,
        null=True
    )
    birth_date = models.DateField(blank=True, null=True)
    created_at = models.DateField(auto_now_add=True)
    updated_at = models.DateField(auto_now=True)

    def __str__(self):
        return self.user.email



class Address(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='addresses'
    )
    title = models.CharField(max_length=100)
    recipient_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=30)
    country = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    city = models.CharField(max_length=100)
    district = models.CharField(
        max_length=100,
        blank=True
    )
    street = models.CharField(max_length=255)
    house = models.CharField(max_length=50)

    apartment = models.CharField(
        max_length=50,
        blank=True
    )
    landmark = models.CharField(
        max_length=255,
        blank=True
    )
    postal_code = models.CharField(
        max_length=20,
        blank=True
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True
    )
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)