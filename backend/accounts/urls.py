from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('register/', views.RegisterAPIView.as_view()),
    path('email-verify/', views.VerifyEmailAPIView.as_view()),
    path('resend-verification/', views.ResendVerificationAPIView.as_view()),
    path('login/', views.LoginAPIView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
    path('logout/', views.LogoutAPIView.as_view()),
    path('logout-all/', views.LogoutAllAPIView.as_view()),
    path('password/forgot/', views.PasswordForgotAPIView.as_view()),
    path('password/reset/', views.PasswordResetAPIView.as_view()),
    path('change/password/', views.PasswordChangeAPIView.as_view()),
]
