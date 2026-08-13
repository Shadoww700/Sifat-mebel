from rest_framework import serializers
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from .models import CustomUser
from .services import create_verification_code, send_verification_code


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