from rest_framework import serializers
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from .models import CustomUser, EmailVerificationCode, VerificationPurpose
from .services import create_verification_code, send_verification_code
from django.utils import timezone
from django.contrib.auth.hashers import check_password
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError


class RegisterSerializer(serializers.ModelSerializer):
    password_confirm = serializers.CharField(write_only=True)
    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'phone_number', 'password', 'password_confirm', 'first_name', 
            'last_name', 'role', 'is_email_verified', 'created_at', 'updated_at'
            ]
        read_only_fields = ['id', 'role', 'is_email_verified', 'created_at', 'updated_at']
        extra_kwargs = {
            'password':{'write_only':True},
        }

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')
        if password_confirm != password:
            raise serializers.ValidationError({'message':'Passwords do not match'})
        try:
            validate_password(password)
        except ValidationError as e:
            raise serializers.ValidationError({
                'password':e.messages
            })
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = CustomUser.objects.create_user(**validated_data)
        code = create_verification_code(user)
        send_verification_code(user.email, code)
        return user


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
    def validate(self, attrs):
        user = CustomUser.objects.filter(email=attrs.get('email')).first()
        if not user:
            raise serializers.ValidationError({
                'error':'Not such user'
            })
        verify_code = EmailVerificationCode.objects.filter(
            user=user, 
            purpose=VerificationPurpose.EMAIL_VERIFY,
            is_used=False
            ).order_by('-created_at').first()
        if not verify_code:
            raise serializers.ValidationError({
                'error':'Not such code'
            })
        if verify_code.attempts >= 5:
            raise serializers.ValidationError({
                'error':'More than 5 time, send code again'
            })
        if verify_code.expires_at < timezone.now():
            raise serializers.ValidationError({
                'error':"Code expired ! (Code's time Ended!)"
            })
        if not check_password(attrs.get('code'), verify_code.code_hash):
            verify_code.attempts += 1
            verify_code.save(update_fields=['attempts'])
            raise serializers.ValidationError({
                'error':'Wrong verification code'
            })
        attrs['user'] = user
        attrs['verify_code'] = verify_code

        return attrs

    def create(self, validated_data):
        user = validated_data['user']
        verify_code = validated_data['verify_code']

        user.is_email_verified = True
        user.save(update_fields=['is_email_verified'])

        verify_code.is_used = True
        verify_code.save(update_fields=['is_used'])

        return user


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate(self, attrs):
        user = CustomUser.objects.filter(email=attrs.get('email')).first()
        if not user:
            raise serializers.ValidationError({
                'error': 'No such user'
            })
        if user.is_email_verified:
            raise serializers.ValidationError({
                'message':"You've verified, just login"
            })
        attrs['user'] = user 
        return attrs

    def create(self, validated_data):
        user = validated_data['user']
        code = create_verification_code(user)
        send_verification_code(user.email, code)
        return user



class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            email=attrs.get('email'),
            password=attrs.get('password')
        )
        if not user:
            raise serializers.ValidationError(
                {'message':'Wrong password or username'}
            )
        if not user.is_email_verified:
            raise serializers.ValidationError(
                {'message':'Verify first'}
            )
        refresh = RefreshToken.for_user(user)
        access = refresh.access_token
        return {
            'refresh': str(refresh),
            'access': str(access),
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role
            }
        }

class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate(self, attrs):
        try:
            token = RefreshToken(attrs['refresh'])
            token.blacklist()
        except TokenError:
            raise serializers.ValidationError(
                {'message':'Invalid or expiredd refresh token'}
            )
        return attrs